'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Paper,
  Stack,
  Group,
  Text,
  Title,
  Badge,
  Button,
  Timeline,
  Loader,
  Alert,
  SimpleGrid,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconFlask,
  IconCheck,
  IconX,
  IconClock,
  IconArrowLeft,
} from '@tabler/icons-react';

/** Lot status type */
type LotStatus =
  | 'PENDING_QC'
  | 'QC_IN_PROGRESS'
  | 'QC_PASSED'
  | 'QC_FAILED'
  | 'MANAGER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'QUARANTINED';

/** Inspection record */
interface Inspection {
  id: string;
  inspection_type: string;
  status: string;
  ai_grade: string | null;
  ai_confidence: number | null;
  date_created: string;
}

/** Review record */
interface Review {
  id: string;
  decision: string;
  notes: string;
  reviewer_id: string;
  date_created: string;
}

/** Lot record with related data */
interface Lot {
  id: string;
  lot_number: string;
  material_type: string;
  material_name: string;
  supplier_name: string;
  quantity_kg: number;
  status: LotStatus;
  status_changed_at: string | null;
  date_created: string;
  inspections: Inspection[];
  reviews: Review[];
}

/** Map lot status to badge color */
function getStatusColor(status: LotStatus): string {
  const colorMap: Record<LotStatus, string> = {
    PENDING_QC: 'blue',
    QC_IN_PROGRESS: 'yellow',
    QC_PASSED: 'green',
    QC_FAILED: 'red',
    MANAGER_REVIEW: 'orange',
    APPROVED: 'teal',
    REJECTED: 'red',
    QUARANTINED: 'dark',
  };
  return colorMap[status] ?? 'gray';
}

/** Map inspection status to badge color */
function getInspectionStatusColor(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'green';
    case 'ERROR':
      return 'red';
    case 'PENDING':
      return 'blue';
    default:
      return 'gray';
  }
}

/** Format a date string for display */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

export default function LotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const lotId = params.id as string;

  const [lot, setLot] = useState<Lot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLot() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `/api/items/lots/${lotId}?fields=*,inspections.*,reviews.*`,
          { credentials: 'include' }
        );

        if (!res.ok) {
          if (res.status === 404) {
            setError('Lot not found.');
          } else if (res.status === 403) {
            setError('You do not have permission to view this lot.');
          } else {
            setError(`Failed to load lot (HTTP ${res.status}).`);
          }
          return;
        }

        const json = await res.json();
        const data = json.data ?? json;

        // Normalize inspections and reviews to arrays
        setLot({
          ...data,
          inspections: Array.isArray(data.inspections) ? data.inspections : [],
          reviews: Array.isArray(data.reviews) ? data.reviews : [],
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'An unexpected error occurred.'
        );
      } finally {
        setLoading(false);
      }
    }

    if (lotId) {
      fetchLot();
    }
  }, [lotId]);

  if (loading) {
    return (
      <Stack align="center" justify="center" h={400}>
        <Loader size="lg" />
        <Text c="dimmed">Loading lot details...</Text>
      </Stack>
    );
  }

  if (error) {
    return (
      <Stack gap="md" maw={600} mx="auto" mt="xl">
        <Alert
          icon={<IconAlertCircle size={20} />}
          title="Error"
          color="red"
          variant="light"
        >
          {error}
        </Alert>
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => router.push('/lots')}
        >
          Back to Lots
        </Button>
      </Stack>
    );
  }

  if (!lot) {
    return null;
  }

  return (
    <Stack gap="lg">
      {/* Header */}
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Group gap="sm">
            <Button
              variant="subtle"
              size="compact-sm"
              leftSection={<IconArrowLeft size={14} />}
              onClick={() => router.push('/lots')}
            >
              Back
            </Button>
          </Group>
          <Title order={2}>{lot.lot_number}</Title>
          <Text c="dimmed" size="sm">
            {lot.material_name} — {lot.supplier_name}
          </Text>
        </Stack>

        <Group gap="sm">
          <Badge size="lg" color={getStatusColor(lot.status)} variant="filled">
            {lot.status.replace(/_/g, ' ')}
          </Badge>
          {lot.status === 'PENDING_QC' && (
            <Button
              leftSection={<IconFlask size={16} />}
              onClick={() => router.push(`/lots/${lot.id}/inspect`)}
            >
              Start Inspection
            </Button>
          )}
        </Group>
      </Group>

      {/* Lot Information */}
      <Paper p="md" withBorder>
        <Title order={4} mb="sm">
          Lot Information
        </Title>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          <Stack gap={2}>
            <Text size="xs" c="dimmed" fw={500}>
              Lot Number
            </Text>
            <Text size="sm">{lot.lot_number}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed" fw={500}>
              Material Type
            </Text>
            <Text size="sm">{lot.material_type.replace(/_/g, ' ')}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed" fw={500}>
              Material Name
            </Text>
            <Text size="sm">{lot.material_name}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed" fw={500}>
              Supplier
            </Text>
            <Text size="sm">{lot.supplier_name}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed" fw={500}>
              Quantity (kg)
            </Text>
            <Text size="sm">{lot.quantity_kg}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed" fw={500}>
              Status
            </Text>
            <Badge color={getStatusColor(lot.status)} variant="light" size="sm">
              {lot.status.replace(/_/g, ' ')}
            </Badge>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed" fw={500}>
              Status Changed At
            </Text>
            <Text size="sm">{formatDate(lot.status_changed_at)}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed" fw={500}>
              Created
            </Text>
            <Text size="sm">{formatDate(lot.date_created)}</Text>
          </Stack>
        </SimpleGrid>
      </Paper>

      {/* Inspections */}
      <Paper p="md" withBorder>
        <Title order={4} mb="sm">
          Inspections
        </Title>
        {lot.inspections.length === 0 ? (
          <Text c="dimmed" size="sm">
            No inspections recorded yet.
          </Text>
        ) : (
          <Timeline active={lot.inspections.length - 1} bulletSize={28} lineWidth={2}>
            {lot.inspections.map((inspection) => (
              <Timeline.Item
                key={inspection.id}
                bullet={
                  inspection.status === 'COMPLETED' ? (
                    <IconCheck size={14} />
                  ) : inspection.status === 'ERROR' ? (
                    <IconX size={14} />
                  ) : (
                    <IconClock size={14} />
                  )
                }
                title={
                  <Group gap="xs">
                    <Text size="sm" fw={500}>
                      {inspection.inspection_type.replace(/_/g, ' ')} Inspection
                    </Text>
                    <Badge
                      size="xs"
                      color={getInspectionStatusColor(inspection.status)}
                      variant="light"
                    >
                      {inspection.status}
                    </Badge>
                  </Group>
                }
              >
                <Stack gap={2} mt={4}>
                  {inspection.ai_grade && (
                    <Text size="xs" c="dimmed">
                      Grade: <strong>{inspection.ai_grade}</strong>
                      {inspection.ai_confidence != null && (
                        <> — Confidence: <strong>{(inspection.ai_confidence * 100).toFixed(1)}%</strong></>
                      )}
                    </Text>
                  )}
                  <Text size="xs" c="dimmed">
                    {formatDate(inspection.date_created)}
                  </Text>
                </Stack>
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </Paper>

      {/* Reviews */}
      <Paper p="md" withBorder>
        <Title order={4} mb="sm">
          Reviews
        </Title>
        {lot.reviews.length === 0 ? (
          <Text c="dimmed" size="sm">
            No reviews recorded yet.
          </Text>
        ) : (
          <Timeline active={lot.reviews.length - 1} bulletSize={28} lineWidth={2}>
            {lot.reviews.map((review) => (
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
