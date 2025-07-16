#!/bin/bash

# Terraform wrapper script for R2 backend configuration
# Usage: ./tf.sh [-e env-file] <terraform-command> [args...]
# Example: ./tf.sh init
#          ./tf.sh -e ../.env.prod init
#          ./tf.sh plan
#          ./tf.sh -e ../.env.dev apply

# Default env file
ENV_FILE="../.env.terraform"

# Parse options
while getopts "e:" opt; do
    case $opt in
        e)
            ENV_FILE="$OPTARG"
            ;;
        \?)
            echo "Invalid option: -$OPTARG" >&2
            echo "Usage: $0 [-e env-file] <terraform-command> [args...]"
            exit 1
            ;;
    esac
done

# Shift past the options
shift $((OPTIND-1))

# Check if we have a terraform command
if [ $# -eq 0 ]; then
    echo "Error: No terraform command specified"
    echo "Usage: $0 [-e env-file] <terraform-command> [args...]"
    exit 1
fi

# Load environment variables
if [ -f "$ENV_FILE" ]; then
    echo "Loading environment from: $ENV_FILE"
    source "$ENV_FILE"
else
    echo "Error: Environment file not found: $ENV_FILE"
    echo "Please create the file or specify a different one with -e"
    exit 1
fi

# Check required variables
if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ] || [ -z "$AWS_ENDPOINT" ]; then
    echo "Error: Required AWS credentials not set in $ENV_FILE"
    echo "Please ensure AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_ENDPOINT are set."
    exit 1
fi

# Special handling for terraform init
if [ "$1" = "init" ]; then
    # Pass the backend config for init
    terraform init \
        -backend-config="endpoint=${AWS_ENDPOINT}" \
        "${@:2}"
else
    # For all other commands, just pass through (Terraform will read TF_VAR_* automatically)
    terraform "$@"
fi
