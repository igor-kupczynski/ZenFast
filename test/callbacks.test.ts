import { describe, it, expect, beforeEach } from 'vitest';
import { routeCallback } from '../src/callbacks';
import { Env, User, CallbackQuery, Message, Chat, ChatAuthData, ApiKeyData } from '../src/types';
import { MockKV } from './utils/mockKv';

describe('Callbacks Module', () => {
  let mockApiKeys: MockKV;
  let mockChats: MockKV;
  let mockFasts: MockKV;
  let env: Env;
  let testUser: User;
  let testMessage: Message;
  let testChat: Chat;

  beforeEach(() => {
    mockApiKeys = new MockKV();
    mockChats = new MockKV();
    mockFasts = new MockKV();
    
    env = {
      BOT_TOKEN: 'test-token',
      BOT_USERNAME: 'TestBot',
      WEBHOOK_SECRET: 'test-secret',
      API_KEYS: mockApiKeys as any,
      CHATS: mockChats as any,
      RATE_LIMITS: new MockKV() as any,
      FASTS: mockFasts as any,
    };

    testUser = {
      id: 123456789,
      is_bot: false,
      first_name: 'Test',
      username: 'testuser'
    };

    testChat = {
      id: 12345,
      type: 'private'
    };

    testMessage = {
      message_id: 100,
      chat: testChat,
      date: Math.floor(Date.now() / 1000),
      from: testUser
    };
  });

  async function authenticateUser(chatId: number) {
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
  }

  describe('routeCallback', () => {
    it('should handle missing callback data', async () => {
      const callbackQuery: CallbackQuery = {
        id: 'callback123',
        from: testUser,
        message: testMessage,
        chat_instance: 'instance123'
      };

      const result = await routeCallback(callbackQuery, env);
      expect(result.showAlert).toBe(false);
    });

    it('should handle missing message', async () => {
      const callbackQuery: CallbackQuery = {
        id: 'callback123',
        from: testUser,
        data: 'start_fast',
        chat_instance: 'instance123'
      };

      const result = await routeCallback(callbackQuery, env);
      expect(result.showAlert).toBe(false);
    });

    it('should require authentication', async () => {
      const callbackQuery: CallbackQuery = {
        id: 'callback123',
        from: testUser,
        message: testMessage,
        data: 'start_fast',
        chat_instance: 'instance123'
      };

      const result = await routeCallback(callbackQuery, env);
      expect(result.text).toContain('Please authenticate first');
      expect(result.showAlert).toBe(true);
    });

    it('should handle unknown callback data', async () => {
      await authenticateUser(testChat.id);

      const callbackQuery: CallbackQuery = {
        id: 'callback123',
        from: testUser,
        message: testMessage,
        data: 'unknown_action',
        chat_instance: 'instance123'
      };

      const result = await routeCallback(callbackQuery, env);
      expect(result.showAlert).toBe(false);
    });
  });

  describe('start_fast callback', () => {
    beforeEach(async () => {
      await authenticateUser(testChat.id);
    });

    it('should start a fast successfully', async () => {
      const callbackQuery: CallbackQuery = {
        id: 'callback123',
        from: testUser,
        message: testMessage,
        data: 'start_fast',
        chat_instance: 'instance123'
      };

      const result = await routeCallback(callbackQuery, env);
      
      expect(result.editMessage).toBeDefined();
      expect(result.editMessage!.newText).toContain('✅ Fast started at');
      expect(result.editMessage!.newKeyboard).toBeDefined();
      expect(result.editMessage!.newKeyboard?.inline_keyboard?.[0]?.[0]?.text).toBe('🛑 End Fast');
      expect(result.editMessage!.newKeyboard?.inline_keyboard?.[0]?.[0]?.callback_data).toBe('end_fast');
    });
  });

  describe('end_fast callback', () => {
    beforeEach(async () => {
      await authenticateUser(testChat.id);
    });

    it('should end a fast successfully', async () => {
      // First start a fast
      const startCallbackQuery: CallbackQuery = {
        id: 'callback123',
        from: testUser,
        message: testMessage,
        data: 'start_fast',
        chat_instance: 'instance123'
      };
      await routeCallback(startCallbackQuery, env);

      // Wait a bit for duration
      await new Promise(resolve => setTimeout(resolve, 10));

      // Then end the fast
      const endCallbackQuery: CallbackQuery = {
        id: 'callback456',
        from: testUser,
        message: testMessage,
        data: 'end_fast',
        chat_instance: 'instance123'
      };

      const result = await routeCallback(endCallbackQuery, env);
      
      expect(result.editMessage).toBeDefined();
      expect(result.editMessage!.newText).toContain('✅ Great job! You fasted for');
      expect(result.editMessage!.newText).toContain('1st fast this week');
      expect(result.editMessage!.newKeyboard).toBeDefined();
      expect(result.editMessage!.newKeyboard?.inline_keyboard?.[0]?.[0]?.text).toBe('🚀 Start Fast');
      expect(result.editMessage!.newKeyboard?.inline_keyboard?.[0]?.[0]?.callback_data).toBe('start_fast');
    });

    it('should handle ending when no active fast', async () => {
      const callbackQuery: CallbackQuery = {
        id: 'callback123',
        from: testUser,
        message: testMessage,
        data: 'end_fast',
        chat_instance: 'instance123'
      };

      const result = await routeCallback(callbackQuery, env);
      
      expect(result.text).toBe('No active fast to end.');
      expect(result.showAlert).toBe(true);
    });

    it('should show correct ordinal numbers for multiple fasts', async () => {
      // Complete a few fasts to test ordinal numbering
      for (let i = 0; i < 3; i++) {
        // Start fast
        const startQuery: CallbackQuery = {
          id: `start${i}`,
          from: testUser,
          message: testMessage,
          data: 'start_fast',
          chat_instance: 'instance123'
        };
        await routeCallback(startQuery, env);

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 10));

        // End fast
        const endQuery: CallbackQuery = {
          id: `end${i}`,
          from: testUser,
          message: testMessage,
          data: 'end_fast',
          chat_instance: 'instance123'
        };
        const result = await routeCallback(endQuery, env);

        if (i === 0) {
          expect(result.editMessage!.newText).toContain('1st fast this week');
        } else if (i === 1) {
          expect(result.editMessage!.newText).toContain('2nd fast this week');
        } else if (i === 2) {
          expect(result.editMessage!.newText).toContain('3rd fast this week');
        }
      }
    });
  });
});