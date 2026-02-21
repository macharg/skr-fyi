# Dockerfile — skr.fyi Data Pipeline
FROM node:20-slim

WORKDIR /app

# force rebuild 1

# Install build tools for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy application code
COPY config/ ./config/
COPY scripts/ ./scripts/
COPY cron/ ./cron/

# Create data and logs directories
RUN mkdir -p data logs

# Initialize database on build
RUN node scripts/init-db.js

# Install cron
RUN apt-get update && apt-get install -y cron && rm -rf /var/lib/apt/lists/*

# Copy cron schedule
COPY cron/schedule /etc/cron.d/skr-fyi
RUN chmod 0644 /etc/cron.d/skr-fyi && crontab /etc/cron.d/skr-fyi

# Default: run full pipeline once, then start cron
CMD ["node", "scripts/test-connection.js"]
