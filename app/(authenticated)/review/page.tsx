'use client';

import { useCallback, useState } from 'react';
import { Badge, Button, Group, Stack, Text, Title } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { CollectionList } from '@/components/ui/collection-list';
import { ReviewForm } from '@/components/review/ReviewForm';
import type { AnyItem } from '@/lib/buildpad/types';
import type { Header } from '@/components/ui/vtable-types';

/**
 * Grade badge color mapping.
 */
const GRADE_COLORS: Record<string, string> = {
  A: 'green',
  B: 'teal',
  C: 'yellow',
  D: 'orange',
  F: 'red',
};

/**
 * Material type human-readable labels.
 */
const MATERIAL_TYPE_LABELS: Record<string, string> = {
  RAW_FRUIT: 'Raw Fruit',
  RAW_BOTANICAL: 'Raw Botanical',
  EXTRACT_POWDER: 'Extract Powder',
};

/**
 * Review Queue Page
 *
 * Displays lots in MANAGER_REVIEW status for QC Managers to review.
 * Shows lot details along with the latest inspection AI grade and confidence.
 * Clicking a row navigates to the lot detail page with full inspection data.
 *
 * Requirements: 7.1
 */
export default function ReviewQueuePage() {
  const [filter, setFilter] = useState<Record<string, unknown> | null>(null);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);

  const handleItemClick = useCallback(
    (item: AnyItem) => {
      setSelectedLotId(item.id as string);
    },
    [],
  );

  const handleReviewComplete = useCallback(() => {
    setSelectedLotId(null);
  }, []);

  const handleFilterChange = useCallback(
    (newFilter: Record<string, unknown> | null) => {
      setFilter(newFilter);
    },
    [],
  );

  /**
   * Custom cell renderer for grade badges, confidence percentages,
   * material type labels, and formatted dates.
   */
  const renderCell = useCallback(
    (item: AnyItem, header: Header) => {
      // AI Grade from related inspection (dot notation: inspections.ai_grade)
      if (header.value === 'inspections.ai_grade') {
        const inspections = item.inspections as Array<Record<string, unknown>> | undefined;
        const latestInspection = inspections?.[0];
        const grade = latestInspection?.ai_grade as string | null;
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

      // AI Confidence from related inspection
      if (header.value === 'inspections.ai_confidence') {
        const inspections = item.inspections as Array<Record<string, unknown>> | undefined;
        const latestInspection = inspections?.[0];
        const confidence = latestInspection?.ai_confidence as number | null;
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
      if (header.value === 'inspections.status') {
        const inspections = item.inspections as Array<Record<string, unknown>> | undefined;
        const latestInspection = inspections?.[0];
        const status = latestInspection?.status as string | null;
        if (!status) {
          return (
            <Text size="sm" c="dimmed">
              —
            </Text>
          );
        }
        const statusColors: Record<string, string> = {
          COMPLETED: 'green',
          ERROR: 'red',
          PENDING: 'blue',
        };
        return (
          <Badge color={statusColors[status] || 'gray'} variant="light" size="sm">
            {status}
          </Badge>
        );
      }

      // Material type with human-readable label
      if (header.value === 'material_type') {
        const type = item.material_type as string;
        if (!type) return null;
        return (
          <Text size="sm" truncate="end">
            {MATERIAL_TYPE_LABELS[type] || type.replace(/_/g, ' ')}
          </Text>
        );
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

      // Return null to use default rendering for other columns
      return null;
    },
    [],
  );

  // Base filter: only lots in MANAGER_REVIEW status
  const baseFilter: Record<string, unknown> = {
    status: { _eq: 'MANAGER_REVIEW' },
    ...(filter ?? {}),
  };

  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Group justify="space-between" align="center">
          <Stack gap={4}>
            <Title order={2}>Review Queue</Title>
            <Text c="dimmed" size="sm">
              {selectedLotId
                ? 'Review the inspection details and submit your decision.'
                : 'Lots awaiting manager review. Click a lot to review.'}
            </Text>
          </Stack>
          {selectedLotId && (
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => setSelectedLotId(null)}
            >
              Back to Queue
            </Button>
          )}
        </Group>
      </Stack>

      {selectedLotId ? (
        <ReviewForm
          lotId={selectedLotId}
          onReviewComplete={handleReviewComplete}
        />
      ) : (
        <CollectionList
          collection="lots"
          fields={[
            'lot_number',
            'material_type',
            'material_name',
            'date_created',
            'inspections.ai_grade',
            'inspections.ai_confidence',
            'inspections.status',
          ]}
          filter={baseFilter}
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
