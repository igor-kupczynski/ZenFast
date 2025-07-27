import { describe, it, expect } from 'vitest';
import { generateApiKey, hashApiKey } from '../src/crypto';
import { DICTIONARY } from '../src/dictionary';

describe('generateApiKey', () => {
  it('should generate a key with 5 words separated by hyphens', () => {
    const key = generateApiKey();
    const words = key.split('-');
    
    expect(words).toHaveLength(5);
    expect(key).toMatch(/^[a-z]+-[a-z]+-[a-z]+-[a-z]+-[a-z]+$/);
  });

  it('should only use words from the dictionary', () => {
    const key = generateApiKey();
    const words = key.split('-');
    
    words.forEach(word => {
      expect(DICTIONARY).toContain(word);
    });
  });

  it('should generate different keys on subsequent calls', () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();
    
    expect(key1).not.toBe(key2);
  });

  it('should generate keys with correct entropy (multiple runs)', () => {
    const keys = new Set();
    const numRuns = 100;
    
    for (let i = 0; i < numRuns; i++) {
      keys.add(generateApiKey());
    }
    
    // With 2000^5 possible combinations, we shouldn't see duplicates in 100 runs
    expect(keys.size).toBe(numRuns);
  });
});

describe('hashApiKey', () => {
  it('should return a hash with sha256 prefix', async () => {
    const key = 'test-key-value-here-word';
    const hash = await hashApiKey(key);
    
    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('should generate consistent hashes for the same input', async () => {
    const key = 'consistent-test-key-value-word';
    const hash1 = await hashApiKey(key);
    const hash2 = await hashApiKey(key);
    
    expect(hash1).toBe(hash2);
  });

  it('should generate different hashes for different inputs', async () => {
    const key1 = 'first-test-key-value-word';
    const key2 = 'second-test-key-value-word';
    const hash1 = await hashApiKey(key1);
    const hash2 = await hashApiKey(key2);
    
    expect(hash1).not.toBe(hash2);
  });

  it('should produce expected hash for known input', async () => {
    const key = 'correct-horse-battery-staple-zebra';
    const hash = await hashApiKey(key);
    
    // Pre-computed expected hash for this specific input (using Web Crypto API SHA-256)
    const expectedHash = 'sha256:6b78cdb50432dc8222b89902041707754c9b46399178ecd7f8d74839fc90b65f';
    
    expect(hash).toBe(expectedHash);
  });
});