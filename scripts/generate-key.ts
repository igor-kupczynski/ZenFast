#!/usr/bin/env tsx

import { generateApiKey, hashApiKey } from '../src/crypto';
import { ApiKeyData } from '../src/types';
import { execSync } from 'child_process';

interface CliArgs {
  name: string;
  expiry: string;
  local: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let name = '';
  let expiry = '';
  let local = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && i + 1 < args.length) {
      const nextArg = args[i + 1];
      if (nextArg !== undefined) {
        name = nextArg;
      }
      i++;
    } else if (args[i] === '--expiry' && i + 1 < args.length) {
      const nextArg = args[i + 1];
      if (nextArg !== undefined) {
        expiry = nextArg;
      }
      i++;
    } else if (args[i] === '--local') {
      local = true;
    }
  }

  if (!name) {
    console.error('Error: --name is required');
    process.exit(1);
  }

  if (!expiry) {
    console.error('Error: --expiry is required');
    process.exit(1);
  }

  // Validate expiry date format (basic validation)
  const expiryDate = new Date(expiry);
  if (isNaN(expiryDate.getTime())) {
    console.error('Error: Invalid date format for --expiry. Use YYYY-MM-DD format.');
    process.exit(1);
  }

  // Ensure expiry is in the future
  if (expiryDate <= new Date()) {
    console.error('Error: Expiry date must be in the future');
    process.exit(1);
  }

  return { name, expiry, local };
}

async function storeKey(keyHash: string, keyData: ApiKeyData, useLocal: boolean = false): Promise<void> {
  try {
    const kvData = JSON.stringify(keyData);
    
    // Determine which storage to use based on a flag
    const remoteFlag = useLocal ? '' : ' --remote';
    
    // Try using binding first, then fall back to namespace ID
    let command = `npx wrangler kv key put${remoteFlag} --binding API_KEYS "${keyHash}" '${kvData.replace(/'/g, "'\"'\"'")}'`;
    
    try {
      execSync(command, { stdio: 'inherit' });
    } catch (bindingError) {
      console.warn('Warning: Could not use binding, trying with namespace ID...');
      
      // Fall back to the namespace ID approach (for testing/development)
      const listCommand = 'npx wrangler kv namespace list';
      try {
        const namespaceList = execSync(listCommand, { encoding: 'utf8' });
        const lines = namespaceList.split('\n');
        const apiKeysLine = lines.find((line: string) => line.includes('API_KEYS'));
        
        if (!apiKeysLine) {
          console.error('API_KEYS namespace not found. Please create it first with:');
          console.error('npx wrangler kv namespace create API_KEYS');
          process.exit(1);
        }
        
        const namespaceIdMatch = apiKeysLine.match(/[a-f0-9]{32}/);
        if (!namespaceIdMatch) {
          console.error('Could not extract namespace ID from:', apiKeysLine);
          process.exit(1);
        }
        
        const namespaceId = namespaceIdMatch[0];
        command = `npx wrangler kv key put${remoteFlag} --namespace-id "${namespaceId}" "${keyHash}" '${kvData.replace(/'/g, "'\"'\"'")}'`;
        execSync(command, { stdio: 'inherit' });
      } catch (fallbackError) {
        console.error('Error: Could not store key in KV namespace.');
        console.error('Please ensure:');
        console.error('1. The API_KEYS namespace exists');
        console.error('2. Wrangler is properly configured');
        console.error('3. You have the necessary permissions');
        console.error('\nOriginal error:', fallbackError);
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('Error storing key in KV:', error);
    process.exit(1);
  }
}

async function main() {
  try {
    const { name, expiry, local } = parseArgs();
    
    // Generate the API key
    const apiKey = generateApiKey();
    
    // Hash the key for storage
    const keyHash = await hashApiKey(apiKey);
    
    // Prepare the data to store
    const keyData: ApiKeyData = {
      name,
      expiry,
      created: new Date().toISOString()
    };
    
    // Store in KV
    await storeKey(keyHash, keyData, local);
    
    // Display the success message
    console.log(`Generated API key: ${apiKey}`);
    console.log(`Key stored successfully for '${name}' (expires: ${expiry})`);
    console.log(`Storage location: ${local ? 'local' : 'remote'}`);
    console.log('Save this key securely - it cannot be recovered!');
    
  } catch (error) {
    console.error('Error generating API key:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});