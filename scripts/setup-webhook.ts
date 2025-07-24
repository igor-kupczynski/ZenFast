#!/usr/bin/env tsx
import { config } from 'dotenv';

// Load environment variables
config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const WORKER_ROUTE = process.env.WORKER_ROUTE;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN environment variable is required');
  console.error('Get your bot token from @BotFather on Telegram');
  process.exit(1);
}

if (!WEBHOOK_SECRET) {
  console.error('❌ WEBHOOK_SECRET environment variable is required');
  console.error('Generate a random secret token for webhook validation');
  process.exit(1);
}

if (!WORKER_ROUTE) {
  console.error('❌ WORKER_ROUTE environment variable is required');
  console.error('Example: https://zenfast.example.workers.dev/webhook');
  process.exit(1);
}

async function setupWebhook() {
  console.log('🚀 Setting up Telegram webhook...\n');

  const webhookUrl = WORKER_ROUTE.endsWith('/webhook') 
    ? WORKER_ROUTE 
    : `${WORKER_ROUTE}/webhook`;

  try {
    // First, validate the bot token
    console.log('Validating bot token...');
    const meResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    const meResult = await meResponse.json();

    if (!meResult.ok) {
      throw new Error(`Invalid bot token: ${meResult.description}`);
    }

    console.log(`✅ Bot validated: @${meResult.result.username}`);

    // Set the webhook
    console.log(`Setting webhook to: ${webhookUrl}`);
    const webhookResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: WEBHOOK_SECRET,
      }),
    });

    const webhookResult = await webhookResponse.json();

    if (!webhookResult.ok) {
      throw new Error(`Failed to set webhook: ${webhookResult.description}`);
    }

    console.log('✅ Webhook set successfully!');

    // Verify the webhook
    console.log('\nVerifying webhook configuration...');
    const infoResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const infoResult = await infoResponse.json();

    if (infoResult.ok) {
      const info = infoResult.result;
      console.log(`✅ Webhook URL: ${info.url}`);
      console.log(`✅ Has secret token: ${info.has_custom_certificate ? 'Yes' : 'No'}`);
      console.log(`✅ Pending updates: ${info.pending_update_count}`);
      
      if (info.last_error_date) {
        console.warn(`⚠️  Last error: ${info.last_error_message} (${new Date(info.last_error_date * 1000)})`);
      }
    }

    console.log('\n🎉 Webhook setup completed successfully!');
    console.log('\nYour bot is now ready to receive messages.');
    console.log('Test it by sending a message to your bot on Telegram.');

  } catch (error) {
    console.error('❌ Failed to setup webhook:', error);
    process.exit(1);
  }
}

// Run the script
setupWebhook().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});