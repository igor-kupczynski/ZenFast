#!/usr/bin/env tsx
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { config } from 'dotenv';

// Load environment variables
config();

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!CLOUDFLARE_ACCOUNT_ID) {
  console.error('❌ CLOUDFLARE_ACCOUNT_ID environment variable is required');
  console.error('Run: wrangler whoami to get your account ID');
  process.exit(1);
}

const namespaces = [
  { name: 'API_KEYS', binding: 'API_KEYS' },
  { name: 'CHATS', binding: 'CHATS' },
  { name: 'RATE_LIMITS', binding: 'RATE_LIMITS' },
];

interface KvNamespace {
  binding: string;
  id: string;
}

async function createNamespaces() {
  console.log('🚀 Creating KV namespaces...\n');

  const createdNamespaces: KvNamespace[] = [];

  for (const namespace of namespaces) {
    try {
      console.log(`Creating ${namespace.name} namespace...`);
      
      // Create the namespace
      const output = execSync(`npx wrangler kv:namespace create "${namespace.name}"`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      // Extract the namespace ID from wrangler output
      const idMatch = output.match(/id = "([^"]+)"/);
      if (!idMatch) {
        throw new Error(`Could not extract namespace ID from wrangler output: ${output}`);
      }

      const namespaceId = idMatch[1];
      createdNamespaces.push({
        binding: namespace.binding,
        id: namespaceId,
      });

      console.log(`✅ Created ${namespace.name} with ID: ${namespaceId}`);
    } catch (error) {
      console.error(`❌ Failed to create ${namespace.name}:`, error);
      process.exit(1);
    }
  }

  // Update wrangler.toml with the namespace IDs
  console.log('\n📝 Updating wrangler.toml...');
  updateWranglerToml(createdNamespaces);

  // Set up environment variables as secrets
  console.log('\n🔐 Setting up environment variables...');
  await setupSecrets();

  console.log('✅ All KV namespaces created and configured successfully!');
  console.log('\nNext steps:');
  console.log('1. Run: npm run deploy');
  console.log('2. Run: npm run setup:webhook');
}

async function setupSecrets() {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

  if (!BOT_TOKEN) {
    console.log('⚠️  BOT_TOKEN not found in .env - you will need to set it manually:');
    console.log('   wrangler secret put BOT_TOKEN');
    return;
  }

  if (!WEBHOOK_SECRET) {
    console.log('⚠️  WEBHOOK_SECRET not found in .env - you will need to set it manually:');
    console.log('   wrangler secret put WEBHOOK_SECRET');
    return;
  }

  try {
    console.log('Setting BOT_TOKEN secret...');
    execSync(`echo "${BOT_TOKEN}" | npx wrangler secret put BOT_TOKEN`, {
      stdio: 'pipe',
    });
    console.log('✅ BOT_TOKEN secret set');

    console.log('Setting WEBHOOK_SECRET...');
    execSync(`echo "${WEBHOOK_SECRET}" | npx wrangler secret put WEBHOOK_SECRET`, {
      stdio: 'pipe',
    });
    console.log('✅ WEBHOOK_SECRET secret set');
  } catch (error) {
    console.warn('⚠️  Failed to set secrets automatically. Set them manually:');
    console.log('   wrangler secret put BOT_TOKEN');
    console.log('   wrangler secret put WEBHOOK_SECRET');
    console.error('Error:', error);
  }
}

function updateWranglerToml(namespaces: KvNamespace[]) {
  try {
    let wranglerContent = readFileSync('wrangler.toml', 'utf-8');

    // Remove the commented placeholder sections
    wranglerContent = wranglerContent.replace(
      /# KV namespaces will be added by create-namespaces script[\s\S]*$/,
      ''
    );

    // Add the actual KV namespace configurations
    for (const namespace of namespaces) {
      wranglerContent += `\n[[kv_namespaces]]\nbinding = "${namespace.binding}"\nid = "${namespace.id}"\n`;
    }

    writeFileSync('wrangler.toml', wranglerContent);
    console.log('✅ Updated wrangler.toml with namespace IDs');
  } catch (error) {
    console.error('❌ Failed to update wrangler.toml:', error);
    process.exit(1);
  }
}

// Run the script
createNamespaces().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});