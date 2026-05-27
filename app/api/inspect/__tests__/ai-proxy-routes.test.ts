import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Supabase server client
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

// Mock ai-service-config
const mockGetAiServiceConfig = vi.fn();
vi.mock('@/lib/api/ai-service-config', () => ({
  getAiServiceConfig: () => mockGetAiServiceConfig(),
}));

// Mock global fetch for AI service calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Helper to create authenticated state
function setAuthenticated() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: 'user-123', email: 'operator@test.com' } },
    error: null,
  });
}

function setUnauthenticated() {
  mockGetUser.mockResolvedValue({
    data: { user: null },
    error: { message: 'Not authenticated' },
  });
}

function setDefaultConfig() {
  mockGetAiServiceConfig.mockResolvedValue({
    aiServiceUrl: 'https://ai.example.com',
    timeoutMs: 5000,
  });
}

describe('POST /api/inspect/fruit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthenticated();
    setDefaultConfig();
  });

  it('returns 401 when user is not authenticated', async () => {
    setUnauthenticated();

    const { POST } = await import('../fruit/route');
    const request = new NextRequest('http://localhost/api/inspect/fruit', {
      method: 'POST',
      body: JSON.stringify({ image_base64: 'abc', material_type: 'RAW_FRUIT' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.errors[0].message).toBe('Authentication required');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid JSON body', async () => {
    const { POST } = await import('../fruit/route');
    const request = new NextRequest('http://localhost/api/inspect/fruit', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'text/plain' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errors[0].message).toBe('Invalid JSON request body');
  });

  it('proxies request to AI service and returns data on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        grade: 'A',
        confidence: 0.95,
        defects_found: [],
        annotated_image_base64: 'annotated_abc',
      }),
    });

    const { POST } = await import('../fruit/route');
    const request = new NextRequest('http://localhost/api/inspect/fruit', {
      method: 'POST',
      body: JSON.stringify({ image_base64: 'abc', material_type: 'RAW_FRUIT' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.grade).toBe('A');
    expect(body.data.confidence).toBe(0.95);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://ai.example.com/api/inspect/fruit',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('returns 502 when AI service returns non-200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    const { POST } = await import('../fruit/route');
    const request = new NextRequest('http://localhost/api/inspect/fruit', {
      method: 'POST',
      body: JSON.stringify({ image_base64: 'abc', material_type: 'RAW_FRUIT' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.errors[0].message).toBe('AI service returned HTTP 500');
    expect(body.errors[0].details).toBe('Internal Server Error');
  });

  it('returns 504 when AI service times out', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValueOnce(abortError);

    const { POST } = await import('../fruit/route');
    const request = new NextRequest('http://localhost/api/inspect/fruit', {
      method: 'POST',
      body: JSON.stringify({ image_base64: 'abc', material_type: 'RAW_FRUIT' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(504);
    expect(body.errors[0].message).toBe('AI service timeout after 5000ms');
  });

  it('returns 502 when AI service is unreachable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const { POST } = await import('../fruit/route');
    const request = new NextRequest('http://localhost/api/inspect/fruit', {
      method: 'POST',
      body: JSON.stringify({ image_base64: 'abc', material_type: 'RAW_FRUIT' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.errors[0].message).toBe('AI service unreachable');
    expect(body.errors[0].details).toBe('ECONNREFUSED');
  });

  it('returns 502 with TLS error message when certificate validation fails', async () => {
    const tlsError = new Error('CERT_HAS_EXPIRED') as NodeJS.ErrnoException;
    tlsError.code = 'CERT_HAS_EXPIRED';
    mockFetch.mockRejectedValueOnce(tlsError);

    const { POST } = await import('../fruit/route');
    const request = new NextRequest('http://localhost/api/inspect/fruit', {
      method: 'POST',
      body: JSON.stringify({ image_base64: 'abc', material_type: 'RAW_FRUIT' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.errors[0].message).toBe('AI service TLS certificate validation failed');
    expect(body.errors[0].details).toContain('CERT_HAS_EXPIRED');
  });

  it('returns 502 with TLS error for self-signed certificate', async () => {
    const tlsError = new Error('DEPTH_ZERO_SELF_SIGNED_CERT') as NodeJS.ErrnoException;
    tlsError.code = 'DEPTH_ZERO_SELF_SIGNED_CERT';
    mockFetch.mockRejectedValueOnce(tlsError);

    const { POST } = await import('../fruit/route');
    const request = new NextRequest('http://localhost/api/inspect/fruit', {
      method: 'POST',
      body: JSON.stringify({ image_base64: 'abc', material_type: 'RAW_FRUIT' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.errors[0].message).toBe('AI service TLS certificate validation failed');
    expect(body.errors[0].details).toContain('DEPTH_ZERO_SELF_SIGNED_CERT');
  });

  it('uses configurable timeout from system_config', async () => {
    mockGetAiServiceConfig.mockResolvedValue({
      aiServiceUrl: 'https://custom-ai.example.com',
      timeoutMs: 10000,
    });

    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValueOnce(abortError);

    const { POST } = await import('../fruit/route');
    const request = new NextRequest('http://localhost/api/inspect/fruit', {
      method: 'POST',
      body: JSON.stringify({ image_base64: 'abc', material_type: 'RAW_FRUIT' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(504);
    expect(body.errors[0].message).toBe('AI service timeout after 10000ms');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://custom-ai.example.com/api/inspect/fruit',
      expect.anything()
    );
  });
});

describe('POST /api/inspect/powder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthenticated();
    setDefaultConfig();
  });

  it('returns 401 when user is not authenticated', async () => {
    setUnauthenticated();

    const { POST } = await import('../powder/route');
    const request = new NextRequest('http://localhost/api/inspect/powder', {
      method: 'POST',
      body: JSON.stringify({ image_base64: 'abc', material_name: 'Turmeric' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.errors[0].message).toBe('Authentication required');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid JSON body', async () => {
    const { POST } = await import('../powder/route');
    const request = new NextRequest('http://localhost/api/inspect/powder', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'text/plain' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errors[0].message).toBe('Invalid JSON request body');
  });

  it('proxies request to AI service and returns data on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        grade: 'B',
        confidence: 0.88,
        color_score: 12.5,
        color_analysis: { hue: 45, saturation: 80 },
        annotated_image_base64: 'annotated_xyz',
      }),
    });

    const { POST } = await import('../powder/route');
    const request = new NextRequest('http://localhost/api/inspect/powder', {
      method: 'POST',
      body: JSON.stringify({ image_base64: 'abc', material_name: 'Turmeric' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.grade).toBe('B');
    expect(body.data.confidence).toBe(0.88);
    expect(body.data.color_score).toBe(12.5);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://ai.example.com/api/inspect/powder',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('returns 502 when AI service returns non-200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: async () => 'Unprocessable Entity',
    });

    const { POST } = await import('../powder/route');
    const request = new NextRequest('http://localhost/api/inspect/powder', {
      method: 'POST',
      body: JSON.stringify({ image_base64: 'abc', material_name: 'Turmeric' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.errors[0].message).toBe('AI service returned HTTP 422');
    expect(body.errors[0].details).toBe('Unprocessable Entity');
  });

  it('returns 504 when AI service times out', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValueOnce(abortError);

    const { POST } = await import('../powder/route');
    const request = new NextRequest('http://localhost/api/inspect/powder', {
      method: 'POST',
      body: JSON.stringify({ image_base64: 'abc', material_name: 'Turmeric' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(504);
    expect(body.errors[0].message).toBe('AI service timeout after 5000ms');
  });

  it('returns 502 when AI service is unreachable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ENOTFOUND'));

    const { POST } = await import('../powder/route');
    const request = new NextRequest('http://localhost/api/inspect/powder', {
      method: 'POST',
      body: JSON.stringify({ image_base64: 'abc', material_name: 'Turmeric' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.errors[0].message).toBe('AI service unreachable');
    expect(body.errors[0].details).toBe('ENOTFOUND');
  });

  it('returns 502 with TLS error message when certificate validation fails', async () => {
    const tlsError = new Error('UNABLE_TO_VERIFY_LEAF_SIGNATURE') as NodeJS.ErrnoException;
    tlsError.code = 'UNABLE_TO_VERIFY_LEAF_SIGNATURE';
    mockFetch.mockRejectedValueOnce(tlsError);

    const { POST } = await import('../powder/route');
    const request = new NextRequest('http://localhost/api/inspect/powder', {
      method: 'POST',
      body: JSON.stringify({ image_base64: 'abc', material_name: 'Turmeric' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.errors[0].message).toBe('AI service TLS certificate validation failed');
    expect(body.errors[0].details).toContain('UNABLE_TO_VERIFY_LEAF_SIGNATURE');
  });

  it('returns 502 with TLS error for self-signed cert in chain', async () => {
    const tlsError = new Error('SELF_SIGNED_CERT_IN_CHAIN') as NodeJS.ErrnoException;
    tlsError.code = 'SELF_SIGNED_CERT_IN_CHAIN';
    mockFetch.mockRejectedValueOnce(tlsError);

    const { POST } = await import('../powder/route');
    const request = new NextRequest('http://localhost/api/inspect/powder', {
      method: 'POST',
      body: JSON.stringify({ image_base64: 'abc', material_name: 'Turmeric' }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.errors[0].message).toBe('AI service TLS certificate validation failed');
    expect(body.errors[0].details).toContain('SELF_SIGNED_CERT_IN_CHAIN');
  });
});

describe('GET /api/inspect/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setAuthenticated();
    setDefaultConfig();
  });

  it('returns 401 when user is not authenticated', async () => {
    setUnauthenticated();

    const { GET } = await import('../health/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.errors[0].message).toBe('Authentication required');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('proxies request to AI service health endpoint and returns data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'healthy',
        model_loaded: true,
        version: '1.0.0',
      }),
    });

    const { GET } = await import('../health/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.status).toBe('healthy');
    expect(body.data.model_loaded).toBe(true);
    expect(body.data.version).toBe('1.0.0');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://ai.example.com/api/health',
      expect.objectContaining({
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
    );
  });

  it('returns 502 when AI service returns non-200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => 'Service Unavailable',
    });

    const { GET } = await import('../health/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.errors[0].message).toBe('AI service returned HTTP 503');
    expect(body.errors[0].details).toBe('Service Unavailable');
  });

  it('returns 504 when AI service times out', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValueOnce(abortError);

    const { GET } = await import('../health/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(504);
    expect(body.errors[0].message).toBe('AI service timeout after 5000ms');
  });

  it('returns 502 when AI service is unreachable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const { GET } = await import('../health/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.errors[0].message).toBe('AI service unreachable');
    expect(body.errors[0].details).toBe('ECONNREFUSED');
  });

  it('returns 500 on internal proxy error', async () => {
    mockGetAiServiceConfig.mockRejectedValue(new Error('Config fetch failed'));

    const { GET } = await import('../health/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.errors[0].message).toBe('Internal proxy error');
    expect(body.errors[0].details).toBe('Config fetch failed');
  });
});
