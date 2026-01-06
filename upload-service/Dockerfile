# Upload Service Dockerfile
FROM node:20-alpine

# Install git for repository operations
RUN apk add --no-cache git

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install

# Copy TypeScript config and source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN pnpm build

# Create gitBare directory for mirror repos
RUN mkdir -p /app/src/gitBare

# Create entrypoint script to run both server and worker
RUN echo '#!/bin/sh' > /app/entrypoint.sh && \
    echo 'echo "🚀 Starting Upload Service..."' >> /app/entrypoint.sh && \
    echo 'node dist/worker.js &' >> /app/entrypoint.sh && \
    echo 'echo "✅ Worker started in background"' >> /app/entrypoint.sh && \
    echo 'node dist/index.js' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

# Expose port 3000
EXPOSE 3000

# Default command - run both server and worker
CMD ["/app/entrypoint.sh"]
