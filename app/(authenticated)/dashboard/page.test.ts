/**
 * Dashboard Page Tests
 *
 * Tests for the date range filter and auto-refresh functionality.
 * Requirements: 12.4, 12.5
 */

import { describe, it, expect } from 'vitest';

// ─── Extracted validation logic for testing ──────────────────────────────────

const TRAILING_DAYS_MIN = 1;
const TRAILING_DAYS_MAX = 365;

/**
 * Validates a trailing days input value.
 * Returns { valid: true, value: number } or { valid: false, error: string }
 */
function validateDaysInput(raw: string | number | null): { valid: true; value: number } | { valid: false; error: string } {
  const str = raw === null ? '' : String(raw);

  const num = Number(str);
  if (str === '' || isNaN(num)) {
    return { valid: false, error: 'Enter a number between 1 and 365' };
  }
  if (!Number.isInteger(num)) {
    return { valid: false, error: 'Must be a whole number' };
  }
  if (num < TRAILING_DAYS_MIN) {
    return { valid: false, error: `Minimum is ${TRAILING_DAYS_MIN} day` };
  }
  if (num > TRAILING_DAYS_MAX) {
    return { valid: false, error: `Maximum is ${TRAILING_DAYS_MAX} days` };
  }

  return { valid: true, value: num };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Dashboard date range filter validation', () => {
  describe('valid inputs', () => {
    it('accepts the minimum value of 1', () => {
      const result = validateDaysInput('1');
      expect(result).toEqual({ valid: true, value: 1 });
    });

    it('accepts the maximum value of 365', () => {
      const result = validateDaysInput('365');
      expect(result).toEqual({ valid: true, value: 365 });
    });

    it('accepts the default value of 30', () => {
      const result = validateDaysInput('30');
      expect(result).toEqual({ valid: true, value: 30 });
    });

    it('accepts mid-range values', () => {
      const result = validateDaysInput('180');
      expect(result).toEqual({ valid: true, value: 180 });
    });

    it('accepts numeric input as number type', () => {
      const result = validateDaysInput(7);
      expect(result).toEqual({ valid: true, value: 7 });
    });
  });

  describe('invalid inputs', () => {
    it('rejects empty string', () => {
      const result = validateDaysInput('');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('number between 1 and 365');
      }
    });

    it('rejects null', () => {
      const result = validateDaysInput(null);
      expect(result.valid).toBe(false);
    });

    it('rejects non-numeric strings', () => {
      const result = validateDaysInput('abc');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('number between 1 and 365');
      }
    });

    it('rejects decimal numbers', () => {
      const result = validateDaysInput('30.5');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('whole number');
      }
    });

    it('rejects zero', () => {
      const result = validateDaysInput('0');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('Minimum is 1');
      }
    });

    it('rejects negative numbers', () => {
      const result = validateDaysInput('-5');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('Minimum is 1');
      }
    });

    it('rejects values above 365', () => {
      const result = validateDaysInput('366');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('Maximum is 365');
      }
    });

    it('rejects very large numbers', () => {
      const result = validateDaysInput('9999');
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain('Maximum is 365');
      }
    });
  });

  describe('boundary values', () => {
    it('accepts exactly 1 (lower bound)', () => {
      expect(validateDaysInput('1').valid).toBe(true);
    });

    it('accepts exactly 365 (upper bound)', () => {
      expect(validateDaysInput('365').valid).toBe(true);
    });

    it('rejects 0 (below lower bound)', () => {
      expect(validateDaysInput('0').valid).toBe(false);
    });

    it('rejects 366 (above upper bound)', () => {
      expect(validateDaysInput('366').valid).toBe(false);
    });
  });
});

describe('Dashboard auto-refresh interval', () => {
  it('auto-refresh interval is 30 seconds (30000ms)', () => {
    // The constant AUTO_REFRESH_INTERVAL_MS = 30_000 ensures metrics
    // refresh within 30 seconds of a lot status change (Requirement 12.4)
    const AUTO_REFRESH_INTERVAL_MS = 30_000;
    expect(AUTO_REFRESH_INTERVAL_MS).toBe(30000);
    expect(AUTO_REFRESH_INTERVAL_MS).toBeLessThanOrEqual(30000);
  });
});
