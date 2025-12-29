# ========================================
# Entomate Deployment Script (PowerShell)
# Week 8: Production Deployment
# ========================================

param(
    [Parameter(Position=0)]
    [ValidateSet("build", "push", "deploy", "health", "rollback", "full")]
    [string]$Command = "full",

    [string]$DockerRegistry = $env:DOCKER_REGISTRY,
    [string]$ImageTag = $(if ($env:IMAGE_TAG) { $env:IMAGE_TAG } else { "latest" })
)

$ErrorActionPreference = "Stop"

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir

Write-Host "========================================" -ForegroundColor Green
Write-Host "Entomate Deployment Script" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

function Write-Info($Message) {
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warn($Message) {
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Error($Message) {
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Test-Prerequisites {
    Write-Info "Checking prerequisites..."

    try {
        docker --version | Out-Null
    } catch {
        Write-Error "Docker is not installed"
        exit 1
    }

    try {
        docker-compose --version | Out-Null
    } catch {
        Write-Error "Docker Compose is not installed"
        exit 1
    }

    Write-Info "Prerequisites check passed"
}

function Build-Images {
    Write-Info "Building Docker images..."

    Push-Location $ProjectDir

    try {
        # Build backend
        Write-Info "Building backend image..."
        docker build -t "entomate-backend:$ImageTag" ./backend

        # Build frontend
        Write-Info "Building frontend image..."
        docker build -t "entomate-frontend:$ImageTag" ./frontend

        Write-Info "Images built successfully"
    } finally {
        Pop-Location
    }
}

function Push-Images {
    if (-not $DockerRegistry) {
        Write-Warn "DOCKER_REGISTRY not set, skipping push"
        return
    }

    Write-Info "Pushing images to registry..."

    docker tag "entomate-backend:$ImageTag" "$DockerRegistry/entomate-backend:$ImageTag"
    docker tag "entomate-frontend:$ImageTag" "$DockerRegistry/entomate-frontend:$ImageTag"

    docker push "$DockerRegistry/entomate-backend:$ImageTag"
    docker push "$DockerRegistry/entomate-frontend:$ImageTag"

    Write-Info "Images pushed successfully"
}

function Deploy-Compose {
    Write-Info "Deploying with Docker Compose..."

    Push-Location $ProjectDir

    try {
        # Stop existing containers
        docker-compose down 2>$null

        # Pull latest images (if using registry)
        if ($DockerRegistry) {
            docker-compose pull
        }

        # Start containers
        docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

        Write-Info "Deployment complete"
    } finally {
        Pop-Location
    }
}

function Test-Health {
    Write-Info "Running health checks..."

    $MaxRetries = 30
    $RetryInterval = 2

    # Check backend
    for ($i = 1; $i -le $MaxRetries; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -eq 200) {
                Write-Info "Backend health check passed"
                break
            }
        } catch {
            if ($i -eq $MaxRetries) {
                Write-Error "Backend health check failed after $MaxRetries attempts"
                exit 1
            }
            Write-Warn "Waiting for backend... (attempt $i/$MaxRetries)"
            Start-Sleep -Seconds $RetryInterval
        }
    }

    # Check frontend
    for ($i = 1; $i -le $MaxRetries; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:80/health" -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -eq 200) {
                Write-Info "Frontend health check passed"
                break
            }
        } catch {
            if ($i -eq $MaxRetries) {
                Write-Error "Frontend health check failed after $MaxRetries attempts"
                exit 1
            }
            Write-Warn "Waiting for frontend... (attempt $i/$MaxRetries)"
            Start-Sleep -Seconds $RetryInterval
        }
    }

    Write-Info "All health checks passed"
}

function Invoke-Rollback {
    Write-Warn "Rolling back to previous version..."

    Push-Location $ProjectDir

    try {
        docker-compose down
        docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-build

        Write-Info "Rollback complete"
    } finally {
        Pop-Location
    }
}

# Main execution
switch ($Command) {
    "build" {
        Test-Prerequisites
        Build-Images
    }
    "push" {
        Push-Images
    }
    "deploy" {
        Test-Prerequisites
        Deploy-Compose
    }
    "health" {
        Test-Health
    }
    "rollback" {
        Invoke-Rollback
    }
    "full" {
        Test-Prerequisites
        Build-Images
        Deploy-Compose
        Test-Health
    }
}
