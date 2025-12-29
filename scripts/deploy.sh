#!/bin/bash
# ========================================
# Entomate Deployment Script
# Week 8: Production Deployment
# ========================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Entomate Deployment Script${NC}"
echo -e "${GREEN}========================================${NC}"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi

    log_info "Prerequisites check passed"
}

# Build images
build_images() {
    log_info "Building Docker images..."

    cd "$PROJECT_DIR"

    # Build backend
    log_info "Building backend image..."
    docker build -t entomate-backend:${IMAGE_TAG} ./backend

    # Build frontend
    log_info "Building frontend image..."
    docker build -t entomate-frontend:${IMAGE_TAG} ./frontend

    log_info "Images built successfully"
}

# Push to registry
push_images() {
    if [ -z "$DOCKER_REGISTRY" ]; then
        log_warn "DOCKER_REGISTRY not set, skipping push"
        return
    fi

    log_info "Pushing images to registry..."

    docker tag entomate-backend:${IMAGE_TAG} ${DOCKER_REGISTRY}/entomate-backend:${IMAGE_TAG}
    docker tag entomate-frontend:${IMAGE_TAG} ${DOCKER_REGISTRY}/entomate-frontend:${IMAGE_TAG}

    docker push ${DOCKER_REGISTRY}/entomate-backend:${IMAGE_TAG}
    docker push ${DOCKER_REGISTRY}/entomate-frontend:${IMAGE_TAG}

    log_info "Images pushed successfully"
}

# Deploy with Docker Compose
deploy_compose() {
    log_info "Deploying with Docker Compose..."

    cd "$PROJECT_DIR"

    # Stop existing containers
    docker-compose down || true

    # Pull latest images (if using registry)
    if [ -n "$DOCKER_REGISTRY" ]; then
        docker-compose pull
    fi

    # Start containers
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

    log_info "Deployment complete"
}

# Health check
health_check() {
    log_info "Running health checks..."

    MAX_RETRIES=30
    RETRY_INTERVAL=2

    for i in $(seq 1 $MAX_RETRIES); do
        if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
            log_info "Backend health check passed"
            break
        fi

        if [ $i -eq $MAX_RETRIES ]; then
            log_error "Backend health check failed after $MAX_RETRIES attempts"
            exit 1
        fi

        log_warn "Waiting for backend... (attempt $i/$MAX_RETRIES)"
        sleep $RETRY_INTERVAL
    done

    for i in $(seq 1 $MAX_RETRIES); do
        if curl -sf http://localhost:80/health > /dev/null 2>&1; then
            log_info "Frontend health check passed"
            break
        fi

        if [ $i -eq $MAX_RETRIES ]; then
            log_error "Frontend health check failed after $MAX_RETRIES attempts"
            exit 1
        fi

        log_warn "Waiting for frontend... (attempt $i/$MAX_RETRIES)"
        sleep $RETRY_INTERVAL
    done

    log_info "All health checks passed"
}

# Rollback
rollback() {
    log_warn "Rolling back to previous version..."

    cd "$PROJECT_DIR"

    docker-compose down
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-build

    log_info "Rollback complete"
}

# Show usage
usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  build       Build Docker images"
    echo "  push        Push images to registry"
    echo "  deploy      Deploy with Docker Compose"
    echo "  health      Run health checks"
    echo "  rollback    Rollback to previous version"
    echo "  full        Full deployment (build + deploy + health)"
    echo ""
    echo "Environment variables:"
    echo "  DOCKER_REGISTRY   Docker registry URL"
    echo "  IMAGE_TAG         Image tag (default: latest)"
}

# Main
main() {
    case "${1:-full}" in
        build)
            check_prerequisites
            build_images
            ;;
        push)
            push_images
            ;;
        deploy)
            check_prerequisites
            deploy_compose
            ;;
        health)
            health_check
            ;;
        rollback)
            rollback
            ;;
        full)
            check_prerequisites
            build_images
            deploy_compose
            health_check
            ;;
        *)
            usage
            exit 1
            ;;
    esac
}

main "$@"
