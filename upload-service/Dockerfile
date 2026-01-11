# Upload Service Dockerfile - Security Hardened
# Course Relevance: CO3 - Memory protection, Trusted Systems

FROM node:20-alpine

# Security: Don't run as root - create app user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Install git for repository operations (required for cloning)
RUN apk add --no-cache git

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files first (for better layer caching)
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy TypeScript config and source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN pnpm build

# Create required directories with proper ownership
RUN mkdir -p /app/src/gitBare /app/keys && \
    chown -R appuser:appgroup /app

# Create entrypoint script
RUN echo '#!/bin/sh' > /app/entrypoint.sh && \
    echo 'echo "🚀 Starting Secure Upload Service..."' >> /app/entrypoint.sh && \
    echo 'node dist/index.js' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Security: Switch to non-root user
USER appuser

# Expose port 3000
EXPOSE 3000

# Security: Set read-only filesystem where possible (in docker-compose)
# Security: Drop all capabilities (in docker-compose)

# Default command
CMD ["/app/entrypoint.sh"]
