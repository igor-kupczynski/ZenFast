#!/usr/bin/env tsx

// CI-friendly script to conditionally update the Telegram webhook
// - Reads env vars: BOT_TOKEN, WEBHOOK_SECRET, WORKER_ROUTE
// - If --force is provided, always sets the webhook
// - Otherwise, calls getWebhookInfo and updates only when the URL differs
// - Does not log secrets

function env(name: string): string | undefined {
  const v = process.env[name];
  if (typeof v === 'string') {
    // Trim but preserve actual empty strings as empty
    return v.trim();
  }
  return undefined;
}

const BOT_TOKEN = env('BOT_TOKEN');
const WEBHOOK_SECRET = env('WEBHOOK_SECRET');
const WORKER_ROUTE = env('WORKER_ROUTE');
const FORCE = process.argv.includes('--force');

function fail(msg: string, code = 1): never {
  console.error(msg);
  process.exit(code);
}

async function tg<T = any>(method: string, init?: RequestInit): Promise<T> {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    fail(`Telegram API ${method} failed with HTTP ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function main() {
  console.log('🔧 CI: Conditional Telegram webhook update');

  if (!BOT_TOKEN) return fail('BOT_TOKEN is required via environment variable');
  if (!WEBHOOK_SECRET) return fail('WEBHOOK_SECRET is required via environment variable');
  if (!WORKER_ROUTE) return fail('WORKER_ROUTE is required via environment variable');

  if (!/^https:\/\//.test(WORKER_ROUTE) || WORKER_ROUTE.includes('*')) {
    return fail('Invalid WORKER_ROUTE format');
  }

  const desiredUrl = `${WORKER_ROUTE.replace(/\/$/, '')}/webhook`;

  if (!FORCE) {
    // Check current webhook status without leaking secrets
    type WebhookInfo = { ok: boolean; result?: { url?: string } ; description?: string };
    const info = await tg<WebhookInfo>('getWebhookInfo');
    if (!info.ok) {
      return fail(`getWebhookInfo returned not ok: ${info.description ?? 'unknown error'}`);
    }

    const currentUrl = info.result?.url ?? '';
    if (currentUrl === desiredUrl) {
      console.log(`✅ Webhook already configured (${desiredUrl}); skipping setWebhook`);
      return;
    }
    if (!currentUrl) {
      console.log('ℹ️  No webhook configured currently; will set it now');
    } else {
      console.log(`ℹ️  Webhook mismatch: current=${currentUrl}, desired=${desiredUrl}; updating`);
    }
  } else {
    console.log('⚠️  Force mode enabled; will setWebhook regardless of current state');
  }

  // Set webhook
  type TgResponse = { ok: boolean; description?: string };
  const setBody = JSON.stringify({ url: desiredUrl, secret_token: WEBHOOK_SECRET });
  const result = await tg<TgResponse>('setWebhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: setBody,
  });
  if (!result.ok) {
    return fail(`setWebhook returned not ok: ${result.description ?? 'unknown error'}`);
  }
  console.log('✅ setWebhook succeeded');
}

main().catch((err) => {
  console.error('❌ Error in ci-update-webhook.ts:', err?.message ?? err);
  process.exit(1);
});
