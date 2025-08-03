#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface KVNamespace {
  binding: string;
  title: string;
}

const namespaces: KVNamespace[] = [
  { binding: 'API_KEYS', title: 'zenfast-API_KEYS' },
  { binding: 'CHATS', title: 'zenfast-CHATS' },
  { binding: 'RATE_LIMITS', title: 'zenfast-RATE_LIMITS' }
];

const WRANGLER_CONFIG_PATH = join(process.cwd(), 'wrangler.toml');

function parseNamespaceId(output: string): string | null {
  // Parse wrangler output to extract namespace ID
  const idMatch = output.match(/with id "([a-f0-9]+)"/);
  return idMatch?.[1] ?? null;
}

function createNamespace(binding: string, title: string): string | null {
  try {
    console.log(`Creating KV namespace: ${title}`);
    const output = execSync(`npx wrangler kv:namespace create "${binding}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    const id = parseNamespaceId(output);
    if (id) {
      console.log(`✅ Created ${title} with ID: ${id}`);
      return id;
    } else {
      console.error(`❌ Failed to parse ID from output: ${output}`);
      return null;
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      console.log(`⚠️  Namespace ${title} already exists`);
      // Try to get existing namespace ID from wrangler.toml
      const config = readFileSync(WRANGLER_CONFIG_PATH, 'utf-8');
      const bindingRegex = new RegExp(`binding\\s*=\\s*"${binding}"[\\s\\S]*?id\\s*=\\s*"([a-f0-9]+)"`, 'm');
      const match = config.match(bindingRegex);
      return match?.[1] ?? null;
    }
    throw error;
  }
}

function updateWranglerConfig(namespaceIds: Map<string, string>) {
  console.log('\nUpdating wrangler.toml...');
  
  let config = readFileSync(WRANGLER_CONFIG_PATH, 'utf-8');
  
  // Check if KV namespaces already exist and match
  const existingMatches = config.match(/\[\[kv_namespaces\]\](.|\n)*?(?=\n\[|$)/gm) || [];
  const existingBindings = new Set<string>();
  
  for (const match of existingMatches) {
    const bindingMatch = match.match(/binding\s*=\s*"([^"]+)"/);
    if (bindingMatch) {
      existingBindings.add(bindingMatch[1]);
    }
  }
  
  // Check if all required namespaces are already configured
  const requiredBindings = Array.from(namespaceIds.keys());
  const allExist = requiredBindings.every(binding => existingBindings.has(binding));
  
  if (allExist && !process.argv.includes('--force')) {
    console.log('✅ All KV namespaces already configured in wrangler.toml');
    return;
  }
  
  // Remove existing KV namespace configurations
  config = config.replace(/\[\[kv_namespaces\]\](.|\n)*?(?=\n\[|$)/gm, '');
  
  // Add new KV namespace configurations
  const kvConfig = Array.from(namespaceIds.entries())
    .map(([binding, id]) => `[[kv_namespaces]]\nbinding = "${binding}"\nid = "${id}"`)
    .join('\n\n');
  
  // Add KV config at the end of the file
  config = config.trimEnd() + '\n\n' + kvConfig + '\n';
  
  writeFileSync(WRANGLER_CONFIG_PATH, config);
  console.log('✅ Updated wrangler.toml with namespace IDs');
}

async function main() {
  console.log('Setting up KV namespaces for ZenFast...\n');
  
  const namespaceIds = new Map<string, string>();
  const force = process.argv.includes('--force');
  
  if (force) {
    console.log('⚠️  Force mode enabled - will recreate namespaces\n');
  }
  
  for (const namespace of namespaces) {
    const id = createNamespace(namespace.binding, namespace.title);
    if (id) {
      namespaceIds.set(namespace.binding, id);
    } else {
      console.error(`❌ Failed to create namespace ${namespace.title}`);
      process.exit(1);
    }
  }
  
  updateWranglerConfig(namespaceIds);
  
  console.log('\n✅ KV namespace setup complete!');
  console.log('\nNext steps:');
  console.log('1. Run "npm run deploy" to deploy the worker');
  console.log('2. Set up secrets with "wrangler secret put BOT_TOKEN" and "wrangler secret put WEBHOOK_SECRET"');
}

main().catch(error => {
  console.error('Error setting up KV namespaces:', error);
  process.exit(1);
});