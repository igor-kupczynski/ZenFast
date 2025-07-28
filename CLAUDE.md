# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ZenFast is a Telegram bot for small groups of trusted users (friends/family). It uses API key authentication and runs on CloudFlare Workers.

## Key Context

- **Current stage**: Basic echo bot implemented (Issue #2), foundation ready for authentication features
- **Shared context**: All users share the same bot instance
- **Scale**: Designed for 10-50 users, not thousands
- **Security**: API keys with expiry dates, validate all webhooks
- **Budget constraint**: Must cost <$5/month to run

## Important Files

- `specs/prd-001.md`: Detailed requirements and constraints
- `specs/tdd-001.md`: Technical design and TypeScript types
- `src/types.ts`: Core type definitions for Telegram API and storage
- `README.md`: Setup instructions and project structure
- `test/`: Comprehensive test suite for all functionality

## Code Standards

### TypeScript Requirements
- **Strict compilation**: All code must compile without TypeScript errors (`npm run build`)
- **Import paths**: Use relative imports WITHOUT `.js` extensions (e.g., `import { foo } from './bar'`)
- **Null safety**: Handle potential `undefined` values explicitly, especially for array access and crypto operations
- **Type safety**: Avoid `any` types, use proper type annotations
- **Script configuration**: All `.ts` files in `scripts/` must be included in tsconfig.json with proper Node.js types
- **Test configuration**: Test files use a separate `tsconfig.test.json` that extends the main configuration

### Import Guidelines
- Use relative imports for local modules: `import { Type } from '../types'`
- No file extensions in TypeScript imports
- Group imports: external packages first, then local imports

### Testing Requirements
- All new functionality must have corresponding tests
- Tests must pass before code is considered complete
- Use descriptive test names and organize with `describe` blocks
- **Meaningful assertions**: All declared variables in tests must be used in assertions
- Test deterministic behavior with known inputs/outputs when possible

### Build Verification
- Always run `npm run build` after making changes
- Run `npm run typecheck` to verify all TypeScript files including tests compile without errors
- Ensure `npm test` passes for affected modules
- CLI scripts must be tested with actual execution

When implementing, prioritize simplicity and security. The project follows "vibe coding" methodology. Keep comments minimal - only add them when the code's purpose isn't obvious from reading it.