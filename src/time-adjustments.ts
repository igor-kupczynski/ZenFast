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
  if (relativeMatch && relativeMatch[2] && relativeMatch[3]) {
    const sign = relativeMatch[1] === '+' ? 1 : -1; // Default to negative (ago)
    const amount = parseInt(relativeMatch[2], 10);
    const unit = relativeMatch[3];
    
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
  if (absoluteMatch && absoluteMatch[1] && absoluteMatch[2]) {
    const hours = parseInt(absoluteMatch[1], 10);
    const minutes = parseInt(absoluteMatch[2], 10);
    
    if (hours < 0 || hours > 23) {
      return { error: `Invalid hour: ${hours}. Must be 0-23` };
    }
    
    if (minutes < 0 || minutes > 59) {
      return { error: `Invalid minutes: ${minutes}. Must be 0-59` };
    }
    
    try {
      // Get today's date in the user's timezone
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
      const timeString = `${today}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
      
      // Create a date object representing the time in the user's timezone
      // We'll interpret this as a local time in the target timezone
      const localDate = new Date(timeString);
      
      // Get the timezone offset difference to convert to UTC
      const utcTime = new Date(localDate.toLocaleString('en-US', { timeZone: 'UTC' }));
      const timezoneTime = new Date(localDate.toLocaleString('en-US', { timeZone: timezone }));
      const offsetMs = utcTime.getTime() - timezoneTime.getTime();
      
      // Apply the offset to get the correct UTC time
      const adjustedTime = new Date(localDate.getTime() + offsetMs);
      
      return {
        adjustment: {
          type: 'absolute',
          value: adjustedTime,
          originalInput: trimmed
        }
      };
    } catch (error) {
      return { error: `Failed to parse time in timezone ${timezone}: ${trimmed}` };
    }
  }

  return { error: `Invalid time format: ${trimmed}. Use formats like: -2h, -30m, -1d, 14:00, 09:30` };
}


export function validateTimelineConsistency(
  adjustedTime: Date, 
  existingCurrentFast?: { startedAt: string },
  isStartCommand: boolean = true,
  now: Date = new Date()
): { valid: boolean; error?: string } {
  
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