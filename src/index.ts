import { Env } from './types';
import { validateWebhookSecret, parseWebhookUpdate, shouldProcessMessage, extractChatId, extractMessageText, extractUser, extractMessageId } from './webhook';
import { createTelegramApi } from './telegram';
import { isAuthenticated, authenticateChat, isApiKeyPattern } from './auth';
import { extractCommand, routeCommand } from './commands';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle health check endpoint
    if (request.method === 'GET' && request.url.endsWith('/health')) {
      const startTime = Date.now();
      
      // Check KV namespace connectivity
      const kvChecks = {
        API_KEYS: false,
        CHATS: false,
        RATE_LIMITS: false
      };
      
      try {
        // Test each KV namespace with a simple list operation
        await env.API_KEYS.list({ limit: 1 });
        kvChecks.API_KEYS = true;
      } catch (e) {
        console.error('API_KEYS KV check failed:', e);
      }
      
      try {
        await env.CHATS.list({ limit: 1 });
        kvChecks.CHATS = true;
      } catch (e) {
        console.error('CHATS KV check failed:', e);
      }
      
      try {
        await env.RATE_LIMITS.list({ limit: 1 });
        kvChecks.RATE_LIMITS = true;
      } catch (e) {
        console.error('RATE_LIMITS KV check failed:', e);
      }
      
      const allKvHealthy = Object.values(kvChecks).every(check => check);
      
      const healthResponse = {
        status: allKvHealthy ? 'healthy' : 'degraded',
        version: '0.0.1',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        checks: {
          kv: kvChecks,
          bot_token: !!env.BOT_TOKEN,
          webhook_secret: !!env.WEBHOOK_SECRET,
          bot_username: env.BOT_USERNAME || 'not_configured'
        }
      };
      
      return new Response(JSON.stringify(healthResponse, null, 2), {
        status: allKvHealthy ? 200 : 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }
    
    if (request.method !== 'POST' || !request.url.endsWith('/webhook')) {
      return new Response('Not Found', { status: 404 });
    }

    if (!validateWebhookSecret(request, env)) {
      return new Response('Unauthorized', { status: 401 });
    }

    const update = await parseWebhookUpdate(request);
    if (!update) {
      return new Response('Bad Request', { status: 400 });
    }

    if (!shouldProcessMessage(update, env)) {
      return new Response('OK', { status: 200 });
    }

    const chatId = extractChatId(update);
    const messageText = extractMessageText(update);
    const user = extractUser(update);
    const messageId = extractMessageId(update);

    if (!chatId || !messageText || !user || !messageId) {
      return new Response('OK', { status: 200 });
    }

    const botToken = env.BOT_TOKEN;
    if (!botToken) {
      console.error('BOT_TOKEN environment variable is required');
      return new Response('OK', { status: 200 });
    }
    
    const telegramApi = createTelegramApi(botToken);

    try {
      // Check if this is a command
      const command = extractCommand(messageText);
      
      if (command) {
        // Handle command
        const commandResult = await routeCommand(command, chatId, user, messageId, env);
        if (commandResult) {
          const sendParams: any = {
            chat_id: chatId,
            text: commandResult.text,
          };
          if (commandResult.replyToMessageId) {
            sendParams.reply_to_message_id = commandResult.replyToMessageId;
          }
          const result = await telegramApi.sendMessage(sendParams);

          if (!result.ok) {
            console.error('Failed to send command response:', result.description);
          }
        }
        return new Response('OK', { status: 200 });
      }

      // Check authentication status
      const authenticated = await isAuthenticated(chatId, env);
      
      if (!authenticated) {
        // Check if this message looks like an API key attempt
        if (isApiKeyPattern(messageText)) {
          const authResult = await authenticateChat(chatId, messageText, user, env);
          const result = await telegramApi.sendMessage({
            chat_id: chatId,
            text: authResult.message,
            reply_to_message_id: messageId,
          });

          if (!result.ok) {
            console.error('Failed to send auth response:', result.description);
          }
        } else {
          // Prompt for authentication
          const result = await telegramApi.sendMessage({
            chat_id: chatId,
            text: "Please authenticate by sending your API key, or use /start for help.",
            reply_to_message_id: messageId,
          });

          if (!result.ok) {
            console.error('Failed to send auth prompt:', result.description);
          }
        }
        return new Response('OK', { status: 200 });
      }

      // User is authenticated - echo the message
      const echoText = `You said: ${messageText}`;
      const result = await telegramApi.sendMessage({
        chat_id: chatId,
        text: echoText,
        reply_to_message_id: messageId,
      });

      if (!result.ok) {
        console.error('Failed to send echo message:', result.description);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }

    // Always return 200 OK to Telegram (best practice)
    return new Response('OK', { status: 200 });
  },
};

// Export for local development and testing
export { validateWebhookSecret, parseWebhookUpdate, shouldProcessMessage, extractUser, extractMessageId } from './webhook';
export { createTelegramApi } from './telegram';
export { isAuthenticated, authenticateChat, isApiKeyPattern } from './auth';
export { extractCommand, routeCommand } from './commands';