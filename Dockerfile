# Stage 1: build
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build && npm cache clean --force

# Stage 2: runtime
FROM node:22-alpine AS runtime

LABEL org.opencontainers.image.source="https://github.com/zapfetch/mcp"

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

USER node

ENTRYPOINT ["node", "dist/index.js"]
