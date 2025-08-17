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

export async function startFast(userId: number, user: User, env: Env): Promise<{ success: boolean; startTime: string; userData: UserFastingData }> {
  const userData = await getUserFastingData(userId, env);
  const startTime = new Date().toISOString();
  
  // Void any existing unclosed fast by starting a new one
  userData.currentFast = {
    startedAt: startTime,
    startedBy: user
  };
  
  await saveUserFastingData(userId, userData, env);
  
  return { success: true, startTime, userData };
}

export async function endFast(userId: number, user: User, env: Env): Promise<{ success: boolean; duration?: number; fastEntry?: FastEntry; userData: UserFastingData }> {
  const userData = await getUserFastingData(userId, env);
  
  if (!userData.currentFast) {
    return { success: false, userData };
  }
  
  const endTime = new Date().toISOString();
  const startTime = userData.currentFast.startedAt;
  const duration = new Date(endTime).getTime() - new Date(startTime).getTime();
  
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
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, so 6 days back
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