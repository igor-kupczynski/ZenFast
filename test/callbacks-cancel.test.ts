import { describe, it, expect, beforeEach } from 'vitest';
import { routeCallback } from '../src/callbacks';
import { startFast } from '../src/fasting';
import type { Env, CallbackQuery, User } from '../src/types';
import { MockKV } from './utils/mockKv';

describe('Cancel Flow - Callback handlers', () => {
  let env: Env;
  let apiKeys: MockKV;
  let chats: MockKV;
  let rateLimits: MockKV;
  let fasts: MockKV;
  const chatId = 7777;
  const messageId = 123;
  const user: User = { id: 101, is_bot: false, first_name: 'Alice', username: 'alice' };

  beforeEach(() => {
    apiKeys = new MockKV();
    chats = new MockKV();
    rateLimits = new MockKV();
    fasts = new MockKV();

    env = {
      BOT_TOKEN: 'tkn',
      BOT_USERNAME: 'TestBot',
      WEBHOOK_SECRET: 'whs',
      API_KEYS: apiKeys as any,
      CHATS: chats as any,
      RATE_LIMITS: rateLimits as any,
      FASTS: fasts as any,
    };
  });

  async function authenticateChat() {
    await chats.put(chatId.toString(), JSON.stringify({
      api_key_hash: 'sha256:key',
      authenticated_at: new Date().toISOString(),
      authenticated_by: user,
    }));
    await apiKeys.put('sha256:key', JSON.stringify({ name: 'Key', expiry: new Date(Date.now()+86400000).toISOString(), created: new Date().toISOString() }));
  }

  function makeCallback(data: string): CallbackQuery {
    return {
      id: 'cbq-1',
      from: user,
      chat_instance: 'ci-1',
      data,
      message: {
        message_id: messageId,
        date: Math.floor(Date.now()/1000),
        chat: { id: chatId, type: 'private' },
        text: 'msg',
      },
    } as any;
  }

  it('cancel_fast prompts for confirmation with yes/no buttons', async () => {
    await authenticateChat();
    await startFast(user.id, user, env);

    const res = await routeCallback(makeCallback('cancel_fast'), env);
    expect(res.editMessage).toBeDefined();
    expect(res.editMessage?.newText).toContain('Cancel current fast?');
    const kb = res.editMessage?.newKeyboard?.inline_keyboard;
    expect(kb?.[0]?.[0]?.text).toBe('✅ Yes, cancel');
    expect(kb?.[0]?.[0]?.callback_data).toBe('cancel_fast_yes');
    expect(kb?.[0]?.[1]?.text).toBe('↩️ No, keep fasting');
    expect(kb?.[0]?.[1]?.callback_data).toBe('cancel_fast_no');
  });

  it('cancel_fast_yes cancels the fast and shows Start Fast button', async () => {
    await authenticateChat();
    await startFast(user.id, user, env);

    const res = await routeCallback(makeCallback('cancel_fast_yes'), env);
    expect(res.editMessage).toBeDefined();
    expect(res.editMessage?.newText).toContain('Fast canceled');
    const kb = res.editMessage?.newKeyboard?.inline_keyboard;
    expect(kb?.[0]?.[0]?.text).toBe('🚀 Start Fast');
  });

  it('cancel_fast_no aborts and keeps End/Cancel buttons', async () => {
    await authenticateChat();
    await startFast(user.id, user, env);

    const res = await routeCallback(makeCallback('cancel_fast_no'), env);
    expect(res.editMessage).toBeDefined();
    expect(res.editMessage?.newText).toContain('Cancellation aborted');
    const kb = res.editMessage?.newKeyboard?.inline_keyboard;
    expect(kb?.[0]?.[0]?.text).toBe('🛑 End Fast');
    expect(kb?.[0]?.[1]?.text).toBe('🗑️ Cancel Fast');
  });
});
