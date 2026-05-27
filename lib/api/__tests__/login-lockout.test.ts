import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock auth-headers
vi.mock('@/lib/api/auth-headers', () => ({
  getDaasUrl: vi.fn(() => 'https://test.daas.buildpad.ai'),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock env
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

describe('login-lockout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkLockout', () => {
    it('returns locked=false when no failed attempts exist', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const { checkLockout } = await import('../login-lockout');
      const result = await checkLockout('user@example.com');

      expect(result.locked).toBe(false);
    });

    it('returns locked=false when fewer than 5 failed attempts in window', async () => {
      const now = new Date();
      const attempts = Array.from({ length: 4 }, (_, i) => ({
        id: `id-${i}`,
        email: 'user@example.com',
        attempted_at: new Date(now.getTime() - i * 60000).toISOString(),
        success: false,
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: attempts }),
      });

      const { checkLockout } = await import('../login-lockout');
      const result = await checkLockout('user@example.com');

      expect(result.locked).toBe(false);
    });

    it('returns locked=true with retryAfter when 5+ failed attempts in window', async () => {
      vi.setSystemTime(new Date('2024-01-15T10:15:00Z'));

      const attempts = Array.from({ length: 5 }, (_, i) => ({
        id: `id-${i}`,
        email: 'user@example.com',
        // Most recent attempt at 10:14, then 10:13, etc.
        attempted_at: new Date(
          new Date('2024-01-15T10:14:00Z').getTime() - i * 60000
        ).toISOString(),
        success: false,
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: attempts }),
      });

      const { checkLockout } = await import('../login-lockout');
      const result = await checkLockout('user@example.com');

      expect(result.locked).toBe(true);
      expect(result.retryAfter).toBeGreaterThan(0);
      // Lockout expires 15 min after most recent attempt (10:14 + 15 = 10:29)
      // Current time is 10:15, so retryAfter should be ~14 minutes (840 seconds)
      expect(result.retryAfter).toBe(840);
      expect(result.message).toContain('temporarily locked');
    });

    it('normalizes email to lowercase for comparison', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const { checkLockout } = await import('../login-lockout');
      await checkLockout('User@EXAMPLE.com');

      const fetchCall = mockFetch.mock.calls[0];
      const url = fetchCall[0] as string;
      expect(url).toContain('user%40example.com');
    });

    it('returns locked=false (fail open) when DaaS is unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { checkLockout } = await import('../login-lockout');
      const result = await checkLockout('user@example.com');

      expect(result.locked).toBe(false);
    });

    it('returns locked=false when DaaS returns non-200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { checkLockout } = await import('../login-lockout');
      const result = await checkLockout('user@example.com');

      expect(result.locked).toBe(false);
    });
  });

  describe('recordLoginAttempt', () => {
    it('records a failed login attempt', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const { recordLoginAttempt } = await import('../login-lockout');
      await recordLoginAttempt('user@example.com', false);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(
        'https://test.daas.buildpad.ai/api/items/login_attempts'
      );
      expect(options.method).toBe('POST');
      const body = JSON.parse(options.body);
      expect(body.email).toBe('user@example.com');
      expect(body.success).toBe(false);
      expect(body.attempted_at).toBeDefined();
    });

    it('records a successful login attempt', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const { recordLoginAttempt } = await import('../login-lockout');
      await recordLoginAttempt('user@example.com', true);

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.success).toBe(true);
    });

    it('does not throw when DaaS is unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { recordLoginAttempt } = await import('../login-lockout');
      // Should not throw
      await expect(
        recordLoginAttempt('user@example.com', false)
      ).resolves.toBeUndefined();
    });
  });

  describe('clearFailedAttempts', () => {
    it('deletes all failed attempts for the email', async () => {
      // First call: query failed attempts
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 'id-1' }, { id: 'id-2' }, { id: 'id-3' }],
        }),
      });
      // Second call: delete
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const { clearFailedAttempts } = await import('../login-lockout');
      await clearFailedAttempts('user@example.com');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      // Verify delete call
      const [url, options] = mockFetch.mock.calls[1];
      expect(url).toBe(
        'https://test.daas.buildpad.ai/api/items/login_attempts'
      );
      expect(options.method).toBe('DELETE');
      const body = JSON.parse(options.body);
      expect(body).toEqual(['id-1', 'id-2', 'id-3']);
    });

    it('does nothing when no failed attempts exist', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const { clearFailedAttempts } = await import('../login-lockout');
      await clearFailedAttempts('user@example.com');

      // Only the query call, no delete
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('does not throw when DaaS is unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { clearFailedAttempts } = await import('../login-lockout');
      await expect(
        clearFailedAttempts('user@example.com')
      ).resolves.toBeUndefined();
    });
  });

  describe('LOCKOUT_CONFIG', () => {
    it('exports correct lockout configuration constants', async () => {
      const { LOCKOUT_CONFIG } = await import('../login-lockout');
      expect(LOCKOUT_CONFIG.MAX_FAILED_ATTEMPTS).toBe(5);
      expect(LOCKOUT_CONFIG.LOCKOUT_WINDOW_MINUTES).toBe(15);
    });
  });
});
