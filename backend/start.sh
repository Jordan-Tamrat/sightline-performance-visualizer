#!/bin/bash
set -e

echo "Running database migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Starting Celery Worker in background..."
celery -A sightline worker --loglevel=info --concurrency=1 --max-tasks-per-child=1 &

echo "Starting Gunicorn..."
exec gunicorn sightline.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 1 \
    --timeout 300 \
    --log-level info
