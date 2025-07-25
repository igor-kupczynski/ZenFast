import { Update, Env } from './types';

export function validateWebhookSecret(request: Request, env: Env): boolean {
  const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  return secret === env.WEBHOOK_SECRET;
}

export async function parseWebhookUpdate(request: Request): Promise<Update | null> {
  try {
    const body = await request.json() as Update;
    return body;
  } catch (error) {
    console.error('Failed to parse webhook update:', error);
    return null;
  }
}

export function shouldProcessMessage(update: Update): boolean {
  if (!update.message?.text) {
    return false;
  }

  const chat = update.message.chat;
  
  // Process all messages in private chats
  if (chat.type === 'private') {
    return true;
  }

  // For groups/channels, only process:
  // 1. Messages that mention the bot (@zenfast_bot)
  // 2. Commands starting with /
  // 3. Replies to bot messages (not implemented in basic version)
  if (chat.type === 'group' || chat.type === 'supergroup' || chat.type === 'channel') {
    const text = update.message.text;
    
    // Check for bot commands
    if (text.startsWith('/')) {
      return true;
    }
    
    // Check for bot mentions (simplified - would need bot username)
    if (text.includes('@zenfast_bot')) {
      return true;
    }
    
    return false;
  }

  return false;
}

export function extractChatId(update: Update): number | null {
  return update.message?.chat.id ?? null;
}

export function extractMessageText(update: Update): string | null {
  return update.message?.text ?? null;
}