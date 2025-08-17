import { InlineKeyboardMarkup } from './types';

export interface SendMessageParams {
  chat_id: number;
  text: string;
  reply_to_message_id?: number;
  parse_mode?: 'Markdown' | 'MarkdownV2' | 'HTML';
  reply_markup?: InlineKeyboardMarkup;
}

export interface SetWebhookParams {
  url: string;
  secret_token: string;
}

export interface AnswerCallbackQueryParams {
  callback_query_id: string;
  text?: string;
  show_alert?: boolean;
}

export interface EditMessageTextParams {
  chat_id: number;
  message_id: number;
  text: string;
  parse_mode?: 'Markdown' | 'MarkdownV2' | 'HTML';
  reply_markup?: InlineKeyboardMarkup;
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

      return await response.json() as TelegramApiResponse;
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

      return await response.json() as TelegramApiResponse;
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
      return await response.json() as TelegramApiResponse;
    } catch (error) {
      console.error('Failed to get webhook info:', error);
      return {
        ok: false,
        description: 'Network error occurred',
      };
    }
  }

  async answerCallbackQuery(params: AnswerCallbackQueryParams): Promise<TelegramApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/answerCallbackQuery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      return await response.json() as TelegramApiResponse;
    } catch (error) {
      console.error('Failed to answer callback query:', error);
      return {
        ok: false,
        description: 'Network error occurred',
      };
    }
  }

  async editMessageText(params: EditMessageTextParams): Promise<TelegramApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/editMessageText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      return await response.json() as TelegramApiResponse;
    } catch (error) {
      console.error('Failed to edit message text:', error);
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

// Helper functions for creating inline keyboards
export function createInlineKeyboard(buttons: Array<Array<{ text: string; callback_data: string }>>): InlineKeyboardMarkup {
  return {
    inline_keyboard: buttons.map(row => 
      row.map(button => ({
        text: button.text,
        callback_data: button.callback_data
      }))
    )
  };
}

export function createSingleButtonKeyboard(text: string, callback_data: string): InlineKeyboardMarkup {
  return createInlineKeyboard([[{ text, callback_data }]]);
}