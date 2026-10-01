release: cd backend && python manage.py migrate --noinput
web: cd backend && gunicorn sightline.wsgi:application --bind 0.0.0.0:$PORT --workers 1 --timeout 300 --log-level info
worker: cd backend && celery -A sightline worker --loglevel=info --concurrency=1 --max-tasks-per-child=1 --without-gossip --without-mingle --without-heartbeat -O fair
