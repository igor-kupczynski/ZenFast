import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelegramApi, createTelegramApi } from '../src/telegram';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('TelegramApi', () => {
  let api: TelegramApi;
  const botToken = 'test-bot-token';

  beforeEach(() => {
    api = new TelegramApi(botToken);
    vi.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      const mockResponse = {
        ok: true,
        result: {
          message_id: 1,
          chat: { id: 123, type: 'private' },
          date: 1234567890,
          text: 'Test message',
        },
      };

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse),
      });

      const result = await api.sendMessage({
        chat_id: 123,
        text: 'Test message',
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: 123,
            text: 'Test message',
          }),
        }
      );
    });

    it('should handle API errors', async () => {
      const mockResponse = {
        ok: false,
        description: 'Chat not found',
        error_code: 400,
      };

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse),
      });

      const result = await api.sendMessage({
        chat_id: 123,
        text: 'Test message',
      });

      expect(result).toEqual(mockResponse);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await api.sendMessage({
        chat_id: 123,
        text: 'Test message',
      });

      expect(result).toEqual({
        ok: false,
        description: 'Network error occurred',
      });
    });
  });

  describe('setWebhook', () => {
    it('should set webhook successfully', async () => {
      const mockResponse = {
        ok: true,
        result: true,
      };

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse),
      });

      const result = await api.setWebhook({
        url: 'https://example.com/webhook',
        secret_token: 'secret',
      });

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.telegram.org/bot${botToken}/setWebhook`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'https://example.com/webhook',
            secret_token: 'secret',
          }),
        }
      );
    });
  });

  describe('getWebhookInfo', () => {
    it('should get webhook info successfully', async () => {
      const mockResponse = {
        ok: true,
        result: {
          url: 'https://example.com/webhook',
          has_custom_certificate: false,
          pending_update_count: 0,
        },
      };

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse),
      });

      const result = await api.getWebhookInfo();

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.telegram.org/bot${botToken}/getWebhookInfo`
      );
    });
  });

  describe('createTelegramApi', () => {
    it('should create TelegramApi instance', () => {
      const api = createTelegramApi('test-token');
      expect(api).toBeInstanceOf(TelegramApi);
    });
  });
});