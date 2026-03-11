from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ReportViewSet, SharedReportView

router = DefaultRouter()
router.register(r'reports', ReportViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('share/<str:token>/', SharedReportView.as_view(), name='shared-report'),
]
