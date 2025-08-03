#!/usr/bin/env tsx

import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

// Load environment variables
const envPath = join(process.cwd(), '.env');
if (!existsSync(envPath)) {
  console.error('❌ .env file not found. Please copy .env.example to .env and configure it.');
  process.exit(1);
}

config({ path: envPath });

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const WORKER_ROUTE = process.env.WORKER_ROUTE;

interface WebhookInfo {
  ok: boolean;
  result?: {
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
    last_error_date?: number;
    last_error_message?: string;
  };
  description?: string;
}

async function checkWebhook(): Promise<WebhookInfo> {
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
  return response.json();
}

async function setWebhook(): Promise<{ ok: boolean; description?: string }> {
  const webhookUrl = `${WORKER_ROUTE}/webhook`;
  
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: WEBHOOK_SECRET,
    }),
  });
  
  return response.json();
}

async function deleteWebhook(): Promise<{ ok: boolean; description?: string }> {
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
  return response.json();
}

async function main() {
  console.log('🚀 ZenFast Webhook Setup\n');
  
  // Validate environment variables
  if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN not found in .env file');
    process.exit(1);
  }
  
  if (!WEBHOOK_SECRET) {
    console.error('❌ WEBHOOK_SECRET not found in .env file');
    console.log('💡 Generate one with: openssl rand -hex 32');
    process.exit(1);
  }
  
  if (!WORKER_ROUTE) {
    console.error('❌ WORKER_ROUTE not found in .env file');
    console.log('💡 Deploy first with "npm run deploy" to get your worker URL');
    process.exit(1);
  }
  
  // Validate WORKER_ROUTE format
  if (!WORKER_ROUTE.startsWith('https://') || WORKER_ROUTE.includes('*') || WORKER_ROUTE.endsWith('/')) {
    console.error('❌ Invalid WORKER_ROUTE format');
    console.log('✅ Correct format: https://zenfast.your-subdomain.workers.dev');
    console.log('❌ Incorrect formats:');
    console.log('   - https://zenfast.*.workers.dev');
    console.log('   - https://zenfast.your-subdomain.workers.dev/');
    console.log('   - zenfast.your-subdomain.workers.dev');
    process.exit(1);
  }
  
  try {
    // Check current webhook status
    console.log('📡 Checking current webhook status...');
    const currentWebhook = await checkWebhook();
    
    if (!currentWebhook.ok) {
      console.error('❌ Failed to check webhook:', currentWebhook.description);
      process.exit(1);
    }
    
    if (currentWebhook.result?.url) {
      console.log(`\nCurrent webhook: ${currentWebhook.result.url}`);
      
      if (process.argv.includes('--status')) {
        // Just show status and exit
        if (currentWebhook.result.last_error_message) {
          console.log(`⚠️  Last error: ${currentWebhook.result.last_error_message}`);
        }
        console.log(`📊 Pending updates: ${currentWebhook.result.pending_update_count}`);
        return;
      }
      
      if (!process.argv.includes('--force')) {
        console.log('\n⚠️  Webhook already configured');
        console.log('Use --force to reconfigure the webhook');
        return;
      }
      
      console.log('\n🔄 Removing existing webhook...');
      const deleteResult = await deleteWebhook();
      if (!deleteResult.ok) {
        console.error('❌ Failed to delete webhook:', deleteResult.description);
        process.exit(1);
      }
    }
    
    // Set new webhook
    const webhookUrl = `${WORKER_ROUTE}/webhook`;
    console.log(`\n🔗 Setting webhook to: ${webhookUrl}`);
    
    const setResult = await setWebhook();
    if (!setResult.ok) {
      console.error('❌ Failed to set webhook:', setResult.description);
      process.exit(1);
    }
    
    console.log('✅ Webhook configured successfully!');
    
    // Verify webhook was set
    console.log('\n🔍 Verifying webhook configuration...');
    const verifyWebhook = await checkWebhook();
    
    if (verifyWebhook.result?.url === webhookUrl) {
      console.log('✅ Webhook verified and active');
      console.log(`📊 Pending updates: ${verifyWebhook.result.pending_update_count}`);
    } else {
      console.error('❌ Webhook verification failed');
      console.log('Expected:', webhookUrl);
      console.log('Actual:', verifyWebhook.result?.url);
    }
    
  } catch (error) {
    console.error('❌ Error setting up webhook:', error);
    process.exit(1);
  }
}

// Command line options
if (process.argv.includes('--help')) {
  console.log('ZenFast Webhook Setup');
  console.log('\nUsage: npm run setup-webhook [options]');
  console.log('\nOptions:');
  console.log('  --status   Show current webhook status only');
  console.log('  --force    Force reconfigure webhook even if already set');
  console.log('  --help     Show this help message');
  process.exit(0);
}

main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});