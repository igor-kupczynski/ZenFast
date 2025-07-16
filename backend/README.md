# ZenFast Backend

A Cloudflare Workers-based backend for the ZenFast intermittent fasting tracker.

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Language**: TypeScript
- **Framework**: Hono
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare KV (sessions), R2 (files)
- **Validation**: Zod
- **Authentication**: JWT with manual user management (temporary)

## Development Setup

### Prerequisites

- Node.js 18+
- Wrangler CLI (installed via npm)
- Access to Cloudflare account with provisioned infrastructure

### Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.development.template .env.development
   # Edit .env.development with your values:
   # - JWT_SECRET: Generate with `openssl rand -base64 32`
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

### Available Scripts

- `npm run dev` - Start development server
- `npm run deploy` - Deploy to production
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run typecheck` - Run TypeScript type checking

## Project Structure

```
src/
├── index.ts          # Worker entry point
├── types/           # Type definitions
├── routes/          # API route handlers
├── services/        # Business logic
├── repositories/    # Data access layer
├── middleware/      # Custom middleware
└── utils/           # Utility functions
```

## Authentication

The backend uses password-based authentication:
1. Users are manually added to the database with bcrypt password hashes
2. Login with email and password
3. System verifies the password and issues a JWT for the session

To add a new user:
```bash
# First, generate a bcrypt hash for the password (use an online tool or Node.js script)
# Example for password "mypassword123" with cost factor 10:
# $2b$10$N9qo8uLOickgx2ZMRZoMye...

# Then add the user with the hash:
wrangler d1 execute zenfast --command "INSERT INTO users (id, email, name, password_hash) VALUES ('550e8400-e29b-41d4-a716-446655440000', 'user@example.com', 'User Name', '$2b$10$N9qo8uLOickgx2ZMRZoMye...')"
```

### Generating Password Hashes

You can use Node.js to generate bcrypt hashes:
```javascript
const bcrypt = require('bcryptjs');
const password = 'mypassword123';
const hash = bcrypt.hashSync(password, 10);
console.log(hash);
```

Note: User registration endpoints will be added later. For now, users must be manually created.

## Infrastructure

Infrastructure is managed via Terraform. See `../terraform/` for configuration.

Resources:
- D1 Database: `zenfast`
- KV Namespace: `SESSIONS`
- R2 Bucket: `zenfast-storage`