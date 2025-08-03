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
  // New format: id = "5f325e8e6b3e45b2849685577b10a763"
  const idMatch = output.match(/id = "([a-f0-9]+)"/);
  return idMatch?.[1] ?? null;
}

function createNamespace(binding: string, title: string): string | null {
  // First, check if namespace already exists
  try {
    console.log(`Checking for existing KV namespace: ${title}`);
    const listOutput = execSync('npx wrangler kv namespace list', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    const namespaces = JSON.parse(listOutput);
    for (const ns of namespaces) {
      if (ns.title === title) {
        console.log(`✅ Found existing ${title} with ID: ${ns.id}`);
        return ns.id;
      }
    }
  } catch (listError) {
    console.log(`⚠️  Could not list namespaces: ${listError}`);
  }
  
  // Namespace doesn't exist, create it
  try {
    console.log(`Creating KV namespace: ${title}`);
    const output = execSync(`npx wrangler kv namespace create "${binding}"`, {
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
  } catch (error: any) {
    // Check if this is a "namespace already exists" error
    const errorOutput = error.stdout || error.stderr || error.message || '';
    if (errorOutput.includes('already exists') || errorOutput.includes('title already exists')) {
      console.log(`⚠️  Namespace ${title} already exists`);
      // Try to get existing namespace ID from wrangler.toml
      try {
        const config = readFileSync(WRANGLER_CONFIG_PATH, 'utf-8');
        const bindingRegex = new RegExp(`binding\\s*=\\s*"${binding}"[\\s\\S]*?id\\s*=\\s*"([a-f0-9]+)"`, 'm');
        const match = config.match(bindingRegex);
        if (match?.[1]) {
          console.log(`✅ Found existing ${title} with ID: ${match[1]}`);
          return match[1];
        }
      } catch (e) {
        console.log(`⚠️  Could not read existing ID from wrangler.toml`);
      }
      
      // If we can't get the ID from wrangler.toml, list namespaces to find it
      try {
        console.log(`🔍 Looking up existing namespace ID...`);
        const listOutput = execSync('npx wrangler kv namespace list', {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        // Parse JSON output to find our namespace by title
        const namespaces = JSON.parse(listOutput);
        for (const ns of namespaces) {
          // Match by exact title (prefer "zenfast-" prefixed versions)
          if (ns.title === title) {
            console.log(`✅ Found existing ${title} with ID: ${ns.id}`);
            return ns.id;
          }
        }
        
        // Fallback: try to find by binding name in title
        for (const ns of namespaces) {
          if (ns.title.includes(binding) || ns.title === `zenfast-${binding}`) {
            console.log(`✅ Found existing namespace ${ns.title} with ID: ${ns.id}`);
            return ns.id;
          }
        }
      } catch (listError) {
        console.log(`⚠️  Could not list namespaces to find existing ID`);
      }
      
      return null;
    }
    throw error;
  }
}

function updateWranglerConfig(namespaceIds: Map<string, string>) {
  console.log('\nUpdating wrangler.toml...');
  
  let config = readFileSync(WRANGLER_CONFIG_PATH, 'utf-8');
  
  // Check if all required namespaces are already configured correctly
  let allConfigured = true;
  
  for (const [binding, expectedId] of namespaceIds.entries()) {
    const bindingRegex = new RegExp(`\\[\\[kv_namespaces\\]\\]\\s*\\nbinding\\s*=\\s*"${binding}"\\s*\\nid\\s*=\\s*"([a-f0-9]+)"`, 'm');
    const match = config.match(bindingRegex);
    
    if (!match || match[1] !== expectedId) {
      allConfigured = false;
      break;
    }
  }
  
  if (allConfigured && !process.argv.includes('--force')) {
    console.log('✅ All KV namespaces already configured correctly in wrangler.toml');
    return;
  }
  
  // Remove existing KV namespace configurations
  config = config.replace(/\[\[kv_namespaces\]\]\s*\n.*?\n.*?\n/g, '');
  
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