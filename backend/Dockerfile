# ========================================
# Entomate Backend Dockerfile
# Week 8: Production Deployment
# ========================================

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source code
COPY . .

# Production stage
FROM node:20-alpine AS production

# Add labels
LABEL org.opencontainers.image.title="Entomate Backend"
LABEL org.opencontainers.image.description="AI-powered meeting management backend"
LABEL org.opencontainers.image.version="1.0.0"

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S entomate -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source from builder
COPY --from=builder /app .

# Create logs directory
RUN mkdir -p logs && chown -R entomate:nodejs logs

# Switch to non-root user
USER entomate

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Environment
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
CMD ["node", "server.js"]
