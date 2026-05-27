import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase server client
const mockSignInWithPassword = vi.fn();
const mockSignOut = vi.fn();
const mockGetUser = vi.fn();
const mockGetSession = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
      getUser: mockGetUser,
      getSession: mockGetSession,
    },
  })),
}));

// Mock auth-headers
vi.mock('@/lib/api/auth-headers', () => ({
  getAuthHeaders: vi.fn(async () => ({
    'Content-Type': 'application/json',
    Authorization: 'Bearer test-token',
  })),
  getDaasUrl: vi.fn(() => 'https://test.daas.buildpad.ai'),
}));

// Mock global fetch for DaaS calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { role: { name: 'operator' } } }),
    });
  });

  it('returns 400 when email or password is missing', async () => {
    const { POST } = await import('../login/route');

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: '', password: '' }),
    });

    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errors[0].message).toBe('Email and password are required');
  });

  it('returns generic error on invalid credentials (does not reveal email/password distinction)', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    });

    const { POST } = await import('../login/route');

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', password: 'wrong' }),
    });

    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(401);
    // Must NOT contain Supabase's specific error message
    expect(body.errors[0].message).not.toContain('Invalid login credentials');
    // Must use generic message
    expect(body.errors[0].message).toBe(
      'Invalid credentials. Please check your email and password.'
    );
  });

  it('returns user data with role on successful login', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {
        user: { id: 'user-123', email: 'operator@test.com' },
        session: { access_token: 'token-abc', expires_at: 1234567890 },
      },
      error: null,
    });

    const { POST } = await import('../login/route');

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'operator@test.com', password: 'correct' }),
    });

    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.user.id).toBe('user-123');
    expect(body.data.user.email).toBe('operator@test.com');
    expect(body.data.user.role).toBe('operator');
    expect(body.data.session.access_token).toBe('token-abc');
  });

  it('returns generic error on unexpected server errors', async () => {
    mockSignInWithPassword.mockRejectedValue(new Error('Connection refused'));

    const { POST } = await import('../login/route');

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', password: 'pass' }),
    });

    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(500);
    // Must NOT expose internal error details
    expect(body.errors[0].message).not.toContain('Connection refused');
    expect(body.errors[0].message).toBe(
      'Invalid credentials. Please check your email and password.'
    );
  });
});

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success on logout', async () => {
    mockSignOut.mockResolvedValue({ error: null });

    const { POST } = await import('../logout/route');

    const request = new Request('http://localhost/api/auth/logout', {
      method: 'POST',
    });

    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.message).toBe('Logged out successfully');
  });

  it('returns 500 on logout failure', async () => {
    mockSignOut.mockResolvedValue({ error: { message: 'Session not found' } });

    const { POST } = await import('../logout/route');

    const request = new Request('http://localhost/api/auth/logout', {
      method: 'POST',
    });

    const response = await POST(request as any);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.errors[0].message).toBe('Failed to logout');
  });
});

describe('GET /api/auth/session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no user is authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    const { GET } = await import('../session/route');

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.errors[0].message).toBe('Authentication required');
  });

  it('returns user session with role when authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-456',
          email: 'manager@test.com',
          user_metadata: { first_name: 'Jane', last_name: 'Doe' },
        },
      },
      error: null,
    });
    mockGetSession.mockResolvedValue({
      data: { session: { expires_at: 1234567890 } },
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          role: { name: 'qc_manager' },
          first_name: 'Jane',
          last_name: 'Doe',
        },
      }),
    });

    const { GET } = await import('../session/route');

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.user.id).toBe('user-456');
    expect(body.data.user.email).toBe('manager@test.com');
    expect(body.data.user.role).toBe('qc_manager');
    expect(body.data.user.first_name).toBe('Jane');
    expect(body.data.user.last_name).toBe('Doe');
    expect(body.data.session.expires_at).toBe(1234567890);
  });

  it('returns session without role when DaaS is unavailable', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-789',
          email: 'admin@test.com',
          user_metadata: { first_name: 'Admin' },
        },
      },
      error: null,
    });
    mockGetSession.mockResolvedValue({
      data: { session: { expires_at: 9999999999 } },
    });
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { GET } = await import('../session/route');

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.user.id).toBe('user-789');
    expect(body.data.user.role).toBeNull();
    expect(body.data.user.first_name).toBe('Admin');
  });

  it('returns 401 and signs out when user is deactivated (status=suspended)', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-deactivated',
          email: 'deactivated@test.com',
          user_metadata: { first_name: 'Deactivated' },
        },
      },
      error: null,
    });
    mockGetSession.mockResolvedValue({
      data: { session: { expires_at: 1234567890 } },
    });
    mockSignOut.mockResolvedValue({ error: null });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          role: { name: 'operator' },
          first_name: 'Deactivated',
          last_name: 'User',
          status: 'suspended',
        },
      }),
    });

    const { GET } = await import('../session/route');

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.errors[0].message).toBe('Authentication required');
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('returns 401 and signs out when user is terminated', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-terminated',
          email: 'terminated@test.com',
          user_metadata: {},
        },
      },
      error: null,
    });
    mockGetSession.mockResolvedValue({
      data: { session: { expires_at: 1234567890 } },
    });
    mockSignOut.mockResolvedValue({ error: null });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          role: { name: 'qc_manager' },
          first_name: 'Terminated',
          last_name: 'User',
          status: 'terminated',
        },
      }),
    });

    const { GET } = await import('../session/route');

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.errors[0].message).toBe('Authentication required');
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('returns valid session when user status is active', async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-active',
          email: 'active@test.com',
          user_metadata: { first_name: 'Active' },
        },
      },
      error: null,
    });
    mockGetSession.mockResolvedValue({
      data: { session: { expires_at: 1234567890 } },
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          role: { name: 'admin' },
          first_name: 'Active',
          last_name: 'User',
          status: 'active',
        },
      }),
    });

    const { GET } = await import('../session/route');

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.user.id).toBe('user-active');
    expect(body.data.user.role).toBe('admin');
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('reflects role change immediately without re-authentication (Requirement 9.6)', async () => {
    // Simulate a user whose role was changed from operator to qc_manager by an Admin.
    // The session route fetches role from DaaS on every call (no caching),
    // so the updated role is returned on the next request.
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'user-role-changed',
          email: 'promoted@test.com',
          user_metadata: { first_name: 'Promoted' },
        },
      },
      error: null,
    });
    mockGetSession.mockResolvedValue({
      data: { session: { expires_at: 1234567890 } },
    });

    // First call: user has operator role
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          role: { name: 'operator' },
          first_name: 'Promoted',
          last_name: 'User',
          status: 'active',
        },
      }),
    });

    const { GET } = await import('../session/route');

    const response1 = await GET();
    const body1 = await response1.json();

    expect(response1.status).toBe(200);
    expect(body1.data.user.role).toBe('operator');

    // Second call: Admin has changed the user's role to qc_manager in DaaS.
    // The session route fetches fresh role data — no re-auth needed.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          role: { name: 'qc_manager' },
          first_name: 'Promoted',
          last_name: 'User',
          status: 'active',
        },
      }),
    });

    const response2 = await GET();
    const body2 = await response2.json();

    expect(response2.status).toBe(200);
    expect(body2.data.user.role).toBe('qc_manager');
    // Same user, same session — role updated without re-authentication
    expect(body2.data.user.id).toBe('user-role-changed');
  });
});
