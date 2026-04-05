import json
import os
from django.conf import settings

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
