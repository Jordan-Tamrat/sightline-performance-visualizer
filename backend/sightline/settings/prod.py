from .base import *

DEBUG = False

SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    raise ImproperlyConfigured('SECRET_KEY must be set in production')

_hosts = os.environ.get('DJANGO_ALLOWED_HOSTS')
if not _hosts:
    raise ImproperlyConfigured('DJANGO_ALLOWED_HOSTS must be set in production')
ALLOWED_HOSTS = _hosts.split()

# CORS Configuration
CORS_ALLOW_ALL_ORIGINS = False
_cors = os.environ.get('CORS_ALLOWED_ORIGINS', '')
CORS_ALLOWED_ORIGINS = _cors.split() if _cors else []

# Optional security hardening
# SESSION_COOKIE_SECURE = True
# CSRF_COOKIE_SECURE = True
# SECURE_HSTS_SECONDS = int(os.environ.get('SECURE_HSTS_SECONDS', '3600'))
# SECURE_SSL_REDIRECT = True
