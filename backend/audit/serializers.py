from rest_framework import serializers
from .models import Report

class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = '__all__'
        read_only_fields = ('status', 'performance_score', 'lighthouse_json', 'ai_summary', 'screenshot', 'created_at')
