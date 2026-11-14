# ==========================================
# Stage 1: Build & Dependencies
# ==========================================
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# ==========================================
# Stage 2: Production Runtime
# ==========================================
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install curl for healthcheck
RUN apk add --no-cache curl

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/src ./src
COPY --from=builder /app/server.js ./server.js

# Run as non-root user for container security
USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/v1/health/liveness || exit 1

CMD ["node", "src/server.js"]
