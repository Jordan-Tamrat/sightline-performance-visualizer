from celery import shared_task
from django.conf import settings
from .models import Report
import subprocess
import json
import os
import google.generativeai as genai
from playwright.sync_api import sync_playwright
from django.core.files import File
from django.utils import timezone

@shared_task
def run_audit(report_id):
    try:
        report = Report.objects.get(id=report_id)
        report.status = 'processing'
        report.save()

        url = report.url
        print(f"Starting audit for {url}")

        # 1. Playwright: Screenshot
        screenshot_path = f"/tmp/screenshot_{report_id}.png"
        chrome_path = None
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            executable_path = p.chromium.executable_path # Get path here
            page = browser.new_page()
            page.goto(url)
            page.screenshot(path=screenshot_path, full_page=False)
            browser.close()
        
        # Save screenshot to model
        with open(screenshot_path, 'rb') as f:
            report.screenshot.save(f"screenshot_{report_id}.png", File(f), save=False)
        
        # 2. Lighthouse Audit
        lighthouse_report_path = f"/tmp/report_{report_id}.json"
        # Run lighthouse CLI
        # Note: In Docker, we need --no-sandbox and potentially --chrome-flags
        cmd = [
            "lighthouse",
            url,
            "--output=json",
            f"--output-path={lighthouse_report_path}",
            "--chrome-flags=--headless --no-sandbox --disable-gpu"
        ]
        
        # Set CHROME_PATH environment variable for lighthouse
        env = os.environ.copy()
        if executable_path:
            env['CHROME_PATH'] = executable_path
        
        try:
            subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
        except subprocess.CalledProcessError as e:
            error_msg = f"Lighthouse command failed with exit code {e.returncode}."
            if e.stderr:
                error_msg += f"\nStderr: {e.stderr.decode()}"
            if e.stdout:
                error_msg += f"\nStdout: {e.stdout.decode()}"
            raise Exception(error_msg)
        
        with open(lighthouse_report_path, 'r', encoding='utf-8') as f:
            lighthouse_data = json.load(f)
        
        # Extract performance score (0-1) -> (0-100)
        performance_score = int(lighthouse_data.get('categories', {}).get('performance', {}).get('score', 0) * 100)
        
        report.lighthouse_json = lighthouse_data
        report.performance_score = performance_score
        
        # 3. AI Summary with Gemini
        try:
            gemini_api_key = settings.GEMINI_API_KEY
            if gemini_api_key:
                genai.configure(api_key=gemini_api_key)
                model = genai.GenerativeModel('gemini-2.5-flash')
                
                # Prepare prompt
                audit_findings = []
                audits = lighthouse_data.get('audits', {})
                
                # Extract failing audits
                for key, audit in audits.items():
                    score = audit.get('score')
                    # Consider audits with a score < 0.9 (Needs Improvement or Poor)
                    # Also skip audits that are informative only (score is None) or manual checks
                    if score is not None and score < 0.9:
                        title = audit.get('title')
                        display_value = audit.get('displayValue', '')
                        # description = audit.get('description') # Description is often generic, so we skip it to reduce hallucination risk unless needed
                        
                        # Format: "- Title (Value): Description"
                        # We use displayValue to give the AI context on magnitude (e.g., "2,500 ms" or "150 KiB")
                        audit_findings.append({
                            'score': score,
                            'text': f"- {title} (Value: {display_value})"
                        })
                
                # Sort by score ascending (lowest score first) to prioritize worst issues
                audit_findings.sort(key=lambda x: x['score'])
                
                # Take top 15 issues
                top_findings = [item['text'] for item in audit_findings[:15]]
                findings_text = "\n".join(top_findings)
                
                if not top_findings:
                    findings_text = "No major performance issues found. All audits passed with a score >= 0.9."

                prompt = (
                    f"I am building a web performance visualizer. Analyze these specific Lighthouse performance findings for {url}:\n\n"
                    f"{findings_text}\n\n"
                    "INSTRUCTIONS:\n"
                    "1. STRICTLY base your summary ONLY on the findings listed above. Do NOT hallucinate or assume issues that are not present in the list.\n"
                    "2. Summarize the findings into 3 bullet points for a non-tech client.\n"
                    "3. Focus on what is slowing down the site and the business impact (e.g., user bounce rate, SEO).\n"
                    "4. If the list is empty or contains only minor issues, state that the site is performing well."
                )
                
                response = model.generate_content(prompt)
                report.ai_summary = response.text
            else:
                report.ai_summary = "Gemini API Key not configured."
        except Exception as ai_error:
            print(f"AI Summary failed: {ai_error}")
            report.ai_summary = f"AI Summary unavailable due to error: {str(ai_error)}"

        report.status = 'completed'
        report.save()

        # Cleanup
        if os.path.exists(screenshot_path):
            os.remove(screenshot_path)
        if os.path.exists(lighthouse_report_path):
            os.remove(lighthouse_report_path)
            
        return f"Audit completed for {url}"

    except Exception as e:
        print(f"Error auditing {url}: {e}")
        if 'report' in locals():
            report.status = 'failed'
            report.ai_summary = f"Error: {str(e)}"
            report.save()
        return f"Audit failed for {url}: {e}"
