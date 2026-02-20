import os
import django
from django.conf import settings

# Must be set before django.setup()
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sightline.settings.dev')
django.setup()

# Debug: Print DB config
print(f"DB Config: {settings.DATABASES['default']['ENGINE']}")
print(f"DB Name: {settings.DATABASES['default']['NAME']}")

from audit.models import Report
from audit.tasks import run_audit

print("Creating test report...")
r = Report.objects.create(url='https://www.metaappz.com/')
print(f"Report ID: {r.id}")
print("Running audit...")
result = run_audit(r.id)
print(f"Result: {result}")

r.refresh_from_db()
print(f"Final Status: {r.status}")
print(f"Performance Score: {r.performance_score}")
