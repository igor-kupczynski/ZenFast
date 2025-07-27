import { DICTIONARY } from './dictionary';

export function generateApiKey(): string {
  const words: string[] = [];
  
  for (let i = 0; i < 5; i++) {
    const randomValue = crypto.getRandomValues(new Uint32Array(1))[0];
    if (randomValue === undefined) {
      throw new Error('Failed to generate random value');
    }
    const randomIndex = Math.floor(randomValue / (2**32) * DICTIONARY.length);
    const word = DICTIONARY[randomIndex];
    if (word === undefined) {
      throw new Error('Invalid dictionary index');
    }
    words.push(word);
  }
  
  return words.join('-');
}

export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `sha256:${hashHex}`;
}