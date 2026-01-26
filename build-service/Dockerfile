# Build Service Dockerfile - Optimized for Docker on Windows
# Course Relevance: CO3 - Memory protection, Trusted Systems

FROM node:20-alpine

# Security: Create app user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Install build tools and common dependencies
RUN apk add --no-cache git python3 make g++

# Set working directory
WORKDIR /app

# Install pnpm and common build tools globally
RUN npm install -g pnpm typescript vite @vitejs/plugin-react

# Copy package files
COPY --chown=appuser:appgroup package.json ./

# Install dependencies
RUN pnpm install

# Copy TypeScript config and source code
COPY --chown=appuser:appgroup tsconfig.json ./
COPY --chown=appuser:appgroup src ./src

# Build TypeScript
RUN pnpm build

# Set ownership only on specific directories (not node_modules)
RUN chown -R appuser:appgroup /app/dist

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Security: Switch to non-root user
USER appuser

# Expose port for static file server
EXPOSE 3001

# Default command - run startup script which handles setup + service start
CMD ["node", "dist/startup.js"]
