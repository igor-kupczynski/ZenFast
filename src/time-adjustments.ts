export interface TimeAdjustment {
  type: 'relative' | 'absolute';
  value: Date;
  originalInput: string;
}

export interface ParseTimeResult {
  adjustment?: TimeAdjustment;
  error?: string;
}

export function parseTimeAdjustment(input: string, baseTime: Date, timezone: string): ParseTimeResult {
  const trimmed = input.trim();
  
  if (!trimmed) {
    return {};
  }

  // Try relative time format first (e.g., -2h, -30m, -1d)
  const relativeMatch = trimmed.match(/^([+-])?(\d+)([hmd])$/);
  if (relativeMatch) {
    const sign = relativeMatch[1] === '+' ? 1 : -1; // Default to negative (ago)
    const amount = parseInt(relativeMatch[2]!, 10);
    const unit = relativeMatch[3]!;
    
    if (isNaN(amount) || amount <= 0) {
      return { error: `Invalid time amount: ${trimmed}` };
    }
    
    const adjustedTime = new Date(baseTime);
    
    switch (unit) {
      case 'h':
        adjustedTime.setHours(adjustedTime.getHours() + (sign * amount));
        break;
      case 'm':
        adjustedTime.setMinutes(adjustedTime.getMinutes() + (sign * amount));
        break;
      case 'd':
        adjustedTime.setDate(adjustedTime.getDate() + (sign * amount));
        break;
      default:
        return { error: `Unsupported time unit: ${unit}. Use h (hours), m (minutes), or d (days)` };
    }
    
    return {
      adjustment: {
        type: 'relative',
        value: adjustedTime,
        originalInput: trimmed
      }
    };
  }

  // Try absolute time format (e.g., 14:00, 09:30)
  const absoluteMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (absoluteMatch) {
    const hours = parseInt(absoluteMatch[1]!, 10);
    const minutes = parseInt(absoluteMatch[2]!, 10);
    
    if (hours < 0 || hours > 23) {
      return { error: `Invalid hour: ${hours}. Must be 0-23` };
    }
    
    if (minutes < 0 || minutes > 59) {
      return { error: `Invalid minutes: ${minutes}. Must be 0-59` };
    }
    
    // Create absolute time for today in user's timezone
    const adjustedTime = new Date();
    
    try {
      // Convert to user's timezone and set the time
      const todayInTimezone = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(adjustedTime);
      
      const timeString = `${todayInTimezone}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
      
      // Parse as if it's in UTC, then adjust for timezone offset
      const parsedTime = new Date(timeString);
      
      // Get the timezone offset for the target timezone
      const tempDate = new Date();
      const utcOffset = tempDate.getTimezoneOffset() * 60000; // Convert to milliseconds
      const targetTime = new Date(parsedTime.getTime() - utcOffset);
      
      // Adjust for the target timezone
      const targetFormatter = new Intl.DateTimeFormat('en', {
        timeZone: timezone,
        timeZoneName: 'longOffset'
      });
      
      const targetOffset = getTimezoneOffset(timezone);
      const finalTime = new Date(parsedTime.getTime() - (targetOffset * 60000));
      
      return {
        adjustment: {
          type: 'absolute',
          value: finalTime,
          originalInput: trimmed
        }
      };
    } catch (error) {
      return { error: `Failed to parse time in timezone ${timezone}: ${trimmed}` };
    }
  }

  return { error: `Invalid time format: ${trimmed}. Use formats like: -2h, -30m, -1d, 14:00, 09:30` };
}

function getTimezoneOffset(timezone: string): number {
  try {
    const now = new Date();
    const utc = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 
                        now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
    
    const target = new Date(utc.toLocaleString('en-US', { timeZone: timezone }));
    const diff = utc.getTime() - target.getTime();
    
    return diff / (1000 * 60); // Return offset in minutes
  } catch (error) {
    return 0; // Fallback to UTC
  }
}

export function validateTimelineConsistency(
  adjustedTime: Date, 
  existingCurrentFast?: { startedAt: string },
  isStartCommand: boolean = true
): { valid: boolean; error?: string } {
  const now = new Date();
  
  // Check if adjusted time is in the future
  if (adjustedTime > now) {
    return { 
      valid: false, 
      error: `Cannot ${isStartCommand ? 'start' : 'end'} a fast in the future` 
    };
  }
  
  // For start commands, check if there's already an active fast
  if (isStartCommand && existingCurrentFast) {
    const existingStartTime = new Date(existingCurrentFast.startedAt);
    
    // Check if adjusted start time is after the existing fast start
    if (adjustedTime >= existingStartTime) {
      return {
        valid: false,
        error: `Cannot start a fast at ${adjustedTime.toISOString()} - you already have a fast that started at ${existingStartTime.toISOString()}`
      };
    }
  }
  
  // For end commands, check if adjusted time is after the fast start time
  if (!isStartCommand && existingCurrentFast) {
    const startTime = new Date(existingCurrentFast.startedAt);
    
    if (adjustedTime <= startTime) {
      return {
        valid: false,
        error: `Cannot end a fast before it started. Fast started at ${startTime.toISOString()}, trying to end at ${adjustedTime.toISOString()}`
      };
    }
  }
  
  // Check if the adjusted time is too far in the past (more than 7 days)
  const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
  if (adjustedTime < sevenDaysAgo) {
    return {
      valid: false,
      error: `Cannot ${isStartCommand ? 'start' : 'end'} a fast more than 7 days ago`
    };
  }
  
  return { valid: true };
}

export function formatAdjustedTime(adjustment: TimeAdjustment, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(adjustment.value);
  } catch (error) {
    // Fallback to UTC format
    return adjustment.value.toISOString().substring(11, 16);
  }
}