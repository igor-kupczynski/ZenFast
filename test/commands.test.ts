import { describe, it, expect, beforeEach } from 'vitest';
import { handleStartCommand, handleStatusCommand, extractCommand, routeCommand } from '../src/commands';
import { Env, User, ApiKeyData, ChatAuthData } from '../src/types';
import { MockKV } from './utils/mockKv';

describe('Commands Module', () => {
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

  describe('extractCommand', () => {
    it('should extract command from message text', () => {
      expect(extractCommand('/start')).toBe('start');
      expect(extractCommand('/status')).toBe('status');
      expect(extractCommand('/help')).toBe('help');
      expect(extractCommand('/START')).toBe('start'); // should be lowercase
    });

    it('should handle commands with arguments', () => {
      expect(extractCommand('/start hello world')).toBe('start');
      expect(extractCommand('/status now')).toBe('status');
    });

    it('should return null for non-commands', () => {
      expect(extractCommand('hello world')).toBeNull();
      expect(extractCommand('test-api-key-here-now')).toBeNull();
      expect(extractCommand('')).toBeNull();
    });

    it('should handle edge cases', () => {
      expect(extractCommand('/')).toBeNull();
      expect(extractCommand('/123')).toBe('123');
      expect(extractCommand('/cmd_with_underscores')).toBe('cmd_with_underscores');
    });
  });

  describe('handleStartCommand', () => {
    it('should show authentication prompt for unauthenticated chat', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      const result = await handleStartCommand(chatId, testUser, messageId, env);
      
      expect(result.text).toContain('Welcome to ZenFast! 🚀');
      expect(result.text).toContain('Please authenticate by sending your API key.');
      expect(result.replyToMessageId).toBe(messageId);
    });

    it('should show welcome back message for authenticated chat', async () => {
      const chatId = 12345;
      const messageId = 100;
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
      
      const result = await handleStartCommand(chatId, testUser, messageId, env);
      
      expect(result.text).toContain('Welcome back! ✅');
      expect(result.text).toContain('Authenticated as: Test Key');
      expect(result.text).toContain('Expires:');
      expect(result.replyToMessageId).toBe(messageId);
    });
  });

  describe('handleStatusCommand', () => {
    it('should show not authenticated message for unauthenticated chat', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      const result = await handleStatusCommand(chatId, testUser, messageId, env);
      
      expect(result.text).toContain('Authentication Status: ❌ Not authenticated');
      expect(result.text).toContain('Please use /start to begin authentication.');
      expect(result.replyToMessageId).toBe(messageId);
    });

    it('should show authentication details for authenticated chat', async () => {
      const chatId = 12345;
      const messageId = 100;
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
      
      const result = await handleStatusCommand(chatId, testUser, messageId, env);
      
      expect(result.text).toContain('Authentication Status: ✅ Authenticated');
      expect(result.text).toContain('Key Name: Test Key');
      expect(result.text).toContain('Expires:');
      expect(result.text).toContain('Authenticated by: Test');
      expect(result.text).toContain('Authenticated on:');
      expect(result.replyToMessageId).toBe(messageId);
    });
  });

  describe('routeCommand', () => {
    it('should route start command correctly', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      const result = await routeCommand('start', chatId, testUser, messageId, env);
      
      expect(result).toBeTruthy();
      expect(result!.text).toContain('Welcome to ZenFast!');
    });

    it('should route status command correctly', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      const result = await routeCommand('status', chatId, testUser, messageId, env);
      
      expect(result).toBeTruthy();
      expect(result!.text).toContain('Authentication Status:');
    });

    it('should return null for unknown commands', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      const result = await routeCommand('unknown', chatId, testUser, messageId, env);
      
      expect(result).toBeNull();
    });

    it('should handle help command (unknown, should return null)', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      const result = await routeCommand('help', chatId, testUser, messageId, env);
      
      expect(result).toBeNull();
    });
  });
});