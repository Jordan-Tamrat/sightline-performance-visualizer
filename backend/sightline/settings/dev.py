from .base import *

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/6.0/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-lek4mo$fs1pg)k7=xq^$r(cezzrt#h_5jckei)1egcq7md-bfr')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost 127.0.0.1 [::1]').split()

# CORS Configuration
CORS_ALLOW_ALL_ORIGINS = True # For development only
