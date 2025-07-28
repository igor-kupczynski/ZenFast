import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../src/index.ts';
import { Env } from '../src/types.ts';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock console.error to avoid noise in tests
vi.spyOn(console, 'error').mockImplementation(() => {});

const mockEnv: Env = {
  BOT_TOKEN: 'test-bot-token',
  WEBHOOK_SECRET: 'test-secret',
  API_KEYS: {} as KVNamespace,
  CHATS: {} as KVNamespace,
  RATE_LIMITS: {} as KVNamespace,
};

describe('Worker Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 404 for non-webhook endpoints', async () => {
    const request = new Request('https://example.com/');
    const response = await worker.fetch(request, mockEnv);

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Not Found');
  });

  it('should return 404 for non-POST requests', async () => {
    const request = new Request('https://example.com/webhook', {
      method: 'GET',
    });
    const response = await worker.fetch(request, mockEnv);

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Not Found');
  });

  it('should return 401 for invalid webhook secret', async () => {
    const request = new Request('https://example.com/webhook', {
      method: 'POST',
      headers: {
        'X-Telegram-Bot-Api-Secret-Token': 'wrong-secret',
      },
    });
    const response = await worker.fetch(request, mockEnv);

    expect(response.status).toBe(401);
    expect(await response.text()).toBe('Unauthorized');
  });

  it('should return 400 for invalid JSON', async () => {
    const request = new Request('https://example.com/webhook', {
      method: 'POST',
      headers: {
        'X-Telegram-Bot-Api-Secret-Token': 'test-secret',
        'Content-Type': 'application/json',
      },
      body: 'invalid json',
    });
    const response = await worker.fetch(request, mockEnv);

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('Bad Request');
  });

  it('should ignore messages that should not be processed', async () => {
    const updateData = {
      update_id: 1,
      message: {
        message_id: 1,
        chat: { id: -123, type: 'group' },
        date: 1234567890,
        text: 'Regular group message',
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
    expect(await response.text()).toBe('OK');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should prompt for authentication on unauthenticated message', async () => {
    // Mock successful Telegram API response
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ ok: true }),
    });

    const updateData = {
      update_id: 1,
      message: {
        message_id: 1,
        from: { id: 123, is_bot: false, first_name: 'Test' },
        chat: { id: 123, type: 'private' },
        date: 1234567890,
        text: 'Hello bot!',
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
    expect(await response.text()).toBe('OK');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-bot-token/sendMessage',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: 123,
          text: 'Please authenticate by sending your API key, or use /start for help.',
          reply_to_message_id: 1,
        }),
      }
    );
  });

  it('should handle Telegram API errors gracefully', async () => {
    // Mock failed Telegram API response
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ 
        ok: false, 
        description: 'Chat not found' 
      }),
    });

    const updateData = {
      update_id: 1,
      message: {
        message_id: 1,
        from: { id: 123, is_bot: false, first_name: 'Test' },
        chat: { id: 123, type: 'private' },
        date: 1234567890,
        text: 'Hello bot!',
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
    expect(await response.text()).toBe('OK');
    expect(console.error).toHaveBeenCalledWith(
      'Failed to send auth prompt:',
      'Chat not found'
    );
  });

  it('should handle network errors gracefully', async () => {
    // Mock network failure
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));

    const updateData = {
      update_id: 1,
      message: {
        message_id: 1,
        from: { id: 123, is_bot: false, first_name: 'Test' },
        chat: { id: 123, type: 'private' },
        date: 1234567890,
        text: 'Hello bot!',
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
    expect(await response.text()).toBe('OK');
    expect(console.error).toHaveBeenCalledWith(
      'Failed to send auth prompt:',
      'Network error occurred'
    );
  });

  it('should handle missing BOT_TOKEN gracefully', async () => {
    const envWithoutToken: Env = {
      ...mockEnv,
      BOT_TOKEN: '',
    };

    const updateData = {
      update_id: 1,
      message: {
        message_id: 1,
        from: { id: 123, is_bot: false, first_name: 'Test' },
        chat: { id: 123, type: 'private' },
        date: 1234567890,
        text: 'Hello bot!',
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

    const response = await worker.fetch(request, envWithoutToken);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('OK');
    expect(console.error).toHaveBeenCalledWith('BOT_TOKEN environment variable is required');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should ignore messages without text or chat ID', async () => {
    const updateData = {
      update_id: 1,
      message: {
        message_id: 1,
        chat: { id: 123, type: 'private' },
        date: 1234567890,
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
    expect(await response.text()).toBe('OK');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});