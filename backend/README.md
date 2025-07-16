# ZenFast Backend

A Cloudflare Workers-based backend for the ZenFast intermittent fasting tracker.

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Language**: TypeScript
- **Framework**: Hono
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare KV (sessions), R2 (files)
- **Validation**: Zod
- **Authentication**: JWT with bcrypt password hashing

## Development Setup

### Prerequisites

- Node.js 18+
- npm or equivalent package manager
- Terraform (for infrastructure setup)
- Access to the `.env.terraform` file with Cloudflare credentials

### Quick Start for New Developers

```bash
# 1. Clone the repository
git clone https://github.com/your-org/zenfast
cd zenfast/backend

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.development.template .env.development
# Generate a JWT secret:
openssl rand -base64 32
# Add the generated secret to .env.development

# 4. Generate wrangler.toml from Terraform outputs
npm run setup

# 5. Set up local database with test data
npm run db:reset

# 6. Start development server
npm run dev
```

The development server will start at `http://localhost:8787`. 

### Test Credentials

After running `npm run db:reset`, you can use these test accounts:

| Email | Password | Description |
|-------|----------|-------------|
| alice@example.com | testpass123 | Has an active fast |
| bob@example.com | testpass123 | Has fasting history |
| charlie@example.com | testpass123 | New user, no fasts |

## Local Development

When you run `npm run dev`, Wrangler automatically uses local mock resources:
- **D1 Database** → Local SQLite in `.wrangler/state/v3/d1/`
- **KV Namespace** → Local storage in `.wrangler/state/v3/kv/`
- **R2 Bucket** → Local storage in `.wrangler/state/v3/r2/`

This means you develop without touching production resources!

### How Database Commands Work

The `DB` in database commands like `wrangler d1 execute DB` refers to the **binding name** from your `wrangler.toml`, not a database name:

```toml
[[d1_databases]]
binding = "DB"                    # This is what the command references
database_name = "zenfast"         # The actual database name
database_id = "abc123..."         # The Cloudflare D1 database ID
```

- **Local commands** (with `--local` flag) → Execute against local SQLite in `.wrangler/state/v3/d1/`
- **Production commands** (without `--local`) → Execute against the actual Cloudflare D1 database

So `npm run db:execute "SELECT * FROM users"` runs against your local SQLite file, while `npm run db:execute:prod "SELECT * FROM users"` runs against the production D1 database in Cloudflare.

### Available Scripts

**Development:**
- `npm run setup` - Generate wrangler.toml from Terraform outputs
- `npm run dev` - Start local development (uses mock resources)
- `npm run dev:prod` - Development with real Cloudflare resources (use carefully!)
- `npm run dev:clean` - Reset local state and start fresh

**Database:**
- `npm run db:reset` - Reset local database with schema and test data
- `npm run db:seed` - Add test data to existing local database
- `npm run db:execute "SQL"` - Run SQL against local SQLite database
- `npm run db:execute:prod "SQL"` - Run SQL against production D1 database
- `npm run db:migrations:apply` - Apply migrations to local database
- `npm run db:migrations:apply:prod` - Apply migrations to production database

**Code Quality:**
- `npm run typecheck` - TypeScript type checking
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format with Prettier
- `npm run format:check` - Check formatting
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode

**Deployment:**
- `npm run deploy:prod` - Deploy to production

## Project Structure

```
backend/
├── src/
│   ├── index.ts          # Worker entry point
│   ├── types/           # TypeScript type definitions
│   ├── routes/          # API route handlers
│   ├── services/        # Business logic
│   ├── repositories/    # Data access layer
│   ├── middleware/      # Authentication, validation
│   └── utils/           # Utilities (JWT, etc.)
├── migrations/          # Production database migrations
├── migrations-dev/      # Development-only seed data
├── scripts/            # Utility scripts
├── .env.development.template  # Environment template
├── wrangler.toml.template    # Wrangler config template
└── package.json
```

## Security Notes

1. **Never commit sensitive data:**
   - `wrangler.toml` (contains resource IDs)
   - `.env.development` (contains secrets)
   - Any file with real API keys or passwords

2. **Development migrations are for local use only:**
   - Files in `migrations-dev/` contain test data with known passwords
   - Safety checks prevent running these in production
   - See `migrations-dev/README.md` for details

3. **Resource IDs are kept private:**
   - Use `npm run setup` to generate `wrangler.toml` from Terraform
   - The template files can be safely committed

## Infrastructure

Infrastructure is managed via Terraform in the `../terraform/` directory.

Key resources:
- **D1 Database**: SQLite-compatible database for user and fasting data
- **KV Namespace**: Key-value storage for session management
- **R2 Bucket**: Object storage for future file uploads

To provision infrastructure, see `../terraform/README.md`.

## API Endpoints

See `../specs/api.md` for the complete API specification.

Key endpoints:
- `POST /api/v1/auth/login` - Login with email/password
- `GET /api/v1/fasts` - List user's fasts
- `POST /api/v1/fasts` - Start a new fast
- `PATCH /api/v1/fasts/:id` - Update/end a fast

Remember: `main` branch should always be deployable!
