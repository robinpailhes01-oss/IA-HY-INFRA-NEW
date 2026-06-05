FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Build TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Auth state persisted in /data (mount a Railway volume here)
RUN mkdir -p /data/auth

EXPOSE 3001

CMD ["node", "dist/index.js"]
