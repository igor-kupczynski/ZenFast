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
- [ ] Navigate to `backend/` directory
- [ ] Run `npm init -y`
- [ ] Install dependencies:
  ```bash
  npm install hono @hono/zod-validator zod jose uuid
  npm install -D @cloudflare/workers-types wrangler typescript vitest @types/node
  npm install -D eslint prettier eslint-config-prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin
  ```

### Step 2.2: Configure TypeScript
- [ ] Create `tsconfig.json`:
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
- [ ] Create `.env.development.template`:
  ```
  APPLE_TEAM_ID=your-apple-team-id
  APPLE_SERVICE_ID=your-apple-service-id
  APPLE_KEY_ID=your-apple-key-id
  APPLE_PRIVATE_KEY=your-apple-private-key-content
  JWT_SECRET=your-jwt-secret
  ```
- [ ] Copy `.env.development.template` to `.env.development` and fill in with actual values
- [ ] Update `.gitignore` to exclude env files but include templates:
  ```
  .env.*
  !.env.*.template
  ```

### Step 2.4: Configure Wrangler
- [ ] Create `wrangler.toml` using Terraform outputs:
  ```toml
  name = "zenfast-api"
  main = "src/index.ts"
  compatibility_date = "2024-01-15"

  # Development environment (default)
  [[d1_databases]]
  binding = "DB"
  database_name = "zenfast"
  database_id = "<from-terraform-output>"

  [[kv_namespaces]]
  binding = "SESSIONS"
  id = "<from-terraform-output>"

  # Production environment
  [env.production]
  routes = [
    { pattern = "api.zenfast.eu/*", zone_name = "zenfast.eu" }
  ]

  [[env.production.d1_databases]]
  binding = "DB"
  database_name = "zenfast"
  database_id = "<from-terraform-output>"

  [[env.production.kv_namespaces]]
  binding = "SESSIONS"
  id = "<from-terraform-output>"
  ```

### Step 2.5: Add NPM Scripts
- [ ] Update `package.json`:
  ```json
  {
    "scripts": {
      "dev": "wrangler dev",
      "deploy": "wrangler deploy",
      "test": "vitest",
      "test:watch": "vitest --watch",
      "lint": "eslint src/",
      "lint:fix": "eslint src/ --fix",
      "format": "prettier --write src/",
      "format:check": "prettier --check src/",
      "typecheck": "tsc --noEmit"
    }
  }
  ```

### Step 2.6: Configure Code Quality Tools
- [ ] Create `.eslintrc.json`:
  ```json
  {
    "root": true,
    "parser": "@typescript-eslint/parser",
    "plugins": ["@typescript-eslint"],
    "extends": [
      "eslint:recommended",
      "plugin:@typescript-eslint/recommended",
      "prettier"
    ],
    "env": {
      "node": true,
      "es2022": true
    },
    "rules": {
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "@typescript-eslint/explicit-module-boundary-types": "off"
    }
  }
  ```
- [ ] Create `.prettierrc`:
  ```json
  {
    "semi": true,
    "trailingComma": "es5",
    "singleQuote": true,
    "printWidth": 100,
    "tabWidth": 2
  }
  ```
- [ ] Create `vitest.config.ts`:
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

### Step 2.7: Verify Setup
- [ ] Run `terraform/tf.sh output -json > terraform-outputs.json` to capture resource IDs
- [ ] Verify database_id and kv_namespace_id are populated in `wrangler.toml`
- [ ] Run `npm run typecheck` to ensure TypeScript is properly configured
- [ ] Create `src/index.ts` with minimal content:
  ```typescript
  export default {
    async fetch(): Promise<Response> {
      return new Response('Hello ZenFast!', { status: 200 });
    },
  };
  ```
- [ ] Run `npm run dev` and verify the worker responds at `http://localhost:8787`
- [ ] Run `npm run lint` and `npm run format:check` to verify code quality tools work

**Checkpoint**: Project is configured with TypeScript, Wrangler, and code quality tools verified.

## Phase 3: Database Schema and Migrations

### Step 3.1: Create Migration Files
- [ ] Create `migrations/` directory
- [ ] Create `migrations/0001_initial_schema.sql`:
  ```sql
  -- Users table
  CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      apple_id TEXT UNIQUE NOT NULL,
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
- [ ] Apply migrations: `wrangler d1 migrations apply zenfast`
- [ ] Verify migrations: `wrangler d1 execute zenfast --command "SELECT * FROM sqlite_master"`

### Step 3.3: Create Type Definitions
- [ ] Create `src/types/` directory
- [ ] Create `src/types/models.ts`:
  ```typescript
  export interface User {
    id: string;
    email: string;
    name: string;
    apple_id: string;
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

**Checkpoint**: Database schema is created and ready for use.

## Phase 4: Core Application Structure

### Step 4.1: Create Worker Entry Point
- [ ] Create `src/index.ts`:
  ```typescript
  import { Hono } from 'hono';
  import { cors } from 'hono/cors';
  import { logger } from 'hono/logger';
  
  export interface Env {
    DB: D1Database;
    SESSIONS: KVNamespace;
    APPLE_TEAM_ID: string;
    APPLE_SERVICE_ID: string;
    APPLE_KEY_ID: string;
    APPLE_PRIVATE_KEY: string;
    JWT_SECRET: string;
  }

  const app = new Hono<{ Bindings: Env }>();

  // Global middleware
  app.use('*', cors());
  app.use('*', logger());

  // Health check
  app.get('/health', (c) => {
    return c.json({ status: 'ok' });
  });

  export default app;
  ```

### Step 4.2: Create Repository Layer
- [ ] Create `src/repositories/` directory
- [ ] Create `src/repositories/userRepository.ts`
- [ ] Create `src/repositories/fastRepository.ts`
- [ ] Implement basic CRUD operations for both

### Step 4.3: Create Service Layer
- [ ] Create `src/services/` directory
- [ ] Create `src/services/authService.ts`
- [ ] Create `src/services/fastService.ts`
- [ ] Implement business logic and validation

### Step 4.4: Test Basic Setup
- [ ] Run `npm run dev`
- [ ] Visit `http://localhost:8787/health`
- [ ] Verify response shows correct environment

**Checkpoint**: Basic application structure is working with health check endpoint.

## Phase 5: Apple Sign In Authentication

### Step 5.1: Configure Apple Sign In
- [ ] In Apple Developer Console:
  - Create App ID with Sign in with Apple capability
  - Create Service ID for web authentication
  - Create private key for Sign in with Apple
  - Configure return URLs
- [ ] Save credentials securely for later use

### Step 5.2: Implement Apple OAuth Flow
- [ ] Create `src/routes/auth.ts`
- [ ] Implement `/api/v1/auth/apple` endpoint
- [ ] Implement Apple client secret generation
- [ ] Implement token exchange with Apple
- [ ] Create or update user on successful auth

### Step 5.3: Implement JWT Management
- [ ] Create `src/utils/jwt.ts`
- [ ] Implement JWT generation with user claims
- [ ] Implement JWT validation middleware
- [ ] Implement refresh token flow with KV

### Step 5.4: Create Auth Middleware
- [ ] Create `src/middleware/auth.ts`
- [ ] Implement JWT validation
- [ ] Add user context to requests
- [ ] Handle token expiration

### Step 5.5: Test Authentication Flow
- [ ] Create test HTML page with Apple Sign In button
- [ ] Test complete OAuth flow
- [ ] Verify JWT generation
- [ ] Test protected endpoint access

**Checkpoint**: Apple Sign In is fully functional with JWT authentication.

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
- [ ] Add business rule validation (one fast per day)
- [ ] Implement proper error responses

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

### Step 7.3: Add Linting and Formatting
- [ ] Configure ESLint rules
- [ ] Configure Prettier
- [ ] Add pre-commit hooks
- [ ] Fix all linting issues

**Checkpoint**: Comprehensive test suite is in place with >80% coverage.

## Phase 8: Deployment and CI/CD

### Step 8.1: Set Up GitHub Actions
- [ ] Create `.github/workflows/test.yml` for testing
- [ ] Create `.github/workflows/deploy.yml` for production deployment
- [ ] Add secret management for deployments

### Step 8.2: Configure Local Testing
- [ ] Test all endpoints locally with `npm run dev`
- [ ] Verify Apple Sign In with localhost
- [ ] Check logs with `wrangler tail`

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
- [ ] Apple Sign In working end-to-end
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
4. **Apple Sign In failing**: Verify all IDs match and return URLs are configured
5. **D1 migration errors**: Check SQL syntax and foreign key constraints
6. **Wrangler deployment fails**: Verify all environment variables are set

### Useful Commands
```bash
# View logs
wrangler tail

# Execute D1 queries
wrangler d1 execute zenfast --command "SELECT * FROM users"

# List KV keys
wrangler kv:key list --binding=SESSIONS

# Check secret values (without exposing them)
wrangler secret list
```

This plan provides a complete path from zero to a fully functional backend. Each phase can be completed independently, and the checkpoints ensure you have a working system at each stage.
