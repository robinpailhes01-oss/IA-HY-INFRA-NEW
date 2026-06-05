FROM node:20-slim

# Required for native build deps (Baileys / libsignal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

RUN mkdir -p /data/auth

EXPOSE 3001

CMD ["node", "dist/index.js"]
