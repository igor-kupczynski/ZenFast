import { Env, User } from './types';
import { getAuthDetails } from './auth';

export interface CommandResult {
  text: string;
  replyToMessageId?: number;
}

export async function handleStartCommand(
  chatId: number,
  _user: User,
  messageId: number,
  env: Env
): Promise<CommandResult> {
  const authDetails = await getAuthDetails(chatId, env);
  
  if (authDetails) {
    // Chat is already authenticated
    const expiry = new Date(authDetails.expiry);
    return {
      text: `Welcome back! ✅\nAuthenticated as: ${authDetails.keyName}\nExpires: ${formatDate(expiry)}`,
      replyToMessageId: messageId
    };
  } else {
    // Chat is not authenticated
    return {
      text: "Welcome to ZenFast! 🚀\nPlease authenticate by sending your API key.",
      replyToMessageId: messageId
    };
  }
}

export async function handleStatusCommand(
  chatId: number,
  _user: User,
  messageId: number,
  env: Env
): Promise<CommandResult> {
  const authDetails = await getAuthDetails(chatId, env);
  
  if (authDetails) {
    const expiry = new Date(authDetails.expiry);
    const authenticatedAt = new Date(authDetails.authenticatedAt);
    
    return {
      text: `Authentication Status: ✅ Authenticated\n\n` +
            `Key Name: ${authDetails.keyName}\n` +
            `Expires: ${formatDate(expiry)}\n` +
            `Authenticated by: ${authDetails.authenticatedBy.first_name}\n` +
            `Authenticated on: ${formatDate(authenticatedAt)}`,
      replyToMessageId: messageId
    };
  } else {
    return {
      text: "Authentication Status: ❌ Not authenticated\n\nPlease use /start to begin authentication.",
      replyToMessageId: messageId
    };
  }
}

export function extractCommand(text: string): string | null {
  if (!text.startsWith('/')) {
    return null;
  }
  
  // Extract command name (everything between / and first space or end of string)
  const match = text.match(/^\/([a-zA-Z0-9_]+)/);
  return match?.[1]?.toLowerCase() || null;
}

export async function routeCommand(
  command: string,
  chatId: number,
  user: User,
  messageId: number,
  env: Env
): Promise<CommandResult | null> {
  switch (command) {
    case 'start':
      return await handleStartCommand(chatId, user, messageId, env);
    case 'status':
      return await handleStatusCommand(chatId, user, messageId, env);
    default:
      // Unknown command - ignore silently
      return null;
  }
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] || '';
}