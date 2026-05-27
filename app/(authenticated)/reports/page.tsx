'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Group,
  Image,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Timeline,
  Title,
  Alert,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconCheck,
  IconDownload,
  IconX,
  IconClock,
  IconAlertCircle,
} from '@tabler/icons-react';
import { CollectionList } from '@/components/ui/collection-list';
import type { AnyItem } from '@/lib/buildpad/types';
import type { Header } from '@/components/ui/vtable-types';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Grade badge color mapping */
const GRADE_COLORS: Record<string, string> = {
  A: 'green',
  B: 'teal',
  C: 'yellow',
  D: 'orange',
  F: 'red',
};

/** Status badge color mapping */
const STATUS_COLORS: Record<string, string> = {
  PENDING: 'blue',
  COMPLETED: 'green',
  ERROR: 'red',
};

/** Material type human-readable labels */
const MATERIAL_TYPE_LABELS: Record<string, string> = {
  RAW_FRUIT: 'Raw Fruit',
  RAW_BOTANICAL: 'Raw Botanical',
  EXTRACT_POWDER: 'Extract Powder',
};

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRole = 'operator' | 'qc_manager' | 'admin';

interface SessionUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
}

interface InspectionDetail {
  id: string;
  inspection_type: string;
  status: string;
  image_url: string | null;
  annotated_image_url: string | null;
  ai_grade: string | null;
  ai_confidence: number | null;
  ai_details: Record<string, unknown> | null;
  defects_found: Array<Record<string, unknown>> | null;
  color_score: number | null;
  retry_count: number;
  date_created: string;
  lot_id: {
    id: string;
    lot_number: string;
    material_type: string;
    material_name: string;
    reviews: Array<{
      id: string;
      decision: string;
      notes: string;
      date_created: string;
    }>;
  } | null;
  inspector_id: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_HIERARCHY: Record<UserRole, number> = {
  operator: 0,
  qc_manager: 1,
  admin: 2,
};

function normalizeRole(role: string | null | undefined): UserRole | null {
  if (!role) return null;
  const lower = role.toLowerCase();
  if (lower === 'admin') return 'admin';
  if (lower === 'qc_manager') return 'qc_manager';
  if (lower === 'operator') return 'operator';
  return null;
}

function hasMinRole(userRole: UserRole | null, minRole: UserRole): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

// ─── Main Page Component ──────────────────────────────────────────────────────

/**
 * Inspection Results / Reports Page
 *
 * Displays all inspection results in a paginated, filterable list.
 * - Operators see only their own inspections (enforced server-side by DaaS permissions).
 * - QC Managers and Admins see all inspections.
 * - QC_Manager+ roles can export filtered results as CSV.
 * - Clicking a row shows the full inspection detail view.
 *
 * Requirements: 15.1, 15.2, 15.5
 */
export default function ReportsPage() {
  const [filter, setFilter] = useState<Record<string, unknown> | null>(null);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Fetch current user session to determine role for export button visibility
  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch('/api/auth/session', { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          const role = json.data?.user?.role ?? null;
          setUserRole(normalizeRole(role));
        }
      } catch {
        // Silently ignore — export button just won't show
      }
    }
    fetchSession();
  }, []);

  const canExport = hasMinRole(userRole, 'qc_manager');

  const handleItemClick = useCallback((item: AnyItem) => {
    setSelectedInspectionId(item.id as string);
  }, []);

  const handleFilterChange = useCallback(
    (newFilter: Record<string, unknown> | null) => {
      setFilter(newFilter);
    },
    [],
  );

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportError(null);
    try {
      // Build query params from current filter
      const params = new URLSearchParams();
      if (filter) {
        // Pass filter as JSON for the export route to forward
        params.set('filter', JSON.stringify(filter));
      }

      const url = `/api/export/inspections${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, { credentials: 'include' });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        const message =
          json?.errors?.[0]?.message || `Export failed (HTTP ${res.status})`;
        setExportError(message);
        return;
      }

      // Download the CSV
      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `inspections-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [filter]);

  /**
   * Custom cell renderer for grade badges, confidence percentages,
   * status badges, material type labels, and formatted dates.
   */
  const renderCell = useCallback((item: AnyItem, header: Header) => {
    // AI Grade
    if (header.value === 'ai_grade') {
      const grade = item.ai_grade as string | null;
      if (!grade) {
        return (
          <Text size="sm" c="dimmed">
            —
          </Text>
        );
      }
      return (
        <Badge color={GRADE_COLORS[grade] || 'gray'} variant="filled" size="sm">
          Grade {grade}
        </Badge>
      );
    }

    // AI Confidence
    if (header.value === 'ai_confidence') {
      const confidence = item.ai_confidence as number | null;
      if (confidence == null) {
        return (
          <Text size="sm" c="dimmed">
            —
          </Text>
        );
      }
      const percentage = (confidence * 100).toFixed(1);
      const color = confidence >= 0.7 ? 'green' : confidence >= 0.5 ? 'yellow' : 'red';
      return (
        <Badge color={color} variant="light" size="sm">
          {percentage}%
        </Badge>
      );
    }

    // Inspection status
    if (header.value === 'status') {
      const status = item.status as string;
      if (!status) return null;
      return (
        <Badge color={STATUS_COLORS[status] || 'gray'} variant="light" size="sm">
          {status}
        </Badge>
      );
    }

    // Lot number (from relation)
    if (header.value === 'lot_id.lot_number') {
      const lot = item.lot_id as Record<string, unknown> | null;
      const lotNumber = lot?.lot_number as string | null;
      if (!lotNumber) {
        return (
          <Text size="sm" c="dimmed">
            —
          </Text>
        );
      }
      return <Text size="sm">{lotNumber}</Text>;
    }

    // Material type (from relation)
    if (header.value === 'lot_id.material_type') {
      const lot = item.lot_id as Record<string, unknown> | null;
      const type = lot?.material_type as string | null;
      if (!type) return null;
      return (
        <Text size="sm" truncate="end">
          {MATERIAL_TYPE_LABELS[type] || type.replace(/_/g, ' ')}
        </Text>
      );
    }

    // Inspector name (from relation)
    if (header.value === 'inspector_id.first_name') {
      const inspector = item.inspector_id as Record<string, unknown> | null;
      if (!inspector) {
        return (
          <Text size="sm" c="dimmed">
            —
          </Text>
        );
      }
      const name = [inspector.first_name, inspector.last_name].filter(Boolean).join(' ');
      return <Text size="sm">{name || '—'}</Text>;
    }

    // Date created formatted
    if (header.value === 'date_created') {
      const dateStr = item.date_created as string;
      if (!dateStr) return null;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      return (
        <Text size="sm" truncate="end">
          {date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </Text>
      );
    }

    return null;
  }, []);

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Stack gap={4}>
          <Title order={2}>
            {selectedInspectionId ? 'Inspection Detail' : 'Inspection Reports'}
          </Title>
          <Text c="dimmed" size="sm">
            {selectedInspectionId
              ? 'Full inspection details including images, grade, and review history.'
              : 'View, filter, and export inspection results.'}
          </Text>
        </Stack>

        <Group gap="sm">
          {selectedInspectionId && (
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => setSelectedInspectionId(null)}
            >
              Back to List
            </Button>
          )}
          {!selectedInspectionId && canExport && (
            <Button
              leftSection={<IconDownload size={16} />}
              variant="light"
              loading={exporting}
              onClick={handleExport}
              data-testid="export-csv-button"
            >
              Export CSV
            </Button>
          )}
        </Group>
      </Group>

      {exportError && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="red"
          variant="light"
          withCloseButton
          onClose={() => setExportError(null)}
        >
          {exportError}
        </Alert>
      )}

      {selectedInspectionId ? (
        <InspectionDetailView inspectionId={selectedInspectionId} />
      ) : (
        <CollectionList
          collection="inspections"
          fields={[
            'lot_id.lot_number',
            'lot_id.material_type',
            'ai_grade',
            'ai_confidence',
            'status',
            'inspector_id.first_name',
            'date_created',
          ]}
          filter={filter ?? undefined}
          enableFilter
          enableSearch
          enableSort
          enableCreate={false}
          enableSelection={false}
          limit={25}
          primaryKeyField="id"
          onItemClick={handleItemClick}
          onFilterChange={handleFilterChange}
          renderCell={renderCell}
        />
      )}
    </Stack>
  );
}

// ─── Inspection Detail View ───────────────────────────────────────────────────

/**
 * Displays full inspection detail including:
 * - Original image and annotated image
 * - Grade, confidence score
 * - Defects found (for fruit inspections)
 * - Color analysis data (for powder inspections)
 * - Retry history
 * - Review history
 *
 * Requirements: 15.2
 */
function InspectionDetailView({ inspectionId }: { inspectionId: string }) {
  const [inspection, setInspection] = useState<InspectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInspection() {
      try {
        setLoading(true);
        setError(null);

        const fields = [
          '*',
          'lot_id.id',
          'lot_id.lot_number',
          'lot_id.material_type',
          'lot_id.material_name',
          'lot_id.reviews.id',
          'lot_id.reviews.decision',
          'lot_id.reviews.notes',
          'lot_id.reviews.date_created',
          'inspector_id.id',
          'inspector_id.first_name',
          'inspector_id.last_name',
        ].join(',');

        const res = await fetch(
          `/api/items/inspections/${inspectionId}?fields=${fields}`,
          { credentials: 'include' },
        );

        if (!res.ok) {
          if (res.status === 404) {
            setError('Inspection not found.');
          } else if (res.status === 403) {
            setError('You do not have permission to view this inspection.');
          } else {
            setError(`Failed to load inspection (HTTP ${res.status}).`);
          }
          return;
        }

        const json = await res.json();
        setInspection(json.data ?? json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    }

    if (inspectionId) {
      fetchInspection();
    }
  }, [inspectionId]);

  if (loading) {
    return (
      <Stack align="center" justify="center" h={300}>
        <Loader size="lg" />
        <Text c="dimmed">Loading inspection details...</Text>
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert icon={<IconAlertCircle size={20} />} title="Error" color="red" variant="light">
        {error}
      </Alert>
    );
  }

  if (!inspection) return null;

  const lot = inspection.lot_id;
  const inspector = inspection.inspector_id;
  const inspectorName = inspector
    ? [inspector.first_name, inspector.last_name].filter(Boolean).join(' ')
    : '—';
  const reviews = lot?.reviews ?? [];

  return (
    <Stack gap="lg">
      {/* Summary Info */}
      <Paper p="md" withBorder>
        <Title order={4} mb="sm">
          Inspection Summary
        </Title>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
          <Stack gap={2}>
            <Text size="xs" c="dimmed" fw={500}>
              Lot Number
            </Text>
            <Text size="sm">{lot?.lot_number ?? '—'}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed" fw={500}>
              Material Type
            </Text>
            <Text size="sm">
              {lot?.material_type
                ? MATERIAL_TYPE_LABELS[lot.material_type] || lot.material_type
                : '—'}
            </Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed" fw={500}>
              Material Name
            </Text>
            <Text size="sm">{lot?.material_name ?? '—'}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed" fw={500}>
              Inspector
            </Text>
            <Text size="sm">{inspectorName}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed" fw={500}>
              Inspection Type
            </Text>
            <Text size="sm">{inspection.inspection_type.replace(/_/g, ' ')}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed" fw={500}>
              Status
            </Text>
            <Badge
              color={STATUS_COLORS[inspection.status] || 'gray'}
              variant="light"
              size="sm"
            >
              {inspection.status}
            </Badge>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed" fw={500}>
              Date
            </Text>
            <Text size="sm">{formatDate(inspection.date_created)}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed" fw={500}>
              Retry Count
            </Text>
            <Text size="sm">{inspection.retry_count}</Text>
          </Stack>
        </SimpleGrid>
      </Paper>

      {/* Grade and Confidence */}
      <Paper p="md" withBorder>
        <Title order={4} mb="sm">
          AI Grading Results
        </Title>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          <Stack gap={2}>
            <Text size="xs" c="dimmed" fw={500}>
              Grade
            </Text>
            {inspection.ai_grade ? (
              <Badge
                color={GRADE_COLORS[inspection.ai_grade] || 'gray'}
                variant="filled"
                size="lg"
              >
                Grade {inspection.ai_grade}
              </Badge>
            ) : (
              <Text size="sm" c="dimmed">
                —
              </Text>
            )}
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed" fw={500}>
              Confidence Score
            </Text>
            {inspection.ai_confidence != null ? (
              <Group gap="xs">
                <Badge
                  color={
                    inspection.ai_confidence >= 0.7
                      ? 'green'
                      : inspection.ai_confidence >= 0.5
                        ? 'yellow'
                        : 'red'
                  }
                  variant="light"
                  size="lg"
                >
                  {(inspection.ai_confidence * 100).toFixed(1)}%
                </Badge>
              </Group>
            ) : (
              <Text size="sm" c="dimmed">
                —
              </Text>
            )}
          </Stack>
          {inspection.color_score != null && (
            <Stack gap={2}>
              <Text size="xs" c="dimmed" fw={500}>
                Color Score (Delta)
              </Text>
              <Text size="sm" fw={500}>
                {inspection.color_score.toFixed(2)}
              </Text>
            </Stack>
          )}
        </SimpleGrid>
      </Paper>

      {/* Images */}
      <Paper p="md" withBorder>
        <Title order={4} mb="sm">
          Inspection Images
        </Title>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Stack gap="xs">
            <Text size="xs" c="dimmed" fw={500}>
              Original Image
            </Text>
            {inspection.image_url ? (
              <Image
                src={`/api/assets/${inspection.image_url}`}
                alt="Original inspection image"
                radius="sm"
                mah={400}
                fit="contain"
                fallbackSrc="https://placehold.co/400x300?text=Image+Unavailable"
              />
            ) : (
              <Text size="sm" c="dimmed">
                No image available
              </Text>
            )}
          </Stack>
          <Stack gap="xs">
            <Text size="xs" c="dimmed" fw={500}>
              Annotated Image (AI)
            </Text>
            {inspection.annotated_image_url ? (
              <Image
                src={`/api/assets/${inspection.annotated_image_url}`}
                alt="AI annotated inspection image"
                radius="sm"
                mah={400}
                fit="contain"
                fallbackSrc="https://placehold.co/400x300?text=Image+Unavailable"
              />
            ) : (
              <Text size="sm" c="dimmed">
                No annotated image available
              </Text>
            )}
          </Stack>
        </SimpleGrid>
      </Paper>

      {/* Defects Found (for fruit inspections) */}
      {inspection.defects_found && inspection.defects_found.length > 0 && (
        <Paper p="md" withBorder>
          <Title order={4} mb="sm">
            Defects Found
          </Title>
          <Stack gap="xs">
            {inspection.defects_found.map((defect, index) => (
              <Group key={index} gap="sm">
                <Badge color="red" variant="light" size="sm">
                  {(defect.type as string) || (defect.label as string) || `Defect ${index + 1}`}
                </Badge>
                {defect.confidence != null && (
                  <Text size="xs" c="dimmed">
                    Confidence: {((defect.confidence as number) * 100).toFixed(1)}%
                  </Text>
                )}
                {defect.area != null && (
                  <Text size="xs" c="dimmed">
                    Area: {String(defect.area)}
                  </Text>
                )}
              </Group>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Color Analysis (for powder inspections) */}
      {inspection.ai_details &&
        (inspection.ai_details.color_analysis as Record<string, unknown> | undefined) && (
          <Paper p="md" withBorder>
            <Title order={4} mb="sm">
              Color Analysis
            </Title>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
              {Object.entries(
                inspection.ai_details.color_analysis as Record<string, unknown>,
              ).map(([key, value]) => (
                <Stack key={key} gap={2}>
                  <Text size="xs" c="dimmed" fw={500}>
                    {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </Text>
                  <Text size="sm">
                    {typeof value === 'number' ? value.toFixed(2) : String(value)}
                  </Text>
                </Stack>
              ))}
            </SimpleGrid>
          </Paper>
        )}

      {/* Retry History */}
      {inspection.retry_count > 0 && (
        <Paper p="md" withBorder>
          <Title order={4} mb="sm">
            Retry History
          </Title>
          <Stack gap="xs">
            <Group gap="sm">
              <Text size="sm">
                Total retries: <strong>{inspection.retry_count}</strong>
              </Text>
              <Badge
                color={inspection.status === 'ERROR' ? 'red' : 'green'}
                variant="light"
                size="sm"
              >
                {inspection.status === 'ERROR'
                  ? 'Last attempt failed'
                  : 'Resolved after retries'}
              </Badge>
            </Group>
            {inspection.ai_details?.error != null && (
              <Text size="xs" c="dimmed">
                Last error: {String(inspection.ai_details.error)}
              </Text>
            )}
          </Stack>
        </Paper>
      )}

      {/* Review History */}
      <Paper p="md" withBorder>
        <Title order={4} mb="sm">
          Review History
        </Title>
        {reviews.length === 0 ? (
          <Text c="dimmed" size="sm">
            No reviews recorded for this lot.
          </Text>
        ) : (
          <Timeline active={reviews.length - 1} bulletSize={28} lineWidth={2}>
            {reviews.map((review) => (
              <Timeline.Item
                key={review.id}
                bullet={
                  review.decision === 'APPROVED' ? (
                    <IconCheck size={14} />
                  ) : (
                    <IconX size={14} />
                  )
                }
                title={
                  <Group gap="xs">
                    <Text size="sm" fw={500}>
                      Manager Review
                    </Text>
                    <Badge
                      size="xs"
                      color={review.decision === 'APPROVED' ? 'green' : 'red'}
                      variant="light"
                    >
                      {review.decision}
                    </Badge>
                  </Group>
                }
              >
                <Stack gap={2} mt={4}>
                  <Text size="xs" c="dimmed">
                    {review.notes}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatDate(review.date_created)}
                  </Text>
                </Stack>
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </Paper>
    </Stack>
  );
}
