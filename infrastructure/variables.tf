# ========================================
# Entomate Infrastructure Variables
# Week 8: Production Deployment
# ========================================

# ========================================
# Environment Configuration
# ========================================

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }
}

variable "app_name" {
  description = "Application name (used for resource naming)"
  type        = string
  default     = "entomate"
}

# ========================================
# Networking
# ========================================

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Number of availability zones to use"
  type        = number
  default     = 2
}

# ========================================
# Container Configuration
# ========================================

variable "container_cpu" {
  description = "CPU units for containers (256, 512, 1024, 2048, 4096)"
  type        = number
  default     = 256
}

variable "container_memory" {
  description = "Memory for containers in MB"
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Desired number of container instances"
  type        = number
  default     = 2
}

variable "min_capacity" {
  description = "Minimum instances for auto-scaling"
  type        = number
  default     = 2
}

variable "max_capacity" {
  description = "Maximum instances for auto-scaling"
  type        = number
  default     = 10
}

# ========================================
# Domain & SSL
# ========================================

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = ""
}

variable "ssl_certificate_arn" {
  description = "ARN of ACM certificate for HTTPS"
  type        = string
  default     = ""
}

# ========================================
# Logging & Monitoring
# ========================================

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "enable_container_insights" {
  description = "Enable ECS Container Insights"
  type        = bool
  default     = true
}

# ========================================
# Auto Scaling Thresholds
# ========================================

variable "cpu_scale_target" {
  description = "Target CPU utilization for auto-scaling"
  type        = number
  default     = 70
}

variable "memory_scale_target" {
  description = "Target memory utilization for auto-scaling"
  type        = number
  default     = 80
}

variable "scale_in_cooldown" {
  description = "Cooldown period for scaling in (seconds)"
  type        = number
  default     = 300
}

variable "scale_out_cooldown" {
  description = "Cooldown period for scaling out (seconds)"
  type        = number
  default     = 60
}

# ========================================
# Tags
# ========================================

variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
