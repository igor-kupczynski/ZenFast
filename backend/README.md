# ZenFast Backend

A Cloudflare Workers-based backend for the ZenFast intermittent fasting tracker.

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Language**: TypeScript
- **Framework**: Hono
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare KV (sessions), R2 (files)
- **Validation**: Zod
- **Authentication**: Apple Sign In with JWT

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
   # Edit .env.development with your values
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

## Infrastructure

Infrastructure is managed via Terraform. See `../terraform/` for configuration.

Resources:
- D1 Database: `zenfast`
- KV Namespace: `SESSIONS`
- R2 Bucket: `zenfast-storage`