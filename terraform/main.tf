provider "cloudflare" {
  # API token is automatically read from CLOUDFLARE_API_TOKEN env var
}

# D1 Database
resource "cloudflare_d1_database" "zenfast" {
  account_id = var.cloudflare_account_id
  name       = var.project_name
}

# KV Namespace for sessions
resource "cloudflare_workers_kv_namespace" "sessions" {
  account_id = var.cloudflare_account_id
  title      = "${var.project_name}-sessions"
}

# R2 Bucket for application storage
resource "cloudflare_r2_bucket" "storage" {
  account_id = var.cloudflare_account_id
  name       = "${var.project_name}-storage"
  location   = "EEUR"
}