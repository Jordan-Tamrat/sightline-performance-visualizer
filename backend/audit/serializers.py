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
        # Always use the Django storage mechanism (which connects to Supabase S3)
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
