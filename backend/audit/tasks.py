from celery import shared_task
from django.conf import settings
from .models import Report
import subprocess
import json
import os
import google.generativeai as genai
from playwright.sync_api import sync_playwright
from django.core.files import File

def take_screenshot(url, report_id):
    """Captures a screenshot and returns the browser executable path."""
    screenshot_path = f"/tmp/screenshot_{report_id}.png"
    executable_path = None
    
    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=True)
        executable_path = p.chromium.executable_path
        
        # New context and page
        page = browser.new_page()
        page.goto(url, timeout=60000) # 60s timeout for page load
        page.screenshot(path=screenshot_path, full_page=False)
        browser.close()
        
    return screenshot_path, executable_path

def run_lighthouse(url, executable_path, report_id):
    """Runs Lighthouse audit and returns the JSON data."""
    lighthouse_report_path = f"/tmp/report_{report_id}.json"
    
    cmd = [
        "lighthouse",
        url,
        "--output=json",
        f"--output-path={lighthouse_report_path}",
        "--chrome-flags=--headless --no-sandbox --disable-gpu"
    ]
    
    # Set CHROME_PATH environment variable
    env = os.environ.copy()
    if executable_path:
        env['CHROME_PATH'] = executable_path
    
    try:
        # Added timeout=120s protection
        subprocess.run(
            cmd, 
            check=True, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE, 
            env=env,
            timeout=120
        )
    except subprocess.TimeoutExpired:
        raise Exception("Lighthouse audit timed out after 120 seconds.")
    except subprocess.CalledProcessError as e:
        error_msg = f"Lighthouse command failed with exit code {e.returncode}."
        if e.stderr:
            error_msg += f"\nStderr: {e.stderr.decode()}"
        if e.stdout:
            error_msg += f"\nStdout: {e.stdout.decode()}"
        raise Exception(error_msg)
        
    with open(lighthouse_report_path, 'r', encoding='utf-8') as f:
        lighthouse_data = json.load(f)
        
    return lighthouse_data, lighthouse_report_path

def generate_ai_summary(lighthouse_data, url):
    """Generates an AI summary using Gemini."""
    try:
        gemini_api_key = settings.GEMINI_API_KEY
        if not gemini_api_key:
            return "Gemini API Key not configured."

        genai.configure(api_key=gemini_api_key)
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Prepare findings
        audit_findings = []
        audits = lighthouse_data.get('audits', {})
        
        for key, audit in audits.items():
            score = audit.get('score')
            if score is not None and score < 0.9:
                title = audit.get('title')
                display_value = audit.get('displayValue', '')
                audit_findings.append({
                    'score': score,
                    'text': f"- {title} (Value: {display_value})"
                })
        
        audit_findings.sort(key=lambda x: x['score'])
        top_findings = [item['text'] for item in audit_findings[:15]]
        
        findings_text = "\n".join(top_findings)
        if not top_findings:
            findings_text = "No major performance issues found. All audits passed with a score >= 0.9."

        prompt = (
            f"You are a web performance analyst.\n\n"
            f"Context:\n"
            f"The following Lighthouse audit findings are extracted directly from a performance report for {url}.\n"
            f"The issues are already filtered and sorted from worst to least severe.\n\n"
            f"Audit Findings:\n"
            f"{findings_text}\n\n"
            f"STRICT RULES:\n"
            f"1. ONLY use the issues listed above. Do NOT invent or assume any additional problems.\n"
            f"2. If no major issues are listed, clearly state that performance is strong and no critical bottlenecks were detected.\n"
            f"3. Prioritize the most severe issues first.\n"
            f"4. Keep the tone professional and factual.\n"
            f"5. Do NOT exaggerate business impact.\n\n"
            f"OUTPUT FORMAT (JSON ONLY):\n"
            f"{{\n"
            f'  "overall_assessment": "Short 1-2 sentence summary of the overall performance.",\n'
            f'  "issues": [\n'
            f'    {{\n'
            f'      "title": "Issue Name (e.g. Reduce Unused JavaScript)",\n'
            f'      "explanation": "Brief explanation of what is happening.",\n'
            f'      "impact": "Specific business impact (e.g. Slows down initial page load, increasing bounce rate).",\n'
            f'      "suggestion": "Specific technical recommendation on how to fix this issue (e.g. Use Next.js Script component with strategy=\'lazyOnload\').",\n'
            f'      "severity": "High" | "Medium" | "Low"\n'
            f'    }}\n'
            f'  ]\n'
            f"}}\n\n"
            f"Provide RAW JSON only. Do not wrap in markdown code blocks."
        )
        
        response = model.generate_content(prompt)
        
        # Clean response if it contains markdown code blocks
        text = response.text.strip()
        # Remove potential markdown code blocks
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
            
        # Additional cleanup for safety
        text = text.strip()
            
        return text
    except Exception as e:
        print(f"AI Summary failed: {e}")
        # Return a fallback JSON structure for UI consistency
        fallback = {
            "overall_assessment": f"AI Summary unavailable due to error: {str(e)}",
            "issues": []
        }
        return json.dumps(fallback)

@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def run_audit(self, report_id):
    url = None # Fix 1: Initialize url safely
    screenshot_path = None
    lighthouse_report_path = None
    
    try:
        report = Report.objects.get(id=report_id)
        url = report.url
        report.status = 'processing'
        report.save()

        print(f"Starting audit for {url}")

        # 1. Playwright Screenshot
        screenshot_path, executable_path = take_screenshot(url, report_id)
        
        # Save screenshot immediately to DB so frontend progress UI updates
        with open(screenshot_path, 'rb') as f:
            report.screenshot.save(f"screenshot_{report_id}.png", File(f), save=True)

        # 2. Lighthouse Audit
        lighthouse_data, lighthouse_report_path = run_lighthouse(url, executable_path, report_id)
        
        # Extract score and save to DB immediately to trigger frontend Stage 3
        performance_score = int(lighthouse_data.get('categories', {}).get('performance', {}).get('score', 0) * 100)
        report.lighthouse_json = lighthouse_data
        report.performance_score = performance_score
        report.save(update_fields=['lighthouse_json', 'performance_score'])

        # 3. AI Summary
        report.ai_summary = generate_ai_summary(lighthouse_data, url)

        report.status = 'completed'
        report.save(update_fields=['ai_summary', 'status'])

        # Cleanup
        if screenshot_path and os.path.exists(screenshot_path):
            os.remove(screenshot_path)
        if lighthouse_report_path and os.path.exists(lighthouse_report_path):
            os.remove(lighthouse_report_path)
            
        return f"Audit completed for {url}"

    except Exception as e:
        print(f"Error auditing report_id={report_id}: {e}") # Fix 1: Safe logging
        
        # Fix 3: Retry logic
        try:
            # Only retry if it's NOT a hard logic error (like 404 on DB get)
            # But here we catch general Exception, so we can retry on network glitches
            raise self.retry(exc=e)
        except self.MaxRetriesExceededError:
            if 'report' in locals():
                report.status = 'failed'
                report.ai_summary = f"Error: {str(e)}"
                report.save()
            return f"Audit failed for report_id={report_id}: {e}"
