import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '../src/index';
import { Env } from '../src/types';
import { MockKV } from './utils/mockKv';

describe('Authentication Integration Tests', () => {
  let mockFetch: any;
  let mockApiKeys: MockKV;
  let mockChats: MockKV;
  let mockRateLimits: MockKV;
  let mockEnv: Env;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    
    mockApiKeys = new MockKV();
    mockChats = new MockKV();
    mockRateLimits = new MockKV();
    
    mockEnv = {
      BOT_TOKEN: 'test-bot-token',
      WEBHOOK_SECRET: 'test-secret',
      API_KEYS: mockApiKeys as any,
      CHATS: mockChats as any,
      RATE_LIMITS: mockRateLimits as any,
    };
  });

  it('should handle /start command for unauthenticated chat', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ ok: true }),
    });

    const updateData = {
      update_id: 1,
      message: {
        message_id: 1,
        from: { id: 123, is_bot: false, first_name: 'Alice' },
        chat: { id: 123, type: 'private' },
        date: 1234567890,
        text: '/start',
      },
    };

    const request = new Request('https://example.com/webhook', {
      method: 'POST',
      headers: {
        'X-Telegram-Bot-Api-Secret-Token': 'test-secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    const response = await worker.fetch(request, mockEnv);

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-bot-token/sendMessage',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: 123,
          text: 'Welcome to ZenFast! 🚀\nPlease authenticate by sending your API key.',
          reply_to_message_id: 1,
        }),
      }
    );
  });

  it('should handle successful authentication flow', async () => {
    // Set up a valid API key
    const apiKey = 'apple-banana-cherry-dog-elephant';
    const keyHash = 'sha256:' + Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey)))
    ).map(b => b.toString(16).padStart(2, '0')).join('');
    
    await mockApiKeys.put(keyHash, JSON.stringify({
      name: 'Alice Key',
      expiry: new Date(Date.now() + 86400000).toISOString(),
      created: new Date().toISOString()
    }));

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ ok: true }),
    });

    const updateData = {
      update_id: 1,
      message: {
        message_id: 1,
        from: { id: 123, is_bot: false, first_name: 'Alice' },
        chat: { id: 123, type: 'private' },
        date: 1234567890,
        text: apiKey,
      },
    };

    const request = new Request('https://example.com/webhook', {
      method: 'POST',
      headers: {
        'X-Telegram-Bot-Api-Secret-Token': 'test-secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    const response = await worker.fetch(request, mockEnv);

    expect(response.status).toBe(200);
    
    // Check that authentication success message was sent
    const sentMessage = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentMessage.text).toContain('Authentication successful! ✅');
    expect(sentMessage.text).toContain('Alice Key');
    expect(sentMessage.reply_to_message_id).toBe(1);
    expect(sentMessage.chat_id).toBe(123);
  });

  it('should handle /start for authenticated chat', async () => {
    // Set up authentication
    const apiKey = 'apple-banana-cherry-dog-elephant';
    const keyHash = 'sha256:' + Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey)))
    ).map(b => b.toString(16).padStart(2, '0')).join('');
    
    await mockApiKeys.put(keyHash, JSON.stringify({
      name: 'Alice Key',
      expiry: new Date(Date.now() + 86400000).toISOString(),
      created: new Date().toISOString()
    }));

    await mockChats.put('123', JSON.stringify({
      api_key_hash: keyHash,
      authenticated_at: new Date().toISOString(),
      authenticated_by: {
        id: 123,
        is_bot: false,
        first_name: 'Alice'
      }
    }));

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ ok: true }),
    });

    const updateData = {
      update_id: 1,
      message: {
        message_id: 1,
        from: { id: 123, is_bot: false, first_name: 'Alice' },
        chat: { id: 123, type: 'private' },
        date: 1234567890,
        text: '/start',
      },
    };

    const request = new Request('https://example.com/webhook', {
      method: 'POST',
      headers: {
        'X-Telegram-Bot-Api-Secret-Token': 'test-secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    const response = await worker.fetch(request, mockEnv);

    expect(response.status).toBe(200);
    
    const sentMessage = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentMessage.text).toContain('Welcome back! ✅');
    expect(sentMessage.text).toContain('Alice Key');
  });

  it('should echo messages for authenticated users', async () => {
    // Set up authentication
    const apiKey = 'apple-banana-cherry-dog-elephant';
    const keyHash = 'sha256:' + Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey)))
    ).map(b => b.toString(16).padStart(2, '0')).join('');
    
    await mockApiKeys.put(keyHash, JSON.stringify({
      name: 'Alice Key',
      expiry: new Date(Date.now() + 86400000).toISOString(),
      created: new Date().toISOString()
    }));

    await mockChats.put('123', JSON.stringify({
      api_key_hash: keyHash,
      authenticated_at: new Date().toISOString(),
      authenticated_by: {
        id: 123,
        is_bot: false,
        first_name: 'Alice'
      }
    }));

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ ok: true }),
    });

    const updateData = {
      update_id: 1,
      message: {
        message_id: 1,
        from: { id: 123, is_bot: false, first_name: 'Alice' },
        chat: { id: 123, type: 'private' },
        date: 1234567890,
        text: 'Hello there!',
      },
    };

    const request = new Request('https://example.com/webhook', {
      method: 'POST',
      headers: {
        'X-Telegram-Bot-Api-Secret-Token': 'test-secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    const response = await worker.fetch(request, mockEnv);

    expect(response.status).toBe(200);
    
    const sentMessage = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentMessage.text).toBe('You said: Hello there!');
    expect(sentMessage.reply_to_message_id).toBe(1);
    expect(sentMessage.chat_id).toBe(123);
  });

  it('should handle /status command', async () => {
    // Set up authentication
    const apiKey = 'apple-banana-cherry-dog-elephant';
    const keyHash = 'sha256:' + Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey)))
    ).map(b => b.toString(16).padStart(2, '0')).join('');
    
    await mockApiKeys.put(keyHash, JSON.stringify({
      name: 'Alice Key',
      expiry: new Date(Date.now() + 86400000).toISOString(),
      created: new Date().toISOString()
    }));

    await mockChats.put('123', JSON.stringify({
      api_key_hash: keyHash,
      authenticated_at: new Date().toISOString(),
      authenticated_by: {
        id: 123,
        is_bot: false,
        first_name: 'Alice'
      }
    }));

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ ok: true }),
    });

    const updateData = {
      update_id: 1,
      message: {
        message_id: 1,
        from: { id: 123, is_bot: false, first_name: 'Alice' },
        chat: { id: 123, type: 'private' },
        date: 1234567890,
        text: '/status',
      },
    };

    const request = new Request('https://example.com/webhook', {
      method: 'POST',
      headers: {
        'X-Telegram-Bot-Api-Secret-Token': 'test-secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    const response = await worker.fetch(request, mockEnv);

    expect(response.status).toBe(200);
    
    const sentMessage = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentMessage.text).toContain('Authentication Status: ✅ Authenticated');
    expect(sentMessage.text).toContain('Key Name: Alice Key');
    expect(sentMessage.text).toContain('Authenticated by: Alice');
  });
});