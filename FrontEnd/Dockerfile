# Frontend Dockerfile - Security Hardened Multi-stage build
# Course Relevance: CO3 - Trusted Systems, Memory protection

# Stage 1: Build the React app
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Stage 2: Serve with nginx (security hardened)
FROM nginx:alpine

# Security: Remove default nginx configs
RUN rm -rf /etc/nginx/conf.d/default.conf

# Security: Create nginx user if not exists and set permissions
RUN chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown nginx:nginx /var/run/nginx.pid

# Copy security headers configuration
COPY security-headers.conf /etc/nginx/security-headers.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Expose port 80 (and 443 for HTTPS in production)
EXPOSE 80
# EXPOSE 443

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
