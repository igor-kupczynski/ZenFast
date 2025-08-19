import { describe, test, expect } from 'vitest';
import { parseTimeAdjustment, validateTimelineConsistency, formatAdjustedTime } from '../src/time-adjustments';

describe('parseTimeAdjustment', () => {
  const baseTime = new Date('2024-01-15T10:00:00.000Z'); // Monday 10:00 UTC
  const timezone = 'Europe/Paris'; // UTC+1 in winter

  describe('relative time parsing', () => {
    test('parses negative hours correctly', () => {
      const result = parseTimeAdjustment('-2h', baseTime, timezone);
      
      expect(result.error).toBeUndefined();
      expect(result.adjustment).toBeDefined();
      expect(result.adjustment?.type).toBe('relative');
      expect(result.adjustment?.originalInput).toBe('-2h');
      
      const expectedTime = new Date('2024-01-15T08:00:00.000Z');
      expect(result.adjustment?.value.getTime()).toBe(expectedTime.getTime());
    });

    test('parses negative minutes correctly', () => {
      const result = parseTimeAdjustment('-30m', baseTime, timezone);
      
      expect(result.error).toBeUndefined();
      expect(result.adjustment).toBeDefined();
      expect(result.adjustment?.type).toBe('relative');
      
      const expectedTime = new Date('2024-01-15T09:30:00.000Z');
      expect(result.adjustment?.value.getTime()).toBe(expectedTime.getTime());
    });

    test('parses negative days correctly', () => {
      const result = parseTimeAdjustment('-1d', baseTime, timezone);
      
      expect(result.error).toBeUndefined();
      expect(result.adjustment).toBeDefined();
      expect(result.adjustment?.type).toBe('relative');
      
      const expectedTime = new Date('2024-01-14T10:00:00.000Z');
      expect(result.adjustment?.value.getTime()).toBe(expectedTime.getTime());
    });

    test('parses positive hours correctly', () => {
      const result = parseTimeAdjustment('+1h', baseTime, timezone);
      
      expect(result.error).toBeUndefined();
      expect(result.adjustment).toBeDefined();
      
      const expectedTime = new Date('2024-01-15T11:00:00.000Z');
      expect(result.adjustment?.value.getTime()).toBe(expectedTime.getTime());
    });

    test('defaults to negative when no sign provided', () => {
      const result = parseTimeAdjustment('2h', baseTime, timezone);
      
      expect(result.error).toBeUndefined();
      expect(result.adjustment).toBeDefined();
      
      const expectedTime = new Date('2024-01-15T08:00:00.000Z');
      expect(result.adjustment?.value.getTime()).toBe(expectedTime.getTime());
    });

    test('returns error for invalid amount', () => {
      const result = parseTimeAdjustment('-0h', baseTime, timezone);
      expect(result.error).toBe('Invalid time amount: -0h');
    });

    test('returns error for invalid unit', () => {
      const result = parseTimeAdjustment('-2x', baseTime, timezone);
      expect(result.error).toBe('Invalid time format: -2x. Use formats like: -2h, -30m, -1d, 14:00, 09:30');
    });
  });

  describe('absolute time parsing', () => {
    test('parses 24-hour time correctly', () => {
      const result = parseTimeAdjustment('14:30', baseTime, timezone);
      
      expect(result.error).toBeUndefined();
      expect(result.adjustment).toBeDefined();
      expect(result.adjustment?.type).toBe('absolute');
      expect(result.adjustment?.originalInput).toBe('14:30');
    });

    test('parses morning time correctly', () => {
      const result = parseTimeAdjustment('09:15', baseTime, timezone);
      
      expect(result.error).toBeUndefined();
      expect(result.adjustment).toBeDefined();
      expect(result.adjustment?.type).toBe('absolute');
    });

    test('returns error for invalid hour', () => {
      const result = parseTimeAdjustment('25:00', baseTime, timezone);
      expect(result.error).toBe('Invalid hour: 25. Must be 0-23');
    });

    test('returns error for invalid minutes', () => {
      const result = parseTimeAdjustment('14:60', baseTime, timezone);
      expect(result.error).toBe('Invalid minutes: 60. Must be 0-59');
    });
  });

  describe('error cases', () => {
    test('returns error for invalid format', () => {
      const result = parseTimeAdjustment('invalid', baseTime, timezone);
      expect(result.error).toBe('Invalid time format: invalid. Use formats like: -2h, -30m, -1d, 14:00, 09:30');
    });

    test('returns empty result for empty input', () => {
      const result = parseTimeAdjustment('', baseTime, timezone);
      expect(result.error).toBeUndefined();
      expect(result.adjustment).toBeUndefined();
    });

    test('returns empty result for whitespace input', () => {
      const result = parseTimeAdjustment('   ', baseTime, timezone);
      expect(result.error).toBeUndefined();
      expect(result.adjustment).toBeUndefined();
    });
  });
});

describe('validateTimelineConsistency', () => {
  const now = new Date('2024-01-15T10:00:00.000Z');
  const twoHoursAgo = new Date('2024-01-15T08:00:00.000Z');
  const twoHoursFuture = new Date('2024-01-15T12:00:00.000Z');
  const eightDaysAgo = new Date('2024-01-07T10:00:00.000Z');

  test('allows valid start time in the past', () => {
    const result = validateTimelineConsistency(twoHoursAgo, undefined, true, now);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('rejects future start time', () => {
    const result = validateTimelineConsistency(twoHoursFuture, undefined, true, now);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Cannot start a fast in the future');
  });

  test('rejects start time too far in the past', () => {
    const result = validateTimelineConsistency(eightDaysAgo, undefined, true, now);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Cannot start a fast more than 7 days ago');
  });

  test('allows valid end time after fast start', () => {
    const existingFast = { startedAt: twoHoursAgo.toISOString() };
    const result = validateTimelineConsistency(now, existingFast, false, now);
    expect(result.valid).toBe(true);
  });

  test('rejects end time before fast start', () => {
    const existingFast = { startedAt: now.toISOString() };
    const result = validateTimelineConsistency(twoHoursAgo, existingFast, false, now);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Cannot end a fast before it started');
  });

  test('rejects future end time', () => {
    const existingFast = { startedAt: twoHoursAgo.toISOString() };
    const result = validateTimelineConsistency(twoHoursFuture, existingFast, false, now);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Cannot end a fast in the future');
  });
});

describe('formatAdjustedTime', () => {
  const timezone = 'Europe/Paris';
  
  test('formats time in user timezone', () => {
    const adjustment = {
      type: 'absolute' as const,
      value: new Date('2024-01-15T14:30:00.000Z'),
      originalInput: '14:30'
    };
    
    const formatted = formatAdjustedTime(adjustment, timezone);
    // In Europe/Paris (UTC+1 in winter), 14:30 UTC = 15:30 local
    expect(formatted).toBe('15:30');
  });

  test('handles timezone formatting errors gracefully', () => {
    const adjustment = {
      type: 'relative' as const,
      value: new Date('2024-01-15T14:30:00.000Z'),
      originalInput: '-2h'
    };
    
    const formatted = formatAdjustedTime(adjustment, 'Invalid/Timezone');
    expect(formatted).toBe('14:30'); // Should fallback to UTC format
  });
});