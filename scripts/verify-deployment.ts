#!/usr/bin/env tsx
import { config } from 'dotenv';

// Load environment variables
config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const WORKER_ROUTE = process.env.WORKER_ROUTE;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

if (!BOT_TOKEN || !WORKER_ROUTE || !WEBHOOK_SECRET) {
  console.error('❌ Required environment variables: BOT_TOKEN, WORKER_ROUTE, WEBHOOK_SECRET');
  process.exit(1);
}

async function verifyDeployment() {
  console.log('🔍 Verifying deployment...\n');

  const webhookUrl = WORKER_ROUTE.endsWith('/webhook') 
    ? WORKER_ROUTE 
    : `${WORKER_ROUTE}/webhook`;

  try {
    // Test 1: Check if worker is responding
    console.log('1. Testing worker endpoint...');
    const workerResponse = await fetch(webhookUrl.replace('/webhook', '/'), {
      method: 'GET',
    });

    if (workerResponse.status === 404) {
      console.log('✅ Worker is responding (404 expected for GET /)');
    } else {
      console.log(`✅ Worker is responding (status: ${workerResponse.status})`);
    }

    // Test 2: Check webhook security
    console.log('2. Testing webhook security...');
    const invalidSecretResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': 'invalid-secret',
      },
      body: JSON.stringify({ test: 'message' }),
    });

    if (invalidSecretResponse.status === 401) {
      console.log('✅ Webhook security is working (401 for invalid secret)');
    } else {
      console.warn(`⚠️  Unexpected response for invalid secret: ${invalidSecretResponse.status}`);
    }

    // Test 3: Check valid webhook call
    console.log('3. Testing valid webhook call...');
    const validResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 123, type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: 'test message',
        },
      }),
    });

    if (validResponse.status === 200) {
      console.log('✅ Valid webhook call accepted');
    } else {
      console.warn(`⚠️  Unexpected response for valid webhook: ${validResponse.status}`);
    }

    // Test 4: Check Telegram webhook status
    console.log('4. Checking Telegram webhook status...');
    const webhookInfoResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const webhookInfo = await webhookInfoResponse.json();

    if (webhookInfo.ok) {
      const info = webhookInfo.result;
      console.log(`✅ Telegram webhook URL: ${info.url}`);
      console.log(`✅ Pending updates: ${info.pending_update_count}`);
      
      if (info.last_error_date) {
        console.warn(`⚠️  Last error: ${info.last_error_message} (${new Date(info.last_error_date * 1000)})`);
      } else {
        console.log('✅ No recent webhook errors');
      }
    }

    console.log('\n🎉 Deployment verification completed!');
    console.log('\nYour bot should now be ready to receive and echo messages.');
    console.log('Send a message to your bot on Telegram to test the echo functionality.');

  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

// Run the script
verifyDeployment().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});