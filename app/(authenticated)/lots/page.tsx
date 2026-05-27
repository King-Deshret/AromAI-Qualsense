'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Badge, Text } from '@mantine/core';
import { CollectionList } from '@/components/ui/collection-list';
import type { AnyItem } from '@/lib/buildpad/types';
import type { Header } from '@/components/ui/vtable-types';

/**
 * Status badge color mapping for lot statuses.
 */
const STATUS_COLORS: Record<string, string> = {
  PENDING_QC: 'blue',
  QC_IN_PROGRESS: 'yellow',
  QC_PASSED: 'green',
  QC_FAILED: 'red',
  MANAGER_REVIEW: 'orange',
  APPROVED: 'teal',
  REJECTED: 'pink',
  QUARANTINED: 'grape',
};

/**
 * Human-readable labels for lot statuses.
 */
const STATUS_LABELS: Record<string, string> = {
  PENDING_QC: 'Pending QC',
  QC_IN_PROGRESS: 'QC In Progress',
  QC_PASSED: 'QC Passed',
  QC_FAILED: 'QC Failed',
  MANAGER_REVIEW: 'Manager Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  QUARANTINED: 'Quarantined',
};

/**
 * Lot List Page
 *
 * Displays all lots in a paginated, filterable table using Buildpad CollectionList.
 * - Operators see only their own lots (enforced server-side by DaaS permissions).
 * - QC Managers and Admins see all lots.
 * - Supports filtering by status, material_type, and date range.
 * - Pagination options: 10, 25, 50, 100 per page.
 */
export default function LotsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<Record<string, unknown> | null>(null);

  const handleItemClick = useCallback(
    (item: AnyItem) => {
      router.push(`/lots/${item.id}`);
    },
    [router],
  );

  const handleCreate = useCallback(() => {
    router.push('/lots/new');
  }, [router]);

  const handleFilterChange = useCallback(
    (newFilter: Record<string, unknown> | null) => {
      setFilter(newFilter);
    },
    [],
  );

  /**
   * Custom cell renderer for status badges and formatted dates.
   */
  const renderCell = useCallback(
    (item: AnyItem, header: Header) => {
      if (header.value === 'status') {
        const status = item.status as string;
        if (!status) return null;
        return (
          <Badge
            color={STATUS_COLORS[status] || 'gray'}
            variant="light"
            size="sm"
          >
            {STATUS_LABELS[status] || status}
          </Badge>
        );
      }

      if (header.value === 'material_type') {
        const type = item.material_type as string;
        if (!type) return null;
        const label = type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
        return (
          <Text size="sm" truncate="end">
            {label}
          </Text>
        );
      }

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

  return (
    <CollectionList
      collection="lots"
      fields={[
        'lot_number',
        'material_type',
        'material_name',
        'supplier_name',
        'status',
        'date_created',
      ]}
      filter={filter ?? undefined}
      enableFilter
      enableSearch
      enableSort
      enableCreate
      enableSelection={false}
      limit={25}
      primaryKeyField="id"
      onItemClick={handleItemClick}
      onCreate={handleCreate}
      onFilterChange={handleFilterChange}
      renderCell={renderCell}
    />
  );
}
