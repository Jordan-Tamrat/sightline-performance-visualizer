from celery import shared_task
from django.conf import settings
from .models import Report, SharedReport
import subprocess
import json
import os
import google.genai as genai
from playwright.sync_api import sync_playwright
from django.core.files import File
from django.utils import timezone
from datetime import timedelta
from django.db import transaction
import time
import socket
from contextlib import closing
import gc
import ijson

def _rss_kb_for_pid(pid: int) -> int | None:
    """
    Read VmRSS from /proc/<pid>/status (Linux).
    Returns RSS in KB, or None if unavailable.
    """
    try:
        with open(f"/proc/{pid}/status", "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("VmRSS:"):
                    # Example line: "VmRSS:     123456 kB"
                    return int(line.split()[1])
    except Exception:
        return None
    return None


def _cgroup_mem_kb() -> int | None:
    """
    Read current container memory usage (cgroup).
    Works for common Docker setups (cgroup v2 primary).
    Returns KB, or None if unavailable.
    """
    # cgroup v2
    candidate_paths = [
        "/sys/fs/cgroup/memory.current",
        "/sys/fs/cgroup/memory.max_usage_in_bytes",  # sometimes present
        "/sys/fs/cgroup/memory/memory.current",
        # cgroup v1 fallbacks
        "/sys/fs/cgroup/memory.usage_in_bytes",
        "/sys/fs/cgroup/memory/memory.usage_in_bytes",
    ]

    for p in candidate_paths:
        try:
            if not os.path.exists(p):
                continue
            with open(p, "r", encoding="utf-8") as f:
                raw = f.read().strip()
            if not raw:
                continue
            # Some files may contain 'max'
            if raw.lower() == "max":
                continue
            value_bytes = int(raw)
            return value_bytes // 1024
        except Exception:
            continue

    return None


def _log_mem(prefix: str, extra: dict | None = None) -> None:
    """Lightweight memory logging to diagnose Koyeb OOM kills."""
    try:
        pid = os.getpid()
        rss_kb = _rss_kb_for_pid(pid)
        cgroup_kb = _cgroup_mem_kb()
        msg = f"[MEM] {prefix} pid={pid} rss_kb={rss_kb} cgroup_mem_kb={cgroup_kb}"
        if extra:
            extras = " ".join([f"{k}={v}" for k, v in extra.items()])
            msg = f"{msg} {extras}"
        print(msg, flush=True)
    except Exception:
        # Never fail audits due to logging issues.
        pass


def _stream_trace_events(trace_path: str):
    """Yield trace events from a large trace file without loading the entire JSON."""
    try:
        with open(trace_path, 'rb') as trace_fd:
            for event in ijson.items(trace_fd, 'traceEvents.item'):
                yield event
    except FileNotFoundError:
        return


def _determine_trace_start(trace_path: str, lighthouse_data: dict) -> tuple[int | None, dict | None, dict | None, dict | None]:
    """Stream the trace file to find the earliest calibration events and a sane start timestamp."""
    first_nav = None
    first_tracing = None
    first_fcp = None
    fcp_event_ts = None
    first_screenshot_ts = None

    for event in _stream_trace_events(trace_path):
        name = event.get('name')
        if name == 'navigationStart' and first_nav is None:
            first_nav = event
        elif name == 'TracingStartedInBrowser' and first_tracing is None:
            first_tracing = event
        elif name == 'firstContentfulPaint':
            if first_fcp is None:
                first_fcp = event
            if fcp_event_ts is None:
                fcp_event_ts = event.get('ts')
        elif name == 'Screenshot' and first_screenshot_ts is None:
            first_screenshot_ts = event.get('ts')

        if first_nav and first_tracing and first_fcp and first_screenshot_ts is not None:
            break

    fcp_value_ms = (
        lighthouse_data.get('audits', {})
        .get('first-contentful-paint', {})
        .get('numericValue')
    )

    start_ts = None
    if fcp_event_ts and fcp_value_ms is not None:
        try:
            start_ts = fcp_event_ts - int(fcp_value_ms * 1000)
        except Exception:
            start_ts = None
    if start_ts is None and first_nav:
        start_ts = first_nav.get('ts')
    if start_ts is None and first_tracing:
        start_ts = first_tracing.get('ts')
    if start_ts is None and first_screenshot_ts:
        start_ts = first_screenshot_ts

    return start_ts, first_nav, first_tracing, first_fcp


def _collect_deduped_screenshots(trace_path: str, start_ts: float) -> list[dict]:
    seen_timings: set[int] = set()
    deduped = []

    for event in _stream_trace_events(trace_path):
        if event.get('name') != 'Screenshot':
            continue

        snapshot = event.get('args', {}).get('snapshot')
        if not snapshot:
            continue

        ts = event.get('ts', 0) or 0
        timing_ms = (ts - start_ts) / 1000
        if timing_ms < 0:
            timing_ms = 0

        normalized_timing = round(timing_ms / 100) * 100
        if normalized_timing in seen_timings:
            continue

        seen_timings.add(normalized_timing)
        deduped.append(event)

    return deduped


def _extract_trace_screenshots(trace_path: str, lighthouse_data: dict) -> list[dict]:
    start_ts, first_nav, first_tracing, first_fcp = _determine_trace_start(trace_path, lighthouse_data)
    if start_ts is None:
        return []

    kept_events = []
    for event in (first_fcp, first_nav, first_tracing):
        if event:
            kept_events.append(event)

    deduped = _collect_deduped_screenshots(trace_path, start_ts)
    kept_events.extend(deduped)

    print(f"Extracted {len(kept_events)} events from trace (streaming dedupe).")
    return kept_events

def get_free_port():
    """Finds an available ephemeral port for concurrent Playwright/Lighthouse runs."""
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as s:
        s.bind(('', 0))
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return s.getsockname()[1]

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
        "--max-wait-for-load=300000",
        
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
    
    timed_out = False
    try:
        # Added timeout=330s protection (increased for trace generation)
        subprocess.run(
            cmd, 
            check=True, 
            # Avoid buffering large Lighthouse output in memory.
            # We primarily rely on output JSON files on disk.
            stdout=subprocess.DEVNULL, 
            stderr=subprocess.PIPE, 
            env=env,
            timeout=330
        )
    except subprocess.TimeoutExpired:
        timed_out = True
        if os.path.exists(lighthouse_report_path):
            print("Lighthouse audit timed out, but a report was generated. Proceeding gracefully.")
        else:
            raise Exception("Lighthouse audit completely timed out and no report was generated.")
    except subprocess.CalledProcessError as e:
        if os.path.exists(lighthouse_report_path):
            print(f"Lighthouse exited with code {e.returncode} (likely due to max-wait-for-load limit), but a report was generated. Proceeding gracefully.")
        else:
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
            trace_screenshots = _extract_trace_screenshots(trace_path, lighthouse_data)

            lighthouse_data['trace_screenshots'] = trace_screenshots
            del trace_screenshots
            gc.collect()

            if os.path.exists(trace_path):
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
        
    # --- PRUNE EXCESS LIGHTHOUSE DATA ---
    # The Lighthouse JSON contains massive internal audit properties (like entire HTML bodies 
    # of script tags, extremely long node paths) that we don't use in the UI but take up 
    # huge amounts of RAM in the DB JSON parser. We drop them to save memory.
    if 'audits' in lighthouse_data:
        for audit_key, audit_val in lighthouse_data['audits'].items():
            if 'details' in audit_val:
                # Keep items array but shrink strings and drop raw nodes/snippets
                if 'items' in audit_val['details']:
                    for item in audit_val['details']['items']:
                        if 'node' in item:
                            if 'snippet' in item['node']:
                                item['node']['snippet'] = '...' # Trim huge HTML snippets
                
                # Full page screenshot is totally unnecessary and massive
                if audit_val.get('id') == 'full-page-screenshot':
                     audit_val['details'] = {}
                     
    if 'i18n' in lighthouse_data:
        # Drop translation strings
        lighthouse_data['i18n'] = {}
        
    gc.collect()
        
    return lighthouse_data, lighthouse_report_path, timed_out

def generate_ai_summary(lighthouse_data, url):
    """Generates an AI summary using Gemini."""
    try:
        gemini_api_key = settings.GEMINI_API_KEY
        if not gemini_api_key:
            return "Gemini API Key not configured."

        client = genai.Client(api_key=gemini_api_key)
        
        # Prepare Context - Providing specific Core Metrics for data-driven analysis
        audits = lighthouse_data.get('audits', {})
        core_metrics_keys = [
            'largest-contentful-paint', 
            'total-blocking-time', 
            'cumulative-layout-shift', 
            'first-contentful-paint', 
            'speed-index',
            'interactive'
        ]
        
        core_metrics = []
        for key in core_metrics_keys:
            audit = audits.get(key)
            if audit:
                core_metrics.append({
                    'id': key,
                    'title': audit.get('title'),
                    'score': audit.get('score'),
                    'value': audit.get('displayValue', audit.get('numericValue')),
                    'numeric': audit.get('numericValue'),
                    'description': audit.get('description', '')
                })

        # Process failed audits (excluding ones already in core_metrics to save tokens)
        other_failed_findings = []
        for key, audit in audits.items():
            if key in core_metrics_keys:
                continue
            score = audit.get('score')
            if score is not None and score < 0.9:
                display_value = audit.get('displayValue', '')
                description = audit.get('description', '')
                other_failed_findings.append(f"- {audit.get('title')} (ID: {key}, Value: {display_value}): {description}")

        core_metrics_json = json.dumps(core_metrics, indent=2)
        failed_findings_text = "\n".join(other_failed_findings[:10])

        prompt = (
            f"You are a strict technical Web Performance Analyst.\n\n"
            f"DATA FOR ANALYSIS:\n"
            f"URL: {url}\n"
            f"Core Metrics (WebVitals):\n{core_metrics_json}\n"
            f"Additional Performance Issues:\n{failed_findings_text if other_failed_findings else 'None'}\n\n"
            f"THRESHOLD RULES (STRICT):\n"
            f"- LCP: Good < 2.5s, Needs Improv < 4s, Poor > 4s\n"
            f"- FCP: Good < 1.8s, Needs Improv < 3s, Poor > 3s\n"
            f"- SI (Speed Index): Good < 3.4s, Needs Improv < 5.8s, Poor > 5.8s\n"
            f"- TTI: Good < 3.8s, Needs Improv < 7.3s, Poor > 7.3s\n"
            f"- TBT: Good < 200ms, Needs Improv < 600ms, Poor > 600ms\n"
            f"- CLS: Good < 0.1, Needs Improv < 0.25, Poor > 0.25\n\n"
            f"INSTRUCTIONS:\n"
            f"1. ANALYZE the 'numeric' values of Core Metrics against the thresholds above. \n"
            f"2. TONE & PERFECTIONISM: For metrics in the 'Good' range (Low severity), your tone MUST be confirmatory and positive. \n"
            f"   - DO NOT say it 'needs improvement', is 'far from optimal', or has 'room for improvement'. \n"
            f"   - DO NOT suggest fixes unless there is a glaring, trivial optimization.\n"
            f"   - INSTEAD, state that the metric is well-optimized and explain why this value provides a great user experience.\n"
            f"3. SEVERITY: If a metric is 'Poor', it MUST be 'High' severity. If 'Needs Improvement', mark as 'Medium'. Good = 'Low'.\n"
            f"4. IMPACT: \n"
            f"   - For 'Poor'/'Medium': Describe how this value hurts the user.\n"
            f"   - For 'Good': Explain the positive benefit this value brings to the user (e.g., 'Instant visual feedback', 'Smooth interactions').\n"
            f"5. SUGGESTION: Only provide technical fixes for 'High' and 'Medium' issues. For 'Low' issues, simply suggest 'Monitor and maintain this performance' or leave blank.\n"
            f"6. REFERENCES: Always extract and include at least one high-quality documentation link from the 'description' fields provided in the data.\n\n"
            f"OUTPUT FORMAT (JSON ONLY):\n"
            f"{{\n"
            f'  "overall_assessment": "Data-driven summary based on the scores provided.",\n'
            f'  "issues": [\n'
            f'    {{\n'
            f'      "title": "Exact Metric/Issue Name",\n'
            f'      "explanation": "Technical reason for this specific number.",\n'
            f'      "impact": "User experience cost (specific to the delta from target).",\n'
            f'      "suggestion": "How to fix it.",\n'
            f'      "severity": "High" | "Medium" | "Low",\n'
            f'      "code_fix": "Optional: Specific code fix.",\n'
            f'      "references": ["Optional: URL to documentation"],\n'
            f'      "action": {{ "type": "waterfall" | "metric" | "filmstrip", "target": "Audit ID" }}\n'
            f'    }}\n'
            f'  ]\n'
            f"}}\n"
            f"Provide RAW JSON only."
        )
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )

        # Robustly extract JSON object between first { and last }
        text = response.text.strip()
        start_idx = text.find('{')
        end_idx = text.rfind('}')
        if start_idx != -1 and end_idx != -1:
            text = text[start_idx:end_idx+1]
        else:
            raise ValueError("No valid JSON object found in response.")
            
        return text
    except Exception as e:
        print(f"AI Summary failed: {e}")
        # Return a fallback JSON structure for UI consistency
        fallback = {
            "overall_assessment": f"AI Summary unavailable due to error: {str(e)}",
            "issues": []
        }
        return json.dumps(fallback)

@shared_task(bind=True, max_retries=0, default_retry_delay=30)
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

        # explicitly release any lingering memory from prior runs
        gc.collect()
        
        _log_mem("audit_start")

        # 1. Launch Playwright with Remote Debugging
        screenshot_path = f"/tmp/screenshot_{report_id}.png"
        
        # Get dynamic port for concurrent audits
        debug_port = get_free_port()
        
        # Start Playwright
        p = sync_playwright().start()
        
        _log_mem("after_playwright_start")

        # Launch browser with remote debugging port dynamically assigned
        browser = p.chromium.launch(
            headless=True,
            # Keep Chrome flags minimal but Docker-friendly to reduce memory overhead.
            # These should not change your audit output, only stabilize/trim background work.
            args=[
                f'--remote-debugging-port={debug_port}',
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-extensions',
                '--disable-background-networking',
                # Reduce background work + process/memory overhead in small containers
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-ipc-flooding-protection',
                '--disable-renderer-backgrounding',
                '--no-zygote',
                '--disable-features=site-per-process',
                '--renderer-process-limit=1',
            ],
        )
        
        # Log memory right after browser launch.
        # (Playwright's internal process pid may not always be exposed, so we always log container mem.)
        chrome_extra = None
        try:
            chrome_pid = getattr(getattr(browser, "process", None), "pid", None)
            if chrome_pid:
                chrome_extra = {"chromium_pid": chrome_pid, "chromium_rss_kb": _rss_kb_for_pid(chrome_pid)}
        except Exception:
            chrome_extra = None
        _log_mem("after_chromium_launch", chrome_extra)

        # Save early progress update (browser ready, initializing)
        report.save()

        # 2. Run Lighthouse FIRST (STEP 1: Ensures 100% untouched browser state for pure benchmark)
        network_preset = NETWORK_PRESETS.get(network_type, NETWORK_PRESETS['4g'])
        executable_path = p.chromium.executable_path
        print(f"Running Lighthouse on port {debug_port} (Binary: {executable_path}) for {url}...")
        
        lighthouse_data, lighthouse_report_path, lighthouse_timed_out = run_lighthouse(
            url, 
            report_id, 
            network_preset=network_preset,
            port=debug_port, 
            chrome_path=executable_path,
            device_type=device_type,
        )
        
        _log_mem("after_lighthouse")

        # Update Lighthouse results early to show progress (Step 1 Complete)
        report.lighthouse_json = lighthouse_data
        performance_score = int(lighthouse_data.get('categories', {}).get('performance', {}).get('score', 0) * 100)
        report.performance_score = performance_score
        report.save()

        # 3. Take Screenshot (Extract from Lighthouse rather than launching Playwright again)
        if not lighthouse_timed_out:
            print(f"Extracting screenshot from Lighthouse data for {url}...")
            
            try:
                fallback_b64 = None
                
                # 1. Try final-screenshot audit from Lighthouse first
                final_ss_audit = lighthouse_data.get('audits', {}).get('final-screenshot', {})
                if final_ss_audit.get('details') and final_ss_audit['details'].get('data'):
                    fallback_b64 = final_ss_audit['details']['data']
                
                # 2. Try last trace screenshot if final-screenshot is not available
                if not fallback_b64:
                    trace_events = lighthouse_data.get('trace_screenshots', [])
                    screenshots = [e for e in trace_events if e.get('name') == 'Screenshot']
                    if screenshots:
                        # Get the last screenshot
                        snapshot = screenshots[-1].get('args', {}).get('snapshot')
                        if snapshot:
                            fallback_b64 = f"data:image/jpeg;base64,{snapshot}"
                
        # Save screenshot to DB
                if fallback_b64 and fallback_b64.startswith('data:image/'):
                    # We NO LONGER save to the local ephemeral filesystem.
                    # Koyeb destroys local media on restart, breaking frontend URLs.
                    # Instead, we just keep it inside the JSON and serve the base64 directly through DRF!
                    del fallback_b64
                    gc.collect()
                    print(f"Screenshot kept in JSON to bypass ephemeral storage for {url}")
                    _log_mem("after_screenshot_fallback")
                else:
                    print(f"No screenshot found in Lighthouse data for {url}.")
            except Exception as ss_err:
                print(f"Lighthouse screenshot extraction failed: {ss_err}")

        # 4. AI Summary (STEP 3)
        report.ai_summary = generate_ai_summary(lighthouse_data, url)

        _log_mem("after_ai_summary")

        # 5. Complete Audit
        report.status = 'completed'
        report.ai_summary = report.ai_summary
        report.save()

        _log_mem("audit_completed")

        return f"Audit completed for {url}"

    except Exception as e:
        print(f"Error auditing report_id={report_id}: {e}")
        
        # Determine if we should retry
        is_timeout = "timed out" in str(e).lower() or isinstance(e, subprocess.TimeoutExpired)
        
        # Don't retry on timeouts (they often happen repeatedly on slow sites)
        if is_timeout:
             report.status = 'failed'
             report.ai_summary = f"Audit timed out after search limit. The site is likely too slow or unresponsive to benchmark reliably."
             report.save()
             return f"Audit timed out for report_id={report_id}"

        # Retry logic if within retry limits (for other errors)
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

@shared_task
def cleanup_old_reports():
    """Deletes reports older than 15 days, including their screenshot files."""
    threshold = timezone.now() - timedelta(days=15)
    old_reports = Report.objects.filter(created_at__lt=threshold)
    count = old_reports.count()
    
    for report in old_reports:
        if report.screenshot:
            try:
                report.screenshot.delete(save=False)
            except Exception as e:
                print(f"Failed to delete screenshot for report {report.id}: {e}")
        report.delete()
        
    return f"Deleted {count} reports and their associated screenshots older than 15 days."

@shared_task
def cleanup_expired_shares():
    """Deletes shared reports that have expired."""
    threshold = timezone.now()
    expired_shares = SharedReport.objects.filter(expires_at__lt=threshold)
    count = expired_shares.count()
    expired_shares.delete()
    return f"Deleted {count} expired share links."
