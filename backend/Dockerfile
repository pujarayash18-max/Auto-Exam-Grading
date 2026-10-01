FROM python:3.12-slim

WORKDIR /app

# Install system dependencies (ffmpeg is approved for media handling)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Command is handled by docker-compose
