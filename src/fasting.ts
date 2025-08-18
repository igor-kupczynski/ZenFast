import { Env, User, UserFastingData, CurrentFast, FastEntry } from './types';

const DEFAULT_TIMEZONE = 'Europe/Paris';

export async function getUserFastingData(userId: number, env: Env): Promise<UserFastingData> {
  const key = `user:${userId}`;
  const data = await env.FASTS.get(key);
  
  if (!data) {
    return {
      timezone: DEFAULT_TIMEZONE,
      history: []
    };
  }
  
  return JSON.parse(data);
}

export async function saveUserFastingData(userId: number, data: UserFastingData, env: Env): Promise<void> {
  const key = `user:${userId}`;
  await env.FASTS.put(key, JSON.stringify(data));
}

export async function startFast(userId: number, user: User, env: Env, customStartTime?: Date): Promise<{ success: boolean; startTime?: string; userData: UserFastingData; error?: string }> {
  const userData = await getUserFastingData(userId, env);
  
  // Check if user already has an active fast
  if (userData.currentFast) {
    return { 
      success: false, 
      userData, 
      error: "You already have an active fast. Please end your current fast before starting a new one." 
    };
  }
  
  const startTime = (customStartTime || new Date()).toISOString();
  userData.currentFast = {
    startedAt: startTime,
    startedBy: user
  };
  
  await saveUserFastingData(userId, userData, env);
  
  return { success: true, startTime, userData };
}

export async function endFast(userId: number, user: User, env: Env, customEndTime?: Date): Promise<{ success: boolean; duration?: number; fastEntry?: FastEntry; userData: UserFastingData; error?: string }> {
  const userData = await getUserFastingData(userId, env);
  
  if (!userData.currentFast) {
    return { success: false, userData, error: "You are not currently fasting" };
  }
  
  const endTime = (customEndTime || new Date()).toISOString();
  const startTime = userData.currentFast.startedAt;
  const duration = new Date(endTime).getTime() - new Date(startTime).getTime();
  
  // Validate that end time is after start time
  if (duration <= 0) {
    return { 
      success: false, 
      userData, 
      error: "End time cannot be before or equal to start time" 
    };
  }
  
  const fastEntry: FastEntry = {
    startedAt: startTime,
    endedAt: endTime,
    duration,
    endedBy: user
  };
  
  // Add to history and clear current fast
  userData.history.push(fastEntry);
  delete userData.currentFast;
  
  await saveUserFastingData(userId, userData, env);
  
  return { success: true, duration, fastEntry, userData };
}

export async function setUserTimezone(userId: number, timezone: string, env: Env): Promise<{ success: boolean; userData: UserFastingData }> {
  const userData = await getUserFastingData(userId, env);
  userData.timezone = timezone;
  
  await saveUserFastingData(userId, userData, env);
  
  return { success: true, userData };
}

export function formatDuration(durationMs: number): string {
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours === 0) {
    return `${minutes}m`;
  } else if (minutes === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${minutes}m`;
  }
}

export function formatTimeInTimezone(isoString: string, timezone: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  } catch (error) {
    // Fallback to UTC if timezone is invalid
    const date = new Date(isoString);
    return date.toISOString().substring(11, 16); // HH:MM format
  }
}

export function formatRelativeTime(isoString: string, _timezone: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'today';
    } else if (diffDays === 1) {
      return 'yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      const weeks = Math.floor(diffDays / 7);
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    }
  } catch (error) {
    return 'unknown';
  }
}

export function getCurrentFastDuration(currentFast: CurrentFast): number {
  const now = new Date().getTime();
  const start = new Date(currentFast.startedAt).getTime();
  return now - start;
}

export function getFastsThisWeek(history: FastEntry[], _timezone: string): number {
  try {
    const now = new Date();
    
    // Get start of week (Monday) in user's timezone
    const startOfWeek = new Date(now);
    const dayOfWeek = startOfWeek.getDay();
    // Calculate days back to Monday (week start)
    // Sunday = 0, Monday = 1, Tuesday = 2, etc.
    // For Sunday: go back 6 days, for other days: go back (dayOfWeek - 1) days
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(startOfWeek.getDate() - daysToMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    
    return history.filter(fast => {
      const fastDate = new Date(fast.endedAt);
      return fastDate >= startOfWeek;
    }).length;
  } catch (error) {
    return 0;
  }
}

export function getLastFast(history: FastEntry[]): FastEntry | null {
  if (history.length === 0) return null;
  return history[history.length - 1] ?? null;
}

export function getRecentFasts(history: FastEntry[], limit: number = 5): FastEntry[] {
  return history.slice(-limit).reverse(); // Get last N fasts, most recent first
}

export interface PeriodStatistics {
  totalFasts: number;
  totalHours: number;
  averageDuration: number; // in milliseconds
  longestFast: number; // in milliseconds
}

export function getWeeklyStatistics(history: FastEntry[], timezone: string): PeriodStatistics {
  try {
    // Get current time in user's timezone
    const now = new Date();
    const nowInUserTz = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
    
    // Get start of week (Monday) in user's timezone
    const startOfWeek = new Date(nowInUserTz);
    const dayOfWeek = startOfWeek.getDay();
    // Calculate days back to Monday (week start)
    // Sunday = 0, Monday = 1, Tuesday = 2, etc.
    // For Sunday: go back 6 days, for other days: go back (dayOfWeek - 1) days
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(startOfWeek.getDate() - daysToMonday);
    startOfWeek.setHours(0, 0, 0, 0);
    
    // Convert back to UTC for comparison with stored timestamps
    const startOfWeekUTC = new Date(startOfWeek.toLocaleString("en-US", { timeZone: "UTC" }));
    
    // Filter fasts for this week (compare with UTC timestamps)
    const weekFasts = history.filter(fast => {
      const fastDate = new Date(fast.endedAt);
      return fastDate >= startOfWeekUTC;
    });
    
    return calculatePeriodStatistics(weekFasts);
  } catch (error) {
    return { totalFasts: 0, totalHours: 0, averageDuration: 0, longestFast: 0 };
  }
}

export function getMonthlyStatistics(history: FastEntry[], timezone: string): PeriodStatistics {
  try {
    // Get current time in user's timezone
    const now = new Date();
    const nowInUserTz = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
    
    // Get start of month in user's timezone
    const startOfMonth = new Date(nowInUserTz.getFullYear(), nowInUserTz.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    // Convert back to UTC for comparison with stored timestamps
    const startOfMonthUTC = new Date(startOfMonth.toLocaleString("en-US", { timeZone: "UTC" }));
    
    // Filter fasts for this month (compare with UTC timestamps)
    const monthFasts = history.filter(fast => {
      const fastDate = new Date(fast.endedAt);
      return fastDate >= startOfMonthUTC;
    });
    
    return calculatePeriodStatistics(monthFasts);
  } catch (error) {
    return { totalFasts: 0, totalHours: 0, averageDuration: 0, longestFast: 0 };
  }
}

function calculatePeriodStatistics(fasts: FastEntry[]): PeriodStatistics {
  if (fasts.length === 0) {
    return { totalFasts: 0, totalHours: 0, averageDuration: 0, longestFast: 0 };
  }
  
  const totalDuration = fasts.reduce((sum, fast) => sum + fast.duration, 0);
  const longestFast = fasts.reduce((max, fast) => Math.max(max, fast.duration), 0);
  const averageDuration = totalDuration / fasts.length;
  const totalHours = Math.round(totalDuration / (1000 * 60 * 60) * 10) / 10; // Round to 1 decimal
  
  return {
    totalFasts: fasts.length,
    totalHours,
    averageDuration,
    longestFast
  };
}