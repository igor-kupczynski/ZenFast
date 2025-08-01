import {Env, Update} from './types';

export function validateWebhookSecret(request: Request, env: Env): boolean {
  const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
  return secret === env.WEBHOOK_SECRET;
}

export async function parseWebhookUpdate(request: Request): Promise<Update | null> {
  try {
    return await request.json() as Update;
  } catch (error) {
    console.error('Failed to parse webhook update:', error);
    return null;
  }
}

export function shouldProcessMessage(update: Update, env: Env): boolean {
  const message = update.message;
  const text = message?.text;
  
  if (!message || !text) return false;
  
  const chat = message.chat;
  
  // Private chats: always process
  if (chat.type === 'private') return true;
  
  // Groups/supergroups: check for triggers
  if (chat.type === 'group' || chat.type === 'supergroup') {
    const botUsername = env.BOT_USERNAME;
    
    // 1. Check for bot commands via entities
    if (message.entities) {
      for (const entity of message.entities) {
        if (entity.type === 'bot_command') {
          return true;
        }
        
        // Check for @mentions
        if (entity.type === 'mention') {
          const mention = text.substring(entity.offset, entity.offset + entity.length);
          if (mention === `@${botUsername}`) {
            return true;
          }
        }
      }
    }
    
    // 2. Check for replies to bot
    if (message.reply_to_message?.from?.is_bot) {
      // Extract bot ID from token and compare
      const botId = env.BOT_TOKEN.split(':')[0];
      if (message.reply_to_message.from.id.toString() === botId) {
        return true;
      }
    }
    
    // 3. Fallback: simple text check for mentions without entities
    return text.includes(`@${botUsername}`);
  }
  
  return false;
}

export function extractChatId(update: Update): number | null {
  return update.message?.chat.id ?? null;
}

export function extractMessageText(update: Update): string | null {
  return update.message?.text ?? null;
}

export function extractUser(update: Update): import('./types').User | null {
  return update.message?.from ?? null;
}

export function extractMessageId(update: Update): number | null {
  return update.message?.message_id ?? null;
}