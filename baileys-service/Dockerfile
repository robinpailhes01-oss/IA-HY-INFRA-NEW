FROM node:20-slim

# Required for native build deps (Baileys / libsignal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ git ca-certificates \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Force git to use HTTPS instead of SSH (no SSH keys in Docker).
# Baileys pulls libsignal-node via ssh://git@github.com/...
# IMPORTANT: --add for repeated keys, otherwise the next one overwrites the previous.
RUN git config --global url."https://github.com/".insteadOf "ssh://git@github.com/" \
 && git config --global --add url."https://github.com/".insteadOf "git@github.com:" \
 && git config --global --add url."https://".insteadOf "git://"

WORKDIR /app

COPY package.json ./
RUN npm install --no-fund --no-audit

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

RUN mkdir -p /data/auth

EXPOSE 3001

CMD ["node", "dist/index.js"]
