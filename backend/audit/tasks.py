from celery import shared_task
from django.conf import settings
from .models import Report
import subprocess
import json
import os
import google.generativeai as genai
from playwright.sync_api import sync_playwright
from django.core.files import File
import time

# Helper functions consolidated into run_audit for strict session management

def run_lighthouse(url, report_id, port=9222, chrome_path=None):
    """Runs Lighthouse audit attached to an existing Chrome instance."""
    lighthouse_report_path = f"/tmp/report_{report_id}.json"
    
    # Base command
    cmd = [
        "lighthouse",
        url,
        f"--port={port}",
        "--output=json",
        f"--output-path={lighthouse_report_path}",
        "--disable-storage-reset",
        "--only-categories=performance,accessibility,best-practices,seo",
        "--save-assets",
        "--throttling-method=devtools",
        "--disable-full-page-screenshot",
    ]
    
    # Set environment variables
    env = os.environ.copy()
    if chrome_path:
        # Force Lighthouse to use the exact same binary Playwright is using
        env["CHROME_PATH"] = chrome_path
        print(f"Lighthouse using CHROME_PATH: {chrome_path}")
    
    try:
        # Added timeout=180s protection (increased for trace generation)
        subprocess.run(
            cmd, 
            check=True, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE, 
            env=env,
            timeout=180
        )
    except subprocess.TimeoutExpired:
        raise Exception("Lighthouse audit timed out after 180 seconds.")
    except subprocess.CalledProcessError as e:
        error_msg = f"Lighthouse command failed with exit code {e.returncode}."
        if e.stderr:
            error_msg += f"\nStderr: {e.stderr.decode()}"
        if e.stdout:
            error_msg += f"\nStdout: {e.stdout.decode()}"
        raise Exception(error_msg)
        
    # Read the main report
    with open(lighthouse_report_path, 'r', encoding='utf-8') as f:
        lighthouse_data = json.load(f)

    # Locate and process the trace file
    # Lighthouse --save-assets creates report_name-0.trace.json
    trace_path = f"/tmp/report_{report_id}-0.trace.json"
    
    if os.path.exists(trace_path):
        try:
            print(f"Processing trace file: {trace_path}")
            with open(trace_path, 'r', encoding='utf-8') as f:
                trace_data = json.load(f)
                
            # Extract only Screenshot events to keep DB size manageable
            # We also need navigationStart to calculate relative timing
            trace_events = trace_data.get('traceEvents', [])
            
            filtered_events = []
            for event in trace_events:
                if event.get('name') == 'Screenshot':
                    filtered_events.append(event)
                elif event.get('name') == 'navigationStart':
                    filtered_events.append(event)
                # Keep TracingStartedInBrowser as a fallback for start time
                elif event.get('name') == 'TracingStartedInBrowser':
                    filtered_events.append(event)
                # Keep firstContentfulPaint for calibration
                elif event.get('name') == 'firstContentfulPaint':
                    filtered_events.append(event)
            
            print(f"Extracted {len(filtered_events)} events from trace.")
            
            # Embed trace screenshots into the main JSON
            lighthouse_data['trace_screenshots'] = filtered_events
            
            # Clean up trace file
            os.remove(trace_path)
            
        except Exception as e:
            print(f"Failed to process trace file: {e}")
            # Don't fail the whole audit if trace processing fails
            pass
    else:
        print(f"Trace file not found at: {trace_path}")
        # List files in /tmp to debug
        try:
            print(f"Files in /tmp: {os.listdir('/tmp')}")
        except:
            pass
    
    # Clean up main report file
    if os.path.exists(lighthouse_report_path):
        os.remove(lighthouse_report_path)
        
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
    # CRITICAL: Playwright uses an async event loop internally even in its sync API.
    # This conflicts with Django's synchronous database safety checks.
    # We set this environment variable to allow DB operations within this context.
    os.environ["DJANGO_ALLOW_ASYNC_UNSAFE"] = "true"
    url = None
    screenshot_path = None
    lighthouse_report_path = None
    browser = None
    p = None
    
    try:
        report = Report.objects.get(id=report_id)
        url = report.url
        report.status = 'processing'
        report.save()

        print(f"Starting audit for {url}")

        # 1. Launch Playwright with Remote Debugging
        screenshot_path = f"/tmp/screenshot_{report_id}.png"
        
        # Start Playwright
        p = sync_playwright().start()
        
        # Launch browser with remote debugging port 9222
        browser = p.chromium.launch(
            headless=True,
            args=['--remote-debugging-port=9222']
        )
        
        # Create a new page and navigate
        page = browser.new_page()
        page.goto(url, timeout=60000)
        
        # Take screenshot (Visual Check)
        page.screenshot(path=screenshot_path, full_page=False)
        
        # Save screenshot early to show progress in UI (Step 1 Complete)
        if os.path.exists(screenshot_path):
            with open(screenshot_path, 'rb') as f:
                report.screenshot.save(f"screenshot_{report_id}.png", File(f), save=True)
            print(f"Initial screenshot captured and saved for {url}")
        
        # --- Perform Interactions (Sequentially before audit) ---
        # This "warms up" the page and exercises typical user flows.
        print("Starting simulated user interactions (warmup)...")
        try:
            # Wait for network idle to ensure page is settled
            page.wait_for_load_state("networkidle", timeout=30000)
            
            # Simple Scroll Interactions
            for _ in range(3):
                page.mouse.wheel(0, 500)
                time.sleep(0.3)
            page.mouse.wheel(0, -1500)
            
            # Click something to trigger event listeners
            page.click("body", force=True)
            time.sleep(0.5)
            print("Finished simulated user interactions.")
        except Exception as e:
            print(f"Interaction failed (continuing to audit): {e}")

        # 2. Run Lighthouse (Attached to the SAME chromium instance via port)
        # Bulletproof: Pass the exact same executable path Playwright is using
        executable_path = p.chromium.executable_path
        print(f"Running Lighthouse attached to port 9222 (Binary: {executable_path}) for {url}...")
        
        lighthouse_data, lighthouse_report_path = run_lighthouse(
            url, 
            report_id, 
            port=9222, 
            chrome_path=executable_path
        )
        
        # Update Lighthouse results early to show progress (Step 2 Complete)
        report.lighthouse_json = lighthouse_data
        performance_score = int(lighthouse_data.get('categories', {}).get('performance', {}).get('score', 0) * 100)
        report.performance_score = performance_score
        report.save()

        # 3. AI Summary
        report.ai_summary = generate_ai_summary(lighthouse_data, url)
        # Final Step Complete
        report.status = 'completed'
        report.save()

        return f"Audit completed for {url}"

    except Exception as e:
        print(f"Error auditing report_id={report_id}: {e}")
        
        # Retry logic if within retry limits
        try:
            # Re-raise to let Celery handle retry
            raise self.retry(exc=e)
        except self.MaxRetriesExceededError:
            # Final failure after all retries
            if 'report' in locals():
                try:
                    report.status = 'failed'
                    report.ai_summary = f"Error: {str(e)}"
                    report.save()
                except Exception as db_err:
                     print(f"Failed to save error state to DB: {db_err}")
            return f"Audit failed for report_id={report_id}: {e}"
        except Exception:
            # This handles cases where retry didn't throw MaxRetriesExceededError
            # but we still want to ensure cleanup happens below
            pass

    finally:
        # ABSOLUTE CLEANUP - Always close browser and remove temp files
        if browser:
            try: browser.close()
            except: pass
        if p:
            try: p.stop()
            except: pass
        
        if screenshot_path and os.path.exists(screenshot_path):
            try: os.remove(screenshot_path)
            except: pass
        if lighthouse_report_path and os.path.exists(lighthouse_report_path):
            try: os.remove(lighthouse_report_path)
            except: pass
