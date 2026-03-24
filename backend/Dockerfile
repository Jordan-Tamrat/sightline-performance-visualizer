FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    build-essential \
    libpq-dev \
    ca-certificates

# Install Node.js (required for Lighthouse)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Verify Node + npm installation (helps debugging)
RUN node -v && npm -v

# Set working directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers
RUN playwright install --with-deps chromium

# Install Lighthouse globally
RUN npm install -g lighthouse

# Copy project code
COPY . .

# Expose port
EXPOSE 8000

# Default command (overridden in docker-compose)
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]