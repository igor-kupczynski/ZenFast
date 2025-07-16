#!/bin/bash
set -euo pipefail

# Script to generate wrangler.toml from template using Terraform outputs
# This keeps sensitive resource IDs out of version control

echo "Generating wrangler.toml from Terraform outputs..."

# Check if template exists
if [ ! -f "wrangler.toml.template" ]; then
    echo "Error: wrangler.toml.template not found!"
    exit 1
fi

# Get Terraform outputs
cd ../terraform
# Filter out the "Loading environment" message by skipping the first line
./tf.sh output -json | tail -n +2 > /tmp/terraform-outputs.json
if [ $? -ne 0 ] || [ ! -s /tmp/terraform-outputs.json ]; then
    echo "Error: Failed to get Terraform outputs. Make sure you've run 'terraform apply' first."
    exit 1
fi
cd ../backend

# Extract values from Terraform outputs
D1_DATABASE_ID=$(jq -r '.d1_database_id.value' /tmp/terraform-outputs.json)
KV_SESSIONS_ID=$(jq -r '.kv_sessions_id.value' /tmp/terraform-outputs.json)
R2_BUCKET_NAME=$(jq -r '.r2_storage_bucket_name.value' /tmp/terraform-outputs.json)

# For now, use the same values for production (as noted in the task)
# TODO: Create separate dev/staging resources in Terraform
D1_DATABASE_ID_PROD="$D1_DATABASE_ID"
KV_SESSIONS_ID_PROD="$KV_SESSIONS_ID"
R2_BUCKET_NAME_PROD="$R2_BUCKET_NAME"

# Generate wrangler.toml from template
cp wrangler.toml.template wrangler.toml

# Replace placeholders
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS sed requires -i ''
    sed -i '' "s/<D1_DATABASE_ID>/$D1_DATABASE_ID/g" wrangler.toml
    sed -i '' "s/<KV_SESSIONS_ID>/$KV_SESSIONS_ID/g" wrangler.toml
    sed -i '' "s/<R2_BUCKET_NAME>/$R2_BUCKET_NAME/g" wrangler.toml
    sed -i '' "s/<D1_DATABASE_ID_PROD>/$D1_DATABASE_ID_PROD/g" wrangler.toml
    sed -i '' "s/<KV_SESSIONS_ID_PROD>/$KV_SESSIONS_ID_PROD/g" wrangler.toml
    sed -i '' "s/<R2_BUCKET_NAME_PROD>/$R2_BUCKET_NAME_PROD/g" wrangler.toml
else
    # Linux sed
    sed -i "s/<D1_DATABASE_ID>/$D1_DATABASE_ID/g" wrangler.toml
    sed -i "s/<KV_SESSIONS_ID>/$KV_SESSIONS_ID/g" wrangler.toml
    sed -i "s/<R2_BUCKET_NAME>/$R2_BUCKET_NAME/g" wrangler.toml
    sed -i "s/<D1_DATABASE_ID_PROD>/$D1_DATABASE_ID_PROD/g" wrangler.toml
    sed -i "s/<KV_SESSIONS_ID_PROD>/$KV_SESSIONS_ID_PROD/g" wrangler.toml
    sed -i "s/<R2_BUCKET_NAME_PROD>/$R2_BUCKET_NAME_PROD/g" wrangler.toml
fi

# Clean up
rm -f /tmp/terraform-outputs.json

echo "✅ wrangler.toml generated successfully!"
echo ""
echo "⚠️  Note: Currently using the same resources for dev and prod."
echo "    Consider creating separate development resources in Terraform."