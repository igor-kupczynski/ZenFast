# ZenFast Deployment Guide

This guide covers deploying ZenFast from scratch, managing deployments, and handling common operational scenarios.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [One-Command Deployment](#one-command-deployment)
3. [Manual Deployment Steps](#manual-deployment-steps)
4. [Environment Variables](#environment-variables)
5. [Rollback Procedures](#rollback-procedures)
6. [Monitoring and Troubleshooting](#monitoring-and-troubleshooting)
7. [Operational Runbook](#operational-runbook)

## Pre-Deployment Checklist

**System Requirements:**
- [ ] Node.js 18+ installed
- [ ] Cloudflare account with Workers access
- [ ] Terminal with bash support

**Telegram Setup:**
- [ ] Bot created via [@BotFather](https://t.me/BotFather) 
- [ ] Bot token saved
- [ ] Bot username noted (without @)

**Required Information:**
- **Cloudflare Account ID**: Get from `npx wrangler whoami`
- **Bot Token**: From @BotFather (format: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)
- **Bot Username**: Without @ symbol (e.g., `ZenFastBot`)
- **Webhook Secret**: Generate with `openssl rand -hex 32`

## One-Command Deployment

**Quick deployment in 5 minutes:**

```bash
# 1. Clone and setup
git clone <repository-url>
cd zenfast
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your values (see Pre-Deployment Checklist)

# 3. Deploy everything
npm run deploy:full
```

**What the script does automatically:**
- ✅ Validates all prerequisites
- ✅ Builds TypeScript code
- ✅ Creates KV namespaces
- ✅ Deploys to Cloudflare Workers
- ✅ Sets secrets and configures webhook
- ✅ Runs health checks

> **Success!** Your bot should be ready to use. Send it a message on Telegram.

## Manual Deployment Steps

If you prefer manual control or need to troubleshoot:

### 1. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit with your values
# Required: CLOUDFLARE_ACCOUNT_ID, BOT_TOKEN, WEBHOOK_SECRET
```

### 2. Cloudflare Authentication

```bash
# Login to Cloudflare
npx wrangler login

# Verify authentication
npx wrangler whoami
```

### 3. Create KV Namespaces

```bash
# Automatically create and configure namespaces
npm run setup-kv

# Or manually create each namespace:
npx wrangler kv namespace create zenfast-API_KEYS
npx wrangler kv namespace create zenfast-CHATS
npx wrangler kv namespace create zenfast-RATE_LIMITS
# Then update wrangler.toml with the IDs
```

### 4. Deploy Worker

```bash
# Build TypeScript
npm run build

# Deploy to Cloudflare
npm run deploy

# Note the deployed URL (e.g., https://zenfast.your-subdomain.workers.dev)
# Update WORKER_ROUTE in .env with this URL
```

### 5. Set Secrets

```bash
# Set bot token
echo $BOT_TOKEN | npx wrangler secret put BOT_TOKEN

# Set webhook secret
echo $WEBHOOK_SECRET | npx wrangler secret put WEBHOOK_SECRET
```

### 6. Configure Webhook

```bash
# Set up Telegram webhook
npm run setup-webhook

# Verify webhook status
npm run setup-webhook -- --status
```

### 7. Verify Deployment

```bash
# Check health endpoint
curl https://your-worker.workers.dev/health

# Monitor logs
npx wrangler tail
```

## Environment Variables

### Local Configuration (.env)

| Variable | Description | How to Get | Example |
|----------|-------------|------------|---------|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID | `npx wrangler whoami` | `abc123def456` |
| `BOT_TOKEN` | Telegram bot token | @BotFather | `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz` |
| `WEBHOOK_SECRET` | Webhook validation secret | `openssl rand -hex 32` | `64-character hex string` |
| `WORKER_ROUTE` | Worker URL | Auto-updated by deploy script | `https://zenfast.subdomain.workers.dev` |

### Worker Configuration (wrangler.toml)

```toml
[vars]
BOT_USERNAME = "YourBotUsername"  # Without @ symbol
```

### Production Secrets

Secrets are encrypted and stored in Cloudflare:

```bash
echo $BOT_TOKEN | wrangler secret put BOT_TOKEN
echo $WEBHOOK_SECRET | wrangler secret put WEBHOOK_SECRET
```

## Rollback Procedures

### Quick Rollback

To rollback to a previous deployment:

```bash
# List recent deployments
npx wrangler deployments list

# Rollback to specific deployment
npx wrangler rollback --deployment-id <deployment-id>

# Verify rollback
curl https://your-worker.workers.dev/health
```

### Full Rollback Process

1. **Identify the Issue**
   ```bash
   # Check logs for errors
   npx wrangler tail
   
   # Test health endpoint
   curl https://your-worker.workers.dev/health
   ```

2. **Rollback Deployment**
   ```bash
   # Find last working deployment
   npx wrangler deployments list
   
   # Rollback
   npx wrangler rollback --deployment-id <id>
   ```

3. **Verify Rollback**
   ```bash
   # Test bot functionality
   # Send test message on Telegram
   
   # Check webhook status
   npm run setup-webhook -- --status
   ```

4. **Fix and Redeploy**
   ```bash
   # Fix the issue in code
   # Test locally: npm run dev
   # Deploy fix: npm run deploy
   ```

## Monitoring and Troubleshooting

### Real-time Logs

```bash
# Stream live logs
npx wrangler tail

# Filter logs by status
npx wrangler tail --status error

# Search logs
npx wrangler tail --search "authentication"
```

### Health Monitoring

The `/health` endpoint provides:
- Overall system status
- KV namespace connectivity
- Configuration validation
- Response time metrics

```bash
# Check health
curl https://your-worker.workers.dev/health | jq '.'

# Monitor health continuously
watch -n 30 'curl -s https://your-worker.workers.dev/health | jq .status'
```

### Common Issues

#### Bot Not Responding

1. Check webhook configuration:
   ```bash
   npm run setup-webhook -- --status
   ```

2. Verify secrets are set:
   ```bash
   npx wrangler secret list
   ```

3. Check logs for errors:
   ```bash
   npx wrangler tail
   ```

#### Authentication Failures

1. Verify bot token:
   ```bash
   # Re-set bot token
   echo $BOT_TOKEN | npx wrangler secret put BOT_TOKEN
   ```

2. Check webhook secret matches:
   ```bash
   # Re-configure webhook
   npm run setup-webhook -- --force
   ```

#### KV Namespace Errors

1. Verify namespaces exist:
   ```bash
   npx wrangler kv namespace list
   ```

2. Check namespace bindings in wrangler.toml

3. Re-create if needed:
   ```bash
   npm run setup-kv -- --force
   ```

## Operational Runbook

### Daily Operations

- **Monitor Health**: Check `/health` endpoint periodically
- **Review Logs**: Look for errors or unusual patterns
- **Check Metrics**: Monitor request counts and response times

### Weekly Tasks

- **Review API Keys**: Check for expired keys
- **Update Documentation**: Document any operational changes
- **Performance Review**: Analyze response times and optimize if needed

### Incident Response

1. **Detection**
   - Health check alerts
   - User reports
   - Log monitoring

2. **Triage**
   - Check health endpoint
   - Review recent deployments
   - Examine error logs

3. **Resolution**
   - Quick fix: Rollback to last known good
   - Investigation: Use wrangler tail for debugging
   - Fix forward: Deploy patch after testing

4. **Post-Mortem**
   - Document incident
   - Update runbook
   - Implement preventive measures

### Maintenance Windows

For planned maintenance:

1. **Announce to Users** (if applicable)
2. **Perform Maintenance**
   ```bash
   # Deploy updates
   npm run deploy
   
   # Verify deployment
   curl https://your-worker.workers.dev/health
   ```
3. **Test Functionality**
4. **Monitor for Issues**

### Security Updates

When updating secrets:

```bash
# Update bot token
echo $NEW_BOT_TOKEN | npx wrangler secret put BOT_TOKEN

# Update webhook secret
echo $NEW_WEBHOOK_SECRET | npx wrangler secret put WEBHOOK_SECRET
npm run setup-webhook -- --force

# Verify changes
npm run setup-webhook -- --status
```

### Backup and Recovery

While Cloudflare Workers are stateless, maintain backups of:

1. **Configuration Files**
   - wrangler.toml
   - .env (securely stored)

2. **KV Data** (if critical)
   ```bash
   # Export KV data
   npx wrangler kv:key list --namespace-id <id> > backup.json
   ```

3. **Deployment History**
   ```bash
   # List all deployments
   npx wrangler deployments list > deployments.txt
   ```

## Performance & Cost Optimization

### Monitoring Performance

```bash
# Check response time
curl -w "%{time_total}" -o /dev/null -s https://your-worker.workers.dev/health

# Monitor usage in Cloudflare dashboard
# Workers > Your Worker > Analytics
```

### Cost Control

ZenFast stays under $5/month by:
- **Efficient design**: < 5ms per request
- **Free tier usage**: Handles 200+ users at $0/month
- **Smart caching**: Minimal KV operations
- **Rate limiting**: Prevents abuse

See [cost-analysis.md](cost-analysis.md) for detailed breakdown.

## Advanced Topics

### CI/CD Integration

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci && npm test && npm run build
      - run: npm run deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
```

### Pre-deployment Validation

The `deploy:full` script runs these automatically:

```bash
npm run typecheck  # Type validation
npm test          # Unit tests  
npm run build     # Compilation check
```

## Support and Resources

- **Cloudflare Workers Docs**: https://developers.cloudflare.com/workers/
- **Telegram Bot API**: https://core.telegram.org/bots/api
- **Wrangler CLI**: https://developers.cloudflare.com/workers/wrangler/

For issues specific to ZenFast, check the repository's issue tracker.