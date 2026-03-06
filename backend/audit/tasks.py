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

# ─── Device and Network Configuration ───────────────────────────────────────

DEVICE_CONFIGS = {
    'mobile': {
        'viewport': {'width': 390, 'height': 844},
        'is_mobile': True,
        'has_touch': True,
        'device_scale_factor': 3,
    },
    'desktop': {
        'viewport': {'width': 1366, 'height': 768},
        'is_mobile': False,
        'has_touch': False,
        'device_scale_factor': 1,
    },
}

# Throughput values are in bytes/sec (Lighthouse/CDP convention)
NETWORK_PRESETS = {
    'slow3g': {
        'offline': False,
        'latency': 400,
        'downloadThroughput': 51200,       
        'uploadThroughput': 51200,        
    },
    'fast3g': {
        'offline': False,
        'latency': 150,
        'downloadThroughput': 209715,      
        'uploadThroughput': 78643,         
    },
    '4g': {
        'offline': False,
        'latency': 40,
        'downloadThroughput': 1179648,     
        'uploadThroughput': 1179648,       
    },
}


def run_lighthouse(url, report_id, network_preset, port=9222, chrome_path=None, device_type='desktop'):
    """Runs Lighthouse audit attached to an existing Chrome instance."""
    lighthouse_report_path = f"/tmp/report_{report_id}.json"
    
    # Lighthouse CLI flag expects Kilobits per second (Kbps)
    dl_kbps = (network_preset['downloadThroughput'] * 8) // 1024
    ul_kbps = (network_preset['uploadThroughput'] * 8) // 1024
    
    # Base command
    cmd = [
        "lighthouse",
        url,
        f"--port={port}",
        "--output=json",
        f"--output-path={lighthouse_report_path}",
        "--only-categories=performance,accessibility,best-practices,seo",
        "--save-assets",
        "--disable-full-page-screenshot",
        
        # Enable DevTools throttling and pass custom dynamic parameters
        "--throttling-method=devtools",
        f"--throttling.requestLatencyMs={network_preset['latency']}",
        f"--throttling.downloadThroughputKbps={dl_kbps}",
        f"--throttling.uploadThroughputKbps={ul_kbps}",
    ]
    
    # Device-specific flags
    if device_type == 'mobile':
        cmd.extend([
            "--form-factor=mobile",
            "--throttling.cpuSlowdownMultiplier=4"
        ])
    else:
        cmd.extend([
            "--form-factor=desktop",
            "--screenEmulation.mobile=false",
            "--screenEmulation.width=1350",
            "--screenEmulation.height=940",
            "--screenEmulation.deviceScaleFactor=1",
            "--throttling.cpuSlowdownMultiplier=1"
        ])
    
    # Set environment variables
    env = os.environ.copy()
    if chrome_path:
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
        device_type = report.device_type or 'desktop'
        network_type = report.network_type or '4g'
        report.status = 'processing'
        report.save()

        print(f"Starting audit for {url} [device={device_type}, network={network_type}]")

        # 1. Launch Playwright with Remote Debugging
        screenshot_path = f"/tmp/screenshot_{report_id}.png"
        
        # Start Playwright
        p = sync_playwright().start()
        
        # Launch browser with remote debugging port 9222
        browser = p.chromium.launch(
            headless=True,
            args=['--remote-debugging-port=9222']
        )
        
        # Save early progress update (browser ready, initializing)
        report.save()

        # 2. Run Lighthouse FIRST (STEP 1: Ensures 100% untouched browser state for pure benchmark)
        network_preset = NETWORK_PRESETS.get(network_type, NETWORK_PRESETS['4g'])
        executable_path = p.chromium.executable_path
        print(f"Running Lighthouse on port 9222 (Binary: {executable_path}) for {url}...")
        
        lighthouse_data, lighthouse_report_path = run_lighthouse(
            url, 
            report_id, 
            network_preset=network_preset,
            port=9222, 
            chrome_path=executable_path,
            device_type=device_type,
        )
        
        # Update Lighthouse results early to show progress (Step 1 Complete)
        report.lighthouse_json = lighthouse_data
        performance_score = int(lighthouse_data.get('categories', {}).get('performance', {}).get('score', 0) * 100)
        report.performance_score = performance_score
        report.save()

        # 3. Take High-Quality Screenshot with Playwright (STEP 2: Safe to warm up resources now)
        print(f"Taking high-res screenshot for {url}...")
        
        # Prepare context for screenshot
        device_config = DEVICE_CONFIGS.get(device_type, DEVICE_CONFIGS['desktop'])
        context = browser.new_context(
            viewport=device_config['viewport'],
            is_mobile=device_config['is_mobile'],
            has_touch=device_config['has_touch'],
            device_scale_factor=device_config['device_scale_factor'],
        )
        page = context.new_page()
        
        try:
            # Navigate quickly just to get the visual state
            page.goto(url, timeout=60000, wait_until='networkidle')
            
            # Take a high-quality screenshot
            page.screenshot(path=screenshot_path, full_page=False)
            
            # Save screenshot to DB (Step 2 Complete)
            if os.path.exists(screenshot_path):
                with open(screenshot_path, 'rb') as f:
                    report.screenshot.save(f"screenshot_{report_id}.png", File(f), save=True)
                print(f"High-quality screenshot captured and saved for {url}")
        except Exception as ss_err:
            print(f"Screenshot capture failed (non-critical): {ss_err}")
        finally:
            try: page.close()
            except: pass
            try: context.close()
            except: pass

        # 4. AI Summary (STEP 3)
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
