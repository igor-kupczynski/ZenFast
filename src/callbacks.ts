import { Env, User, Message, CallbackQuery } from './types';
import { isAuthenticated } from './auth';
import { startFast, endFast, formatDuration, formatTimeInTimezone, getFastsThisWeek, cancelFast, getUserFastingData, getCurrentFastDuration } from './fasting';
import { createSingleButtonKeyboard, createInlineKeyboard } from './telegram';
import { getOrdinalSuffix } from './utils';

export interface CallbackResult {
  text?: string;
  showAlert?: boolean;
  editMessage?: {
    messageId: number;
    chatId: number;
    newText: string;
    newKeyboard?: import('./types').InlineKeyboardMarkup;
  };
}

export async function routeCallback(
  callbackQuery: CallbackQuery,
  env: Env
): Promise<CallbackResult> {
  const { data, from: user, message } = callbackQuery;
  
  if (!data || !message) {
    return { showAlert: false };
  }

  const chatId = message.chat.id;
  
  // Check authentication
  const authenticated = await isAuthenticated(chatId, env);
  if (!authenticated) {
    return {
      text: "Please authenticate first by sending your API key.",
      showAlert: true
    };
  }

  switch (data) {
    case 'start_fast':
      return await handleStartFastCallback(user, message, env);
    case 'end_fast':
      return await handleEndFastCallback(user, message, env);
    case 'cancel_fast':
      return await promptCancelFastConfirmation(user, message, env);
    case 'cancel_fast_yes':
      return await handleCancelFastYesCallback(user, message, env);
    case 'cancel_fast_no':
      return await handleCancelFastNoCallback(user, message, env);
    default:
      return { showAlert: false };
  }
}

async function handleStartFastCallback(
  user: User,
  message: Message,
  env: Env
): Promise<CallbackResult> {
  try {
    const result = await startFast(user.id, user, env);
    
    if (!result.success) {
      return {
        text: result.error || "Failed to start fast. Please try again.",
        showAlert: true
      };
    }

    const formattedTime = formatTimeInTimezone(result.startTime!, result.userData.timezone);
    const newText = `✅ Fast started at ${formattedTime}`;
    const newKeyboard = createSingleButtonKeyboard("🛑 End Fast", "end_fast");

    return {
      editMessage: {
        messageId: message.message_id,
        chatId: message.chat.id,
        newText,
        newKeyboard
      }
    };
  } catch (error) {
    console.error('Error in handleStartFastCallback:', error);
    return {
      text: "An error occurred while starting your fast. Please try again.",
      showAlert: true
    };
  }
}

async function handleEndFastCallback(
  user: User,
  message: Message,
  env: Env
): Promise<CallbackResult> {
  try {
    const result = await endFast(user.id, user, env);
    
    if (!result.success || !result.duration || !result.fastEntry) {
      return {
        text: "No active fast to end.",
        showAlert: true
      };
    }

    const durationText = formatDuration(result.duration);
    const fastsThisWeek = getFastsThisWeek(result.userData.history, result.userData.timezone);
    
    let weekText;
    if (fastsThisWeek === 1) {
      weekText = ' (Your 1st fast this week)';
    } else {
      weekText = ` (Your ${fastsThisWeek}${getOrdinalSuffix(fastsThisWeek)} fast this week)`;
    }

    const newText = `✅ Great job! You fasted for ${durationText}${weekText}`;
    const newKeyboard = createSingleButtonKeyboard("🚀 Start Fast", "start_fast");

    return {
      editMessage: {
        messageId: message.message_id,
        chatId: message.chat.id,
        newText,
        newKeyboard
      }
    };
  } catch (error) {
    console.error('Error in handleEndFastCallback:', error);
    return {
      text: "An error occurred while ending your fast. Please try again.",
      showAlert: true
    };
  }
}

async function handleCancelFastYesCallback(
  user: User,
  message: Message,
  env: Env
): Promise<CallbackResult> {
  try {
    const result = await cancelFast(user.id, env);
    if (!result.success) {
      return {
        text: "No active fast to cancel.",
        showAlert: true
      };
    }

    const newText = `❎ Fast canceled. You can start a new fast anytime.`;
    const newKeyboard = createSingleButtonKeyboard("🚀 Start Fast", "start_fast");

    return {
      editMessage: {
        messageId: message.message_id,
        chatId: message.chat.id,
        newText,
        newKeyboard
      }
    };
  } catch (error) {
    console.error('Error in handleCancelFastYesCallback:', error);
    return {
      text: "An error occurred while canceling your fast. Please try again.",
      showAlert: true
    };
  }
}

async function promptCancelFastConfirmation(
  user: User,
  message: Message,
  env: Env
): Promise<CallbackResult> {
  try {
    const userData = await getUserFastingData(user.id, env);
    if (!userData.currentFast) {
      return {
        text: "No active fast to cancel.",
        showAlert: true
      };
    }
    const duration = getCurrentFastDuration(userData.currentFast);
    const durationText = formatDuration(duration);
    const startTime = formatTimeInTimezone(userData.currentFast.startedAt, userData.timezone);

    const newText = `❓ Cancel current fast?\nYou've been fasting for ${durationText} (started at ${startTime}).\nThis will discard the fast. Are you sure?`;
    const newKeyboard = createInlineKeyboard([[
      { text: "✅ Yes, cancel", callback_data: "cancel_fast_yes" },
      { text: "↩️ No, keep fasting", callback_data: "cancel_fast_no" }
    ]]);

    return {
      editMessage: {
        messageId: message.message_id,
        chatId: message.chat.id,
        newText,
        newKeyboard
      }
    };
  } catch (error) {
    console.error('Error in promptCancelFastConfirmation:', error);
    return {
      text: "An error occurred. Please try again.",
      showAlert: true
    };
  }
}

async function handleCancelFastNoCallback(
  user: User,
  message: Message,
  env: Env
): Promise<CallbackResult> {
  try {
    const userData = await getUserFastingData(user.id, env);
    if (!userData.currentFast) {
      return {
        text: "No active fast.",
        showAlert: true
      };
    }

    const duration = getCurrentFastDuration(userData.currentFast);
    const durationText = formatDuration(duration);
    const startTime = formatTimeInTimezone(userData.currentFast.startedAt, userData.timezone);

    const newText = `👍 Cancellation aborted. Keep going! You've been fasting for ${durationText} (started at ${startTime}).`;
    const newKeyboard = createInlineKeyboard([[
      { text: "🛑 End Fast", callback_data: "end_fast" },
      { text: "🗑️ Cancel Fast", callback_data: "cancel_fast" }
    ]]);

    return {
      editMessage: {
        messageId: message.message_id,
        chatId: message.chat.id,
        newText,
        newKeyboard
      }
    };
  } catch (error) {
    console.error('Error in handleCancelFastNoCallback:', error);
    return {
      text: "An error occurred. Please try again.",
      showAlert: true
    };
  }
}