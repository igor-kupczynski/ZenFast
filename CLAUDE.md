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

When implementing, prioritize simplicity and security. The project follows "vibe coding" methodology. Keep comments minimal - only add them when the code's purpose isn't obvious from reading it.