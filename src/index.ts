import { Env } from './types';
import { validateWebhookSecret, parseWebhookUpdate, shouldProcessMessage, extractChatId, extractMessageText } from './webhook';
import { createTelegramApi } from './telegram';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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

    if (!shouldProcessMessage(update)) {
      return new Response('OK', { status: 200 });
    }

    const chatId = extractChatId(update);
    const messageText = extractMessageText(update);

    if (!chatId || !messageText) {
      return new Response('OK', { status: 200 });
    }

    const botToken = env.BOT_TOKEN;
    if (!botToken) {
      console.error('BOT_TOKEN environment variable is required');
      return new Response('OK', { status: 200 });
    }
    
    const telegramApi = createTelegramApi(botToken);
    const echoText = `You said: ${messageText}`;

    try {
      const result = await telegramApi.sendMessage({
        chat_id: chatId,
        text: echoText,
      });

      if (!result.ok) {
        console.error('Failed to send message:', result.description);
      }
    } catch (error) {
      console.error('Error sending echo message:', error);
    }

    // Always return 200 OK to Telegram (best practice)
    return new Response('OK', { status: 200 });
  },
};

// Export for local development and testing
export { validateWebhookSecret, parseWebhookUpdate, shouldProcessMessage } from './webhook';
export { createTelegramApi } from './telegram';