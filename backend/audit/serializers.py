from rest_framework import serializers
from .models import Report, SharedReport

class ReportSerializer(serializers.ModelSerializer):
    screenshot = serializers.SerializerMethodField()

    class Meta:
        model = Report
        fields = '__all__'
        read_only_fields = ('status', 'performance_score', 'lighthouse_json', 'ai_summary', 'screenshot', 'created_at')
        # url, device_type, network_type, user_identifier are writable on creation

    def get_screenshot(self, obj):
        # 1. ALWAYS try to extract Base64 directly from JSON first!
        # This completely bypasses Koyeb's ephemeral filesystem where images disappear on restart.
        try:
            if obj.lighthouse_json:
                final_ss = obj.lighthouse_json.get('audits', {}).get('final-screenshot', {}).get('details', {}).get('data')
                if final_ss:
                    return final_ss
                
                # fallback trace screenshot
                trace_events = obj.lighthouse_json.get('trace_screenshots', [])
                screenshots = [e for e in trace_events if e.get('name') == 'Screenshot']
                if screenshots:
                    snapshot = screenshots[-1].get('args', {}).get('snapshot')
                    if snapshot:
                        return f"data:image/jpeg;base64,{snapshot}"
        except Exception:
            pass
            
        # 2. Fallback to existing disk file if present (mostly for local testing or old runs)
        if obj.screenshot:
            try:
                request = self.context.get('request')
                if request:
                    return request.build_absolute_uri(obj.screenshot.url)
                return obj.screenshot.url
            except ValueError:
                pass
            
        return None

class SharedReportSerializer(serializers.ModelSerializer):
    report = ReportSerializer(read_only=True)
    class Meta:
        model = SharedReport
        fields = ['id', 'share_token', 'created_at', 'expires_at', 'views', 'is_active', 'report']
        read_only_fields = fields
