# ZenFast Development Guidelines

This is a monorepo for the ZenFast intermittent fasting tracker app.

## Specs
- `specs/api.md` - describes the backend API structure

## Backend Development

### Directory Structure
- `backend/` - Cloudflare Workers backend implementation
- All backend work should be done in the `backend/` directory
- Use `cd backend/` before running npm commands

### Development Commands
- `npm run dev` - Start local development server
- `npm run typecheck` - Run TypeScript type checking
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run test` - Run tests

### Code Quality
- Always run `npm run typecheck` before committing
- Use ESLint and Prettier for consistent code style
- Write tests for business logic

## Terraform
- Always use the wrapper script `terraform/tf.sh` instead of running `terraform` directly
- The wrapper script automatically sources environment variables from `../.env.terraform`
- Usage: `./tf.sh <terraform-command>` (e.g., `./tf.sh init`, `./tf.sh plan`, `./tf.sh apply`)
- The `.env.terraform` file must be in the project root (parent of terraform directory)
