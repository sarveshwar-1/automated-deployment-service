# Host Service Dockerfile - OpenResty (NGINX + Lua) with Node.js
# Runs per-project servers and routes traffic via NGINX

FROM openresty/openresty:alpine

# Install Node.js 20 and PM2
RUN apk add --no-cache nodejs npm python3 make g++ git && \
    npm install -g pm2 pnpm typescript

# Security: Create app user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Set working directory
WORKDIR /app

# Copy NGINX configuration
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx/lua /etc/nginx/lua

# Copy package files
COPY --chown=appuser:appgroup package.json ./

# Install dependencies
RUN pnpm install

# Copy TypeScript config and source code
COPY --chown=appuser:appgroup tsconfig.json ./
COPY --chown=appuser:appgroup src ./src

# Build TypeScript
RUN pnpm build

# Create directories for projects and registry
RUN mkdir -p /app/projects /app/registry && \
    chown -R appuser:appgroup /app/projects /app/registry /app/dist

# Initialize empty port registry
RUN echo '{"projects":{},"nextProjectPort":4001,"nextIsolatedPort":5001}' > /app/registry/port-registry.json && \
    chown appuser:appgroup /app/registry/port-registry.json

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Expose NGINX port and project port range
EXPOSE 3001
EXPOSE 4000-4999
EXPOSE 5000-5999

# Start script runs both NGINX and Node.js manager
CMD ["sh", "-c", "openresty && node dist/index.js"]
