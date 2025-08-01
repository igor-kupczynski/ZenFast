import { describe, it, expect } from 'vitest';
import { validateWebhookSecret, parseWebhookUpdate, shouldProcessMessage, extractChatId, extractMessageText } from '../src/webhook.ts';
import { Env, Update } from '../src/types.ts';

// Mock environment
const mockEnv: Env = {
  BOT_TOKEN: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz',
  BOT_USERNAME: 'ZenFastBot',
  WEBHOOK_SECRET: 'test-secret-token',
  API_KEYS: {} as KVNamespace,
  CHATS: {} as KVNamespace,
  RATE_LIMITS: {} as KVNamespace,
};

describe('Webhook Security', () => {
  it('should validate correct webhook secret', () => {
    const request = new Request('https://example.com/webhook', {
      method: 'POST',
      headers: {
        'X-Telegram-Bot-Api-Secret-Token': 'test-secret-token',
      },
    });

    expect(validateWebhookSecret(request, mockEnv)).toBe(true);
  });

  it('should reject incorrect webhook secret', () => {
    const request = new Request('https://example.com/webhook', {
      method: 'POST',
      headers: {
        'X-Telegram-Bot-Api-Secret-Token': 'wrong-secret',
      },
    });

    expect(validateWebhookSecret(request, mockEnv)).toBe(false);
  });

  it('should reject missing webhook secret', () => {
    const request = new Request('https://example.com/webhook', {
      method: 'POST',
    });

    expect(validateWebhookSecret(request, mockEnv)).toBe(false);
  });
});

describe('Update Parsing', () => {
  it('should parse valid webhook update', async () => {
    const updateData: Update = {
      update_id: 1,
      message: {
        message_id: 1,
        chat: { id: 123, type: 'private' },
        date: 1234567890,
        text: 'Hello, bot!',
      },
    };

    const request = new Request('https://example.com/webhook', {
      method: 'POST',
      body: JSON.stringify(updateData),
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await parseWebhookUpdate(request);
    expect(result).toEqual(updateData);
  });

  it('should return null for invalid JSON', async () => {
    const request = new Request('https://example.com/webhook', {
      method: 'POST',
      body: 'invalid json',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await parseWebhookUpdate(request);
    expect(result).toBeNull();
  });
});

describe('Message Processing Logic', () => {
  describe('Private chats', () => {
    it('should process private chat messages', () => {
      const update: Update = {
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 123, type: 'private' },
          date: 1234567890,
          text: 'Hello, bot!',
        },
      };

      expect(shouldProcessMessage(update, mockEnv)).toBe(true);
    });
  });

  describe('Group chats - entity-based detection', () => {
    it('should process bot commands via entities', () => {
      const update: Update = {
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: -123, type: 'group' },
          date: 1234567890,
          text: '/start',
          entities: [
            { type: 'bot_command', offset: 0, length: 6 }
          ],
        },
      };

      expect(shouldProcessMessage(update, mockEnv)).toBe(true);
    });

    it('should process bot mentions via entities', () => {
      const update: Update = {
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: -123, type: 'group' },
          date: 1234567890,
          text: 'Hello @ZenFastBot!',
          entities: [
            { type: 'mention', offset: 6, length: 11 }
          ],
        },
      };

      expect(shouldProcessMessage(update, mockEnv)).toBe(true);
    });

    it('should ignore mentions of other bots via entities', () => {
      const update: Update = {
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: -123, type: 'group' },
          date: 1234567890,
          text: 'Hello @OtherBot!',
          entities: [
            { type: 'mention', offset: 6, length: 9 }
          ],
        },
      };

      expect(shouldProcessMessage(update, mockEnv)).toBe(false);
    });
  });

  describe('Group chats - reply detection', () => {
    it('should process replies to bot messages', () => {
      const update: Update = {
        update_id: 1,
        message: {
          message_id: 2,
          chat: { id: -123, type: 'group' },
          date: 1234567890,
          text: 'This is a reply',
          reply_to_message: {
            message_id: 1,
            chat: { id: -123, type: 'group' },
            date: 1234567880,
            text: 'Bot response',
            from: {
              id: 123456789,
              is_bot: true,
              first_name: 'ZenFast Bot'
            }
          }
        },
      };

      expect(shouldProcessMessage(update, mockEnv)).toBe(true);
    });

    it('should ignore replies to other bots', () => {
      const update: Update = {
        update_id: 1,
        message: {
          message_id: 2,
          chat: { id: -123, type: 'group' },
          date: 1234567890,
          text: 'This is a reply',
          reply_to_message: {
            message_id: 1,
            chat: { id: -123, type: 'group' },
            date: 1234567880,
            text: 'Other bot response',
            from: {
              id: 987654321,
              is_bot: true,
              first_name: 'Other Bot'
            }
          }
        },
      };

      expect(shouldProcessMessage(update, mockEnv)).toBe(false);
    });

    it('should ignore replies to users', () => {
      const update: Update = {
        update_id: 1,
        message: {
          message_id: 2,
          chat: { id: -123, type: 'group' },
          date: 1234567890,
          text: 'This is a reply',
          reply_to_message: {
            message_id: 1,
            chat: { id: -123, type: 'group' },
            date: 1234567880,
            text: 'User message',
            from: {
              id: 555666777,
              is_bot: false,
              first_name: 'John'
            }
          }
        },
      };

      expect(shouldProcessMessage(update, mockEnv)).toBe(false);
    });
  });

  describe('Group chats - text fallback', () => {
    it('should process bot mentions via text fallback', () => {
      const update: Update = {
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: -123, type: 'group' },
          date: 1234567890,
          text: 'Hello @ZenFastBot how are you?',
        },
      };

      expect(shouldProcessMessage(update, mockEnv)).toBe(true);
    });

    it('should ignore regular group messages', () => {
      const update: Update = {
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: -123, type: 'group' },
          date: 1234567890,
          text: 'Regular group message',
        },
      };

      expect(shouldProcessMessage(update, mockEnv)).toBe(false);
    });

    it('should ignore mentions of other bots via text', () => {
      const update: Update = {
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: -123, type: 'group' },
          date: 1234567890,
          text: 'Hello @SomeOtherBot!',
        },
      };

      expect(shouldProcessMessage(update, mockEnv)).toBe(false);
    });
  });

  describe('Supergroups', () => {
    it('should process bot commands in supergroups', () => {
      const update: Update = {
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: -1001234567890, type: 'supergroup' },
          date: 1234567890,
          text: '/help',
          entities: [
            { type: 'bot_command', offset: 0, length: 5 }
          ],
        },
      };

      expect(shouldProcessMessage(update, mockEnv)).toBe(true);
    });

    it('should process bot mentions in supergroups', () => {
      const update: Update = {
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: -1001234567890, type: 'supergroup' },
          date: 1234567890,
          text: '@ZenFastBot help me',
          entities: [
            { type: 'mention', offset: 0, length: 11 }
          ],
        },
      };

      expect(shouldProcessMessage(update, mockEnv)).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should ignore messages without text', () => {
      const update: Update = {
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 123, type: 'private' },
          date: 1234567890,
        },
      };

      expect(shouldProcessMessage(update, mockEnv)).toBe(false);
    });

    it('should handle multiple mentions correctly', () => {
      const update: Update = {
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: -123, type: 'group' },
          date: 1234567890,
          text: '@OtherBot @ZenFastBot hello',
          entities: [
            { type: 'mention', offset: 0, length: 9 },
            { type: 'mention', offset: 10, length: 11 }
          ],
        },
      };

      expect(shouldProcessMessage(update, mockEnv)).toBe(true);
    });

    it('should handle command@bot format via entities', () => {
      const update: Update = {
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: -123, type: 'group' },
          date: 1234567890,
          text: '/start@ZenFastBot',
          entities: [
            { type: 'bot_command', offset: 0, length: 16 }
          ],
        },
      };

      expect(shouldProcessMessage(update, mockEnv)).toBe(true);
    });
  });
});

describe('Data Extraction', () => {
  it('should extract chat ID correctly', () => {
    const update: Update = {
      update_id: 1,
      message: {
        message_id: 1,
        chat: { id: 123456, type: 'private' },
        date: 1234567890,
        text: 'Hello!',
      },
    };

    expect(extractChatId(update)).toBe(123456);
  });

  it('should extract message text correctly', () => {
    const update: Update = {
      update_id: 1,
      message: {
        message_id: 1,
        chat: { id: 123, type: 'private' },
        date: 1234567890,
        text: 'Test message',
      },
    };

    expect(extractMessageText(update)).toBe('Test message');
  });

  it('should return null for missing message', () => {
    const update: Update = {
      update_id: 1,
    };

    expect(extractChatId(update)).toBeNull();
    expect(extractMessageText(update)).toBeNull();
  });
});