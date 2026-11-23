variable "region" {
  type    = string
  default = "us-east-2"
}

variable "instance_type" {
  type    = string
  default = "t3.small"
}

variable "ssh_cidr" {
  type = string

  validation {
    condition     = can(cidrhost(var.ssh_cidr, 0)) && endswith(var.ssh_cidr, "/32")
    error_message = "ssh_cidr must be one IP address, such as 203.0.113.7/32."
  }
}

variable "ssh_public_key_path" {
  type    = string
  default = "~/.ssh/forgeops_ec2.pub"
}

variable "release" {
  type = string

  validation {
    condition     = can(regex("^[0-9a-f]{40}$", var.release))
    error_message = "release must be a full commit SHA on main whose images CI pushed to GHCR."
  }
}

variable "github_app_id" {
  type = string
}

variable "github_app_slug" {
  type = string
}

variable "github_client_id" {
  type = string
}
