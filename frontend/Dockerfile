# ========================================
# Entomate Frontend Dockerfile
# Week 8: Production Deployment
# ========================================

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build arguments for environment
ARG VITE_API_URL=http://localhost:3000
ARG VITE_APP_NAME=Entomate

# Set environment variables for build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_NAME=$VITE_APP_NAME

# Build the application
RUN npm run build

# Production stage with Nginx
FROM nginx:alpine AS production

# Add labels
LABEL org.opencontainers.image.title="Entomate Frontend"
LABEL org.opencontainers.image.description="AI-powered meeting management frontend"
LABEL org.opencontainers.image.version="1.0.0"

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
