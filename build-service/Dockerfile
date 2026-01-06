# Build Service Dockerfile
FROM node:20-alpine

# Install build tools that might be needed for project builds
RUN apk add --no-cache git python3 make g++

# Set working directory
WORKDIR /app

# Install pnpm globally
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

# Expose port for static file server
EXPOSE 3001

# Default command - run both worker and server
CMD ["node", "dist/index.js"]
