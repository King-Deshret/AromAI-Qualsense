import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock auth-headers
vi.mock('@/lib/api/auth-headers', () => ({
  getAuthHeaders: vi.fn(async () => ({
    'Content-Type': 'application/json',
    Authorization: 'Bearer test-token',
  })),
  getDaaSUrl: vi.fn(() => 'https://test.daas.buildpad.ai'),
}));

// Mock global fetch for DaaS calls
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('GET /api/export/inspections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns CSV with correct headers and data', async () => {
    // Mock count response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ count: { id: '2' } }] }),
    });

    // Mock data response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'insp-1',
            status: 'COMPLETED',
            ai_grade: 'A',
            ai_confidence: 0.95,
            defects_found: [{ type: 'bruise' }, { type: 'mold' }],
            date_created: '2025-01-15T10:30:00Z',
            lot_id: {
              lot_number: 'LOT-20250115-0001',
              material_type: 'RAW_FRUIT',
              material_name: 'Mango',
              reviews: [{ decision: 'APPROVED' }],
            },
            inspector_id: { first_name: 'John', last_name: 'Doe' },
          },
          {
            id: 'insp-2',
            status: 'COMPLETED',
            ai_grade: 'C',
            ai_confidence: 0.72,
            defects_found: null,
            date_created: '2025-01-15T11:00:00Z',
            lot_id: {
              lot_number: 'LOT-20250115-0002',
              material_type: 'EXTRACT_POWDER',
              material_name: 'Vanilla Extract',
              reviews: [],
            },
            inspector_id: { first_name: 'Jane', last_name: 'Smith' },
          },
        ],
      }),
    });

    const { GET } = await import('../inspections/route');

    const request = new NextRequest('http://localhost/api/export/inspections');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/csv');
    expect(response.headers.get('Content-Disposition')).toContain('inspections-export-');
    expect(response.headers.get('Content-Disposition')).toContain('.csv');

    const csv = await response.text();
    const lines = csv.split('\n');

    // Check header
    expect(lines[0]).toBe(
      'lot_number,material_type,material_name,inspection_date,inspector_name,grade,confidence_score,status,defects_found_count,review_decision'
    );

    // Check first data row
    expect(lines[1]).toContain('LOT-20250115-0001');
    expect(lines[1]).toContain('RAW_FRUIT');
    expect(lines[1]).toContain('Mango');
    expect(lines[1]).toContain('John Doe');
    expect(lines[1]).toContain('A');
    expect(lines[1]).toContain('0.95');
    expect(lines[1]).toContain('COMPLETED');
    expect(lines[1]).toContain('2'); // defects_found_count
    expect(lines[1]).toContain('APPROVED');

    // Check second data row
    expect(lines[2]).toContain('LOT-20250115-0002');
    expect(lines[2]).toContain('Jane Smith');
    expect(lines[2]).toContain('0'); // no defects
  });

  it('returns 400 when record count exceeds 10,000 limit', async () => {
    // Mock count response exceeding limit
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ count: { id: '15000' } }] }),
    });

    const { GET } = await import('../inspections/route');

    const request = new NextRequest('http://localhost/api/export/inspections');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errors[0].message).toContain('Export exceeds maximum record limit of 10000');
    expect(body.errors[0].message).toContain('15000 records');
    expect(body.errors[0].message).toContain('apply additional filters');

    // Should NOT have made a second fetch for data
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('forwards filter query params to DaaS', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ count: { id: '5' } }] }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });

    const { GET } = await import('../inspections/route');

    const request = new NextRequest(
      'http://localhost/api/export/inspections?filter[status][_eq]=COMPLETED&filter[ai_grade][_eq]=A'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);

    // Verify filter params were forwarded in both calls (URL-encoded brackets)
    const countCallUrl = mockFetch.mock.calls[0][0] as string;
    expect(countCallUrl).toContain('filter%5Bstatus%5D%5B_eq%5D=COMPLETED');
    expect(countCallUrl).toContain('filter%5Bai_grade%5D%5B_eq%5D=A');

    const dataCallUrl = mockFetch.mock.calls[1][0] as string;
    expect(dataCallUrl).toContain('filter%5Bstatus%5D%5B_eq%5D=COMPLETED');
    expect(dataCallUrl).toContain('filter%5Bai_grade%5D%5B_eq%5D=A');
  });

  it('returns error when count request fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ errors: [{ message: 'Unauthorized' }] }),
    });

    const { GET } = await import('../inspections/route');

    const request = new NextRequest('http://localhost/api/export/inspections');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.errors[0].message).toBe('Failed to count inspection records');
  });

  it('returns error when data fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ count: { id: '5' } }] }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ errors: [{ message: 'Internal error' }] }),
    });

    const { GET } = await import('../inspections/route');

    const request = new NextRequest('http://localhost/api/export/inspections');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.errors[0].message).toBe('Failed to fetch inspection data');
  });

  it('returns 500 on unexpected errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));

    const { GET } = await import('../inspections/route');

    const request = new NextRequest('http://localhost/api/export/inspections');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.errors[0].message).toBe('Export failed');
  });

  it('handles inspections with null/missing related data gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ count: { id: '1' } }] }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'insp-3',
            status: 'PENDING',
            ai_grade: null,
            ai_confidence: null,
            defects_found: null,
            date_created: '2025-01-15T12:00:00Z',
            lot_id: null,
            inspector_id: null,
          },
        ],
      }),
    });

    const { GET } = await import('../inspections/route');

    const request = new NextRequest('http://localhost/api/export/inspections');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const csv = await response.text();
    const lines = csv.split('\n');

    // Should have header + 1 data row
    expect(lines.length).toBe(2);
    // Data row should have empty values for missing relations
    expect(lines[1]).toContain('PENDING');
    expect(lines[1]).toContain('0'); // defects_found_count = 0 for null
  });
});
