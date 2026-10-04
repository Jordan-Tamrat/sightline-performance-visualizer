import json
import os
import time
from django.conf import settings

# Gemini free-tier Flash returns 503 UNAVAILABLE under load. These are almost always
# brief, so a couple of short waits recovers the request without a second Lighthouse run.
# Deliberately small: each attempt reuses the already-built prompt and holds no extra
# memory, and the total wait stays short enough not to tie up a web worker thread.
_RETRY_DELAYS = (2, 5)  # seconds; 3 attempts total
_RETRY_STATUS = ('503', '429', 'UNAVAILABLE', 'RESOURCE_EXHAUSTED', 'INTERNAL', '500')

def _is_transient(err) -> bool:
    """True for overload/rate-limit style errors that are worth retrying."""
    text = str(err).upper()
    return any(code in text for code in _RETRY_STATUS)


def _generate_with_retry(client, prompt):
    """
    Call Gemini, retrying only on transient overload errors.

    Takes the already-built prompt so retries never re-parse lighthouse_data —
    nothing beyond the prompt string is held across attempts. A non-transient
    error (bad key, bad model, malformed request) raises immediately rather
    than burning time on waits that cannot help.
    """
    last_err = None
    for attempt in range(len(_RETRY_DELAYS) + 1):
        try:
            return client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
            )
        except Exception as e:
            last_err = e
            if not _is_transient(e) or attempt == len(_RETRY_DELAYS):
                raise
            delay = _RETRY_DELAYS[attempt]
            print(f"Gemini transient error (attempt {attempt + 1}), retrying in {delay}s: {e}", flush=True)
            time.sleep(delay)
    raise last_err


def generate_ai_summary(lighthouse_data, url):
    """
    Uses Gemini API to generate a summary based on Lighthouse metrics.
    Moved to a separate module to allow the Django web dyno to run it,
    saving memory on the Celery worker dyno.
    """
    try:
        gemini_api_key = getattr(settings, 'GEMINI_API_KEY', None)
        if not gemini_api_key:
            return "Gemini API Key not configured."

        import google.genai as genai  # lazy import
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
        
        # Release the parsed audit structures before the network call. The prompt
        # string is all the request needs, and retries must not keep the full
        # lighthouse_json-derived data alive while waiting.
        del core_metrics, other_failed_findings, core_metrics_json, failed_findings_text, audits

        response = _generate_with_retry(client, prompt)

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
        # Return a fallback JSON structure for UI consistency.
        # 'retryable' tells the frontend this failure was the AI step alone — the
        # Lighthouse data is intact, so insights can be regenerated without re-auditing.
        fallback = {
            "overall_assessment": (
                "AI insights could not be generated because the model was temporarily "
                "unavailable. Your performance data is complete — use Regenerate to try again."
                if _is_transient(e)
                else f"AI Summary unavailable due to error: {str(e)}"
            ),
            "issues": [],
            "error": str(e),
            "retryable": True,
        }
        return json.dumps(fallback)
