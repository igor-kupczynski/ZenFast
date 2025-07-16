# Development Migrations

This directory contains migrations that should ONLY be run in local development environments.

## ⚠️ WARNING

**NEVER run these migrations in production!** They contain test data with known passwords.

## Available Dev Migrations

- `0001_seed_data.sql` - Creates test users and sample fasting data

## Test Users

All test users have the same password: `testpass123`

| Email | Name | Description |
|-------|------|-------------|
| alice@example.com | Alice Johnson | Has an active fast and historical data |
| bob@example.com | Bob Smith | Has historical fasting data |
| charlie@example.com | Charlie Brown | New user with no fasts |

## Usage

```bash
# First-time setup: Apply schema and seed data
npm run db:reset:local

# Just apply seed data (after schema is already created)
npm run db:seed:local

# Reset everything and start fresh
npm run db:reset:local
```

## Development Workflow

1. When you clone the repo:
   ```bash
   npm install
   npm run setup         # Generate wrangler.toml
   npm run db:reset:local  # Set up database with test data
   npm run dev          # Start development
   ```

2. To reset your local database:
   ```bash
   npm run db:reset:local
   ```

3. To manually query the local database:
   ```bash
   npm run db:execute:local "SELECT * FROM users"
   ```