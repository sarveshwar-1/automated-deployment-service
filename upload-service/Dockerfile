# Upload Service Dockerfile - Optimized for Docker on Windows
# Course Relevance: CO3 - Memory protection, Trusted Systems

FROM node:20-alpine

# Security: Create app user first
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Install git for repository operations (required for cloning)
RUN apk add --no-cache git

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files with proper ownership
COPY --chown=appuser:appgroup package.json pnpm-lock.yaml ./

# Install dependencies (as root to avoid permission issues, then we'll switch)
RUN pnpm install --frozen-lockfile

# Copy TypeScript config and source code with proper ownership
COPY --chown=appuser:appgroup tsconfig.json ./
COPY --chown=appuser:appgroup src ./src

# Build TypeScript
RUN pnpm build

# Create required directories
RUN mkdir -p /app/src/gitBare /app/keys && \
    chown -R appuser:appgroup /app/src/gitBare /app/keys /app/dist

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

# Default command
CMD ["/app/entrypoint.sh"]
