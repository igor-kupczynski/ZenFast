#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Banner
echo -e "${BLUE}"
echo "╔══════════════════════════════════════╗"
echo "║       ZenFast Deployment Script      ║"
echo "╚══════════════════════════════════════╝"
echo -e "${NC}\n"

# Check prerequisites
echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js 18+ is required (found: $(node -v))${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js $(node -v)${NC}"

# Check if npm packages are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    echo -e "${YELLOW}Creating .env from .env.example...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please edit .env with your configuration and run this script again${NC}"
    exit 1
fi

# Load environment variables
source .env

# Validate required environment variables
echo -e "\n${YELLOW}🔐 Validating environment configuration...${NC}"

if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
    echo -e "${RED}❌ CLOUDFLARE_ACCOUNT_ID not set in .env${NC}"
    echo -e "${YELLOW}Run 'npx wrangler whoami' to get your account ID${NC}"
    exit 1
fi

if [ -z "$BOT_TOKEN" ]; then
    echo -e "${RED}❌ BOT_TOKEN not set in .env${NC}"
    echo -e "${YELLOW}Get a bot token from @BotFather on Telegram${NC}"
    exit 1
fi

if [ -z "$WEBHOOK_SECRET" ]; then
    echo -e "${RED}❌ WEBHOOK_SECRET not set in .env${NC}"
    echo -e "${YELLOW}Generate one with: openssl rand -hex 32${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment configuration valid${NC}"

# Check Cloudflare authentication
echo -e "\n${YELLOW}🔑 Checking Cloudflare authentication...${NC}"
if ! npx wrangler whoami &>/dev/null; then
    echo -e "${YELLOW}Not logged in to Cloudflare. Initiating login...${NC}"
    npx wrangler login
fi
echo -e "${GREEN}✅ Authenticated with Cloudflare${NC}"

# Build TypeScript
echo -e "\n${YELLOW}🔨 Building TypeScript...${NC}"
npm run build
echo -e "${GREEN}✅ Build complete${NC}"

# Set up KV namespaces
echo -e "\n${YELLOW}🗄️  Setting up KV namespaces...${NC}"
npm run setup-kv
echo -e "${GREEN}✅ KV namespaces configured${NC}"

# Deploy to Cloudflare Workers
echo -e "\n${YELLOW}🚀 Deploying to Cloudflare Workers...${NC}"
DEPLOY_OUTPUT=$(npm run deploy 2>&1)
echo "$DEPLOY_OUTPUT"

# Extract worker URL from deployment output
DEPLOYED_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://[a-zA-Z0-9.-]+\.workers\.dev' | head -1)

if [ -z "$DEPLOYED_URL" ]; then
    echo -e "${RED}❌ Failed to extract worker URL from deployment output${NC}"
    echo -e "${YELLOW}Please check the deployment output above and update WORKER_ROUTE in .env manually${NC}"
    exit 1
fi

# Update .env with the deployed URL if needed
if [ "$WORKER_ROUTE" != "$DEPLOYED_URL" ]; then
    echo -e "\n${YELLOW}📝 Updating WORKER_ROUTE in .env...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS (BSD sed)
        sed -i '' "s|WORKER_ROUTE=.*|WORKER_ROUTE=$DEPLOYED_URL|" .env
    else
        # Linux (GNU sed)
        sed -i "s|WORKER_ROUTE=.*|WORKER_ROUTE=$DEPLOYED_URL|" .env
    fi
    
    # Verify the update succeeded
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to update WORKER_ROUTE automatically${NC}"
        echo -e "${YELLOW}Please manually update WORKER_ROUTE in .env to: $DEPLOYED_URL${NC}"
        exit 1
    fi
    
    # Reload environment
    source .env
    echo -e "${GREEN}✅ Updated WORKER_ROUTE to: $DEPLOYED_URL${NC}"
fi

# Set secrets
echo -e "\n${YELLOW}🔐 Setting secrets...${NC}"
echo "$BOT_TOKEN" | npx wrangler secret put BOT_TOKEN --silent
echo "$WEBHOOK_SECRET" | npx wrangler secret put WEBHOOK_SECRET --silent
echo -e "${GREEN}✅ Secrets configured${NC}"

# Configure webhook
echo -e "\n${YELLOW}🔗 Configuring Telegram webhook...${NC}"
npm run setup-webhook -- --force
echo -e "${GREEN}✅ Webhook configured${NC}"

# Test health endpoint
echo -e "\n${YELLOW}🏥 Testing health endpoint...${NC}"
HEALTH_CHECK=$(curl -s "$DEPLOYED_URL/health")
if echo "$HEALTH_CHECK" | grep -q '"status"'; then
    echo -e "${GREEN}✅ Health check passed${NC}"
    echo "$HEALTH_CHECK" | jq '.' 2>/dev/null || echo "$HEALTH_CHECK"
else
    echo -e "${RED}❌ Health check failed${NC}"
    echo "Response: $HEALTH_CHECK"
fi

# Summary
echo -e "\n${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}\n"

echo -e "${BLUE}📋 Deployment Summary:${NC}"
echo -e "  • Worker URL: ${GREEN}$DEPLOYED_URL${NC}"
echo -e "  • Health Check: ${GREEN}$DEPLOYED_URL/health${NC}"
echo -e "  • Bot Username: ${GREEN}@${BOT_USERNAME:-YourBotUsername}${NC}"

echo -e "\n${BLUE}📱 Next Steps:${NC}"
echo -e "  1. Send a message to your bot on Telegram"
echo -e "  2. Monitor logs: ${YELLOW}npx wrangler tail${NC}"
echo -e "  3. Generate API keys: ${YELLOW}npm run generate-key -- --name \"User Name\" --expiry \"2024-12-31\"${NC}"

echo -e "\n${BLUE}🔧 Troubleshooting:${NC}"
echo -e "  • Check webhook status: ${YELLOW}npm run setup-webhook -- --status${NC}"
echo -e "  • View logs: ${YELLOW}npx wrangler tail${NC}"
echo -e "  • Redeploy: ${YELLOW}npm run deploy${NC}"