export interface SendMessageParams {
  chat_id: number;
  text: string;
  reply_to_message_id?: number;
  parse_mode?: 'Markdown' | 'MarkdownV2' | 'HTML';
}

export interface SetWebhookParams {
  url: string;
  secret_token: string;
}

export interface TelegramApiResponse<T = any> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

export class TelegramApi {
  private readonly baseUrl: string;

  constructor(botToken: string) {
    this.baseUrl = `https://api.telegram.org/bot${botToken}`;
  }

  async sendMessage(params: SendMessageParams): Promise<TelegramApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      const result = await response.json() as TelegramApiResponse;
      return result;
    } catch (error) {
      console.error('Failed to send message:', error);
      return {
        ok: false,
        description: 'Network error occurred',
      };
    }
  }

  async setWebhook(params: SetWebhookParams): Promise<TelegramApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/setWebhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      const result = await response.json() as TelegramApiResponse;
      return result;
    } catch (error) {
      console.error('Failed to set webhook:', error);
      return {
        ok: false,
        description: 'Network error occurred',
      };
    }
  }

  async getWebhookInfo(): Promise<TelegramApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/getWebhookInfo`);
      const result = await response.json() as TelegramApiResponse;
      return result;
    } catch (error) {
      console.error('Failed to get webhook info:', error);
      return {
        ok: false,
        description: 'Network error occurred',
      };
    }
  }
}

export function createTelegramApi(botToken: string): TelegramApi {
  return new TelegramApi(botToken);
}