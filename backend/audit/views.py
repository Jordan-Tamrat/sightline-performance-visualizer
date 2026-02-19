from rest_framework import viewsets
from .models import Report
from .serializers import ReportSerializer
from .tasks import run_audit

class ReportViewSet(viewsets.ModelViewSet):
    queryset = Report.objects.all().order_by('-created_at')
    serializer_class = ReportSerializer

    def perform_create(self, serializer):
        report = serializer.save()
        run_audit.delay(report.id)
