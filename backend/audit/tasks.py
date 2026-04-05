from celery import shared_task
from django.conf import settings
from .models import Report, SharedReport
import subprocess
import json
import os
from django.core.files import File
from django.utils import timezone
from datetime import timedelta
from django.db import transaction
import time
import socket
from contextlib import closing
import gc
import ijson
# NOTE: playwright and google.genai are imported lazily inside their respective

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
    """Lightweight memory logging. Reads the worker container's own cgroup memory."""
    try:
        pid = os.getpid()
        rss_kb = _rss_kb_for_pid(pid)
        cgroup_kb = _cgroup_mem_kb()
        # 'worker_cgroup_mem_kb' explicitly labels this as the isolated Celery container's
        # memory reading — not a combined / shared-container value.
        msg = f"[MEM] {prefix} pid={pid} rss_kb={rss_kb} worker_cgroup_mem_kb={cgroup_kb}"
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


def run_lighthouse(url, report_id, network_preset, chrome_path=None, device_type='desktop'):
    """Runs Lighthouse audit natively which automatically spawns Chrome."""
    lighthouse_report_path = f"/tmp/report_{report_id}.json"
    
    # Lighthouse CLI flag expects Kilobits per second (Kbps)
    dl_kbps = (network_preset['downloadThroughput'] * 8) // 1024
    ul_kbps = (network_preset['uploadThroughput'] * 8) // 1024
    
    # Get viewport from DEVICE_CONFIGS or fallback to desktop
    config = DEVICE_CONFIGS.get(device_type, DEVICE_CONFIGS['desktop'])
    width = config['viewport']['width']
    height = config['viewport']['height']
    
    # Chrome execution flags to prevent RAM explosions
    chrome_flags = f"--headless --window-size={width},{height} --disable-gpu --disable-dev-shm-usage --no-sandbox --disable-setuid-sandbox --disable-extensions --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-ipc-flooding-protection --disable-renderer-backgrounding --no-zygote --disable-features=site-per-process --renderer-process-limit=1 --memory-pressure-off"

    # Base command
    cmd = [
        "lighthouse",
        url,
        "--output=json",
        f"--output-path={lighthouse_report_path}",
        "--only-categories=performance,accessibility,best-practices,seo",
        "--save-assets",
        "--disable-full-page-screenshot",
        "--max-wait-for-load=300000",
        f"--chrome-flags={chrome_flags}",
        
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
            "--throttling.cpuSlowdownMultiplier=4",
            "--screenEmulation.mobile=true",
            f"--screenEmulation.width={width}",
            f"--screenEmulation.height={height}",
            "--screenEmulation.deviceScaleFactor=3"
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
        
    # Read the main report completely streaming to prevent Py/Node memory explosion
    lighthouse_data = {}
    allowed_keys = {'categories', 'audits', 'lighthouseVersion', 'requestedUrl', 'finalUrl', 'fetchTime', 'environment', 'runWarnings', 'userAgent'}
    try:
        with open(lighthouse_report_path, 'rb') as f:
            for k, v in ijson.kvitems(f, '', use_float=True):
                if k in allowed_keys:
                    # Implement pruning while it's fresh in memory
                    if k == 'audits':
                        for audit_key, audit_val in v.items():
                            if 'details' in audit_val:
                                if 'items' in audit_val['details']:
                                    for item in audit_val['details']['items']:
                                        if 'node' in item and 'snippet' in item['node']:
                                            item['node']['snippet'] = '...'
                                if audit_val.get('id') == 'full-page-screenshot':
                                    audit_val['details'] = {}
                    lighthouse_data[k] = v
    except Exception as read_err:
        print(f"Ijson parsing failed: {read_err}")
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
        
    gc.collect()
        
    return lighthouse_data, lighthouse_report_path, timed_out



@shared_task(bind=True, max_retries=0, default_retry_delay=30)
def run_audit(self, report_id):
    # CRITICAL: Playwright uses an async event loop internally even in its sync API.
    # This conflicts with Django's synchronous database safety checks.
    # We set this environment variable to allow DB operations within this context.
    os.environ["DJANGO_ALLOW_ASYNC_UNSAFE"] = "true"
    
    import glob
    chrome_path = None
    matches = glob.glob('/root/.cache/ms-playwright/chromium-*/chrome-linux64/chrome')
    if matches:
        chrome_path = matches[0]

    url = None
    screenshot_path = None
    lighthouse_report_path = None
    
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

        # 1. Run Lighthouse directly (Spawns Chrome internally)
        screenshot_path = f"/tmp/screenshot_{report_id}.png"
        network_preset = NETWORK_PRESETS.get(network_type, NETWORK_PRESETS['4g'])
        print(f"Running Lighthouse (Binary: {chrome_path}) for {url}...")
        
        lighthouse_data, lighthouse_report_path, lighthouse_timed_out = run_lighthouse(
            url, 
            report_id, 
            network_preset=network_preset,
            chrome_path=chrome_path,
            device_type=device_type,
        )
        
        _log_mem("after_lighthouse")

        # Update Lighthouse results early to show progress (Step 1 Complete)
        report.lighthouse_json = lighthouse_data
        raw_score = lighthouse_data.get('categories', {}).get('performance', {}).get('score')
        # Guard: Lighthouse can return None for score on error/timeout pages.
        # Treat None as 0 to prevent a NoneType * int crash on the next line.
        performance_score = int((raw_score or 0) * 100)
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
                    import base64
                    # Extract the base64 part
                    header, encoded = fallback_b64.split(',', 1)
                    image_data = base64.b64decode(encoded)
                    
                    with open(screenshot_path, 'wb') as f:
                        f.write(image_data)
                        
                    # Drop big strings from memory before reading back file
                    del fallback_b64, encoded, image_data, header
                    gc.collect()
                    
                    with open(screenshot_path, 'rb') as f:
                        report.screenshot.save(f"screenshot_{report_id}.jpg", File(f), save=True)
                    print(f"Screenshot saved successfully to storage for {url}")
                    _log_mem("after_screenshot_fallback")
                else:
                    print(f"No screenshot found in Lighthouse data for {url}.")
            except Exception as ss_err:
                print(f"Lighthouse screenshot extraction failed: {ss_err}")

        # 4. Complete Audit
        # (AI Summary is now intentionally deferred and executed in the Django web
        # dyno when the frontend polls, freeing up maximum memory on this worker)
        # Leaving status as 'processing' so the frontend pauses correctly on the AI loading step!
        report.save()

        _log_mem("audit_completed")

        return f"Audit completed for {url}"

    except Exception as e:
        print(f"Error auditing report_id={report_id}: {e}")
        
        # Always mark the report as failed immediately so:
        # 1. The frontend stops polling (it checks status=='failed')
        # 2. The user sees the error message rather than an infinite loading spinner
        is_timeout = "timed out" in str(e).lower() or isinstance(e, subprocess.TimeoutExpired)
        error_msg = (
            "Audit timed out. The site is likely too slow or unresponsive to benchmark reliably."
            if is_timeout
            else f"Audit error: {str(e)}"
        )
        try:
            # 'report' may not be defined if the DB fetch itself failed
            if 'report' in locals() and report is not None:
                report.status = 'failed'
                report.ai_summary = error_msg
                report.save()
        except Exception as db_err:
            print(f"Failed to save failure state to DB: {db_err}")
        
        return f"Audit failed for report_id={report_id}: {e}"

    finally:
        # ABSOLUTE CLEANUP - Always remove temp files protecting dyno disk
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
