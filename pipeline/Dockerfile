FROM node:20-slim
WORKDIR /app
ARG CACHEBUST=3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install --omit=dev
COPY scripts/test-connection.js ./scripts/test-connection.js
COPY config/ ./config/
CMD ["node", "scripts/test-connection.js"]