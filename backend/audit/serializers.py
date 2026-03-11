from rest_framework import serializers
from .models import Report, SharedReport

class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = '__all__'
        read_only_fields = ('status', 'performance_score', 'lighthouse_json', 'ai_summary', 'screenshot', 'created_at')
        # url, device_type, network_type, user_identifier are writable on creation

class SharedReportSerializer(serializers.ModelSerializer):
    report = ReportSerializer(read_only=True)
    class Meta:
        model = SharedReport
        fields = ['id', 'share_token', 'created_at', 'expires_at', 'views', 'is_active', 'report']
        read_only_fields = fields
