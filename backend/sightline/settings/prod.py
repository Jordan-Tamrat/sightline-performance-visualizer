from .base import *

DEBUG = False

SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    raise ImproperlyConfigured('SECRET_KEY must be set in production')

_hosts = os.environ.get('DJANGO_ALLOWED_HOSTS')
if not _hosts:
    raise ImproperlyConfigured('DJANGO_ALLOWED_HOSTS must be set in production')

# Database configuration validation for production
for var in ['DATABASE_URL', 'DIRECT_URL']:
    if not os.environ.get(var):
        raise ImproperlyConfigured(f'{var} must be set in production')

ALLOWED_HOSTS = [host.strip() for host in _hosts.split(',')]

# CORS Configuration
CORS_ALLOW_ALL_ORIGINS = False
_cors = os.environ.get('CORS_ALLOWED_ORIGINS', '')
if not _cors:
    raise ImproperlyConfigured('CORS_ALLOWED_ORIGINS must be set in production')
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in _cors.split(',')]

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Simple Logging for Production
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
}

