# ZenFast Developer Guidelines (Project-Specific)

This document captures practical, validated guidance for working on this repository. It is targeted at advanced developers; it focuses on details specific to this project and its toolchain.

Important conventions for this repository:
- Always run npm commands with CI=TRUE to avoid interactive prompts in automation.
- TypeScript must compile cleanly (strict). Use extensionless relative imports (no .js or .ts extensions).
- Tests must pass before code is considered complete.


## 1) Build and Configuration

Prerequisites:
- Node.js 18+ (Worker code runs on Cloudflare Workers; scripts run under Node).
- No global wrangler required; repo uses devDependency wrangler@^4.26.0 via npm scripts.

Install dependencies (reproducible):
- CI=TRUE npm ci
  - Alternatively: CI=TRUE npm install

TypeScript build (tsc):
- CI=TRUE npm run build
  - tsconfig.json enforces strict settings (moduleResolution=bundler, isolatedModules, noUnused*, exactOptionalPropertyTypes, etc.).
  - outDir: dist; rootDir includes src and scripts.

Type-check including tests (no emit):
- CI=TRUE npm run typecheck
  - Uses tsconfig.test.json which extends the main config and includes src, test, scripts with types [@cloudflare/workers-types, node, vitest/globals].

Runtime configuration and environment:
- Copy example env and fill in required values:
  - cp .env.example .env
  - Required keys in .env: CLOUDFLARE_ACCOUNT_ID, BOT_TOKEN, WEBHOOK_SECRET, WORKER_ROUTE
- wrangler.toml:
  - main = "src/index.ts"
  - Bot username under [vars] BOT_USERNAME (used by the worker)
  - KV namespaces for API_KEYS, CHATS, RATE_LIMITS, FASTS are defined with IDs
- Secrets (for deployed worker) are managed via Wrangler, not .env:
  - echo "$BOT_TOKEN" | npx wrangler secret put BOT_TOKEN --silent
  - echo "$WEBHOOK_SECRET" | npx wrangler secret put WEBHOOK_SECRET --silent

Cloudflare KV namespaces setup:
- CI=TRUE npm run setup-kv
  - scripts/setup-kv-namespaces.ts will:
    - List/create KV namespaces and update wrangler.toml with IDs (expects Wrangler v4 JSON output)
    - Notes: When re-running with existing namespaces, the script detects and reuses IDs.

Deploy worker:
- CI=TRUE npm run deploy
  - Deploys via wrangler deploy using wrangler.toml.

Full deploy flow (orchestration script):
- CI=TRUE npm run deploy:full
  - scripts/deploy.sh performs: dependency check, build, KV setup, deploy, set secrets, configure webhook, health check.
  - Some steps may require Cloudflare login (wrangler login). In CI, provide pre-auth where needed.

Webhook configuration (post-deploy):
- CI=TRUE npm run setup-webhook -- --status | --force
  - Requires .env (BOT_TOKEN, WEBHOOK_SECRET, WORKER_ROUTE). Validates URL and sets/validates Telegram webhook.


## 2) Testing

Runner and configuration:
- Vitest with Node environment (vitest.config.ts): globals enabled, environment: 'node'.
- tsconfig.test.json sets vitest/globals types so you can use describe/it/expect without imports if desired.

Running tests:
- CI=TRUE npm test
  - Note: Some tests intentionally print error messages to stderr (e.g., simulated network failures, invalid JSON); this is expected and the suite still passes.

Coverage:
- CI=TRUE npx vitest run --coverage
  - Uses @vitest/coverage-v8 (present in devDependencies).

Project test layout and utilities:
- Tests live under test/**/*.test.ts
- Useful helpers:
  - test/utils/mockKv.ts → MockKV: in-memory KV replacement used by higher-level tests.
- Timezone-sensitive tests:
  - src/time-adjustments.ts and test/time-adjustments.test.ts rely on Intl time zone handling (e.g., 'Europe/Paris'). Node 18 ships ICU with time zones; ensure a full-ICU build in environments where this may vary.

Adding new tests (patterns and constraints):
- Follow CLAUDE.md testing requirements:
  - Use descriptive test names; group with describe blocks.
  - Make all declared variables meaningful and asserted.
  - Keep tests deterministic; prefer fixed inputs/outputs.
- Import style: use extensionless relative imports (no .js or .ts extensions) (e.g., import { foo } from '../src/foo').
- Avoid hitting real networks in unit tests; if needed, stub fetch or other effects.

Example: creating and running a simple test (validated)
1) Create a test file test/tmp.sanity.test.ts with:
   import { describe, it, expect } from 'vitest';
   describe('sanity', () => {
     it('adds numbers', () => {
       expect(2 + 2).toBe(4);
     });
   });

2) Run the suite and verify the new test is included:
   CI=TRUE npm test

3) Remove the temporary test when done:
   rm test/tmp.sanity.test.ts

This flow was executed and verified in this session.


## 3) Additional Development Information

Coding standards (enforced by convention and CLAUDE.md):
- Strict TS: all builds must pass tsc without errors.
- Import paths: use relative paths without .js extensions.
- Null/undefined safety: handle potential undefined, including array access and crypto operations.
- Avoid any; keep types precise; prefer explicit return types on exported functions.
- Keep comments minimal; code should be self-explanatory.

Workers vs Node distinctions:
- Worker runtime code (src/*) should not rely on Node-only APIs.
- Scripts (scripts/*) run under Node via tsx and may use child_process, fs, etc. These are included in tsconfig.json and covered by typecheck via tsconfig.test.json.

Cloudflare/Wrangler specifics and pitfalls:
- setup-kv-namespaces.ts expects Wrangler v4 JSON output for `kv namespace list`. Ensure using the project’s wrangler version (via npm scripts) to avoid format drift.
- KV namespaces are mirrored into wrangler.toml. If IDs drift (e.g., reprovision), re-run CI=TRUE npm run setup-kv.
- setup-webhook.ts requires WORKER_ROUTE to be a concrete workers.dev URL (no wildcards). It will refuse invalid formats.

Repository structure highlights:
- src/commands.ts: command routing and handlers (start, end, stats, timezone, etc.).
- src/time-adjustments.ts: relative/absolute time parsing and validation helpers.
- tests cover command routing, auth, fasting logic, crypto, webhook parsing, Telegram API wrapper, integration flows, and time adjustments.

Local development server:
- CI=TRUE npm run dev (wrangler dev) to run locally at http://localhost:8787 (may require Cloudflare login; for CI stick to tests and build).

CI-friendly reminders:
- Prefix all npm invocations with CI=TRUE.
- Some tests log expected error messages; treat stderr noise as acceptable if the test suite passes.

If introducing new scripts:
- Place in scripts/, keep them executable via tsx, and ensure they typecheck under tsconfig.test.json.
- For CLI-style scripts, avoid interactive prompts; accept flags and fail fast with clear errors.
