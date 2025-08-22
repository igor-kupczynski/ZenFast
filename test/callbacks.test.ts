import { describe, it, expect, vi, beforeEach } from 'vitest';

// We'll import worker dynamically inside tests to allow spies to be set up beforehand

// Mock fetch globally
const mockFetch = vi.fn();
(global as any).fetch = mockFetch;

// Mock console.error to reduce noise
vi.spyOn(console, 'error').mockImplementation(() => {});

// Spy on routeCallback to avoid deep dependencies and KV access
import * as callbacks from '../src/callbacks';

import type { Env } from '../src/types';

const mockEnv: Env = {
  BOT_TOKEN: 'test-bot-token',
  BOT_USERNAME: 'TestBot',
  WEBHOOK_SECRET: 'test-secret',
  API_KEYS: {} as KVNamespace,
  CHATS: {} as KVNamespace,
  RATE_LIMITS: {} as KVNamespace,
  FASTS: {} as KVNamespace,
};

describe('Inline keyboard callback handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('answers callback_query to stop the Telegram loading spinner', async () => {
    // Arrange: make routeCallback return a simple result
    vi.spyOn(callbacks, 'routeCallback').mockResolvedValue({
      text: 'Handled',
      showAlert: false,
    });

    const updateData = {
      update_id: 42,
      callback_query: {
        id: 'cbq-id-1',
        from: { id: 123, is_bot: false, first_name: 'Alice' },
        chat_instance: 'ci-1',
        data: 'start_fast',
        message: {
          message_id: 10,
          date: 1234567890,
          chat: { id: 123, type: 'private' },
          text: 'Tap to start fast',
        },
      },
    } as any;

    const request = new Request('https://example.com/webhook', {
      method: 'POST',
      headers: {
        'X-Telegram-Bot-Api-Secret-Token': 'test-secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    // Mock successful Telegram API response for answerCallbackQuery
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ ok: true }),
    });

    const worker = (await import('../src/index')).default;

    // Act
    const response = await worker.fetch(request, mockEnv);

    // Assert
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('OK');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-bot-token/answerCallbackQuery',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: 'cbq-id-1',
          show_alert: false,
          text: 'Handled',
        }),
      }
    );
  });
});
