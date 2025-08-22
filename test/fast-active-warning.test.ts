import { describe, it, expect, beforeEach } from 'vitest';
import { routeCommand } from '../src';
import { Env, User, ApiKeyData, ChatAuthData } from '../src/types';
import { MockKV } from './utils/mockKv';

describe('Active fast warning on /fast', () => {
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
      id: 987654321,
      is_bot: false,
      first_name: 'Bob',
      username: 'bob'
    };
  });

  async function authenticate(chatId: number) {
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
  }

  it('should advise to end current fast when /fast is used during an active fast', async () => {
    const chatId = 424242;
    const messageId = 1;
    await authenticate(chatId);

    // Start a fast first
    const first = await routeCommand('fast', chatId, testUser, messageId, '/fast', env);
    expect(first).toBeTruthy();
    expect(first!.text).toContain('Fast started at');

    // Attempt to start again
    const second = await routeCommand('fast', chatId, testUser, messageId + 1, '/fast', env);
    expect(second).toBeTruthy();
    expect(second!.text).toContain("You've been fasting for");
    expect(second!.text).toContain('Please end your current fast');
  });
});
