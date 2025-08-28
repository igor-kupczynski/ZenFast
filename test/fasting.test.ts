import { describe, it, expect, beforeEach } from 'vitest';
import { 
  getUserFastingData, 
  startFast, 
  endFast, 
  setUserTimezone,
  formatDuration,
  formatTimeInTimezone,
  formatDateInTimezone,
  formatRelativeTime,
  getCurrentFastDuration,
  getFastsThisWeek,
  getLastFast,
  getRecentFasts,
  getWeeklyStatistics,
  getMonthlyStatistics
} from '../src/fasting';
import { Env, User, UserFastingData, FastEntry } from '../src/types';
import { MockKV } from './utils/mockKv';

describe('Fasting Module', () => {
  let mockFasts: MockKV;
  let env: Env;
  let testUser: User;

  beforeEach(() => {
    mockFasts = new MockKV();
    
    env = {
      BOT_TOKEN: 'test-token',
      BOT_USERNAME: 'TestBot',
      WEBHOOK_SECRET: 'test-secret',
      API_KEYS: new MockKV() as any,
      CHATS: new MockKV() as any,
      RATE_LIMITS: new MockKV() as any,
      FASTS: mockFasts as any,
    };

    testUser = {
      id: 123456789,
      is_bot: false,
      first_name: 'Test',
      username: 'testuser'
    };
  });

  describe('getUserFastingData', () => {
    it('should return default data for new user', async () => {
      const result = await getUserFastingData(testUser.id, env);
      
      expect(result.timezone).toBe('Europe/Paris');
      expect(result.currentFast).toBeUndefined();
      expect(result.history).toEqual([]);
    });

    it('should return stored data for existing user', async () => {
      const userData: UserFastingData = {
        timezone: 'America/New_York',
        currentFast: {
          startedAt: '2024-01-01T10:00:00Z',
          startedBy: testUser
        },
        history: []
      };
      
      await mockFasts.put(`user:${testUser.id}`, JSON.stringify(userData));
      
      const result = await getUserFastingData(testUser.id, env);
      
      expect(result.timezone).toBe('America/New_York');
      expect(result.currentFast?.startedAt).toBe('2024-01-01T10:00:00Z');
    });
  });

  describe('startFast', () => {
    it('should start a new fast', async () => {
      const result = await startFast(testUser.id, testUser, env);
      
      expect(result.success).toBe(true);
      expect(result.startTime).toBeDefined();
      expect(result.userData.currentFast?.startedBy).toEqual(testUser);
      
      // Verify stored in KV
      const stored = await mockFasts.get(`user:${testUser.id}`);
      const storedData = JSON.parse(stored!);
      expect(storedData.currentFast).toBeDefined();
    });

    it('should prevent starting new fast when one is already active', async () => {
      // Start first fast
      const firstResult = await startFast(testUser.id, testUser, env);
      expect(firstResult.success).toBe(true);
      
      // Try to start second fast (should fail)
      const secondResult = await startFast(testUser.id, testUser, env);
      
      expect(secondResult.success).toBe(false);
      expect(secondResult.error).toContain('You already have an active fast');
      expect(secondResult.startTime).toBeUndefined();
      
      // Should still have the original fast
      expect(secondResult.userData.currentFast?.startedAt).toBe(firstResult.startTime);
      expect(secondResult.userData.history).toHaveLength(0);
    });
  });

  describe('endFast', () => {
    it('should end current fast and add to history', async () => {
      // Start a fast first
      const startResult = await startFast(testUser.id, testUser, env);
      
      // Wait a bit for duration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // End the fast
      const endResult = await endFast(testUser.id, testUser, env);
      
      expect(endResult.success).toBe(true);
      expect(endResult.duration).toBeGreaterThan(0);
      expect(endResult.fastEntry).toBeDefined();
      expect(endResult.userData.currentFast).toBeUndefined();
      expect(endResult.userData.history).toHaveLength(1);
      
      const historyEntry = endResult.userData.history[0];
      expect(historyEntry?.startedAt).toBe(startResult.startTime);
      expect(historyEntry?.endedBy).toEqual(testUser);
    });

    it('should fail when no current fast', async () => {
      const result = await endFast(testUser.id, testUser, env);
      
      expect(result.success).toBe(false);
      expect(result.duration).toBeUndefined();
      expect(result.fastEntry).toBeUndefined();
    });
  });

  describe('setUserTimezone', () => {
    it('should update user timezone', async () => {
      const result = await setUserTimezone(testUser.id, 'Asia/Tokyo', env);
      
      expect(result.success).toBe(true);
      expect(result.userData.timezone).toBe('Asia/Tokyo');
      
      // Verify stored in KV
      const stored = await mockFasts.get(`user:${testUser.id}`);
      const storedData = JSON.parse(stored!);
      expect(storedData.timezone).toBe('Asia/Tokyo');
    });
  });

  describe('formatDuration', () => {
    it('should format durations correctly', () => {
      expect(formatDuration(1000 * 60 * 30)).toBe('30m'); // 30 minutes
      expect(formatDuration(1000 * 60 * 60 * 2)).toBe('2h'); // 2 hours
      expect(formatDuration(1000 * 60 * 60 * 16 + 1000 * 60 * 30)).toBe('16h 30m'); // 16h 30m
      expect(formatDuration(1000 * 60 * 60 * 24)).toBe('24h'); // 24 hours
    });

    it('should handle edge cases', () => {
      expect(formatDuration(0)).toBe('0m');
      expect(formatDuration(1000 * 60 * 59)).toBe('59m');
      expect(formatDuration(1000 * 60 * 60)).toBe('1h');
    });
  });

  describe('formatTimeInTimezone', () => {
    it('should format time in specified timezone', () => {
      const isoTime = '2024-01-01T15:30:00Z';
      
      // Test different timezones
      const utc = formatTimeInTimezone(isoTime, 'UTC');
      const ny = formatTimeInTimezone(isoTime, 'America/New_York');
      const tokyo = formatTimeInTimezone(isoTime, 'Asia/Tokyo');
      
      expect(utc).toBe('15:30');
      // Note: Exact times depend on DST, but should be valid format
      expect(ny).toMatch(/^\d{2}:\d{2}$/);
      expect(tokyo).toMatch(/^\d{2}:\d{2}$/);
    });

    it('should fallback gracefully for invalid timezone', () => {
      const isoTime = '2024-01-01T15:30:00Z';
      const result = formatTimeInTimezone(isoTime, 'Invalid/Timezone');
      
      expect(result).toBe('15:30'); // Should fallback to UTC
    });
  });

  describe('formatDateInTimezone', () => {
    it('should format date and time in specified timezone', () => {
      const isoTime = '2024-01-15T15:30:00Z';
      
      // Test different timezones
      const utc = formatDateInTimezone(isoTime, 'UTC');
      const ny = formatDateInTimezone(isoTime, 'America/New_York');
      const tokyo = formatDateInTimezone(isoTime, 'Asia/Tokyo');
      
      expect(utc).toBe('15 Jan, 15:30');
      // Note: Exact dates/times depend on DST, but should be valid format
      expect(ny).toMatch(/^\d{1,2} \w{3}, \d{2}:\d{2}$/);
      expect(tokyo).toMatch(/^\d{1,2} \w{3}, \d{2}:\d{2}$/);
    });

    it('should fallback gracefully for invalid timezone', () => {
      const isoTime = '2024-01-15T15:30:00Z';
      const result = formatDateInTimezone(isoTime, 'Invalid/Timezone');
      
      expect(result).toBe('Jan 15, 15:30'); // Should fallback to UTC
    });
  });

  describe('formatRelativeTime', () => {
    it('should format relative times correctly', () => {
      const now = new Date();
      
      // Today
      const today = now.toISOString();
      expect(formatRelativeTime(today, 'UTC')).toBe('today');
      
      // Yesterday
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(yesterday, 'UTC')).toBe('yesterday');
      
      // 3 days ago
      const threeDays = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(threeDays, 'UTC')).toBe('3 days ago');
      
      // 1 week ago
      const oneWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(oneWeek, 'UTC')).toBe('1 week ago');
      
      // 2 weeks ago
      const twoWeeks = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(twoWeeks, 'UTC')).toBe('2 weeks ago');
    });
  });

  describe('getCurrentFastDuration', () => {
    it('should calculate current fast duration', () => {
      const startTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const currentFast = {
        startedAt: startTime.toISOString(),
        startedBy: testUser
      };
      
      const duration = getCurrentFastDuration(currentFast);
      
      // Should be approximately 2 hours (allow for test execution time)
      expect(duration).toBeGreaterThan(2 * 60 * 60 * 1000 - 1000);
      expect(duration).toBeLessThan(2 * 60 * 60 * 1000 + 1000);
    });
  });

  describe('getFastsThisWeek', () => {
    it('should count fasts in current week', () => {
      const now = new Date();
      
      // Calculate the start of the current week (Monday)
      const startOfWeek = new Date(now);
      const dayOfWeek = startOfWeek.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startOfWeek.setDate(startOfWeek.getDate() - daysToMonday);
      startOfWeek.setHours(0, 0, 0, 0);
      
      // Create dates that are definitely in this week (after Monday)
      const dayInThisWeek = new Date(startOfWeek.getTime() + 1 * 24 * 60 * 60 * 1000); // Tuesday
      const anotherDayInThisWeek = new Date(startOfWeek.getTime() + 3 * 24 * 60 * 60 * 1000); // Thursday
      const dayInLastWeek = new Date(startOfWeek.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days before Monday
      
      const history: FastEntry[] = [
        {
          startedAt: dayInLastWeek.toISOString(),
          endedAt: dayInLastWeek.toISOString(),
          duration: 16 * 60 * 60 * 1000,
          endedBy: testUser
        },
        {
          startedAt: dayInThisWeek.toISOString(),
          endedAt: dayInThisWeek.toISOString(),
          duration: 16 * 60 * 60 * 1000,
          endedBy: testUser
        },
        {
          startedAt: anotherDayInThisWeek.toISOString(),
          endedAt: anotherDayInThisWeek.toISOString(),
          duration: 16 * 60 * 60 * 1000,
          endedBy: testUser
        }
      ];
      
      const count = getFastsThisWeek(history, 'UTC');
      expect(count).toBe(2); // Exactly 2 fasts in the current week
    });
  });

  describe('getLastFast', () => {
    it('should return last fast from history', () => {
      const history: FastEntry[] = [
        {
          startedAt: '2024-01-01T10:00:00Z',
          endedAt: '2024-01-01T18:00:00Z',
          duration: 8 * 60 * 60 * 1000,
          endedBy: testUser
        },
        {
          startedAt: '2024-01-02T10:00:00Z',
          endedAt: '2024-01-02T20:00:00Z',
          duration: 10 * 60 * 60 * 1000,
          endedBy: testUser
        }
      ];
      
      const lastFast = getLastFast(history);
      expect(lastFast?.startedAt).toBe('2024-01-02T10:00:00Z');
      expect(lastFast?.duration).toBe(10 * 60 * 60 * 1000);
    });

    it('should return null for empty history', () => {
      const lastFast = getLastFast([]);
      expect(lastFast).toBeNull();
    });
  });

  describe('getRecentFasts', () => {
    it('should return recent fasts in reverse order', () => {
      const history: FastEntry[] = [];
      for (let i = 0; i < 10; i++) {
        history.push({
          startedAt: `2024-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
          endedAt: `2024-01-${String(i + 1).padStart(2, '0')}T18:00:00Z`,
          duration: 8 * 60 * 60 * 1000,
          endedBy: testUser
        });
      }
      
      const recent = getRecentFasts(history, 5);
      expect(recent).toHaveLength(5);
      expect(recent[0]?.startedAt).toBe('2024-01-10T10:00:00Z'); // Most recent first
      expect(recent[4]?.startedAt).toBe('2024-01-06T10:00:00Z'); // 5th most recent
    });

    it('should handle fewer fasts than limit', () => {
      const history: FastEntry[] = [
        {
          startedAt: '2024-01-01T10:00:00Z',
          endedAt: '2024-01-01T18:00:00Z',
          duration: 8 * 60 * 60 * 1000,
          endedBy: testUser
        }
      ];
      
      const recent = getRecentFasts(history, 5);
      expect(recent).toHaveLength(1);
      expect(recent[0]?.startedAt).toBe('2024-01-01T10:00:00Z');
    });
  });

  describe('getWeeklyStatistics', () => {
    it('should calculate weekly statistics correctly', () => {
      const now = new Date();
      const startOfWeek = new Date(now);
      const dayOfWeek = startOfWeek.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startOfWeek.setDate(startOfWeek.getDate() - daysToMonday);
      startOfWeek.setHours(0, 0, 0, 0);
      
      // Create fasts in current week and previous week
      const thisWeekDay1 = new Date(startOfWeek.getTime() + 1 * 24 * 60 * 60 * 1000);
      const thisWeekDay2 = new Date(startOfWeek.getTime() + 3 * 24 * 60 * 60 * 1000);
      const lastWeekDay = new Date(startOfWeek.getTime() - 5 * 24 * 60 * 60 * 1000);
      
      const history: FastEntry[] = [
        {
          startedAt: lastWeekDay.toISOString(),
          endedAt: lastWeekDay.toISOString(),
          duration: 12 * 60 * 60 * 1000, // 12 hours
          endedBy: testUser
        },
        {
          startedAt: thisWeekDay1.toISOString(),
          endedAt: thisWeekDay1.toISOString(),
          duration: 16 * 60 * 60 * 1000, // 16 hours
          endedBy: testUser
        },
        {
          startedAt: thisWeekDay2.toISOString(),
          endedAt: thisWeekDay2.toISOString(),
          duration: 20 * 60 * 60 * 1000, // 20 hours
          endedBy: testUser
        }
      ];
      
      const stats = getWeeklyStatistics(history, 'UTC');
      
      expect(stats.totalFasts).toBe(2); // Only current week fasts
      expect(stats.totalHours).toBe(36); // 16 + 20 hours
      expect(stats.averageDuration).toBe(18 * 60 * 60 * 1000); // 18 hours average
      expect(stats.longestFast).toBe(20 * 60 * 60 * 1000); // 20 hours longest
    });

    it('should return zero stats for empty history', () => {
      const stats = getWeeklyStatistics([], 'UTC');
      
      expect(stats.totalFasts).toBe(0);
      expect(stats.totalHours).toBe(0);
      expect(stats.averageDuration).toBe(0);
      expect(stats.longestFast).toBe(0);
    });

    it('should return zero stats when no fasts this week', () => {
      const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const history: FastEntry[] = [
        {
          startedAt: lastMonth.toISOString(),
          endedAt: lastMonth.toISOString(),
          duration: 16 * 60 * 60 * 1000,
          endedBy: testUser
        }
      ];
      
      const stats = getWeeklyStatistics(history, 'UTC');
      
      expect(stats.totalFasts).toBe(0);
      expect(stats.totalHours).toBe(0);
      expect(stats.averageDuration).toBe(0);
      expect(stats.longestFast).toBe(0);
    });
  });

  describe('getMonthlyStatistics', () => {
    it('should calculate monthly statistics correctly', () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
      
      // Create fasts in current month and previous month
      const thisMonthDay1 = new Date(startOfMonth.getTime() + 5 * 24 * 60 * 60 * 1000);
      const thisMonthDay2 = new Date(startOfMonth.getTime() + 15 * 24 * 60 * 60 * 1000);
      
      const history: FastEntry[] = [
        {
          startedAt: lastMonth.toISOString(),
          endedAt: lastMonth.toISOString(),
          duration: 14 * 60 * 60 * 1000, // 14 hours
          endedBy: testUser
        },
        {
          startedAt: thisMonthDay1.toISOString(),
          endedAt: thisMonthDay1.toISOString(),
          duration: 18 * 60 * 60 * 1000, // 18 hours
          endedBy: testUser
        },
        {
          startedAt: thisMonthDay2.toISOString(),
          endedAt: thisMonthDay2.toISOString(),
          duration: 22 * 60 * 60 * 1000, // 22 hours
          endedBy: testUser
        }
      ];
      
      const stats = getMonthlyStatistics(history, 'UTC');
      
      expect(stats.totalFasts).toBe(2); // Only current month fasts
      expect(stats.totalHours).toBe(40); // 18 + 22 hours
      expect(stats.averageDuration).toBe(20 * 60 * 60 * 1000); // 20 hours average
      expect(stats.longestFast).toBe(22 * 60 * 60 * 1000); // 22 hours longest
    });

    it('should return zero stats for empty history', () => {
      const stats = getMonthlyStatistics([], 'UTC');
      
      expect(stats.totalFasts).toBe(0);
      expect(stats.totalHours).toBe(0);
      expect(stats.averageDuration).toBe(0);
      expect(stats.longestFast).toBe(0);
    });

    it('should return zero stats when no fasts this month', () => {
      const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      
      const history: FastEntry[] = [
        {
          startedAt: threeMonthsAgo.toISOString(),
          endedAt: threeMonthsAgo.toISOString(),
          duration: 16 * 60 * 60 * 1000,
          endedBy: testUser
        }
      ];
      
      const stats = getMonthlyStatistics(history, 'UTC');
      
      expect(stats.totalFasts).toBe(0);
      expect(stats.totalHours).toBe(0);
      expect(stats.averageDuration).toBe(0);
      expect(stats.longestFast).toBe(0);
    });

    it('should handle single fast in month', () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonthDay = new Date(startOfMonth.getTime() + 10 * 24 * 60 * 60 * 1000);
      
      const history: FastEntry[] = [
        {
          startedAt: thisMonthDay.toISOString(),
          endedAt: thisMonthDay.toISOString(),
          duration: 24 * 60 * 60 * 1000, // 24 hours
          endedBy: testUser
        }
      ];
      
      const stats = getMonthlyStatistics(history, 'UTC');
      
      expect(stats.totalFasts).toBe(1);
      expect(stats.totalHours).toBe(24);
      expect(stats.averageDuration).toBe(24 * 60 * 60 * 1000);
      expect(stats.longestFast).toBe(24 * 60 * 60 * 1000);
    });
  });
});