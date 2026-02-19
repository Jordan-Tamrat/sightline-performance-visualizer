import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sightline.settings')
django.setup()

from audit.tasks import run_audit
from audit.models import Report

print("Creating test report...")
r = Report.objects.create(url='https://www.metaappz.com/')
print(f"Report ID: {r.id}")
print("Running audit...")
result = run_audit(r.id)
print(f"Result: {result}")
