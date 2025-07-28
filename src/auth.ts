import { Env, ChatAuthData, ApiKeyData, RateLimitData, User } from './types';
import { hashApiKey } from './crypto';

export interface AuthResult {
  success: boolean;
  message: string;
  keyName?: string;
  expiry?: string;
}

export interface AuthDetails {
  keyName: string;
  expiry: string;
  authenticatedBy: User;
  authenticatedAt: string;
}

export async function isAuthenticated(chatId: number, env: Env): Promise<boolean> {
  try {
    const chatAuth = await env.CHATS.get(chatId.toString());
    if (!chatAuth) {
      return false;
    }

    const authData: ChatAuthData = JSON.parse(chatAuth);
    
    // Check if the API key still exists and hasn't expired
    const apiKeyData = await env.API_KEYS.get(authData.api_key_hash);
    if (!apiKeyData) {
      // API key was deleted, remove the chat association
      await env.CHATS.delete(chatId.toString());
      return false;
    }

    const keyData: ApiKeyData = JSON.parse(apiKeyData);
    const now = new Date();
    const expiry = new Date(keyData.expiry);
    
    if (now > expiry) {
      // Key has expired, remove the chat association
      await env.CHATS.delete(chatId.toString());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking authentication:', error);
    return false;
  }
}

export async function authenticateChat(
  chatId: number,
  apiKey: string,
  user: User,
  env: Env
): Promise<AuthResult> {
  const chatIdStr = chatId.toString();

  try {
    // Check rate limits first
    const rateLimitCheck = await checkRateLimit(chatId, env);
    if (!rateLimitCheck.allowed) {
      return {
        success: false,
        message: rateLimitCheck.message
      };
    }

    // Hash the provided API key
    const keyHash = await hashApiKey(apiKey);
    
    // Check if the hashed key exists in API_KEYS
    const apiKeyData = await env.API_KEYS.get(keyHash);
    if (!apiKeyData) {
      await recordFailedAttempt(chatId, env);
      return {
        success: false,
        message: "Invalid API key. Please check and try again."
      };
    }

    const keyData: ApiKeyData = JSON.parse(apiKeyData);
    
    // Check if key has expired
    const now = new Date();
    const expiry = new Date(keyData.expiry);
    
    if (now > expiry) {
      await recordFailedAttempt(chatId, env);
      return {
        success: false,
        message: "Your API key has expired. Please contact the bot owner for a new key."
      };
    }

    // Authentication successful - store chat association
    const chatAuth: ChatAuthData = {
      api_key_hash: keyHash,
      authenticated_at: now.toISOString(),
      authenticated_by: user
    };

    await env.CHATS.put(chatIdStr, JSON.stringify(chatAuth));
    
    // Clear any rate limit entries for this chat
    await env.RATE_LIMITS.delete(chatIdStr);

    return {
      success: true,
      message: `Authentication successful! ✅\nAuthenticated as: ${keyData.name}\nExpires: ${formatDate(expiry)}`,
      keyName: keyData.name,
      expiry: keyData.expiry
    };

  } catch (error) {
    console.error('Error during authentication:', error);
    return {
      success: false,
      message: "Service temporarily unavailable. Please try again."
    };
  }
}

export async function getAuthDetails(chatId: number, env: Env): Promise<AuthDetails | null> {
  try {
    const chatAuth = await env.CHATS.get(chatId.toString());
    if (!chatAuth) {
      return null;
    }

    const authData: ChatAuthData = JSON.parse(chatAuth);
    
    // Get API key details
    const apiKeyData = await env.API_KEYS.get(authData.api_key_hash);
    if (!apiKeyData) {
      // Key was deleted, clean up chat association
      await env.CHATS.delete(chatId.toString());
      return null;
    }

    const keyData: ApiKeyData = JSON.parse(apiKeyData);
    
    // Check if key has expired
    const now = new Date();
    const expiry = new Date(keyData.expiry);
    
    if (now > expiry) {
      // Key has expired, clean up chat association
      await env.CHATS.delete(chatId.toString());
      return null;
    }

    return {
      keyName: keyData.name,
      expiry: keyData.expiry,
      authenticatedBy: authData.authenticated_by,
      authenticatedAt: authData.authenticated_at
    };

  } catch (error) {
    console.error('Error getting auth details:', error);
    return null;
  }
}

interface RateLimitCheck {
  allowed: boolean;
  message: string;
}

async function checkRateLimit(chatId: number, env: Env): Promise<RateLimitCheck> {
  try {
    const rateLimitData = await env.RATE_LIMITS.get(chatId.toString());
    if (!rateLimitData) {
      return { allowed: true, message: "" };
    }

    const limitData: RateLimitData = JSON.parse(rateLimitData);
    
    if (limitData.locked_until) {
      const now = new Date();
      const lockedUntil = new Date(limitData.locked_until);
      
      if (now < lockedUntil) {
        return {
          allowed: false,
          message: `Too many failed attempts. Please try again after ${formatDateTime(lockedUntil)}.`
        };
      }
    }
    
    return { allowed: true, message: "" };
  } catch (error) {
    console.error('Error checking rate limit:', error);
    return { allowed: true, message: "" };
  }
}

async function recordFailedAttempt(chatId: number, env: Env): Promise<void> {
  try {
    const chatIdStr = chatId.toString();
    const now = new Date();
    
    const existingData = await env.RATE_LIMITS.get(chatIdStr);
    let limitData: RateLimitData;
    
    if (existingData) {
      limitData = JSON.parse(existingData);
      limitData.failed_attempts += 1;
      limitData.last_attempt_at = now.toISOString();
    } else {
      limitData = {
        failed_attempts: 1,
        first_attempt_at: now.toISOString(),
        last_attempt_at: now.toISOString()
      };
    }

    // Set lockout periods based on attempt count
    let ttlSeconds: number;
    if (limitData.failed_attempts >= 10) {
      // 24 hour lockout after 10 attempts
      const lockoutUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      limitData.locked_until = lockoutUntil.toISOString();
      ttlSeconds = 25 * 60 * 60; // 25 hours TTL for cleanup
    } else if (limitData.failed_attempts >= 5) {
      // 1 hour lockout after 5 attempts
      const lockoutUntil = new Date(now.getTime() + 60 * 60 * 1000);
      limitData.locked_until = lockoutUntil.toISOString();
      ttlSeconds = 2 * 60 * 60; // 2 hours TTL for cleanup
    } else if (limitData.failed_attempts >= 3) {
      // 15 minute lockout after 3 attempts
      const lockoutUntil = new Date(now.getTime() + 15 * 60 * 1000);
      limitData.locked_until = lockoutUntil.toISOString();
      ttlSeconds = 60 * 60; // 1 hour TTL for cleanup
    } else {
      // No lockout yet, but track attempts
      ttlSeconds = 24 * 60 * 60; // 24 hours TTL for cleanup
    }

    await env.RATE_LIMITS.put(chatIdStr, JSON.stringify(limitData), {
      expirationTtl: ttlSeconds
    });

  } catch (error) {
    console.error('Error recording failed attempt:', error);
  }
}

function formatDate(date: Date): string {
  const datePart = date.toISOString().split('T')[0];
  if (datePart) {
    return datePart;
  }
  return '';
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  }) || date.toISOString();
}

export function isApiKeyPattern(text: string): boolean {
  // Match 5 words separated by hyphens (lowercase letters only)
  const apiKeyPattern = /^[a-z]+-[a-z]+-[a-z]+-[a-z]+-[a-z]+$/;
  return apiKeyPattern.test(text.trim());
}