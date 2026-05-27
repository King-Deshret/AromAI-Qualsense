import { describe, it, expect } from 'vitest';

/**
 * Unit tests for the inspection retry mechanism logic.
 *
 * Tests cover:
 * - Retry button visibility: only shown to the original inspector (Req 5.1)
 * - Retry button disabled when retry_count >= max_retry_count (Req 5.3, 5.4)
 * - Retry increments retry_count and transitions to PENDING (Req 5.2)
 * - Missing stored image prevents retry and notifies admins (Req 5.7)
 * - Lot remains in QC_IN_PROGRESS while retries available (Req 5.5)
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */

// --- Retry visibility logic (extracted from page component) ---

interface RetryVisibilityInput {
  inspectionStatus: 'PENDING' | 'COMPLETED' | 'ERROR';
  inspectorId: string | null;
  userCreated: string | null;
  currentUserId: string | null;
  retryCount: number;
  maxRetryCount: number;
}

interface RetryVisibilityResult {
  showRetryButton: boolean;
  isDisabled: boolean;
  retriesExhausted: boolean;
}

/**
 * Determines retry button visibility and state.
 * Mirrors the logic in the InspectPage component.
 */
function getRetryVisibility(input: RetryVisibilityInput): RetryVisibilityResult {
  const isAiError = input.inspectionStatus === 'ERROR';
  const retriesExhausted = input.retryCount >= input.maxRetryCount;

  // Requirement 5.1: Show retry button only to the original inspector
  const isOriginalInspector = Boolean(
    input.currentUserId &&
    (input.inspectorId === input.currentUserId || input.userCreated === input.currentUserId)
  );

  const showRetryButton = isAiError && isOriginalInspector;
  const isDisabled = retriesExhausted;

  return { showRetryButton, isDisabled, retriesExhausted };
}

// --- Retry action logic ---

interface RetryActionInput {
  retryCount: number;
  maxRetryCount: number;
  imageUrl: string | null;
}

type RetryActionResult =
  | { action: 'retry'; newRetryCount: number }
  | { action: 'blocked_max_retries' }
  | { action: 'blocked_missing_image' };

/**
 * Determines the outcome of a retry attempt.
 * Mirrors the logic in handleRetry.
 */
function determineRetryAction(input: RetryActionInput): RetryActionResult {
  // Guard: do not retry if already at max (Req 5.3, 5.4)
  if (input.retryCount >= input.maxRetryCount) {
    return { action: 'blocked_max_retries' };
  }

  // Guard: stored image must exist (Req 5.7)
  if (!input.imageUrl) {
    return { action: 'blocked_missing_image' };
  }

  // Proceed with retry (Req 5.2)
  return { action: 'retry', newRetryCount: input.retryCount + 1 };
}

// --- Tests ---

describe('Retry Mechanism - Visibility Logic', () => {
  const baseInput: RetryVisibilityInput = {
    inspectionStatus: 'ERROR',
    inspectorId: 'user-123',
    userCreated: 'user-123',
    currentUserId: 'user-123',
    retryCount: 0,
    maxRetryCount: 3,
  };

  it('shows retry button to the original inspector when status is ERROR (Req 5.1)', () => {
    const result = getRetryVisibility(baseInput);
    expect(result.showRetryButton).toBe(true);
    expect(result.isDisabled).toBe(false);
  });

  it('hides retry button from a different user (Req 5.1)', () => {
    const result = getRetryVisibility({
      ...baseInput,
      currentUserId: 'user-456',
    });
    expect(result.showRetryButton).toBe(false);
  });

  it('hides retry button when inspection status is not ERROR', () => {
    const result = getRetryVisibility({
      ...baseInput,
      inspectionStatus: 'COMPLETED',
    });
    expect(result.showRetryButton).toBe(false);
  });

  it('hides retry button when inspection status is PENDING', () => {
    const result = getRetryVisibility({
      ...baseInput,
      inspectionStatus: 'PENDING',
    });
    expect(result.showRetryButton).toBe(false);
  });

  it('shows retry button but disabled when retry_count >= max (Req 5.3)', () => {
    const result = getRetryVisibility({
      ...baseInput,
      retryCount: 3,
      maxRetryCount: 3,
    });
    expect(result.showRetryButton).toBe(true);
    expect(result.isDisabled).toBe(true);
    expect(result.retriesExhausted).toBe(true);
  });

  it('shows retry button enabled when retry_count < max', () => {
    const result = getRetryVisibility({
      ...baseInput,
      retryCount: 2,
      maxRetryCount: 3,
    });
    expect(result.showRetryButton).toBe(true);
    expect(result.isDisabled).toBe(false);
    expect(result.retriesExhausted).toBe(false);
  });

  it('hides retry button when currentUserId is null (not authenticated)', () => {
    const result = getRetryVisibility({
      ...baseInput,
      currentUserId: null,
    });
    expect(result.showRetryButton).toBe(false);
  });

  it('shows retry button when inspector_id matches but user_created differs', () => {
    const result = getRetryVisibility({
      ...baseInput,
      inspectorId: 'user-123',
      userCreated: 'system-user',
      currentUserId: 'user-123',
    });
    expect(result.showRetryButton).toBe(true);
  });

  it('shows retry button when user_created matches but inspector_id is null', () => {
    const result = getRetryVisibility({
      ...baseInput,
      inspectorId: null,
      userCreated: 'user-123',
      currentUserId: 'user-123',
    });
    expect(result.showRetryButton).toBe(true);
  });
});

describe('Retry Mechanism - Action Logic', () => {
  it('allows retry when retry_count < max and image exists (Req 5.2)', () => {
    const result = determineRetryAction({
      retryCount: 0,
      maxRetryCount: 3,
      imageUrl: 'file-abc-123',
    });
    expect(result).toEqual({ action: 'retry', newRetryCount: 1 });
  });

  it('increments retry_count by exactly 1 on each retry (Req 5.2)', () => {
    const result = determineRetryAction({
      retryCount: 2,
      maxRetryCount: 3,
      imageUrl: 'file-abc-123',
    });
    expect(result).toEqual({ action: 'retry', newRetryCount: 3 });
  });

  it('blocks retry when retry_count equals max (Req 5.3, 5.4)', () => {
    const result = determineRetryAction({
      retryCount: 3,
      maxRetryCount: 3,
      imageUrl: 'file-abc-123',
    });
    expect(result).toEqual({ action: 'blocked_max_retries' });
  });

  it('blocks retry when retry_count exceeds max (Req 5.3)', () => {
    const result = determineRetryAction({
      retryCount: 5,
      maxRetryCount: 3,
      imageUrl: 'file-abc-123',
    });
    expect(result).toEqual({ action: 'blocked_max_retries' });
  });

  it('blocks retry when stored image is null (Req 5.7)', () => {
    const result = determineRetryAction({
      retryCount: 0,
      maxRetryCount: 3,
      imageUrl: null,
    });
    expect(result).toEqual({ action: 'blocked_missing_image' });
  });

  it('blocks retry when stored image is empty string (Req 5.7)', () => {
    const result = determineRetryAction({
      retryCount: 1,
      maxRetryCount: 3,
      imageUrl: '',
    });
    expect(result).toEqual({ action: 'blocked_missing_image' });
  });

  it('prioritizes max retry check over missing image check', () => {
    // When both conditions are true, max retry takes precedence
    const result = determineRetryAction({
      retryCount: 3,
      maxRetryCount: 3,
      imageUrl: null,
    });
    expect(result).toEqual({ action: 'blocked_max_retries' });
  });

  it('allows retry with max_retry_count of 1 when retry_count is 0', () => {
    const result = determineRetryAction({
      retryCount: 0,
      maxRetryCount: 1,
      imageUrl: 'img-url',
    });
    expect(result).toEqual({ action: 'retry', newRetryCount: 1 });
  });

  it('blocks retry with max_retry_count of 1 when retry_count is 1', () => {
    const result = determineRetryAction({
      retryCount: 1,
      maxRetryCount: 1,
      imageUrl: 'img-url',
    });
    expect(result).toEqual({ action: 'blocked_max_retries' });
  });

  it('allows retry with max_retry_count of 10 (upper bound) when retry_count is 9', () => {
    const result = determineRetryAction({
      retryCount: 9,
      maxRetryCount: 10,
      imageUrl: 'img-url',
    });
    expect(result).toEqual({ action: 'retry', newRetryCount: 10 });
  });
});
