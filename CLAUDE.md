# ZenFast Development Guidelines

This is a monorepo for the ZenFast intermittent fasting tracker app.

## Specs
- `specs/api.md` - describes the backend API structure


## Terraform
- Always use the wrapper script `terraform/tf.sh` instead of running `terraform` directly
- The wrapper script automatically sources environment variables from `../.env.terraform`
- Usage: `./tf.sh <terraform-command>` (e.g., `./tf.sh init`, `./tf.sh plan`, `./tf.sh apply`)
- The `.env.terraform` file must be in the project root (parent of terraform directory)
