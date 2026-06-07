# syntax=docker/dockerfile:1

# Stage 1: Builder — install deps and compile TypeScript
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy lockfile and package.json for dependency installation
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including dev for build tools)
# We must allow prisma scripts to run so the client is generated correctly
RUN pnpm install --frozen-lockfile --allow-build=@prisma/client --allow-build=@prisma/engines --allow-build=prisma

# Copy source code, prisma schema, and config
COPY prisma ./prisma/
COPY tsconfig.json ./
COPY src ./src/
COPY .env.example ./

# Generate Prisma client
RUN pnpm --filter @prisma/client generate

# Build TypeScript
RUN pnpm build

# Stage 2: Runner — production image
FROM node:22-alpine AS runner

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy package files for production install
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
# Allow prisma scripts to run for client generation
RUN pnpm install --frozen-lockfile --prod --allow-build=@prisma/client --allow-build=@prisma/engines --allow-build=prisma

# Copy Prisma schema and generated client
COPY prisma ./prisma/
RUN pnpm --filter @prisma/client generate

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy .env.example as template (NEVER copy .env files)
COPY .env.example ./

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# Expose default port
EXPOSE 3000

# Default: start both the HTTP server and the worker in the same container
# This allows using Render's Free Tier for web services
CMD ["sh", "-c", "node dist/server.js & node dist/worker.js & wait"]