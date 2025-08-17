import { Env, User, InlineKeyboardMarkup } from './types';
import { getAuthDetails, isAuthenticated } from './auth';
import { 
  getUserFastingData, 
  startFast, 
  endFast, 
  setUserTimezone, 
  getCurrentFastDuration, 
  formatDuration, 
  formatTimeInTimezone, 
  formatRelativeTime, 
  getFastsThisWeek, 
  getLastFast, 
  getRecentFasts 
} from './fasting';
import { createSingleButtonKeyboard } from './telegram';
import { getOrdinalSuffix } from './utils';

export interface CommandResult {
  text: string;
  replyToMessageId?: number;
  replyMarkup?: InlineKeyboardMarkup;
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

export async function handleFastCommand(
  chatId: number,
  user: User,
  messageId: number,
  env: Env
): Promise<CommandResult> {
  try {
    const authenticated = await isAuthenticated(chatId, env);
    if (!authenticated) {
      return {
        text: "Please authenticate by sending your API key first.",
        replyToMessageId: messageId
      };
    }

    const userData = await getUserFastingData(user.id, env);
    
    if (userData.currentFast) {
      const duration = getCurrentFastDuration(userData.currentFast);
      const durationText = formatDuration(duration);
      const startTime = formatTimeInTimezone(userData.currentFast.startedAt, userData.timezone);
      
      return {
        text: `You've been fasting for ${durationText} (started at ${startTime})`,
        replyToMessageId: messageId,
        replyMarkup: createSingleButtonKeyboard("🛑 End Fast", "end_fast")
      };
    } else {
      const result = await startFast(user.id, user, env);
      if (!result.success) {
        return {
          text: result.error || "Failed to start fast. Please try again.",
          replyToMessageId: messageId
        };
      }
      
      const startTime = formatTimeInTimezone(result.startTime!, result.userData.timezone);
      return {
        text: `✅ Fast started at ${startTime}`,
        replyToMessageId: messageId,
        replyMarkup: createSingleButtonKeyboard("🛑 End Fast", "end_fast")
      };
    }
  } catch (error) {
    console.error('Error in handleFastCommand:', error);
    return {
      text: "An error occurred while processing your request. Please try again.",
      replyToMessageId: messageId
    };
  }
}

export async function handleEndCommand(
  chatId: number,
  user: User,
  messageId: number,
  env: Env
): Promise<CommandResult> {
  try {
    const authenticated = await isAuthenticated(chatId, env);
    if (!authenticated) {
      return {
        text: "Please authenticate by sending your API key first.",
        replyToMessageId: messageId
      };
    }

    const userData = await getUserFastingData(user.id, env);
    
    if (userData.currentFast) {
      const result = await endFast(user.id, user, env);
      if (!result.success || !result.duration) {
        return {
          text: "Failed to end fast. Please try again.",
          replyToMessageId: messageId
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
      
      return {
        text: `✅ Great job! You fasted for ${durationText}${weekText}`,
        replyToMessageId: messageId,
        replyMarkup: createSingleButtonKeyboard("🚀 Start Fast", "start_fast")
      };
    } else {
      const lastFast = getLastFast(userData.history);
      if (lastFast) {
        const durationText = formatDuration(lastFast.duration);
        const relativeTime = formatRelativeTime(lastFast.endedAt, userData.timezone);
        
        return {
          text: `You're not currently fasting. Your last fast was ${durationText} (${relativeTime})`,
          replyToMessageId: messageId,
          replyMarkup: createSingleButtonKeyboard("🚀 Start Fast", "start_fast")
        };
      } else {
        return {
          text: "You're not currently fasting and have no fasting history.",
          replyToMessageId: messageId,
          replyMarkup: createSingleButtonKeyboard("🚀 Start Fast", "start_fast")
        };
      }
    }
  } catch (error) {
    console.error('Error in handleEndCommand:', error);
    return {
      text: "An error occurred while processing your request. Please try again.",
      replyToMessageId: messageId
    };
  }
}

export async function handleStatsCommand(
  chatId: number,
  user: User,
  messageId: number,
  env: Env
): Promise<CommandResult> {
  try {
    const authenticated = await isAuthenticated(chatId, env);
    if (!authenticated) {
      return {
        text: "Please authenticate by sending your API key first.",
        replyToMessageId: messageId
      };
    }

    const userData = await getUserFastingData(user.id, env);
    const recentFasts = getRecentFasts(userData.history, 5);
    
    if (recentFasts.length === 0) {
      return {
        text: "📊 No fasting history yet. Start your first fast to see stats here!",
        replyToMessageId: messageId,
        replyMarkup: createSingleButtonKeyboard("🚀 Start Fast", "start_fast")
      };
    }
    
    let statsText = "📊 Your recent fasts:\n\n";
    
    recentFasts.forEach(fast => {
      const duration = formatDuration(fast.duration);
      const relativeTime = formatRelativeTime(fast.endedAt, userData.timezone);
      statsText += `📊 ${duration} - ${relativeTime}\n`;
    });
    
    // Determine appropriate button based on current state
    const buttonText = userData.currentFast ? "🛑 End Fast" : "🚀 Start Fast";
    const buttonData = userData.currentFast ? "end_fast" : "start_fast";
    
    return {
      text: statsText.trim(),
      replyToMessageId: messageId,
      replyMarkup: createSingleButtonKeyboard(buttonText, buttonData)
    };
  } catch (error) {
    console.error('Error in handleStatsCommand:', error);
    return {
      text: "An error occurred while retrieving your stats. Please try again.",
      replyToMessageId: messageId
    };
  }
}

export async function handleTimezoneCommand(
  chatId: number,
  user: User,
  messageId: number,
  messageText: string,
  env: Env
): Promise<CommandResult> {
  try {
    const authenticated = await isAuthenticated(chatId, env);
    if (!authenticated) {
      return {
        text: "Please authenticate by sending your API key first.",
        replyToMessageId: messageId
      };
    }

    // Extract timezone from command
    const parts = messageText.split(' ');
    if (parts.length < 2) {
      const userData = await getUserFastingData(user.id, env);
      return {
        text: `Your current timezone is: ${userData.timezone}\n\nTo change it, use: /timezone America/New_York`,
        replyToMessageId: messageId
      };
    }
    
    const timezone = parts[1];
    if (!timezone) {
      const userData = await getUserFastingData(user.id, env);
      return {
        text: `Your current timezone is: ${userData.timezone}\n\nTo change it, use: /timezone America/New_York`,
        replyToMessageId: messageId
      };
    }
    
    // Validate timezone by attempting to create a formatter
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    } catch (timezoneError) {
      return {
        text: `Invalid timezone: ${timezone}\n\nPlease use a valid IANA timezone like: America/New_York, Europe/London, Asia/Tokyo`,
        replyToMessageId: messageId
      };
    }
    
    const result = await setUserTimezone(user.id, timezone, env);
    if (!result.success) {
      return {
        text: "Failed to update timezone. Please try again.",
        replyToMessageId: messageId
      };
    }
    
    return {
      text: `✅ Timezone updated to: ${timezone}`,
      replyToMessageId: messageId
    };
  } catch (error) {
    console.error('Error in handleTimezoneCommand:', error);
    return {
      text: "An error occurred while updating your timezone. Please try again.",
      replyToMessageId: messageId
    };
  }
}

export async function routeCommand(
  command: string,
  chatId: number,
  user: User,
  messageId: number,
  messageText: string,
  env: Env
): Promise<CommandResult | null> {
  switch (command) {
    case 'start':
      return await handleStartCommand(chatId, user, messageId, env);
    case 'status':
      return await handleStatusCommand(chatId, user, messageId, env);
    case 'fast':
    case 'f':
      return await handleFastCommand(chatId, user, messageId, env);
    case 'end':
    case 'e':
      return await handleEndCommand(chatId, user, messageId, env);
    case 'stats':
      return await handleStatsCommand(chatId, user, messageId, env);
    case 'timezone':
      return await handleTimezoneCommand(chatId, user, messageId, messageText, env);
    default:
      // Unknown command - ignore silently
      return null;
  }
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] || '';
}