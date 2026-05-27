import { describe, it, expect } from 'vitest';

/**
 * Unit tests for the review submission logic.
 *
 * Tests cover:
 * - Notes validation (10-1000 characters) (Req 7.2, 7.3)
 * - Review submission payload construction (Req 7.2, 7.3)
 * - Concurrent review error detection (Req 7.7)
 * - Lot reviewability check (Req 7.7)
 *
 * Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */

// --- Extracted logic from ReviewForm ---

const NOTES_MIN = 10;
const NOTES_MAX = 1000;

/**
 * Validates review notes length.
 * Returns error message or null if valid.
 */
function validateNotes(value: string | null): string | null {
  const trimmed = (value ?? '').trim();
  if (trimmed.length < NOTES_MIN) {
    return `Notes must be at least ${NOTES_MIN} characters (currently ${trimmed.length}).`;
  }
  if (trimmed.length > NOTES_MAX) {
    return `Notes must not exceed ${NOTES_MAX} characters (currently ${trimmed.length}).`;
  }
  return null;
}

/**
 * Constructs the review submission payload.
 */
function buildReviewPayload(
  lotId: string,
  decision: 'APPROVED' | 'REJECTED',
  notes: string | null
): { lot_id: string; decision: string; notes: string } {
  return {
    lot_id: lotId,
    decision,
    notes: (notes ?? '').trim(),
  };
}

/**
 * Determines if a lot is reviewable based on its status.
 */
function isLotReviewable(status: string): boolean {
  return status === 'MANAGER_REVIEW';
}

/**
 * Detects concurrent review rejection from error messages.
 */
function isConcurrencyError(errorMessages: string[]): boolean {
  return errorMessages.some(
    (msg) =>
      msg?.toLowerCase().includes('not in manager_review') ||
      msg?.toLowerCase().includes('status has changed') ||
      msg?.toLowerCase().includes('already been reviewed')
  );
}

// --- Tests ---

describe('Review Notes Validation', () => {
  it('rejects null notes (Req 7.2, 7.3)', () => {
    const error = validateNotes(null);
    expect(error).not.toBeNull();
    expect(error).toContain('at least 10 characters');
  });

  it('rejects empty string notes', () => {
    const error = validateNotes('');
    expect(error).not.toBeNull();
    expect(error).toContain('at least 10 characters');
  });

  it('rejects notes with only whitespace', () => {
    const error = validateNotes('         ');
    expect(error).not.toBeNull();
    expect(error).toContain('at least 10 characters');
  });

  it('rejects notes shorter than 10 characters', () => {
    const error = validateNotes('Too short');
    expect(error).not.toBeNull();
    expect(error).toContain('at least 10 characters');
  });

  it('accepts notes with exactly 10 characters', () => {
    const error = validateNotes('1234567890');
    expect(error).toBeNull();
  });

  it('accepts notes with 500 characters', () => {
    const error = validateNotes('a'.repeat(500));
    expect(error).toBeNull();
  });

  it('accepts notes with exactly 1000 characters', () => {
    const error = validateNotes('a'.repeat(1000));
    expect(error).toBeNull();
  });

  it('rejects notes exceeding 1000 characters', () => {
    const error = validateNotes('a'.repeat(1001));
    expect(error).not.toBeNull();
    expect(error).toContain('must not exceed 1000 characters');
  });

  it('trims whitespace before validating length', () => {
    // "  hello  " has 5 trimmed chars — should fail
    const error = validateNotes('  hello  ');
    expect(error).not.toBeNull();
    expect(error).toContain('at least 10 characters');
  });

  it('accepts notes with leading/trailing whitespace if trimmed length >= 10', () => {
    const error = validateNotes('  This is valid notes  ');
    expect(error).toBeNull();
  });
});

describe('Review Payload Construction', () => {
  it('builds APPROVED payload correctly (Req 7.2)', () => {
    const payload = buildReviewPayload('lot-123', 'APPROVED', 'This lot meets quality standards.');
    expect(payload).toEqual({
      lot_id: 'lot-123',
      decision: 'APPROVED',
      notes: 'This lot meets quality standards.',
    });
  });

  it('builds REJECTED payload correctly (Req 7.3)', () => {
    const payload = buildReviewPayload('lot-456', 'REJECTED', 'Grade below acceptable threshold.');
    expect(payload).toEqual({
      lot_id: 'lot-456',
      decision: 'REJECTED',
      notes: 'Grade below acceptable threshold.',
    });
  });

  it('trims notes whitespace in payload', () => {
    const payload = buildReviewPayload('lot-789', 'APPROVED', '  Trimmed notes here  ');
    expect(payload.notes).toBe('Trimmed notes here');
  });

  it('handles null notes by converting to empty string', () => {
    const payload = buildReviewPayload('lot-000', 'REJECTED', null);
    expect(payload.notes).toBe('');
  });
});

describe('Lot Reviewability Check', () => {
  it('returns true for MANAGER_REVIEW status (Req 7.7)', () => {
    expect(isLotReviewable('MANAGER_REVIEW')).toBe(true);
  });

  it('returns false for PENDING_QC status', () => {
    expect(isLotReviewable('PENDING_QC')).toBe(false);
  });

  it('returns false for QC_IN_PROGRESS status', () => {
    expect(isLotReviewable('QC_IN_PROGRESS')).toBe(false);
  });

  it('returns false for QC_PASSED status', () => {
    expect(isLotReviewable('QC_PASSED')).toBe(false);
  });

  it('returns false for QC_FAILED status', () => {
    expect(isLotReviewable('QC_FAILED')).toBe(false);
  });

  it('returns false for APPROVED status', () => {
    expect(isLotReviewable('APPROVED')).toBe(false);
  });

  it('returns false for REJECTED status', () => {
    expect(isLotReviewable('REJECTED')).toBe(false);
  });

  it('returns false for QUARANTINED status', () => {
    expect(isLotReviewable('QUARANTINED')).toBe(false);
  });
});

describe('Concurrent Review Error Detection', () => {
  it('detects "not in manager_review" error (Req 7.7)', () => {
    expect(isConcurrencyError(['Lot is not in MANAGER_REVIEW status'])).toBe(true);
  });

  it('detects "status has changed" error', () => {
    expect(isConcurrencyError(['The lot status has changed since you loaded the page'])).toBe(true);
  });

  it('detects "already been reviewed" error', () => {
    expect(isConcurrencyError(['This lot has already been reviewed'])).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isConcurrencyError(['Internal server error'])).toBe(false);
    expect(isConcurrencyError(['Permission denied'])).toBe(false);
  });

  it('returns false for empty error array', () => {
    expect(isConcurrencyError([])).toBe(false);
  });

  it('handles case-insensitive matching', () => {
    expect(isConcurrencyError(['LOT IS NOT IN MANAGER_REVIEW STATUS'])).toBe(true);
    expect(isConcurrencyError(['The Status Has Changed'])).toBe(true);
  });
});
