# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ZenFast is a Telegram bot for small groups of trusted users (friends/family). It uses API key authentication and runs on CloudFlare Workers.

## Key Context

- **Early stage**: No code yet, only PRD exists
- **Shared context**: All users share the same bot instance
- **Scale**: Designed for 10-50 users, not thousands
- **Security**: API keys with expiry dates, validate all webhooks
- **Budget constraint**: Must cost <$5/month to run

## Important Files

- `specs/prd-001.md`: Detailed requirements and constraints

When implementing, prioritize simplicity and security. The project follows "vibe coding" methodology.