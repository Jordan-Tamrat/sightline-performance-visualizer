import os
import django
import google.generativeai as genai
from django.conf import settings

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sightline.settings')
django.setup()

genai.configure(api_key=settings.GEMINI_API_KEY)
for m in genai.list_models():
    if 'generateContent' in m.supported_generation_methods:
        print(m.name)
