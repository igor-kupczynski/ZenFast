import { describe, it, expect, beforeEach } from 'vitest';
import { handleCancelCommand, handleFastCommand, routeCommand } from '../src/commands';
import { MockKV } from './utils/mockKv';
import type { Env, User } from '../src/types';

describe('Cancel Flow - Commands and Routing', () => {
  let env: Env;
  let user: User;
  let apiKeys: MockKV;
  let chats: MockKV;
  let rateLimits: MockKV;
  let fasts: MockKV;

  const chatId = 1111;
  const messageId = 999;

  beforeEach(() => {
    apiKeys = new MockKV();
    chats = new MockKV();
    rateLimits = new MockKV();
    fasts = new MockKV();

    env = {
      BOT_TOKEN: 't',
      BOT_USERNAME: 'TestBot',
      WEBHOOK_SECRET: 's',
      API_KEYS: apiKeys as any,
      CHATS: chats as any,
      RATE_LIMITS: rateLimits as any,
      FASTS: fasts as any,
    };

    user = { id: 42, is_bot: false, first_name: 'Tester', username: 'tester' };
  });

  it('requires authentication for /cancel', async () => {
    const res = await handleCancelCommand(chatId, user, messageId, env);
    expect(res.text).toContain('Please authenticate');
  });

  it('returns not fasting message when no current fast', async () => {
    // Mark chat as authenticated
    await chats.put(chatId.toString(), JSON.stringify({
      api_key_hash: 'sha256:abc',
      authenticated_at: new Date().toISOString(),
      authenticated_by: user,
    }));
    await apiKeys.put('sha256:abc', JSON.stringify({ name: 'Key', expiry: new Date(Date.now()+86400000).toISOString(), created: new Date().toISOString() }));

    const res = await handleCancelCommand(chatId, user, messageId, env);
    expect(res.text).toContain("You're not currently fasting");
    expect(res.replyMarkup).toBeDefined();
  });

  it('when fasting, /cancel asks for confirmation with yes/no buttons', async () => {
    // Authenticate chat
    await chats.put(chatId.toString(), JSON.stringify({
      api_key_hash: 'sha256:abc',
      authenticated_at: new Date().toISOString(),
      authenticated_by: user,
    }));
    await apiKeys.put('sha256:abc', JSON.stringify({ name: 'Key', expiry: new Date(Date.now()+86400000).toISOString(), created: new Date().toISOString() }));

    // Start a fast using /fast
    const started = await handleFastCommand(chatId, user, messageId, env, '/fast');
    expect(started.text).toContain('Fast started at');

    const res = await handleCancelCommand(chatId, user, messageId, env);
    expect(res.text).toContain('Cancel current fast?');
    const kb = res.replyMarkup?.inline_keyboard;
    expect(kb?.[0]?.[0]?.text).toBe('✅ Yes, cancel');
    expect(kb?.[0]?.[0]?.callback_data).toBe('cancel_fast_yes');
    expect(kb?.[0]?.[1]?.text).toBe('↩️ No, keep fasting');
    expect(kb?.[0]?.[1]?.callback_data).toBe('cancel_fast_no');
  });

  it('handleFastCommand when already fasting shows Cancel button', async () => {
    // Authenticate chat
    await chats.put(chatId.toString(), JSON.stringify({
      api_key_hash: 'sha256:abc',
      authenticated_at: new Date().toISOString(),
      authenticated_by: user,
    }));
    await apiKeys.put('sha256:abc', JSON.stringify({ name: 'Key', expiry: new Date(Date.now()+86400000).toISOString(), created: new Date().toISOString() }));

    // Start a fast
    await handleFastCommand(chatId, user, messageId, env, '/fast');
    // Invoke again
    const res = await handleFastCommand(chatId, user, messageId, env, '/fast');
    const kb = res.replyMarkup?.inline_keyboard;
    expect(kb?.[0]?.[0]?.text).toBe('🛑 End Fast');
    expect(kb?.[0]?.[1]?.text).toBe('🗑️ Cancel Fast');
  });

  it('routeCommand supports /cancel and /c', async () => {
    // Authenticate chat and start a fast
    await chats.put(chatId.toString(), JSON.stringify({
      api_key_hash: 'sha256:abc',
      authenticated_at: new Date().toISOString(),
      authenticated_by: user,
    }));
    await apiKeys.put('sha256:abc', JSON.stringify({ name: 'Key', expiry: new Date(Date.now()+86400000).toISOString(), created: new Date().toISOString() }));
    await handleFastCommand(chatId, user, messageId, env, '/fast');

    const res1 = await routeCommand('cancel', chatId, user, messageId, '/cancel', env);
    expect(res1).toBeTruthy();
    expect(res1!.text).toContain('Cancel current fast?');
  });
});
