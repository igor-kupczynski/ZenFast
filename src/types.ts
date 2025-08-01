// Storage Types
export interface ApiKeyData {
  name: string;
  expiry: string; // ISO 8601
  created: string; // ISO 8601
}

export interface ChatAuthData {
  api_key_hash: string;
  authenticated_at: string; // ISO 8601
  authenticated_by: User;
}

export interface RateLimitData {
  failed_attempts: number;
  first_attempt_at: string; // ISO 8601
  last_attempt_at: string; // ISO 8601
  locked_until?: string; // ISO 8601
}

// Telegram Types (subset used)
export interface Update {
  update_id: number;
  message?: Message;
  edited_message?: Message;
}

export interface Message {
  message_id: number;
  from?: User;
  chat: Chat;
  date: number;
  text?: string;
  entities?: MessageEntity[];
  reply_to_message?: Message;
}

export interface User {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

export interface Chat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
}

export interface MessageEntity {
  type: 'mention' | 'bot_command' | 'text_mention' | string;
  offset: number;
  length: number;
}

// Worker Environment
export interface Env {
  BOT_TOKEN: string;
  BOT_USERNAME: string;
  WEBHOOK_SECRET: string;
  API_KEYS: KVNamespace;
  CHATS: KVNamespace;
  RATE_LIMITS: KVNamespace;
}