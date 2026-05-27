import { type NextRequest, NextResponse } from 'next/server';
import { getAuthHeaders, getDaaSUrl } from '@/lib/api/auth-headers';

const MAX_EXPORT_RECORDS = 10000;
const CSV_FIELDS = [
  'lot_number',
  'material_type',
  'material_name',
  'inspection_date',
  'inspector_name',
  'grade',
  'confidence_score',
  'status',
  'defects_found_count',
  'review_decision',
];

function escapeCsvValue(value: string): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: NextRequest) {
  try {
    const headers = await getAuthHeaders();
    const daasUrl = getDaaSUrl();

    // Forward query params for filtering
    const searchParams = request.nextUrl.searchParams;
    const filterParams = searchParams.toString();

    // First, count total records matching the filter
    const countUrl = `${daasUrl}/api/items/inspections?aggregate[count]=id${filterParams ? `&${filterParams}` : ''}`;
    const countRes = await fetch(countUrl, { headers, cache: 'no-store' });

    if (!countRes.ok) {
      return NextResponse.json(
        { errors: [{ message: 'Failed to count inspection records' }] },
        { status: countRes.status }
      );
    }

    const countData = await countRes.json();
    const totalCount = parseInt(countData.data?.[0]?.count?.id || '0', 10);

    if (totalCount > MAX_EXPORT_RECORDS) {
      return NextResponse.json(
        {
          errors: [
            {
              message: `Export exceeds maximum record limit of ${MAX_EXPORT_RECORDS}. Current result set contains ${totalCount} records. Please apply additional filters to reduce the result set.`,
            },
          ],
        },
        { status: 400 }
      );
    }

    // Fetch inspections with related data
    const fields = [
      'id',
      'status',
      'ai_grade',
      'ai_confidence',
      'defects_found',
      'date_created',
      'lot_id.lot_number',
      'lot_id.material_type',
      'lot_id.material_name',
      'lot_id.reviews.decision',
      'inspector_id.first_name',
      'inspector_id.last_name',
    ].join(',');

    const fetchUrl = `${daasUrl}/api/items/inspections?fields=${fields}&limit=${MAX_EXPORT_RECORDS}${filterParams ? `&${filterParams}` : ''}`;
    const response = await fetch(fetchUrl, { headers, cache: 'no-store' });

    if (!response.ok) {
      return NextResponse.json(
        { errors: [{ message: 'Failed to fetch inspection data' }] },
        { status: response.status }
      );
    }

    const result = await response.json();
    const inspections = result.data || [];

    // Build CSV
    const csvHeader = CSV_FIELDS.join(',');
    const csvRows = inspections.map((insp: Record<string, unknown>) => {
      const lot = insp.lot_id as Record<string, unknown> | null;
      const inspector = insp.inspector_id as Record<string, unknown> | null;

      const lotNumber = (lot?.lot_number as string) || '';
      const materialType = (lot?.material_type as string) || '';
      const materialName = (lot?.material_name as string) || '';
      const inspectionDate = (insp.date_created as string) || '';
      const inspectorName = [
        inspector?.first_name as string | undefined,
        inspector?.last_name as string | undefined,
      ]
        .filter(Boolean)
        .join(' ');
      const grade = (insp.ai_grade as string) || '';
      const confidence = insp.ai_confidence != null ? String(insp.ai_confidence) : '';
      const status = (insp.status as string) || '';
      const defectsFound = insp.defects_found;
      const defectsCount = Array.isArray(defectsFound) ? defectsFound.length : 0;

      // Get review decision from lot's reviews relation
      const reviews = (lot?.reviews as Array<Record<string, unknown>>) || [];
      const reviewDecision =
        reviews.length > 0 ? (reviews[reviews.length - 1]?.decision as string) || '' : '';

      return [
        lotNumber,
        materialType,
        materialName,
        inspectionDate,
        inspectorName,
        grade,
        confidence,
        status,
        String(defectsCount),
        reviewDecision,
      ]
        .map(escapeCsvValue)
        .join(',');
    });

    const csv = [csvHeader, ...csvRows].join('\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="inspections-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Export failed';
    return NextResponse.json(
      { errors: [{ message: 'Export failed', details: message }] },
      { status: 500 }
    );
  }
}
