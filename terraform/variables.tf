variable "aws_region" {
  type        = string
  description = "Target AWS region"
  default     = "us-east-1"
}

variable "project_prefix" {
  type        = string
  description = "Resource prefix for naming"
  default     = "genesis-hw18"
}

variable "my_ip" {
  type        = string
  description = "Engineer public IP in CIDR format (e.g. 203.0.113.25/32)"
}

variable "db_password" {
  type        = string
  description = "PostgreSQL master password"
  sensitive   = true

  validation {
    condition     = length(var.db_password) >= 10
    error_message = "The db_password must be at least 10 characters long."
  }
}
