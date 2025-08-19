import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  handleStartCommand, 
  handleStatusCommand, 
  handleFastCommand,
  handleEndCommand,
  handleStatsCommand,
  handleTimezoneCommand,
  handleWeekCommand,
  handleMonthCommand,
  extractCommand, 
  routeCommand 
} from '../src/commands';
import { Env, User, ApiKeyData, ChatAuthData } from '../src/types';
import { MockKV } from './utils/mockKv';

describe('Commands Module', () => {
  let mockApiKeys: MockKV;
  let mockChats: MockKV;
  let mockRateLimits: MockKV;
  let mockFasts: MockKV;
  let env: Env;
  let testUser: User;

  beforeEach(() => {
    mockApiKeys = new MockKV();
    mockChats = new MockKV();
    mockRateLimits = new MockKV();
    mockFasts = new MockKV();
    
    env = {
      BOT_TOKEN: 'test-token',
      BOT_USERNAME: 'TestBot',
      WEBHOOK_SECRET: 'test-secret',
      API_KEYS: mockApiKeys as any,
      CHATS: mockChats as any,
      RATE_LIMITS: mockRateLimits as any,
      FASTS: mockFasts as any,
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

  describe('handleFastCommand', () => {
    it('should require authentication', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      const result = await handleFastCommand(chatId, testUser, messageId, env);
      
      expect(result.text).toContain('Please authenticate by sending your API key first.');
    });

    it('should start a fast when not currently fasting', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      // Set up authentication
      const keyHash = 'sha256:testhash';
      const apiKeyData: ApiKeyData = {
        name: 'Test Key',
        expiry: new Date(Date.now() + 86400000).toISOString(),
        created: new Date().toISOString()
      };
      await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
      
      const chatAuth: ChatAuthData = {
        api_key_hash: keyHash,
        authenticated_at: new Date().toISOString(),
        authenticated_by: testUser
      };
      await mockChats.put(chatId.toString(), JSON.stringify(chatAuth));
      
      const result = await handleFastCommand(chatId, testUser, messageId, env);
      
      expect(result.text).toContain('✅ Fast started at');
      expect(result.replyMarkup).toBeDefined();
      expect(result.replyMarkup?.inline_keyboard?.[0]?.[0]?.text).toBe('🛑 End Fast');
    });

    it('should show current fast duration when already fasting', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      // Set up authentication
      const keyHash = 'sha256:testhash';
      const apiKeyData: ApiKeyData = {
        name: 'Test Key',
        expiry: new Date(Date.now() + 86400000).toISOString(),
        created: new Date().toISOString()
      };
      await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
      
      const chatAuth: ChatAuthData = {
        api_key_hash: keyHash,
        authenticated_at: new Date().toISOString(),
        authenticated_by: testUser
      };
      await mockChats.put(chatId.toString(), JSON.stringify(chatAuth));
      
      // Start a fast first
      await handleFastCommand(chatId, testUser, messageId, env);
      
      // Then call again to see current duration
      const result = await handleFastCommand(chatId, testUser, messageId, env);
      
      expect(result.text).toContain("You've been fasting for");
      expect(result.replyMarkup?.inline_keyboard?.[0]?.[0]?.text).toBe('🛑 End Fast');
    });

    it('should handle time adjustment for new fast', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      // Set up authentication
      const keyHash = 'sha256:testhash';
      const apiKeyData: ApiKeyData = {
        name: 'Test Key',
        expiry: new Date(Date.now() + 86400000).toISOString(),
        created: new Date().toISOString()
      };
      await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
      
      const chatAuth: ChatAuthData = {
        api_key_hash: keyHash,
        authenticated_at: new Date().toISOString(),
        authenticated_by: testUser
      };
      await mockChats.put(chatId.toString(), JSON.stringify(chatAuth));
      
      const result = await handleFastCommand(chatId, testUser, messageId, env, '/f -2h');
      
      expect(result.text).toContain('✅ Fast started at');
      expect(result.text).toContain('(adjusted from your input)');
    });

    it('should return error for invalid time adjustment', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      // Set up authentication
      const keyHash = 'sha256:testhash';
      const apiKeyData: ApiKeyData = {
        name: 'Test Key',
        expiry: new Date(Date.now() + 86400000).toISOString(),
        created: new Date().toISOString()
      };
      await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
      
      const chatAuth: ChatAuthData = {
        api_key_hash: keyHash,
        authenticated_at: new Date().toISOString(),
        authenticated_by: testUser
      };
      await mockChats.put(chatId.toString(), JSON.stringify(chatAuth));
      
      const result = await handleFastCommand(chatId, testUser, messageId, env, '/f invalid');
      
      expect(result.text).toContain('❌');
      expect(result.text).toContain('Invalid time format');
    });
  });

  describe('handleEndCommand', () => {
    it('should require authentication', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      const result = await handleEndCommand(chatId, testUser, messageId, env);
      
      expect(result.text).toContain('Please authenticate by sending your API key first.');
    });

    it('should end current fast successfully', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      // Set up authentication
      const keyHash = 'sha256:testhash';
      const apiKeyData: ApiKeyData = {
        name: 'Test Key',
        expiry: new Date(Date.now() + 86400000).toISOString(),
        created: new Date().toISOString()
      };
      await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
      
      const chatAuth: ChatAuthData = {
        api_key_hash: keyHash,
        authenticated_at: new Date().toISOString(),
        authenticated_by: testUser
      };
      await mockChats.put(chatId.toString(), JSON.stringify(chatAuth));
      
      // Start a fast first
      await handleFastCommand(chatId, testUser, messageId, env);
      
      // Wait a bit for duration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // End the fast
      const result = await handleEndCommand(chatId, testUser, messageId, env);
      
      expect(result.text).toContain('✅ Great job! You fasted for');
      expect(result.text).toContain('1st fast this week');
      expect(result.replyMarkup?.inline_keyboard?.[0]?.[0]?.text).toBe('🚀 Start Fast');
    });

    it('should handle time adjustment for ending fast', async () => {
      // Mock time to ensure test is deterministic
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-08-19T18:00:00.000Z')); // 6:00 PM UTC (8:00 PM Europe/Paris)
      
      try {
        const chatId = 12345;
        const messageId = 100;
        
        // Set up authentication
        const keyHash = 'sha256:testhash';
        const apiKeyData: ApiKeyData = {
          name: 'Test Key',
          expiry: new Date(Date.now() + 86400000).toISOString(),
          created: new Date().toISOString()
        };
        await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
        
        const chatAuth: ChatAuthData = {
          api_key_hash: keyHash,
          authenticated_at: new Date().toISOString(),
          authenticated_by: testUser
        };
        await mockChats.put(chatId.toString(), JSON.stringify(chatAuth));
        
        // Start a fast first (at 10:00 AM Europe/Paris = 8:00 UTC, earlier than current 18:00 UTC)
        await handleFastCommand(chatId, testUser, messageId, env, '/f 10:00');
        
        // End with time adjustment (16:00 Europe/Paris = 14:00 UTC, which is after start but before current 18:00 UTC)
        const result = await handleEndCommand(chatId, testUser, messageId, env, '/e 16:00');
        
        expect(result.text).toContain('✅ Great job! You fasted for');
        expect(result.text).toContain('(adjusted from your input)');
      } finally {
        vi.useRealTimers();
      }
    });

    it('should return error for invalid end time adjustment', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      // Set up authentication  
      const keyHash = 'sha256:testhash';
      const apiKeyData: ApiKeyData = {
        name: 'Test Key',
        expiry: new Date(Date.now() + 86400000).toISOString(),
        created: new Date().toISOString()
      };
      await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
      
      const chatAuth: ChatAuthData = {
        api_key_hash: keyHash,
        authenticated_at: new Date().toISOString(),
        authenticated_by: testUser
      };
      await mockChats.put(chatId.toString(), JSON.stringify(chatAuth));
      
      // Start a fast first
      await handleFastCommand(chatId, testUser, messageId, env);
      
      // Try to end with invalid time adjustment
      const result = await handleEndCommand(chatId, testUser, messageId, env, '/e invalid');
      
      expect(result.text).toContain('❌');
      expect(result.text).toContain('Invalid time format');
    });

    it('should show last fast when not currently fasting', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      // Set up authentication
      const keyHash = 'sha256:testhash';
      const apiKeyData: ApiKeyData = {
        name: 'Test Key',
        expiry: new Date(Date.now() + 86400000).toISOString(),
        created: new Date().toISOString()
      };
      await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
      
      const chatAuth: ChatAuthData = {
        api_key_hash: keyHash,
        authenticated_at: new Date().toISOString(),
        authenticated_by: testUser
      };
      await mockChats.put(chatId.toString(), JSON.stringify(chatAuth));
      
      const result = await handleEndCommand(chatId, testUser, messageId, env);
      
      expect(result.text).toContain("You're not currently fasting and have no fasting history.");
      expect(result.replyMarkup?.inline_keyboard?.[0]?.[0]?.text).toBe('🚀 Start Fast');
    });
  });

  describe('handleStatsCommand', () => {
    it('should require authentication', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      const result = await handleStatsCommand(chatId, testUser, messageId, env);
      
      expect(result.text).toContain('Please authenticate by sending your API key first.');
    });

    it('should show no history message for new user', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      // Set up authentication
      const keyHash = 'sha256:testhash';
      const apiKeyData: ApiKeyData = {
        name: 'Test Key',
        expiry: new Date(Date.now() + 86400000).toISOString(),
        created: new Date().toISOString()
      };
      await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
      
      const chatAuth: ChatAuthData = {
        api_key_hash: keyHash,
        authenticated_at: new Date().toISOString(),
        authenticated_by: testUser
      };
      await mockChats.put(chatId.toString(), JSON.stringify(chatAuth));
      
      const result = await handleStatsCommand(chatId, testUser, messageId, env);
      
      expect(result.text).toContain('📊 No fasting history yet');
      expect(result.replyMarkup?.inline_keyboard?.[0]?.[0]?.text).toBe('🚀 Start Fast');
    });
  });

  describe('handleTimezoneCommand', () => {
    it('should require authentication', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      const result = await handleTimezoneCommand(chatId, testUser, messageId, '/timezone', env);
      
      expect(result.text).toContain('Please authenticate by sending your API key first.');
    });

    it('should show current timezone when no argument provided', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      // Set up authentication
      const keyHash = 'sha256:testhash';
      const apiKeyData: ApiKeyData = {
        name: 'Test Key',
        expiry: new Date(Date.now() + 86400000).toISOString(),
        created: new Date().toISOString()
      };
      await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
      
      const chatAuth: ChatAuthData = {
        api_key_hash: keyHash,
        authenticated_at: new Date().toISOString(),
        authenticated_by: testUser
      };
      await mockChats.put(chatId.toString(), JSON.stringify(chatAuth));
      
      const result = await handleTimezoneCommand(chatId, testUser, messageId, '/timezone', env);
      
      expect(result.text).toContain('Your current timezone is: Europe/Paris');
    });

    it('should update timezone successfully', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      // Set up authentication
      const keyHash = 'sha256:testhash';
      const apiKeyData: ApiKeyData = {
        name: 'Test Key',
        expiry: new Date(Date.now() + 86400000).toISOString(),
        created: new Date().toISOString()
      };
      await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
      
      const chatAuth: ChatAuthData = {
        api_key_hash: keyHash,
        authenticated_at: new Date().toISOString(),
        authenticated_by: testUser
      };
      await mockChats.put(chatId.toString(), JSON.stringify(chatAuth));
      
      const result = await handleTimezoneCommand(chatId, testUser, messageId, '/timezone America/New_York', env);
      
      expect(result.text).toContain('✅ Timezone updated to: America/New_York');
    });

    it('should reject invalid timezone', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      // Set up authentication
      const keyHash = 'sha256:testhash';
      const apiKeyData: ApiKeyData = {
        name: 'Test Key',
        expiry: new Date(Date.now() + 86400000).toISOString(),
        created: new Date().toISOString()
      };
      await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
      
      const chatAuth: ChatAuthData = {
        api_key_hash: keyHash,
        authenticated_at: new Date().toISOString(),
        authenticated_by: testUser
      };
      await mockChats.put(chatId.toString(), JSON.stringify(chatAuth));
      
      const result = await handleTimezoneCommand(chatId, testUser, messageId, '/timezone Invalid/Timezone', env);
      
      expect(result.text).toContain('Invalid timezone: Invalid/Timezone');
    });
  });

  describe('routeCommand', () => {
    it('should route start command correctly', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      const result = await routeCommand('start', chatId, testUser, messageId, '/start', env);
      
      expect(result).toBeTruthy();
      expect(result!.text).toContain('Welcome to ZenFast!');
    });

    it('should route status command correctly', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      const result = await routeCommand('status', chatId, testUser, messageId, '/status', env);
      
      expect(result).toBeTruthy();
      expect(result!.text).toContain('Authentication Status:');
    });

    it('should route fast commands correctly', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      // Set up authentication
      const keyHash = 'sha256:testhash';
      const apiKeyData: ApiKeyData = {
        name: 'Test Key',
        expiry: new Date(Date.now() + 86400000).toISOString(),
        created: new Date().toISOString()
      };
      await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
      
      const chatAuth: ChatAuthData = {
        api_key_hash: keyHash,
        authenticated_at: new Date().toISOString(),
        authenticated_by: testUser
      };
      await mockChats.put(chatId.toString(), JSON.stringify(chatAuth));
      
      // Test /fast command
      const fastResult = await routeCommand('fast', chatId, testUser, messageId, '/fast', env);
      expect(fastResult).toBeTruthy();
      expect(fastResult!.text).toContain('Fast started at');
      expect(fastResult!.replyMarkup).toBeDefined();
      
      // Test /f alias
      const fResult = await routeCommand('f', chatId, testUser, messageId, '/f', env);
      expect(fResult).toBeTruthy();
      expect(fResult!.text).toContain("You've been fasting for");
      
      // Wait a bit for duration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Test /end command
      const endResult = await routeCommand('end', chatId, testUser, messageId, '/end', env);
      expect(endResult).toBeTruthy();
      expect(endResult!.text).toContain('Great job! You fasted for');
      
      // Test /e alias
      const eResult = await routeCommand('e', chatId, testUser, messageId, '/e', env);
      expect(eResult).toBeTruthy();
      expect(eResult!.text).toContain("You're not currently fasting");
    });

    it('should route stats command correctly', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      // Set up authentication
      const keyHash = 'sha256:testhash';
      const apiKeyData: ApiKeyData = {
        name: 'Test Key',
        expiry: new Date(Date.now() + 86400000).toISOString(),
        created: new Date().toISOString()
      };
      await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
      
      const chatAuth: ChatAuthData = {
        api_key_hash: keyHash,
        authenticated_at: new Date().toISOString(),
        authenticated_by: testUser
      };
      await mockChats.put(chatId.toString(), JSON.stringify(chatAuth));
      
      const result = await routeCommand('stats', chatId, testUser, messageId, '/stats', env);
      
      expect(result).toBeTruthy();
      expect(result!.text).toContain('📊');
    });

    it('should route timezone command correctly', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      // Set up authentication
      const keyHash = 'sha256:testhash';
      const apiKeyData: ApiKeyData = {
        name: 'Test Key',
        expiry: new Date(Date.now() + 86400000).toISOString(),
        created: new Date().toISOString()
      };
      await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
      
      const chatAuth: ChatAuthData = {
        api_key_hash: keyHash,
        authenticated_at: new Date().toISOString(),
        authenticated_by: testUser
      };
      await mockChats.put(chatId.toString(), JSON.stringify(chatAuth));
      
      const result = await routeCommand('timezone', chatId, testUser, messageId, '/timezone America/New_York', env);
      
      expect(result).toBeTruthy();
      expect(result!.text).toContain('Timezone updated to: America/New_York');
    });

    it('should return null for unknown commands', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      const result = await routeCommand('unknown', chatId, testUser, messageId, '/unknown', env);
      
      expect(result).toBeNull();
    });

    it('should handle help command (unknown, should return null)', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      const result = await routeCommand('help', chatId, testUser, messageId, '/help', env);
      
      expect(result).toBeNull();
    });

    it('should route week command correctly', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      // Set up authentication
      const keyHash = 'sha256:testhash';
      const apiKeyData: ApiKeyData = {
        name: 'Test Key',
        expiry: new Date(Date.now() + 86400000).toISOString(),
        created: new Date().toISOString()
      };
      await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
      
      const chatAuth: ChatAuthData = {
        api_key_hash: keyHash,
        authenticated_at: new Date().toISOString(),
        authenticated_by: testUser
      };
      await mockChats.put(chatId.toString(), JSON.stringify(chatAuth));
      
      const result = await routeCommand('week', chatId, testUser, messageId, '/week', env);
      
      expect(result).toBeTruthy();
      expect(result!.text).toContain("📅 This Week's Fasting Summary");
    });

    it('should route month command correctly', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      // Set up authentication
      const keyHash = 'sha256:testhash';
      const apiKeyData: ApiKeyData = {
        name: 'Test Key',
        expiry: new Date(Date.now() + 86400000).toISOString(),
        created: new Date().toISOString()
      };
      await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
      
      const chatAuth: ChatAuthData = {
        api_key_hash: keyHash,
        authenticated_at: new Date().toISOString(),
        authenticated_by: testUser
      };
      await mockChats.put(chatId.toString(), JSON.stringify(chatAuth));
      
      const result = await routeCommand('month', chatId, testUser, messageId, '/month', env);
      
      expect(result).toBeTruthy();
      expect(result!.text).toContain("📊 This Month's Fasting Summary");
    });
  });

  describe('handleWeekCommand', () => {
    it('should require authentication', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      const result = await handleWeekCommand(chatId, testUser, messageId, env);
      
      expect(result.text).toContain('Please authenticate by sending your API key first.');
    });

    it('should show no fasts message when user has no weekly history', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      // Set up authentication
      const keyHash = 'sha256:testhash';
      const apiKeyData: ApiKeyData = {
        name: 'Test Key',
        expiry: new Date(Date.now() + 86400000).toISOString(),
        created: new Date().toISOString()
      };
      await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
      
      const chatAuth: ChatAuthData = {
        api_key_hash: keyHash,
        authenticated_at: new Date().toISOString(),
        authenticated_by: testUser
      };
      await mockChats.put(chatId.toString(), JSON.stringify(chatAuth));
      
      const result = await handleWeekCommand(chatId, testUser, messageId, env);
      
      expect(result.text).toContain('No fasts completed this week yet');
      expect(result.replyMarkup).toBeDefined();
    });
  });

  describe('handleMonthCommand', () => {
    it('should require authentication', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      const result = await handleMonthCommand(chatId, testUser, messageId, env);
      
      expect(result.text).toContain('Please authenticate by sending your API key first.');
    });

    it('should show no fasts message when user has no monthly history', async () => {
      const chatId = 12345;
      const messageId = 100;
      
      // Set up authentication
      const keyHash = 'sha256:testhash';
      const apiKeyData: ApiKeyData = {
        name: 'Test Key',
        expiry: new Date(Date.now() + 86400000).toISOString(),
        created: new Date().toISOString()
      };
      await mockApiKeys.put(keyHash, JSON.stringify(apiKeyData));
      
      const chatAuth: ChatAuthData = {
        api_key_hash: keyHash,
        authenticated_at: new Date().toISOString(),
        authenticated_by: testUser
      };
      await mockChats.put(chatId.toString(), JSON.stringify(chatAuth));
      
      const result = await handleMonthCommand(chatId, testUser, messageId, env);
      
      expect(result.text).toContain('No fasts completed this month yet');
      expect(result.replyMarkup).toBeDefined();
    });
  });
});