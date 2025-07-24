# ZenFast Telegram Bot

A minimal Telegram bot for small groups of trusted users, built on Cloudflare Workers. This bot demonstrates echo functionality as a foundation for future features.

## Features

- ✅ Webhook-based Telegram bot with security validation
- ✅ Echo functionality: responds "You said: [message]" to any text message
- ✅ Works in private chats and group conversations
- ✅ TypeScript implementation with comprehensive tests
- ✅ Automated setup scripts for quick deployment
- ✅ Cloudflare Workers runtime for global edge performance

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

# Your worker domain (will be provided after first deployment)
WORKER_ROUTE=https://bot.zenfast.eu
```

### 3. Automated Deployment

```bash
# Run all setup steps
npm run setup
```

This command will:
1. Create KV namespaces and update `wrangler.toml`
2. Deploy the worker to Cloudflare
3. Configure the Telegram webhook

### 4. Test Your Bot

Send a message to your bot on Telegram. It should respond with:
```
You said: [your message]
```

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
```

### Manual Verification

```bash
# Verify deployment status
npm run verify
```

## Project Structure

```
zenfast/
├── src/
│   ├── index.ts          # Main worker entry point
│   ├── types.ts          # TypeScript type definitions
│   ├── webhook.ts        # Webhook validation and processing
│   └── telegram.ts       # Telegram API interaction
├── test/
│   ├── index.test.ts     # Worker integration tests
│   ├── webhook.test.ts   # Webhook validation tests
│   └── telegram.test.ts  # Telegram API tests
├── scripts/
│   ├── create-namespaces.ts  # KV namespace creation
│   ├── setup-webhook.ts      # Webhook configuration
│   └── verify-deployment.ts  # Deployment verification
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
- **Group chats**: Processes only:
  - Messages mentioning `@your_bot_username`
  - Commands starting with `/`
  - Replies to bot messages

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
| `npm run deploy` | Deploy to Cloudflare Workers |
| `npm run setup:namespaces` | Create KV namespaces |
| `npm run setup:webhook` | Configure Telegram webhook |
| `npm run setup` | Full automated setup |
| `npm run verify` | Verify deployment status |

## Troubleshooting

### Common Issues

**Bot not responding:**
1. Check webhook status: `npm run verify`
2. Verify environment variables in `.env`
3. Check Cloudflare Workers logs: `wrangler tail`

**Webhook errors:**
1. Ensure `WEBHOOK_SECRET` matches in `.env` and Telegram
2. Verify worker URL is accessible
3. Check bot token is valid

**Deployment failures:**
1. Verify `CLOUDFLARE_ACCOUNT_ID` is correct
2. Ensure you're logged in: `wrangler auth login`
3. Check account has Workers access

### Manual Commands

If automatic setup fails, you can run commands manually:

```bash
# Create KV namespaces
wrangler kv:namespace create "API_KEYS"
wrangler kv:namespace create "CHATS"
wrangler kv:namespace create "RATE_LIMITS"

# Deploy worker
wrangler deploy

# Set webhook (replace with your values)
curl -X POST https://api.telegram.org/bot<BOT_TOKEN>/setWebhook \
  -d "url=https://your-worker.workers.dev/webhook" \
  -d "secret_token=your-webhook-secret"
```

## Security

- Webhook validation using secret token
- No sensitive data logged
- Direct Telegram API calls (no third-party SDKs)
- Environment variables for all secrets

## Next Steps

This basic echo bot provides the foundation for implementing:

1. **Authentication system** (as per TDD-001)
2. **API key management**
3. **Rate limiting**
4. **Custom commands**
5. **Shared context features**

See `specs/tdd-001.md` for the full technical design.

## Contributing

1. Make changes to TypeScript files in `src/`
2. Add tests in `test/`
3. Run `npm test` to verify
4. Test locally with `npm run dev`
5. Deploy with `npm run deploy`

## License

This project is licensed under the MIT License.
