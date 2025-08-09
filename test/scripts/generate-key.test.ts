import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseArgs, validateExpiry } from '../../scripts/generate-key';

describe('parseArgs', () => {
  describe('valid arguments', () => {
    it('should parse valid name and expiry arguments', () => {
      const argv = ['--name', 'test-key', '--expiry', '2025-12-31'];
      const result = parseArgs(argv);
      
      expect(result.error).toBeUndefined();
      expect(result.args).toEqual({
        name: 'test-key',
        expiry: '2025-12-31',
        local: false
      });
    });

    it('should parse arguments with local flag', () => {
      const argv = ['--name', 'test-key', '--expiry', '2025-12-31', '--local'];
      const result = parseArgs(argv);
      
      expect(result.error).toBeUndefined();
      expect(result.args).toEqual({
        name: 'test-key',
        expiry: '2025-12-31',
        local: true
      });
    });

    it('should handle arguments in different order', () => {
      const argv = ['--expiry', '2025-12-31', '--local', '--name', 'test-key'];
      const result = parseArgs(argv);
      
      expect(result.error).toBeUndefined();
      expect(result.args).toEqual({
        name: 'test-key',
        expiry: '2025-12-31',
        local: true
      });
    });
  });

  describe('missing arguments', () => {
    it('should return error when name is missing', () => {
      const argv = ['--expiry', '2025-12-31'];
      const result = parseArgs(argv);
      
      expect(result.error).toBe('Error: --name is required');
      expect(result.args).toBeUndefined();
    });

    it('should return error when expiry is missing', () => {
      const argv = ['--name', 'test-key'];
      const result = parseArgs(argv);
      
      expect(result.error).toBe('Error: --expiry is required');
      expect(result.args).toBeUndefined();
    });

    it('should return error when both name and expiry are missing', () => {
      const argv: string[] = [];
      const result = parseArgs(argv);
      
      expect(result.error).toBe('Error: --name is required');
      expect(result.args).toBeUndefined();
    });
  });

  describe('empty argument values', () => {
    it('should return error when name value is missing', () => {
      const argv = ['--name', '--expiry', '2025-12-31'];
      const result = parseArgs(argv);
      
      expect(result.error).toBe('Error: --name is required');
      expect(result.args).toBeUndefined();
    });

    it('should return error when expiry value is missing', () => {
      const argv = ['--name', 'test-key', '--expiry'];
      const result = parseArgs(argv);
      
      expect(result.error).toBe('Error: --expiry is required');
      expect(result.args).toBeUndefined();
    });
  });

  describe('date validation integration', () => {
    it('should return error for invalid date format', () => {
      const argv = ['--name', 'test-key', '--expiry', 'invalid-date'];
      const result = parseArgs(argv);
      
      expect(result.error).toBe('Error: Invalid date format for --expiry. Use YYYY-MM-DD format.');
      expect(result.args).toBeUndefined();
    });

    it('should return error for past date', () => {
      const argv = ['--name', 'test-key', '--expiry', '2020-01-01'];
      const result = parseArgs(argv);
      
      expect(result.error).toBe('Error: Expiry date must be in the future');
      expect(result.args).toBeUndefined();
    });
  });
});

describe('validateExpiry', () => {
  beforeEach(() => {
    // Mock current date to make tests deterministic
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('valid dates', () => {
    it('should accept valid future date in YYYY-MM-DD format', () => {
      const result = validateExpiry('2025-12-31');
      expect(result).toBeNull();
    });

    it('should accept date far in the future', () => {
      const result = validateExpiry('2030-06-15');
      expect(result).toBeNull();
    });

    it('should accept date with different valid formats', () => {
      const result = validateExpiry('2025-02-28');
      expect(result).toBeNull();
    });
  });

  describe('invalid date formats', () => {
    it('should reject completely invalid date string', () => {
      const result = validateExpiry('not-a-date');
      expect(result).toBe('Error: Invalid date format for --expiry. Use YYYY-MM-DD format.');
    });

    it('should reject empty string', () => {
      const result = validateExpiry('');
      expect(result).toBe('Error: Invalid date format for --expiry. Use YYYY-MM-DD format.');
    });

    it('should reject invalid date values', () => {
      const result = validateExpiry('2025-13-45');
      expect(result).toBe('Error: Invalid date format for --expiry. Use YYYY-MM-DD format.');
    });
  });

  describe('past dates', () => {
    it('should reject date in the past', () => {
      const result = validateExpiry('2024-12-31');
      expect(result).toBe('Error: Expiry date must be in the future');
    });

    it('should reject current date (boundary case)', () => {
      const result = validateExpiry('2025-01-01');
      expect(result).toBe('Error: Expiry date must be in the future');
    });

    it('should reject very old dates', () => {
      const result = validateExpiry('2020-01-01');
      expect(result).toBe('Error: Expiry date must be in the future');
    });
  });
});

describe('CLI Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should handle valid CLI arguments end-to-end', () => {
    // Test the CLI parsing with valid arguments
    const result = parseArgs(['--name', 'integration-test', '--expiry', '2025-12-31', '--local']);
    
    expect(result.error).toBeUndefined();
    expect(result.args).toEqual({
      name: 'integration-test',
      expiry: '2025-12-31',
      local: true
    });
  });
});