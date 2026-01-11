# Build Service Dockerfile - Security Hardened
# Course Relevance: CO3 - Memory protection, Trusted Systems

FROM node:20-alpine

# Security: Don't run as root - create app user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Install build tools that might be needed for project builds
RUN apk add --no-cache git python3 make g++

# Set working directory
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy TypeScript config and source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN pnpm build

# Set proper ownership
RUN chown -R appuser:appgroup /app

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Security: Switch to non-root user
USER appuser

# Expose port for static file server
EXPOSE 3001

# Default command
CMD ["node", "dist/index.js"]
