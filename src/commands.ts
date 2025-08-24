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
  getRecentFasts,
  getWeeklyStatistics,
  getMonthlyStatistics,
  PeriodStatistics
} from './fasting';
import { createSingleButtonKeyboard, createInlineKeyboard } from './telegram';
import { getOrdinalSuffix } from './utils';
import { parseTimeAdjustment, validateTimelineConsistency } from './time-adjustments';

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
  env: Env,
  messageText?: string
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
        text: `You've been fasting for ${durationText} (started at ${startTime}). Please end your current fast (or cancel it) before starting a new one.`,
        replyToMessageId: messageId,
        replyMarkup: createInlineKeyboard([[
          { text: "🛑 End Fast", callback_data: "end_fast" },
          { text: "🗑️ Cancel Fast", callback_data: "cancel_fast" }
        ]])
      };
    } else {
      // Parse time adjustment if provided
      let customStartTime: Date | undefined;
      if (messageText) {
        const parts = messageText.split(' ');
        if (parts.length > 1) {
          const timeInput = parts.slice(1).join(' ');
          const parseResult = parseTimeAdjustment(timeInput, new Date(), userData.timezone);
          
          if (parseResult.error) {
            return {
              text: `❌ ${parseResult.error}`,
              replyToMessageId: messageId
            };
          }
          
          if (parseResult.adjustment) {
            // Validate timeline consistency
            const validation = validateTimelineConsistency(
              parseResult.adjustment.value,
              userData.currentFast,
              true
            );
            
            if (!validation.valid) {
              return {
                text: `❌ ${validation.error}`,
                replyToMessageId: messageId
              };
            }
            
            customStartTime = parseResult.adjustment.value;
          }
        }
      }
      
      const result = await startFast(user.id, user, env, customStartTime);
      if (!result.success) {
        return {
          text: result.error || "Failed to start fast. Please try again.",
          replyToMessageId: messageId
        };
      }
      
      const startTime = formatTimeInTimezone(result.startTime!, result.userData.timezone);
      const timeNote = customStartTime ? ` (adjusted from your input)` : '';
      
      return {
        text: `✅ Fast started at ${startTime}${timeNote}`,
        replyToMessageId: messageId,
        replyMarkup: createInlineKeyboard([[
          { text: "🛑 End Fast", callback_data: "end_fast" },
          { text: "🗑️ Cancel Fast", callback_data: "cancel_fast" }
        ]])
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
  env: Env,
  messageText?: string
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
      // Parse time adjustment if provided
      let customEndTime: Date | undefined;
      if (messageText) {
        const parts = messageText.split(' ');
        if (parts.length > 1) {
          const timeInput = parts.slice(1).join(' ');
          const parseResult = parseTimeAdjustment(timeInput, new Date(), userData.timezone);
          
          if (parseResult.error) {
            return {
              text: `❌ ${parseResult.error}`,
              replyToMessageId: messageId
            };
          }
          
          if (parseResult.adjustment) {
            // Validate timeline consistency
            const validation = validateTimelineConsistency(
              parseResult.adjustment.value,
              userData.currentFast,
              false
            );
            
            if (!validation.valid) {
              return {
                text: `❌ ${validation.error}`,
                replyToMessageId: messageId
              };
            }
            
            customEndTime = parseResult.adjustment.value;
          }
        }
      }
      
      const result = await endFast(user.id, user, env, customEndTime);
      if (!result.success || !result.duration) {
        return {
          text: result.error || "Failed to end fast. Please try again.",
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
      
      const timeNote = customEndTime ? ` (adjusted from your input)` : '';
      
      return {
        text: `✅ Great job! You fasted for ${durationText}${weekText}${timeNote}`,
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

export async function handleWeekCommand(
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
    const weekStats = getWeeklyStatistics(userData.history, userData.timezone);
    
    if (weekStats.totalFasts === 0) {
      return {
        text: "📅 This Week's Fasting Summary\n\nNo fasts completed this week yet. Start your first fast to see your weekly progress!",
        replyToMessageId: messageId,
        replyMarkup: createSingleButtonKeyboard("🚀 Start Fast", "start_fast")
      };
    }
    
    const text = formatPeriodStatistics("📅 This Week's Fasting Summary", weekStats);
    
    // Determine appropriate button based on current state
    const buttonText = userData.currentFast ? "🛑 End Fast" : "🚀 Start Fast";
    const buttonData = userData.currentFast ? "end_fast" : "start_fast";
    
    return {
      text,
      replyToMessageId: messageId,
      replyMarkup: createSingleButtonKeyboard(buttonText, buttonData)
    };
  } catch (error) {
    console.error('Error in handleWeekCommand:', error);
    return {
      text: "An error occurred while retrieving your weekly stats. Please try again.",
      replyToMessageId: messageId
    };
  }
}

export async function handleMonthCommand(
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
    const monthStats = getMonthlyStatistics(userData.history, userData.timezone);
    
    if (monthStats.totalFasts === 0) {
      return {
        text: "📊 This Month's Fasting Summary\n\nNo fasts completed this month yet. Start your first fast to see your monthly progress!",
        replyToMessageId: messageId,
        replyMarkup: createSingleButtonKeyboard("🚀 Start Fast", "start_fast")
      };
    }
    
    const text = formatPeriodStatistics("📊 This Month's Fasting Summary", monthStats);
    
    // Determine appropriate button based on current state
    const buttonText = userData.currentFast ? "🛑 End Fast" : "🚀 Start Fast";
    const buttonData = userData.currentFast ? "end_fast" : "start_fast";
    
    return {
      text,
      replyToMessageId: messageId,
      replyMarkup: createSingleButtonKeyboard(buttonText, buttonData)
    };
  } catch (error) {
    console.error('Error in handleMonthCommand:', error);
    return {
      text: "An error occurred while retrieving your monthly stats. Please try again.",
      replyToMessageId: messageId
    };
  }
}

function formatPeriodStatistics(title: string, stats: PeriodStatistics): string {
  const averageDurationText = formatDuration(stats.averageDuration);
  const longestFastText = formatDuration(stats.longestFast);
  
  return `${title}\n\n` +
         `📈 Total fasts: ${stats.totalFasts}\n` +
         `⏰ Total hours: ${stats.totalHours}h\n` +
         `📊 Average duration: ${averageDurationText}\n` +
         `🏆 Longest fast: ${longestFastText}`;
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
      return await handleFastCommand(chatId, user, messageId, env, messageText);
    case 'end':
    case 'e':
      return await handleEndCommand(chatId, user, messageId, env, messageText);
    case 'cancel':
      return await handleCancelCommand(chatId, user, messageId, env);
    case 'stats':
      return await handleStatsCommand(chatId, user, messageId, env);
    case 'timezone':
      return await handleTimezoneCommand(chatId, user, messageId, messageText, env);
    case 'week':
      return await handleWeekCommand(chatId, user, messageId, env);
    case 'month':
      return await handleMonthCommand(chatId, user, messageId, env);
    default:
      // Unknown command - ignore silently
      return null;
  }
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] || '';
}

export async function handleCancelCommand(
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
    if (!userData.currentFast) {
      return {
        text: "You're not currently fasting.",
        replyToMessageId: messageId,
        replyMarkup: createSingleButtonKeyboard("🚀 Start Fast", "start_fast")
      };
    }

    // Ask for confirmation before canceling
    const duration = getCurrentFastDuration(userData.currentFast);
    const durationText = formatDuration(duration);
    const startTime = formatTimeInTimezone(userData.currentFast.startedAt, userData.timezone);

    return {
      text: `❓ Cancel current fast?\nYou've been fasting for ${durationText} (started at ${startTime}).\nThis will discard the fast. Are you sure?` ,
      replyToMessageId: messageId,
      replyMarkup: createInlineKeyboard([[
        { text: "✅ Yes, cancel", callback_data: "cancel_fast_yes" },
        { text: "↩️ No, keep fasting", callback_data: "cancel_fast_no" }
      ]])
    };
  } catch (error) {
    console.error('Error in handleCancelCommand:', error);
    return {
      text: "An error occurred while processing your request. Please try again.",
      replyToMessageId: messageId
    };
  }
}
