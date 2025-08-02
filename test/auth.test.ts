import { describe, it, expect, beforeEach } from 'vitest';
import { isAuthenticated, authenticateChat, getAuthDetails, isApiKeyPattern } from '../src/auth';
import { Env, User, ApiKeyData, ChatAuthData } from '../src/types';
import { MockKV } from './utils/mockKv';
import { hashApiKey } from '../src/crypto';

describe('Auth Module', () => {
  let mockApiKeys: MockKV;
  let mockChats: MockKV;
  let mockRateLimits: MockKV;
  let env: Env;
  let testUser: User;

  beforeEach(() => {
    mockApiKeys = new MockKV();
    mockChats = new MockKV();
    mockRateLimits = new MockKV();
    
    env = {
      BOT_TOKEN: 'test-token',
      BOT_USERNAME: 'TestBot',
      WEBHOOK_SECRET: 'test-secret',
      API_KEYS: mockApiKeys as any,
      CHATS: mockChats as any,
      RATE_LIMITS: mockRateLimits as any,
    };

    testUser = {
      id: 123456789,
      is_bot: false,
      first_name: 'Test',
      username: 'testuser'
    };
  });

  describe('isApiKeyPattern', () => {
    it('should validate correct API key patterns', () => {
      expect(isApiKeyPattern('apple-banana-cherry-dog-elephant')).toBe(true);
      expect(isApiKeyPattern('quick-brown-fox-jumps-over')).toBe(true);
    });

    it('should reject invalid patterns', () => {
      expect(isApiKeyPattern('too-few-words-only')).toBe(false);
      expect(isApiKeyPattern('too-many-words-here-today-tomorrow-yesterday')).toBe(false);
      expect(isApiKeyPattern('UPPERCASE-words-not-allowed-here')).toBe(false);
      expect(isApiKeyPattern('numbers-123-not-allowed-here')).toBe(false);
      expect(isApiKeyPattern('spaces not hyphens here')).toBe(false);
    });
  });

  describe('isAuthenticated', () => {
    it('should return false for unauthenticated chat', async () => {
      const result = await isAuthenticated(12345, env);
      expect(result).toBe(false);
    });

    it('should return true for authenticated chat with valid key', async () => {
      const chatId = 12345;
      const keyHash = 'sha256:testhash';
      
      // Set up valid API key
      const apiKeyData: ApiKeyData = {
        name: 'Test Key',
        expiry: new Date(Date.now() + 86400000).toISOString(), // 24 hours from now
        created: new Date().toISOString()
      };
      await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
      
      // Set up chat auth
      const chatAuth: ChatAuthData = {
        api_key_hash: keyHash,
        authenticated_at: new Date().toISOString(),
        authenticated_by: testUser
      };
      await mockChats.put(chatId.toString(), JSON.stringify(chatAuth));
      
      const result = await isAuthenticated(chatId, env);
      expect(result).toBe(true);
    });

    it('should return false and clean up expired key', async () => {
      const chatId = 12345;
      const keyHash = 'sha256:testhash';
      
      // Set up expired API key
      const apiKeyData: ApiKeyData = {
        name: 'Test Key',
        expiry: new Date(Date.now() - 86400000).toISOString(), // 24 hours ago
        created: new Date().toISOString()
      };
      await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
      
      // Set up chat auth
      const chatAuth: ChatAuthData = {
        api_key_hash: keyHash,
        authenticated_at: new Date().toISOString(),
        authenticated_by: testUser
      };
      await mockChats.put(chatId.toString(), JSON.stringify(chatAuth));
      
      const result = await isAuthenticated(chatId, env);
      expect(result).toBe(false);
      
      // Verify cleanup
      const chatData = await mockChats.get(chatId.toString());
      expect(chatData).toBeNull();
    });

    it('should return false and clean up when API key is deleted', async () => {
      const chatId = 12345;
      const keyHash = 'sha256:testhash';
      
      // Initially set up valid API key
      const apiKeyData: ApiKeyData = {
        name: 'Test Key',
        expiry: new Date(Date.now() + 86400000).toISOString(), // 24 hours from now
        created: new Date().toISOString()
      };
      await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
      
      // Set up chat auth
      const chatAuth: ChatAuthData = {
        api_key_hash: keyHash,
        authenticated_at: new Date().toISOString(),
        authenticated_by: testUser
      };
      await mockChats.put(chatId.toString(), JSON.stringify(chatAuth));
      
      // Verify initially authenticated
      let result = await isAuthenticated(chatId, env);
      expect(result).toBe(true);
      
      // Now delete the API key (simulating admin deletion)
      await mockApiKeys.delete(keyHash);
      
      // Check authentication again
      result = await isAuthenticated(chatId, env);
      expect(result).toBe(false);
      
      // Verify chat association was cleaned up
      const chatData = await mockChats.get(chatId.toString());
      expect(chatData).toBeNull();
    });
  });

  describe('authenticateChat', () => {
    it('should successfully authenticate with valid key', async () => {
      const chatId = 12345;
      const apiKey = 'apple-banana-cherry-dog-elephant';
      const keyHash = 'sha256:' + Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey)))
      ).map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Set up valid API key
      const apiKeyData: ApiKeyData = {
        name: 'Test Key',
        expiry: new Date(Date.now() + 86400000).toISOString(),
        created: new Date().toISOString()
      };
      await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
      
      const result = await authenticateChat(chatId, apiKey, testUser, env);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Authentication successful!');
      expect(result.message).toContain('Test Key');
      expect(result.keyName).toBe('Test Key');
      
      // Verify chat auth was stored
      const chatData = await mockChats.get(chatId.toString());
      expect(chatData).toBeTruthy();
      
      const chatAuth: ChatAuthData = JSON.parse(chatData!);
      expect(chatAuth.api_key_hash).toBe(keyHash);
      expect(chatAuth.authenticated_by.id).toBe(testUser.id);
    });

    it('should reject invalid API key', async () => {
      const chatId = 12345;
      const apiKey = 'invalid-wrong-key-test-here';
      
      const result = await authenticateChat(chatId, apiKey, testUser, env);
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid API key. Please check and try again.');
      
      // Verify no chat auth was stored
      const chatData = await mockChats.get(chatId.toString());
      expect(chatData).toBeNull();
    });

    it('should reject expired API key', async () => {
      const chatId = 12345;
      const apiKey = 'apple-banana-cherry-dog-elephant';
      const keyHash = 'sha256:' + Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey)))
      ).map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Set up expired API key
      const apiKeyData: ApiKeyData = {
        name: 'Test Key',
        expiry: new Date(Date.now() - 86400000).toISOString(), // expired
        created: new Date().toISOString()
      };
      await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
      
      const result = await authenticateChat(chatId, apiKey, testUser, env);
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Your API key has expired. Please contact the bot owner for a new key.');
    });

    it('should enforce rate limiting after 3 attempts', async () => {
      const chatId = 12345;
      const apiKey = 'invalid-wrong-key-test-here';
      
      // Make 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await authenticateChat(chatId, apiKey, testUser, env);
      }
      
      // 4th attempt should be blocked
      const result = await authenticateChat(chatId, apiKey, testUser, env);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Too many failed attempts');
    });

    it('should enforce 1-hour lockout after 5 failed attempts', async () => {
      const chatId = 12346;
      const apiKey = 'invalid-key-for-5-attempts';
      
      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await authenticateChat(chatId, apiKey, testUser, env);
      }
      
      // 6th attempt should be blocked with 1-hour lockout
      const result = await authenticateChat(chatId, apiKey, testUser, env);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Too many failed attempts');
      expect(result.message).toMatch(/Please try again after.*\d{4}/); // Contains timestamp
    });

    it('should enforce 24-hour lockout after 10 failed attempts', async () => {
      const chatId = 12347;
      const apiKey = 'invalid-key-for-10-attempts';
      
      // Make 10 failed attempts
      for (let i = 0; i < 10; i++) {
        await authenticateChat(chatId, apiKey, testUser, env);
      }
      
      // 11th attempt should be blocked with 24-hour lockout
      const result = await authenticateChat(chatId, apiKey, testUser, env);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Too many failed attempts');
      expect(result.message).toMatch(/Please try again after.*\d{4}/); // Contains timestamp
    });

    it('should reject valid API key during lockout period', async () => {
      const chatId = 12348;
      const invalidKey = 'invalid-key-to-trigger-lockout';
      const validKey = 'test-api-key-123';
      
      // Set up valid API key in storage
      const keyHash = await hashApiKey(validKey);
      const apiKeyData: ApiKeyData = {
        name: 'Valid Test Key',
        expiry: new Date(Date.now() + 86400000).toISOString(),
        created: new Date().toISOString()
      };
      await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
      
      // Make 3 failed attempts to trigger lockout
      for (let i = 0; i < 3; i++) {
        await authenticateChat(chatId, invalidKey, testUser, env);
      }
      
      // Now try with valid key - should still fail due to lockout
      const result = await authenticateChat(chatId, validKey, testUser, env);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Too many failed attempts');
    });

    it('should clear rate limits on successful authentication', async () => {
      const chatId = 12349;
      const validKey = 'test-clear-rate-limits';
      
      // Set up valid API key
      const keyHash = await hashApiKey(validKey);
      const apiKeyData: ApiKeyData = {
        name: 'Clear Rate Limits Key',
        expiry: new Date(Date.now() + 86400000).toISOString(),
        created: new Date().toISOString()
      };
      await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
      
      // Make 2 failed attempts first
      for (let i = 0; i < 2; i++) {
        await authenticateChat(chatId, 'invalid-key', testUser, env);
      }
      
      // Verify rate limit data exists
      const rateLimitData = await mockRateLimits.get(chatId.toString());
      expect(rateLimitData).toBeTruthy();
      
      // Successfully authenticate with valid key
      const successResult = await authenticateChat(chatId, validKey, testUser, env);
      expect(successResult.success).toBe(true);
      
      // Verify rate limit data is cleared
      const clearedData = await mockRateLimits.get(chatId.toString());
      expect(clearedData).toBeNull();
      
      // Make another failed attempt - should start count at 1
      await authenticateChat(chatId, 'invalid-key-2', testUser, env);
      const newRateLimitData = await mockRateLimits.get(chatId.toString());
      expect(newRateLimitData).toBeTruthy();
      const parsedData = JSON.parse(newRateLimitData!);
      expect(parsedData.failed_attempts).toBe(1);
    });

    it('should handle TTL expiration correctly', async () => {
      const chatId = 12350;
      const apiKey = 'test-ttl-expiration';
      
      // Make 1 failed attempt to create rate limit entry
      await authenticateChat(chatId, apiKey, testUser, env);
      
      // Verify entry exists
      const rateLimitData = await mockRateLimits.get(chatId.toString());
      expect(rateLimitData).toBeTruthy();
      
      // Simulate TTL expiration by manually removing the entry
      // (MockKV doesn't auto-expire, so we simulate it)
      await mockRateLimits.delete(chatId.toString());
      
      // Verify entry is gone
      const expiredData = await mockRateLimits.get(chatId.toString());
      expect(expiredData).toBeNull();
      
      // New attempt should work normally (no existing rate limit)
      await authenticateChat(chatId, 'another-invalid-key', testUser, env);
      const newData = await mockRateLimits.get(chatId.toString());
      expect(newData).toBeTruthy();
      const parsedNewData = JSON.parse(newData!);
      expect(parsedNewData.failed_attempts).toBe(1);
    });
  });

  describe('getAuthDetails', () => {
    it('should return auth details for authenticated chat', async () => {
      const chatId = 12345;
      const keyHash = 'sha256:testhash';
      
      // Set up valid API key
      const apiKeyData: ApiKeyData = {
        name: 'Test Key',
        expiry: new Date(Date.now() + 86400000).toISOString(),
        created: new Date().toISOString()
      };
      await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
      
      // Set up chat auth
      const chatAuth: ChatAuthData = {
        api_key_hash: keyHash,
        authenticated_at: new Date().toISOString(),
        authenticated_by: testUser
      };
      await mockChats.put(chatId.toString(), JSON.stringify(chatAuth));
      
      const result = await getAuthDetails(chatId, env);
      
      expect(result).toBeTruthy();
      expect(result!.keyName).toBe('Test Key');
      expect(result!.authenticatedBy.id).toBe(testUser.id);
    });

    it('should return null for unauthenticated chat', async () => {
      const result = await getAuthDetails(12345, env);
      expect(result).toBeNull();
    });

    it('should return null and clean up expired key', async () => {
      const chatId = 12345;
      const keyHash = 'sha256:testhash';
      
      // Set up expired API key
      const apiKeyData: ApiKeyData = {
        name: 'Test Key',
        expiry: new Date(Date.now() - 86400000).toISOString(), // expired
        created: new Date().toISOString()
      };
      await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
      
      // Set up chat auth
      const chatAuth: ChatAuthData = {
        api_key_hash: keyHash,
        authenticated_at: new Date().toISOString(),
        authenticated_by: testUser
      };
      await mockChats.put(chatId.toString(), JSON.stringify(chatAuth));
      
      const result = await getAuthDetails(chatId, env);
      expect(result).toBeNull();
      
      // Verify cleanup
      const chatData = await mockChats.get(chatId.toString());
      expect(chatData).toBeNull();
    });

    it('should return null and clean up when API key is deleted', async () => {
      const chatId = 12345;
      const keyHash = 'sha256:testhash';
      
      // Initially set up valid API key
      const apiKeyData: ApiKeyData = {
        name: 'Test Key',
        expiry: new Date(Date.now() + 86400000).toISOString(), // 24 hours from now
        created: new Date().toISOString()
      };
      await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
      
      // Set up chat auth
      const chatAuth: ChatAuthData = {
        api_key_hash: keyHash,
        authenticated_at: new Date().toISOString(),
        authenticated_by: testUser
      };
      await mockChats.put(chatId.toString(), JSON.stringify(chatAuth));
      
      // Verify initially can get auth details
      let result = await getAuthDetails(chatId, env);
      expect(result).toBeTruthy();
      expect(result!.keyName).toBe('Test Key');
      
      // Now delete the API key (simulating admin deletion)
      await mockApiKeys.delete(keyHash);
      
      // Try to get auth details again
      result = await getAuthDetails(chatId, env);
      expect(result).toBeNull();
      
      // Verify chat association was cleaned up
      const chatData = await mockChats.get(chatId.toString());
      expect(chatData).toBeNull();
    });
  });
});