'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Paper,
  Stack,
  Group,
  Text,
  Title,
  Badge,
  Button,
  Alert,
  Image,
  Loader,
  SimpleGrid,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import { Textarea } from '@/components/ui/textarea';

// --- Types ---

interface Inspection {
  id: string;
  inspection_type: string;
  status: string;
  ai_grade: string | null;
  ai_confidence: number | null;
  annotated_image_url: string | null;
  image_url: string | null;
  defects_found: Array<{ type: string; count: number; confidence: number }> | null;
  color_score: number | null;
  date_created: string;
}

interface LotData {
  id: string;
  lot_number: string;
  material_type: string;
  material_name: string;
  supplier_name: string;
  quantity_kg: number;
  status: string;
  inspections: Inspection[];
}

export interface ReviewFormProps {
  /** The lot ID to review */
  lotId: string;
  /** Callback when review is successfully submitted */
  onReviewComplete: () => void;
}

// --- Helpers ---

const NOTES_MIN = 10;
const NOTES_MAX = 1000;

function getGradeColor(grade: string | null): string {
  switch (grade) {
    case 'A': return 'green';
    case 'B': return 'teal';
    case 'C': return 'yellow';
    case 'D': return 'orange';
    case 'F': return 'red';
    default: return 'gray';
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

/**
 * ReviewForm Component
 *
 * Displays lot inspection details (grade, confidence, annotated image) alongside
 * a review form with Approve/Reject buttons and notes textarea.
 *
 * Submission logic:
 * - POSTs to /api/items/reviews with { lot_id, decision, notes }
 * - Backend hooks handle state transitions and notifications
 * - Handles concurrent review rejection (lot no longer in MANAGER_REVIEW)
 *
 * Requirements: 7.2, 7.3, 7.4, 7.5, 7.6
 */
export function ReviewForm({ lotId, onReviewComplete }: ReviewFormProps) {
  // --- State ---
  const [lot, setLot] = useState<LotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [notes, setNotes] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // --- Fetch lot with inspections ---
  const fetchLot = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);

      const res = await fetch(
        `/api/items/lots/${lotId}?fields[]=*&fields[]=inspections.*`,
        { credentials: 'include' }
      );

      if (!res.ok) {
        if (res.status === 404) {
          setFetchError('Lot not found.');
        } else if (res.status === 403) {
          setFetchError('You do not have permission to view this lot.');
        } else {
          setFetchError(`Failed to load lot (HTTP ${res.status}).`);
        }
        return;
      }

      const json = await res.json();
      const data = json.data ?? json;

      setLot({
        ...data,
        inspections: Array.isArray(data.inspections) ? data.inspections : [],
      });
    } catch (err) {
      setFetchError(
        err instanceof Error ? err.message : 'An unexpected error occurred.'
      );
    } finally {
      setLoading(false);
    }
  }, [lotId]);

  useEffect(() => {
    fetchLot();
  }, [fetchLot]);

  // --- Validation ---
  const validateNotes = useCallback((value: string | null): string | null => {
    const trimmed = (value ?? '').trim();
    if (trimmed.length < NOTES_MIN) {
      return `Notes must be at least ${NOTES_MIN} characters (currently ${trimmed.length}).`;
    }
    if (trimmed.length > NOTES_MAX) {
      return `Notes must not exceed ${NOTES_MAX} characters (currently ${trimmed.length}).`;
    }
    return null;
  }, []);

  // --- Submission ---
  const handleSubmit = useCallback(async (decision: 'APPROVED' | 'REJECTED') => {
    // Validate notes
    const validationError = validateNotes(notes);
    if (validationError) {
      setNotesError(validationError);
      return;
    }

    setNotesError(null);
    setSubmitError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/items/reviews', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lot_id: lotId,
          decision,
          notes: (notes ?? '').trim(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const errorMessages = errorData?.errors?.map(
          (e: { message?: string }) => e.message
        ) ?? [];

        // Check for concurrent review rejection (lot no longer in MANAGER_REVIEW)
        const isConcurrencyError = errorMessages.some(
          (msg: string) =>
            msg?.toLowerCase().includes('not in manager_review') ||
            msg?.toLowerCase().includes('status has changed') ||
            msg?.toLowerCase().includes('already been reviewed')
        );

        if (isConcurrencyError) {
          setSubmitError(
            'This lot has already been reviewed or its status has changed. Please return to the review queue.'
          );
        } else if (res.status === 403) {
          setSubmitError('You do not have permission to submit reviews.');
        } else {
          setSubmitError(
            errorMessages[0] || `Failed to submit review (HTTP ${res.status}).`
          );
        }
        return;
      }

      // Success
      const decisionLabel = decision === 'APPROVED' ? 'approved' : 'rejected';
      setSubmitSuccess(`Lot ${lot?.lot_number ?? lotId} has been ${decisionLabel}.`);

      // Notify parent after a brief delay for user to see success message
      setTimeout(() => {
        onReviewComplete();
      }, 1500);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'An unexpected error occurred.'
      );
    } finally {
      setSubmitting(false);
    }
  }, [lotId, notes, validateNotes, lot, onReviewComplete]);

  // --- Render: Loading ---
  if (loading) {
    return (
      <Stack align="center" justify="center" h={300}>
        <Loader size="lg" />
        <Text c="dimmed">Loading lot details...</Text>
      </Stack>
    );
  }

  // --- Render: Fetch Error ---
  if (fetchError) {
    return (
      <Alert
        icon={<IconAlertCircle size={20} />}
        title="Error"
        color="red"
        variant="light"
      >
        {fetchError}
      </Alert>
    );
  }

  if (!lot) return null;

  // Get the latest completed inspection for display
  const latestInspection = lot.inspections
    .filter((i) => i.status === 'COMPLETED')
    .sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime())[0] ?? null;

  // Check if lot is still in MANAGER_REVIEW
  const isReviewable = lot.status === 'MANAGER_REVIEW';

  return (
    <Stack gap="lg">
      {/* Success message */}
      {submitSuccess && (
        <Alert
          icon={<IconCheck size={20} />}
          title="Review Submitted"
          color="green"
          variant="light"
        >
          {submitSuccess}
        </Alert>
      )}

      {/* Lot is no longer reviewable */}
      {!isReviewable && !submitSuccess && (
        <Alert
          icon={<IconAlertCircle size={20} />}
          title="Lot Not Reviewable"
          color="orange"
          variant="light"
        >
          This lot is no longer in MANAGER_REVIEW status (current status: {lot.status.replace(/_/g, ' ')}).
          It may have already been reviewed.
        </Alert>
      )}

      {/* Inspection Details Section */}
      <Paper p="md" withBorder>
        <Title order={4} mb="sm">Inspection Details</Title>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          {/* Left: Inspection data */}
          <Stack gap="sm">
            <Group gap="xs">
              <Text size="sm" fw={500} c="dimmed">Lot Number:</Text>
              <Text size="sm">{lot.lot_number}</Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" fw={500} c="dimmed">Material:</Text>
              <Text size="sm">{lot.material_name} ({lot.material_type.replace(/_/g, ' ')})</Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" fw={500} c="dimmed">Supplier:</Text>
              <Text size="sm">{lot.supplier_name}</Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" fw={500} c="dimmed">Quantity:</Text>
              <Text size="sm">{lot.quantity_kg} kg</Text>
            </Group>

            {latestInspection && (
              <>
                <Group gap="xs" mt="xs">
                  <Text size="sm" fw={500} c="dimmed">AI Grade:</Text>
                  <Badge
                    color={getGradeColor(latestInspection.ai_grade)}
                    variant="filled"
                    size="sm"
                  >
                    Grade {latestInspection.ai_grade ?? '—'}
                  </Badge>
                </Group>
                <Group gap="xs">
                  <Text size="sm" fw={500} c="dimmed">Confidence:</Text>
                  <Text size="sm">
                    {latestInspection.ai_confidence != null
                      ? `${(latestInspection.ai_confidence * 100).toFixed(1)}%`
                      : '—'}
                  </Text>
                </Group>
                {latestInspection.color_score != null && (
                  <Group gap="xs">
                    <Text size="sm" fw={500} c="dimmed">Color Score:</Text>
                    <Text size="sm">{latestInspection.color_score.toFixed(2)}</Text>
                  </Group>
                )}
                {latestInspection.defects_found && latestInspection.defects_found.length > 0 && (
                  <Stack gap={4}>
                    <Text size="sm" fw={500} c="dimmed">Defects Found:</Text>
                    {latestInspection.defects_found.map((defect, idx) => (
                      <Text key={idx} size="xs" ml="sm">
                        • {defect.type}: {defect.count} ({(defect.confidence * 100).toFixed(0)}% confidence)
                      </Text>
                    ))}
                  </Stack>
                )}
                <Group gap="xs">
                  <Text size="sm" fw={500} c="dimmed">Inspected:</Text>
                  <Text size="sm">{formatDate(latestInspection.date_created)}</Text>
                </Group>
              </>
            )}

            {!latestInspection && (
              <Text size="sm" c="dimmed" fs="italic">
                No completed inspection data available.
              </Text>
            )}
          </Stack>

          {/* Right: Annotated image */}
          <Stack gap="sm" align="center">
            {latestInspection?.annotated_image_url ? (
              <>
                <Text size="xs" c="dimmed" fw={500}>Annotated Image</Text>
                <Image
                  src={`/api/assets/${latestInspection.annotated_image_url}`}
                  alt="Annotated inspection image"
                  radius="sm"
                  maw={400}
                  mah={300}
                  fit="contain"
                  fallbackSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5OTkiIGZvbnQtc2l6ZT0iMTQiPkltYWdlIHVuYXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg=="
                />
              </>
            ) : latestInspection?.image_url ? (
              <>
                <Text size="xs" c="dimmed" fw={500}>Original Image</Text>
                <Image
                  src={`/api/assets/${latestInspection.image_url}`}
                  alt="Original inspection image"
                  radius="sm"
                  maw={400}
                  mah={300}
                  fit="contain"
                  fallbackSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5OTkiIGZvbnQtc2l6ZT0iMTQiPkltYWdlIHVuYXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg=="
                />
              </>
            ) : (
              <Stack align="center" justify="center" h={200}>
                <Text size="sm" c="dimmed">No inspection image available</Text>
              </Stack>
            )}
          </Stack>
        </SimpleGrid>
      </Paper>

      {/* Review Form Section */}
      {isReviewable && !submitSuccess && (
        <Paper p="md" withBorder>
          <Title order={4} mb="sm">Submit Review</Title>
          <Stack gap="md">
            {/* Submit error */}
            {submitError && (
              <Alert
                icon={<IconAlertCircle size={20} />}
                title="Submission Error"
                color="red"
                variant="light"
              >
                {submitError}
              </Alert>
            )}

            {/* Notes textarea */}
            <Textarea
              label="Review Notes"
              placeholder="Provide justification for your decision (10-1000 characters)..."
              value={notes}
              onChange={setNotes}
              required
              error={notesError ?? undefined}
              softLength={NOTES_MAX}
              minRows={4}
              maxRows={8}
              disabled={submitting}
            />

            <Text size="xs" c="dimmed">
              {(notes ?? '').trim().length} / {NOTES_MAX} characters (minimum {NOTES_MIN})
            </Text>

            {/* Action buttons */}
            <Group gap="md" mt="xs">
              <Button
                color="green"
                leftSection={<IconCheck size={16} />}
                onClick={() => handleSubmit('APPROVED')}
                loading={submitting}
                disabled={submitting}
              >
                Approve
              </Button>
              <Button
                color="red"
                leftSection={<IconX size={16} />}
                onClick={() => handleSubmit('REJECTED')}
                loading={submitting}
                disabled={submitting}
              >
                Reject
              </Button>
            </Group>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

export default ReviewForm;
