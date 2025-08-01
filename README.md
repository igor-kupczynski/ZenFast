# ZenFast Telegram Bot

A minimal Telegram bot for small groups of trusted users, built on Cloudflare Workers. This bot demonstrates echo functionality as a foundation for future features.

## Features

- ✅ Webhook-based Telegram bot with security validation
- ✅ Echo functionality: responds "You said: [message]" to any text message
- ✅ Works in private chats and group conversations
- ✅ TypeScript implementation with comprehensive tests
- ✅ Automated setup scripts for quick deployment
- ✅ Cloudflare Workers runtime for global edge performance
- ✅ API key generation and management system

## Quick Start

### Prerequisites

- Node.js 18+ installed
- Cloudflare account with Workers access
- Telegram bot token from [@BotFather](https://t.me/BotFather)

### 1. Clone and Install

```bash
git clone <repository-url>
cd zenfast
npm install
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your actual values
```

Fill in your `.env` file:

```env
# Get from: wrangler whoami
CLOUDFLARE_ACCOUNT_ID=your-account-id-here

# Get from @BotFather on Telegram
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Generate a random secret (use: openssl rand -hex 32)
WEBHOOK_SECRET=generate-random-secret-here

# Your worker domain (get this from wrangler deploy output)
# Must be a full URL without wildcards, e.g. https://zenfast.your-subdomain.workers.dev
WORKER_ROUTE=https://zenfast.your-subdomain.workers.dev
```

### 3. Create KV Namespaces

Create the required KV namespaces and add their IDs to `wrangler.toml`:

```bash
# Create KV namespaces (run once)
npx wrangler kv:namespace create API_KEYS
npx wrangler kv:namespace create CHATS
npx wrangler kv:namespace create RATE_LIMITS
```

Each command will output something like:
```
🌀 Creating namespace with title "zenfast-API_KEYS"
✨ Success! Created KV namespace with title "zenfast-API_KEYS" and id "abc123def456"
```

Update `wrangler.toml` with the namespace IDs:

```toml
[[kv_namespaces]]
binding = "API_KEYS"
id = "abc123def456"  # Use the actual ID from create command

[[kv_namespaces]]
binding = "CHATS"
id = "def456ghi789"  # Use the actual ID from create command

[[kv_namespaces]]
binding = "RATE_LIMITS"
id = "ghi789jkl012"  # Use the actual ID from create command
```

### 4. Configure Bot Username

Set the bot username in `wrangler.toml` (this is used for group chat mention detection):

```toml
[vars]
BOT_USERNAME = "YourBotUsernameHere"
```

Replace `YourBotUsernameHere` with your actual bot username (without the @).

### 5. Set Environment Secrets

```bash
# Set required secrets
source .env && echo $BOT_TOKEN | npx wrangler secret put BOT_TOKEN
source .env && echo $WEBHOOK_SECRET | npx wrangler secret put WEBHOOK_SECRET
```

### 6. Deploy Worker

```bash
npm run deploy
```

### 7. Configure Telegram Webhook

First, update your `.env` file with the actual worker URL from the deployment output. Then set the Telegram webhook:

```bash
# Set the webhook (ensure WORKER_ROUTE is correct in .env)
source .env && curl -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${WORKER_ROUTE}/webhook\", \"secret_token\": \"${WEBHOOK_SECRET}\"}"
```

**Important**: Make sure `WORKER_ROUTE` in your `.env` file is:
- A complete URL with `https://`
- Without wildcards or `/*` at the end
- The actual domain from your deployment (usually `https://zenfast.your-subdomain.workers.dev`)

Verify the webhook was set correctly:

```bash
# Check webhook status
source .env && curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
```

### 8. Test Your Bot

Send a message to your bot on Telegram. It should respond with:
```
You said: [your message]
```

## API Key Management

### Generate API Keys

Create API keys for users to access the bot:

```bash
# Generate a new API key
npm run generate-key -- --name "User Name" --expiry "2024-12-31"

# For local testing (stores in local KV)
npm run generate-key -- --name "Test User" --expiry "2024-12-31" --local
```

**Important notes:**
- API keys use 5-word format (e.g., "apple-brave-cloud-dance-eagle")
- Keys are hashed with SHA-256 before storage
- Original keys cannot be recovered - save them securely
- Expiry date must be in YYYY-MM-DD format and in the future
- Keys are stored in the API_KEYS KV namespace

### Key Security

- Keys provide ~55 bits of entropy (5 words × 2000-word dictionary)
- Only SHA-256 hashes are stored in KV
- Keys are displayed only once during generation
- Expiry dates enforce time-based access control

## Development

### Local Development

```bash
# Start local development server
npm run dev
# Worker runs at http://localhost:8787
```

### Testing

```bash
# Run unit tests
npm test

# Test specific file
npm test webhook.test.ts

# Type-check TypeScript files including tests
npm run typecheck
```

### Manual Verification

Use the deployment verification commands from the troubleshooting section below.

## Project Structure

```
zenfast/
├── src/           # TypeScript source code
├── test/          # Unit and integration tests
├── scripts/       # CLI tools and utilities
├── specs/         # Requirements and technical design
├── package.json
├── tsconfig.json
├── wrangler.toml
└── .env.example
```

## API Details

### Webhook Endpoint

- **URL**: `https://your-worker.workers.dev/webhook`
- **Method**: POST
- **Security**: Validates `X-Telegram-Bot-Api-Secret-Token` header
- **Response**: Always returns 200 OK to Telegram (best practice)

### Message Processing

- **Private chats**: Processes all text messages
- **Group chats**: Processes only messages that:
  - Contain bot commands (detected via Telegram entities)
  - Mention the bot `@BOT_USERNAME` (detected via Telegram entities or text fallback)
  - Are replies to messages sent by the bot (detected via bot ID from token)

**Group Chat Examples:**
- ✅ `/start` - Bot command
- ✅ `@ZenFastBot hello` - Bot mention with entity
- ✅ `hello @ZenFastBot` - Bot mention in text
- ✅ Replying to a bot message - Reply detection
- ❌ `Regular group message` - Ignored
- ❌ `@OtherBot hello` - Different bot mention

### Echo Functionality

All processed messages receive a response:
```
You said: [original message]
```

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start local development server |
| `npm test` | Run unit tests |
| `npm run build` | Compile TypeScript |
| `npm run typecheck` | Type-check all TypeScript files including tests |
| `npm run deploy` | Deploy to Cloudflare Workers |
| `npm run generate-key` | Generate API keys for users |

## Troubleshooting

### Common Issues

**Bot not responding:**
1. Check webhook status: `source .env && curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"`
2. Verify environment variables in `.env`
3. Check Cloudflare Workers logs: `npx wrangler tail`

**Webhook errors:**
1. Ensure `WEBHOOK_SECRET` matches in `.env` and Telegram
2. Verify worker URL is accessible
3. Check bot token is valid

**Deployment failures:**
1. Verify `CLOUDFLARE_ACCOUNT_ID` is correct
2. Ensure you're logged in: `npx wrangler auth login`
3. Check account has Workers access

**WORKER_ROUTE format errors:**
1. Must be a complete URL: `https://your-domain.workers.dev`
2. No wildcards or `/*` at the end
3. Get actual URL from `npm run deploy` output

## Deployment Verification

If you need to verify your deployment manually:

```bash
# 1. Test worker is responding
source .env && curl -I "${WORKER_ROUTE}/"
# Should return 404 (expected for GET /)

# 2. Test webhook security
source .env && curl -X POST "${WORKER_ROUTE}/webhook" \
  -H "X-Telegram-Bot-Api-Secret-Token: invalid" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
# Should return 401 Unauthorized

# 3. Check Telegram webhook status
source .env && curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
# Should show your webhook URL and status

# 4. Test with actual message to bot on Telegram
```

## Security

- Webhook validation using secret token
- No sensitive data logged
- Direct Telegram API calls (no third-party SDKs)
- Environment variables for all secrets

## Next Steps

This echo bot with API key generation provides the foundation for implementing:

1. **Authentication system** (API key validation - partially complete)
2. **Rate limiting**
3. **Custom commands**
4. **Shared context features**
5. **User management and permissions**

See `specs/tdd-001.md` for the full technical design.

## Contributing

1. Make changes to TypeScript files in `src/`
2. Add tests in `test/`
3. Run `npm test` to verify
4. Test locally with `npm run dev`
5. Deploy with `npm run deploy`
