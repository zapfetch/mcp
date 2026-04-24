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
LABEL org.opencontainers.image.description="MCP server for ZapFetch — APAC-native web scraping for AI agents"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY entry.sh /app/entry.sh
RUN chmod +x /app/entry.sh

# Expose the default HTTP port. STDIO mode ignores this; the port is only
# reachable when ZAPFETCH_TRANSPORT=http is set at container run.
EXPOSE 3000

USER node

# Transport selection is env-driven at the SHELL layer (entry.sh), NOT
# inside the node binaries themselves. See plan §2.5 + Critic I2 for why:
# env-based switching at the bin layer would let npx users silently start
# an HTTP server. The node entrypoints (dist/index.js, dist/http-server.js)
# each hardcode a single transport; entry.sh just chooses which to exec.
ENTRYPOINT ["/app/entry.sh"]
