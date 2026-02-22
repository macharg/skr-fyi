FROM node:20-slim
WORKDIR /app
ARG CACHEBUST=6
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install --omit=dev
COPY config/ ./config/
COPY scripts/ ./scripts/
RUN mkdir -p data logs
CMD ["sh", "-c", "node scripts/init-db.js && node scripts/01-discover-sgt-wallets.js"]
