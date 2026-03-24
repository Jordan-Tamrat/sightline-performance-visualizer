from django.urls import path, include
from django.views.decorators.csrf import csrf_exempt
from rest_framework.routers import DefaultRouter
from .views import ReportViewSet, SharedReportView, CronCleanupView

router = DefaultRouter()
router.register(r'reports', ReportViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('share/<str:token>/', SharedReportView.as_view(), name='shared-report'),
    path('cron/cleanup/', csrf_exempt(CronCleanupView.as_view()), name='cron-cleanup'),
]
