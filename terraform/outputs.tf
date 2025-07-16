output "d1_database_id" {
  description = "ID of the D1 database"
  value       = cloudflare_d1_database.zenfast.id
}

output "kv_sessions_id" {
  description = "ID of the sessions KV namespace"
  value       = cloudflare_workers_kv_namespace.sessions.id
}

output "r2_storage_bucket_name" {
  description = "Name of the R2 storage bucket"
  value       = cloudflare_r2_bucket.storage.name
}