# 001 - ZenFast Backend Implementation Plan

This plan provides a step-by-step guide to implement the ZenFast backend using Cloudflare Workers, TypeScript, and Apple Sign In. Each phase builds naturally on the previous one, allowing you to progress at your own pace.

## Prerequisites

Before starting, ensure you have:
- [X] Node.js 18+ installed
- [X] A Cloudflare account (free tier is fine)
- [X] An Apple Developer account (for Sign in with Apple)
- [X] Terraform installed (`brew install terraform`)
- [X] Git configured with your GitHub account

## Phase 1: Infrastructure Foundation with Terraform

### Step 1.1: Bootstrap Terraform Configuration
- [X] Create `terraform/` directory structure
- [X] Create `terraform/versions.tf`:
  ```hcl
  terraform {
    required_version = ">= 1.0"
    required_providers {
      cloudflare = {
        source  = "cloudflare/cloudflare"
        version = "~> 5.0"
      }
    }
  }
  ```

### Step 1.2: Manual R2 Bucket for Terraform State
- [X] Create R2 bucket manually in Cloudflare dashboard: `zenfast-terraform-state`
- [X] Generate R2 API token with read/write permissions (this is ONLY for state backend)
- [X] Note the account ID and bucket endpoint

### Step 1.2.1: Create Cloudflare API Token for Resource Management
- [X] Go to https://dash.cloudflare.com/profile/api-tokens
- [X] Create a new API token with these permissions:
  - Account: Read
  - Cloudflare D1: Edit
  - Workers KV Storage: Edit
  - Workers R2 Storage: Edit
  - Zone: Read (optional, for custom domains)
- [X] Save this token separately from the R2 token

### Step 1.3: Configure Terraform Backend
- [X] Create `terraform/backend.tf`:
  ```hcl
  terraform {
    backend "s3" {
      bucket = "zenfast-terraform-state"
      key    = "terraform.tfstate"
      region = "auto"
      endpoints = {
        s3 = "https://<your-account-id>.r2.cloudflarestorage.com"
      }
      skip_credentials_validation = true
      skip_metadata_api_check    = true
      skip_region_validation     = true
      skip_requesting_account_id = true
    }
  }
  ```
- [X] Create `.env.terraform.template` with proper documentation for both tokens
- [X] Copy `.env.terraform.template` to `.env.terraform` and fill in:
  - `CLOUDFLARE_API_TOKEN`: Your new API token with resource management permissions
  - `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`: Your R2 token credentials (for state backend only)
  - DO NOT COMMIT `.env.terraform`

### Step 1.4: Define Core Infrastructure
- [X] Create `terraform/main.tf` with:
  - Provider configuration
  - D1 database
  - KV namespace (sessions)
  - R2 bucket (storage)
- [X] Create `terraform/variables.tf` for inputs
- [X] Create `terraform/outputs.tf` to export resource IDs

### Step 1.5: Initialize and Apply Terraform
- [X] Create terraform wrapper script `terraform/tf.sh` for environment management
- [X] Run `./tf.sh init` (upgraded to Cloudflare provider v5)
- [X] Run `./tf.sh plan` to review resources
- [X] Create Cloudflare API token with proper permissions (see Step 1.2.1)
- [X] Update `.env.terraform` with the new API token
- [X] Run `./tf.sh apply` to create infrastructure (resources created successfully!)
- [X] Fix tf.sh backend-config format: use `-backend-config="endpoint=${AWS_ENDPOINT}"` instead of nested JSON
- [X] Run `./tf.sh state push errored.tfstate` to push state to R2 backend
- [X] Save output values (stored in Terraform state, retrieve with `./tf.sh output`)

**Checkpoint**: You now have all Cloudflare infrastructure provisioned via Terraform.

## Phase 2: Project Setup and Configuration

### Step 2.1: Initialize TypeScript Project
- [X] Navigate to `backend/` directory
- [X] Run `npm init -y`
- [X] Install dependencies:
  ```bash
  npm install hono @hono/zod-validator zod jose uuid
  npm install -D @cloudflare/workers-types wrangler typescript vitest @types/node
  npm install -D eslint prettier eslint-config-prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin
  ```

### Step 2.2: Configure TypeScript
- [X] Create `tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "ES2022",
      "lib": ["ES2022"],
      "types": ["@cloudflare/workers-types"],
      "moduleResolution": "node",
      "esModuleInterop": true,
      "strict": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true,
      "resolveJsonModule": true,
      "noEmit": true
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules", "dist"]
  }
  ```

### Step 2.3: Set Up Environment Variables
- [X] Create `.dev.vars.template` for Cloudflare Workers local development:
  ```
  JWT_SECRET=your-jwt-secret-here
  APP_URL=http://localhost:8787
  ```
- [X] Copy `.dev.vars.template` to `.dev.vars` and fill in with actual values
- [X] Update `.gitignore` to exclude `.dev.vars` but include template:
  ```
  .dev.vars
  !.dev.vars.template
  ```
  
  **Note**: Cloudflare Workers uses `.dev.vars` for local development environment variables, not `.env` files.

### Step 2.4: Configure Wrangler
- [X] Create `wrangler.toml.template` with placeholder values (committed to repo)
- [X] Create `setup-wrangler.sh` script to generate `wrangler.toml` from Terraform outputs
- [X] Update `.gitignore` to exclude `wrangler.toml` but include `wrangler.toml.template`
- [X] Run `./setup-wrangler.sh` (or `npm run setup`) to generate your local `wrangler.toml` with actual resource IDs
  
  **Note**: The actual `wrangler.toml` file is NOT committed to the repository for security reasons. 
  Resource IDs should not be exposed in public repositories. Always run `npm run setup` 
  after cloning the repo or when Terraform resources change.

  **Local Development**: When you run `npm run dev`, Wrangler automatically uses local mock resources:
  - D1 database → Local SQLite in `.wrangler/state/v3/d1/`
  - KV namespace → Local storage in `.wrangler/state/v3/kv/`
  - R2 bucket → Local storage in `.wrangler/state/v3/r2/`
  
  This means you can develop without touching production resources! Use `npm run dev:remote` only when you need to test against real Cloudflare resources.

  Template structure (`wrangler.toml.template`):
  ```toml
  name = "zenfast-api"
  main = "src/index.ts"
  compatibility_date = "2024-01-01"

  # Development environment (default)
  [[d1_databases]]
  binding = "DB"
  database_name = "zenfast"
  database_id = "<D1_DATABASE_ID>"

  [[kv_namespaces]]
  binding = "SESSIONS"
  id = "<KV_SESSIONS_ID>"

  [[r2_buckets]]
  binding = "STORAGE"
  bucket_name = "<R2_BUCKET_NAME>"

  # Production environment
  [env.production]
  routes = [
    { pattern = "api.zenfast.eu/*", zone_name = "zenfast.eu" }
  ]

  [[env.production.d1_databases]]
  binding = "DB"
  database_name = "zenfast-prod"
  database_id = "<D1_DATABASE_ID_PROD>"

  [[env.production.kv_namespaces]]
  binding = "SESSIONS"
  id = "<KV_SESSIONS_ID_PROD>"

  [[env.production.r2_buckets]]
  binding = "STORAGE"
  bucket_name = "<R2_BUCKET_NAME_PROD>"
  ```

### Step 2.5: Add NPM Scripts
- [X] Update `package.json`:
  ```json
  {
    "scripts": {
      "setup": "./setup-wrangler.sh",
      "dev": "wrangler dev",
      "dev:prod": "wrangler dev --remote",
      "dev:clean": "rm -rf .wrangler/state && wrangler dev",
      "deploy:prod": "wrangler deploy --env production",
      "test": "vitest",
      "test:watch": "vitest --watch",
      "lint": "eslint src/",
      "lint:fix": "eslint src/ --fix",
      "format": "prettier --write src/",
      "format:check": "prettier --check src/",
      "typecheck": "tsc --noEmit",
      "db:execute": "wrangler d1 execute DB --local --command",
      "db:execute:prod": "wrangler d1 execute DB --command",
      "db:migrations:apply": "wrangler d1 migrations apply DB --local",
      "db:migrations:apply:prod": "wrangler d1 migrations apply DB",
      "db:seed": "wrangler d1 execute DB --local --file=./migrations-dev/0001_seed_data.sql",
      "db:reset": "rm -rf .wrangler/state/v3/d1 && npm run db:migrations:apply && npm run db:seed",
      "hash-password": "node scripts/hash-password.js"
    }
  }
  ```

### Step 2.6: Configure Code Quality Tools
- [X] Create `eslint.config.js` (using new flat config format):
  ```javascript
  import js from '@eslint/js';
  import typescript from '@typescript-eslint/eslint-plugin';
  import typescriptParser from '@typescript-eslint/parser';
  import prettier from 'eslint-config-prettier';

  export default [
    js.configs.recommended,
    prettier,
    {
      files: ['**/*.ts', '**/*.tsx'],
      languageOptions: {
        parser: typescriptParser,
        ecmaVersion: 2022,
        sourceType: 'module',
        globals: {
          console: 'readonly',
          process: 'readonly',
          Buffer: 'readonly',
          Response: 'readonly',
          Request: 'readonly',
          fetch: 'readonly',
        },
      },
      plugins: {
        '@typescript-eslint': typescript,
      },
      rules: {
        ...typescript.configs.recommended.rules,
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/explicit-module-boundary-types': 'off',
      },
    },
    {
      ignores: ['node_modules/', 'dist/', 'build/', '.wrangler/', 'coverage/'],
    },
  ];
  ```
- [X] Create `.prettierrc`:
  ```json
  {
    "semi": true,
    "trailingComma": "es5",
    "singleQuote": true,
    "printWidth": 100,
    "tabWidth": 2
  }
  ```
- [X] Create `.prettierignore` to exclude generated files
- [X] Add `"type": "module"` to package.json for ES module support
- [X] Create `vitest.config.ts`:
  ```typescript
  import { defineConfig } from 'vitest/config';

  export default defineConfig({
    test: {
      environment: 'miniflare',
      environmentOptions: {
        bindings: {
          JWT_SECRET: 'test-secret'
        }
      }
    }
  });
  ```

### Step 2.6.1: Set Up GitHub Actions CI
- [X] Create `.github/workflows/ci.yml`:
  - Runs on every push to main and on PRs
  - Backend checks: TypeScript, ESLint, Prettier, tests
  - Security check: Ensures wrangler.toml isn't committed
  - Terraform checks: Format validation and syntax check
  - Fast fail to save CI minutes

### Step 2.6.2: Set Up Pre-commit Hooks (Optional)
- [X] Create `scripts/setup-git-hooks.sh` for local enforcement
- [X] Add `npm run setup:hooks` command
- [X] Run `npm run setup:hooks` to install the hooks locally
  
  Pre-commit hooks will check:
  - TypeScript types
  - ESLint rules
  - Code formatting
  - Prevent wrangler.toml commits

### Step 2.7: Verify Setup
- [X] Run `terraform/tf.sh output -json > terraform-outputs.json` to capture resource IDs
- [X] Verify database_id and kv_namespace_id are populated in `wrangler.toml`
- [X] Run `npm run typecheck` to ensure TypeScript is properly configured
- [X] Create `src/index.ts` with minimal content:
  ```typescript
  export default {
    async fetch(): Promise<Response> {
      return new Response('Hello ZenFast!', { status: 200 });
    },
  };
  ```
- [X] Run `npm run dev` and verify the worker responds at `http://localhost:8787`
- [X] Run `npm run lint` and `npm run format:check` to verify code quality tools work

**Checkpoint**: Project is configured with TypeScript, Wrangler, and code quality tools verified.

## Phase 3: Database Schema and Migrations

### Step 3.1: Create Migration Files
- [X] Create `migrations/` directory
- [X] Create `migrations/0001_initial_schema.sql`:
  ```sql
  -- Users table
  CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Fasts table
  CREATE TABLE fasts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      started_at TIMESTAMP NOT NULL,
      ended_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Indexes
  CREATE INDEX idx_fasts_user_id ON fasts(user_id);
  CREATE INDEX idx_fasts_started_at ON fasts(started_at);
  CREATE INDEX idx_fasts_ended_at ON fasts(ended_at);

  -- Constraints for one fast per day
  CREATE UNIQUE INDEX idx_unique_fast_start_per_day 
  ON fasts(user_id, date(started_at));

  CREATE UNIQUE INDEX idx_unique_fast_end_per_day 
  ON fasts(user_id, date(ended_at)) 
  WHERE ended_at IS NOT NULL;
  ```

### Step 3.2: Run Migrations
- [X] Apply migrations: `npm run db:migrations:apply`
- [X] Verify migrations: `npm run db:execute "SELECT * FROM sqlite_master"`

### Step 3.3: Create Password Hash Utility
- [ ] Create `scripts/hash-password.js`:
  ```javascript
  import bcrypt from 'bcryptjs';
  import { v4 as uuidv4 } from 'uuid';
  import readline from 'readline';

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
  }

  function questionPassword(query) {
    return new Promise(resolve => {
      rl.question(query, (password) => {
        // Clear the line after password input
        console.log();
        resolve(password);
      });
      // Hide password input
      rl._writeToOutput = function _writeToOutput(stringToWrite) {
        if (rl.line.length === 0) {
          rl.output.write(stringToWrite);
        } else {
          rl.output.write('*');
        }
      };
    });
  }

  async function main() {
    try {
      const email = await question('Email: ');
      const name = await question('Name: ');
      const password = await questionPassword('Password: ');
      
      const userId = uuidv4();
      const hash = await bcrypt.hash(password, 10);
      
      console.log('\n--- SQL Command for Production ---');
      console.log(`INSERT INTO users (id, email, name, password_hash) VALUES ('${userId}', '${email}', '${name}', '${hash}');`);
      console.log('\n--- Execute with ---');
      console.log(`npm run db:execute:prod "INSERT INTO users (id, email, name, password_hash) VALUES ('${userId}', '${email}', '${name}', '${hash}');"`)
    } catch (error) {
      console.error('Error:', error);
    } finally {
      rl.close();
    }
  }

  main();
  ```
- [ ] Add script to package.json: `"hash-password": "node scripts/hash-password.js"`
- [ ] Use this script to generate SQL for production users: `npm run hash-password`

### Step 3.4: Create Development Seed Data
- [X] Create `migrations-dev/` directory for development-only data
- [X] Create `migrations-dev/0001_seed_data.sql`:
  ```sql
  -- Development test users with known passwords
  -- Password for all test users: "testpass123"
  INSERT INTO users (id, email, name, password_hash) VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'alice@test.local', 'Alice Test', '$2b$10$5F.2Z8Qk1j3VH3s1K9JYaOWYqzT4R5pXH8I0dGxqB8ycVxVxG0Eny'),
  ('550e8400-e29b-41d4-a716-446655440002', 'bob@test.local', 'Bob Test', '$2b$10$5F.2Z8Qk1j3VH3s1K9JYaOWYqzT4R5pXH8I0dGxqB8ycVxVxG0Eny'),
  ('550e8400-e29b-41d4-a716-446655440003', 'charlie@test.local', 'Charlie Test', '$2b$10$5F.2Z8Qk1j3VH3s1K9JYaOWYqzT4R5pXH8I0dGxqB8ycVxVxG0Eny');

  -- Sample fasts for Alice
  INSERT INTO fasts (id, user_id, started_at, ended_at) VALUES
  ('660e8400-e29b-41d4-a716-446655440101', '550e8400-e29b-41d4-a716-446655440001', datetime('now', '-7 days', 'start of day', '+6 hours'), datetime('now', '-7 days', 'start of day', '+22 hours')),
  ('660e8400-e29b-41d4-a716-446655440102', '550e8400-e29b-41d4-a716-446655440001', datetime('now', '-5 days', 'start of day', '+6 hours'), datetime('now', '-5 days', 'start of day', '+20 hours')),
  ('660e8400-e29b-41d4-a716-446655440103', '550e8400-e29b-41d4-a716-446655440001', datetime('now', '-2 days', 'start of day', '+6 hours'), datetime('now', '-2 days', 'start of day', '+22 hours')),
  ('660e8400-e29b-41d4-a716-446655440104', '550e8400-e29b-41d4-a716-446655440001', datetime('now', 'start of day', '+6 hours'), NULL); -- Current fast
  ```
- [X] This seed data is ONLY for local development, never for production

### Step 3.5: Create Type Definitions
- [X] Create `src/types/` directory
- [X] Create `src/types/models.ts`:
  ```typescript
  export interface User {
    id: string;
    email: string;
    name: string;
    password_hash: string;
    created_at: string;
    updated_at: string;
  }

  export interface Fast {
    id: string;
    user_id: string;
    started_at: string;
    ended_at: string | null;
    duration_hours: number | null;
    created_at: string;
    updated_at: string;
  }
  ```

**Checkpoint**: ✅ **COMPLETED** - Database schema is created and ready for use. All migrations applied, seed data loaded, and type definitions created.

## Phase 4: Core Application Structure

### Step 4.1: Enhance Worker Entry Point
- [X] Update the existing `src/index.ts` (created in Step 2.7) to full application structure:
  ```typescript
  import { Hono } from 'hono';
  import { cors } from 'hono/cors';
  import { logger } from 'hono/logger';
  
  export interface Env {
    DB: D1Database;
    SESSIONS: KVNamespace;
    STORAGE: R2Bucket;
    JWT_SECRET: string;
    APP_URL: string;
  }

  const app = new Hono<{ Bindings: Env }>();

  // Global middleware
  app.use('*', cors());
  app.use('*', logger());

  // Health check
  app.get('/health', (c) => {
    return c.json({ status: 'ok', environment: 'local' });
  });

  // API routes will be added here
  // app.route('/api/v1/auth', authRoutes);
  // app.route('/api/v1/fasts', fastRoutes);

  export default app;
  ```

### Step 4.2: Create Repository Layer
- [X] Create `src/repositories/` directory
- [X] Create `src/repositories/userRepository.ts`
- [X] Create `src/repositories/fastRepository.ts`
- [X] Implement basic CRUD operations for both

### Step 4.3: Create Service Layer
- [X] Create `src/services/` directory
- [X] Create `src/services/authService.ts`
- [X] Create `src/services/fastService.ts`
- [X] Implement business logic and validation

### Step 4.4: Test Basic Setup
- [X] Run `npm run dev`
- [X] Visit `http://localhost:8787/health`
- [X] Verify response shows correct environment

**Checkpoint**: Basic application structure is working with health check endpoint.

## Phase 5: Simple Authentication (Manual Users)

### Step 5.1: Create User Repository
- [X] Create `src/repositories/userRepository.ts` *(Already completed - includes findByEmail, findById, create, update, delete methods)*

### Step 5.2: Implement Login with Password
- [X] Install bcrypt for password verification *(Already installed: bcryptjs@3.0.2 and @types/bcryptjs@2.4.6)*
- [X] Update `src/services/authService.ts` to add password verification:
  - Import bcryptjs
  - Replace TODO comment with actual bcrypt.compare() implementation
  - Update authenticateUser method to validate passwords
- [X] Create `src/schemas/` directory for validation schemas
- [X] Create `src/schemas/auth.ts` with Zod schemas:
  ```typescript
  import { z } from 'zod';
  
  export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });
  
  export const loginResponseSchema = z.object({
    token: z.string(),
    user: z.object({
      id: z.string(),
      email: z.string().email(),
      name: z.string(),
    }),
  });
  ```
- [X] Create `src/routes/` directory
- [X] Create `src/routes/auth.ts` with login endpoint:
  ```typescript
  import { Hono } from 'hono';
  import { zValidator } from '@hono/zod-validator';
  import { loginSchema } from '../schemas/auth';
  import { AuthService } from '../services/authService';
  import { UserRepository } from '../repositories/userRepository';
  import type { Env } from '../index';
  
  const auth = new Hono<{ Bindings: Env }>();
  
  auth.post('/login', zValidator('json', loginSchema), async (c) => {
    const { email, password } = c.req.valid('json');
    
    const userRepository = new UserRepository(c.env.DB);
    const authService = new AuthService(userRepository, c.env.JWT_SECRET);
    
    const result = await authService.authenticateUser(email, password);
    
    if (!result) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }
    
    return c.json({
      token: result.token,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
    });
  });
  
  export default auth;
  ```

### Step 5.3: Implement JWT Management
- [X] JWT management already implemented in `src/services/authService.ts`:
  - createJWT() method creates tokens with user info
  - verifyJWT() method validates and decodes tokens
  - Uses jose library for JWT operations
  - **Note**: Implementation is in authService.ts rather than separate utils/jwt.ts (better design for encapsulation)

### Step 5.4: Create Auth Middleware
- [X] Create `src/middleware/` directory
- [X] Create `src/middleware/auth.ts`:
  ```typescript
  import { Context, Next } from 'hono';
  import { AuthService } from '../services/authService';
  import { UserRepository } from '../repositories/userRepository';
  import type { Env } from '../index';
  
  export async function authenticate(c: Context<{ Bindings: Env }>, next: Next) {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    
    try {
      const userRepository = new UserRepository(c.env.DB);
      const authService = new AuthService(userRepository, c.env.JWT_SECRET);
      
      const payload = await authService.verifyJWT(token);
      
      // Set user info in context for downstream handlers
      c.set('userId', payload.sub);
      c.set('user', payload);
      
      await next();
    } catch {
      return c.json({ error: 'Invalid token' }, 401);
    }
  }
  ```
- [X] Wire up auth routes in `src/index.ts`:
  ```typescript
  import authRoutes from './routes/auth';
  
  // After existing middleware setup
  app.route('/api/v1/auth', authRoutes);
  ```

### Step 5.5: Test Authentication
- [X] For local development: Use seeded test users (email: `alice@test.local`, password: `testpass123`)
- [ ] For production: Use `npm run hash-password` to generate user SQL, then add manually
- [X] Test login endpoint with curl:
  ```bash
  # Local test
  curl -X POST http://localhost:8787/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email": "alice@test.local", "password": "testpass123"}'
  ```
- [X] Verify JWT generation and decode payload
- [ ] Test protected endpoints with JWT:
  ```bash
  curl http://localhost:8787/api/v1/fasts \
    -H "Authorization: Bearer <your-jwt-token>"
  ```

**Checkpoint**: ✅ **COMPLETED** - Basic authentication is working with manually created users. All authentication components implemented: password verification with bcrypt, JWT management, validation schemas, auth routes, and auth middleware.

## Phase 6: API Endpoints Implementation

### Step 6.1: Implement Fast Management Routes
- [ ] Create `src/routes/fasts.ts`
- [ ] Implement POST `/api/v1/fasts` (start fast)
- [ ] Implement GET `/api/v1/fasts` (list fasts)
- [ ] Implement GET `/api/v1/fasts/current`
- [ ] Implement GET `/api/v1/fasts/:id`
- [ ] Implement PATCH `/api/v1/fasts/:id` (update/end fast)
- [ ] Implement DELETE `/api/v1/fasts/:id`

### Step 6.2: Add Validation
- [ ] Create Zod schemas for all endpoints
- [ ] Implement request validation middleware
- [ ] Add business rule validation:
  - One fast per day constraint
  - User must be authenticated for fast operations
- [ ] Implement proper error responses:
  - 401 for unauthenticated requests
  - 400 for validation errors
  - 409 for business rule violations

### Step 6.3: Connect All Routes
- [ ] Import all routes in `src/index.ts`
- [ ] Configure route prefixes
- [ ] Add global error handling
- [ ] Test all endpoints with curl/Postman

**Checkpoint**: All API endpoints are implemented and functional.

## Phase 7: Testing and Quality Assurance

### Step 7.1: Set Up Testing
- [ ] Create `tests/` directory structure
- [ ] Configure Vitest with Miniflare
- [ ] Create test utilities and fixtures
- [ ] Set up test database

### Step 7.2: Write Tests
- [ ] Unit tests for services
- [ ] Unit tests for repositories
- [ ] Integration tests for auth flow
- [ ] Integration tests for API endpoints
- [ ] Edge case and error handling tests

### Step 7.3: Ensure Code Quality
- [ ] Run full linting check: `npm run lint`
- [ ] Run format check: `npm run format:check`
- [ ] Fix any linting or formatting issues found
- [ ] Run type check: `npm run typecheck`
- [ ] Ensure all tests pass: `npm test`

**Checkpoint**: Comprehensive test suite is in place with >80% coverage.

## Phase 8: Deployment and CI/CD

### Step 8.1: Enhance GitHub Actions for Deployment
- [ ] Update `.github/workflows/ci.yml` to run on main branch only
- [ ] Create `.github/workflows/deploy.yml` for production deployment:
  - Triggered on push to main after CI passes
  - Uses GitHub secrets for Cloudflare API token
  - Deploys to production environment
- [ ] Add required secrets to GitHub repository:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`

### Step 8.2: Production Testing Checklist
- [ ] Test all endpoints locally with `npm run dev`
- [ ] Test authentication flow with production-like users
- [ ] Verify all CRUD operations for fasts
- [ ] Check error handling and validation
- [ ] Monitor logs with `wrangler tail`

### Step 8.3: Production Deployment
- [ ] Add production secrets to Wrangler
- [ ] Deploy to production: `npm run deploy`
- [ ] Verify production endpoints
- [ ] Set up monitoring alerts

**Checkpoint**: Application is deployed to production.

## Phase 9: Monitoring and Operations

### Step 9.1: Set Up Observability
- [ ] Configure structured logging
- [ ] Add request ID tracking
- [ ] Implement error tracking
- [ ] Create performance metrics

### Step 9.2: Create Operational Scripts
- [ ] Database backup script to R2
- [ ] User data export functionality
- [ ] Health check monitoring
- [ ] Secret rotation procedures

### Step 9.3: Documentation
- [ ] API documentation with examples
- [ ] Deployment runbook
- [ ] Troubleshooting guide
- [ ] Architecture decision records

**Checkpoint**: Full observability and operational procedures are in place.

## Review and Next Steps

### Completion Checklist
- [ ] All tests passing
- [ ] Production deployed
- [ ] Authentication system working with manual users
- [ ] All API endpoints functional
- [ ] Monitoring and logging operational
- [ ] Documentation complete

### Potential Enhancements
1. Add push notifications
2. Implement data export features
3. Add analytics dashboard
4. Implement Apple Watch integration
5. Add social features (friends, challenges)

## Troubleshooting Tips

### Common Issues
1. **Terraform state issues**: 
   - Check R2 credentials and bucket permissions
   - Ensure tf.sh uses correct backend-config format: `-backend-config="endpoint=${AWS_ENDPOINT}"`
   - If state push fails with 500 errors, verify the endpoint format is correct
2. **Cloudflare API error 7003**: Verify account ID matches dashboard, check API token has correct permissions (Account:Read, D1:Edit, Workers KV Storage:Edit, Workers R2 Storage:Edit)
3. **Two tokens required**: 
   - Cloudflare API token for managing resources (D1, KV, R2)
   - R2-scoped token for Terraform state backend only
4. **Authentication failing**: 
   - Verify user exists in database
   - Check JWT_SECRET is set correctly in `.dev.vars` file (not `.env`)
   - Ensure Authorization header format is correct: `Bearer <token>`
   - If getting HMAC key length errors, ensure `.dev.vars` file exists and restart `wrangler dev`
5. **User not found**: Use `npm run hash-password` to generate user SQL, then add with: `npm run db:execute:prod "INSERT INTO users..."`
6. **D1 migration errors**: Check SQL syntax and foreign key constraints
7. **Wrangler deployment fails**: Verify all environment variables are set

### Useful Commands
```bash
# View logs
wrangler tail

# Execute D1 queries
npm run db:execute "SELECT * FROM users"

# List KV keys
wrangler kv:key list --binding=SESSIONS

# Check secret values (without exposing them)
wrangler secret list
```

This plan provides a complete path from zero to a fully functional backend. Each phase can be completed independently, and the checkpoints ensure you have a working system at each stage.
