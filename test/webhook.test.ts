import { describe, it, expect } from 'vitest';
import { validateWebhookSecret, parseWebhookUpdate, shouldProcessMessage, extractChatId, extractMessageText } from '../src/webhook.ts';
import { Env, Update } from '../src/types.ts';

// Mock environment
const mockEnv: Env = {
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

    expect(shouldProcessMessage(update)).toBe(true);
  });

  it('should process bot commands in groups', () => {
    const update: Update = {
      update_id: 1,
      message: {
        message_id: 1,
        chat: { id: -123, type: 'group' },
        date: 1234567890,
        text: '/start',
      },
    };

    expect(shouldProcessMessage(update)).toBe(true);
  });

  it('should process bot mentions in groups', () => {
    const update: Update = {
      update_id: 1,
      message: {
        message_id: 1,
        chat: { id: -123, type: 'group' },
        date: 1234567890,
        text: 'Hello @zenfast_bot!',
      },
    };

    expect(shouldProcessMessage(update)).toBe(true);
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

    expect(shouldProcessMessage(update)).toBe(false);
  });

  it('should ignore messages without text', () => {
    const update: Update = {
      update_id: 1,
      message: {
        message_id: 1,
        chat: { id: 123, type: 'private' },
        date: 1234567890,
      },
    };

    expect(shouldProcessMessage(update)).toBe(false);
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