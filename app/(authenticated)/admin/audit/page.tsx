'use client';

/**
 * Audit Log Viewer Page (/admin/audit)
 *
 * Admin-only page displaying DaaS activity log entries.
 * Leverages the built-in DaaS activity logging system (daas_activity table)
 * accessed via GET /api/activity.
 *
 * Features:
 * - Display activity log entries sorted by timestamp descending
 * - Pagination: 25 entries per page
 * - Filters: user, action type, entity type, date range
 *
 * Requirements: 10.3
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Group,
  Loader,
  Pagination,
  Paper,
  Stack,
  Table,
  Text,
  Title,
  Alert,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconFilter,
  IconFilterOff,
  IconHistory,
} from '@tabler/icons-react';
import { Input } from '@/components/ui/input';
import { SelectDropdown } from '@/components/ui/select-dropdown';
import { DateTime } from '@/components/ui/datetime';
import { apiRequest } from '@/lib/buildpad/services/api-request';

/** Activity log entry from DaaS */
interface ActivityEntry {
  id: number;
  action: string;
  collection: string;
  item: string | null;
  user: string | { id: string; email?: string; first_name?: string; last_name?: string } | null;
  timestamp: string;
  ip: string | null;
  user_agent: string | null;
  comment: string | null;
}

/** Activity log API response */
interface ActivityResponse {
  data: ActivityEntry[];
  meta?: {
    total_count?: number;
    filter_count?: number;
  };
}

/** Filter state */
interface AuditFilters {
  user: string;
  action: string | null;
  collection: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}

/** Page size constant */
const PAGE_SIZE = 25;

/** Action type options for filter dropdown */
const ACTION_OPTIONS = [
  { text: 'All Actions', value: '' },
  { text: 'Create', value: 'create' },
  { text: 'Update', value: 'update' },
  { text: 'Delete', value: 'delete' },
  { text: 'Login', value: 'login' },
];

/** Action badge color mapping */
const ACTION_COLORS: Record<string, string> = {
  create: 'green',
  update: 'blue',
  delete: 'red',
  login: 'violet',
  comment: 'gray',
};

/** Collection options for filter dropdown (entity types) */
const COLLECTION_OPTIONS = [
  { text: 'All Entities', value: '' },
  { text: 'Lots', value: 'lots' },
  { text: 'Inspections', value: 'inspections' },
  { text: 'Reviews', value: 'reviews' },
  { text: 'QC Thresholds', value: 'qc_thresholds' },
  { text: 'System Config', value: 'system_config' },
  { text: 'Notifications', value: 'notifications' },
  { text: 'Users', value: 'daas_users' },
];

/**
 * Formats a timestamp for display.
 */
function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return timestamp;
  }
}

/**
 * Extracts a display name from the user field of an activity entry.
 * The user field can be a string (user ID) or an object with user details.
 */
function getUserDisplay(user: ActivityEntry['user']): string {
  if (!user) return 'System';
  if (typeof user === 'string') return user;
  if (typeof user === 'object') {
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
    return name || user.email || user.id || 'Unknown';
  }
  return 'Unknown';
}

/**
 * Formats a collection name for display.
 */
function formatCollection(collection: string): string {
  if (!collection) return '—';
  return collection
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AuditLogPage() {
  // Data state
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Filter state
  const [filters, setFilters] = useState<AuditFilters>({
    user: '',
    action: null,
    collection: null,
    dateFrom: null,
    dateTo: null,
  });
  const [showFilters, setShowFilters] = useState(false);

  /**
   * Fetches activity log entries from DaaS.
   */
  const fetchActivityLog = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const params = new URLSearchParams();
      params.set('sort', '-timestamp');
      params.set('limit', String(PAGE_SIZE));
      params.set('page', String(currentPage));
      params.set('meta', 'total_count,filter_count');

      // Add user fields to get user details
      params.set('fields', 'id,action,collection,item,user.id,user.email,user.first_name,user.last_name,timestamp,ip,comment');

      // Apply filters
      const filterObj: Record<string, unknown> = {};

      if (filters.user && filters.user.trim()) {
        // Search by user email or name
        filterObj['user'] = { id: { _eq: filters.user.trim() } };
      }

      if (filters.action) {
        filterObj['action'] = { _eq: filters.action };
      }

      if (filters.collection) {
        filterObj['collection'] = { _eq: filters.collection };
      }

      if (filters.dateFrom) {
        filterObj['timestamp'] = {
          ...(filterObj['timestamp'] as Record<string, unknown> || {}),
          _gte: filters.dateFrom,
        };
      }

      if (filters.dateTo) {
        filterObj['timestamp'] = {
          ...(filterObj['timestamp'] as Record<string, unknown> || {}),
          _lte: filters.dateTo,
        };
      }

      if (Object.keys(filterObj).length > 0) {
        params.set('filter', JSON.stringify(filterObj));
      }

      const response = await apiRequest<ActivityResponse>(
        `/api/activity?${params.toString()}`
      );

      if (response && response.data) {
        setEntries(response.data);
        setTotalCount(
          response.meta?.filter_count ?? response.meta?.total_count ?? response.data.length
        );
      } else {
        setEntries([]);
        setTotalCount(0);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load audit log';
      setError(message);
      setEntries([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, filters]);

  // Fetch on mount and when page/filters change
  useEffect(() => {
    fetchActivityLog();
  }, [fetchActivityLog]);

  /**
   * Handles filter changes and resets to page 1.
   */
  const handleFilterChange = (key: keyof AuditFilters, value: string | null) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  /**
   * Clears all filters.
   */
  const handleClearFilters = () => {
    setFilters({
      user: '',
      action: null,
      collection: null,
      dateFrom: null,
      dateTo: null,
    });
    setCurrentPage(1);
  };

  /**
   * Checks if any filter is active.
   */
  const hasActiveFilters =
    filters.user.trim() !== '' ||
    filters.action !== null ||
    filters.collection !== null ||
    filters.dateFrom !== null ||
    filters.dateTo !== null;

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between" align="center">
        <Stack gap={4}>
          <Group gap="xs">
            <IconHistory size={28} />
            <Title order={2}>Audit Log</Title>
          </Group>
          <Text c="dimmed" size="sm">
            View all system activity and changes. Entries are sorted by most recent first.
          </Text>
        </Stack>
        <Button
          variant={showFilters ? 'filled' : 'light'}
          leftSection={showFilters ? <IconFilterOff size={16} /> : <IconFilter size={16} />}
          onClick={() => setShowFilters(!showFilters)}
          data-testid="toggle-filters-btn"
        >
          {showFilters ? 'Hide Filters' : 'Show Filters'}
          {hasActiveFilters && (
            <Badge size="xs" circle ml={4}>
              !
            </Badge>
          )}
        </Button>
      </Group>

      {/* Filters Panel */}
      {showFilters && (
        <Paper p="md" shadow="xs" radius="md" data-testid="filters-panel">
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Text size="sm" fw={500}>Filters</Text>
              {hasActiveFilters && (
                <Button
                  variant="subtle"
                  size="xs"
                  onClick={handleClearFilters}
                  data-testid="clear-filters-btn"
                >
                  Clear All
                </Button>
              )}
            </Group>
            <Group grow align="flex-start">
              <Input
                label="User ID"
                placeholder="Enter user ID to filter"
                value={filters.user}
                onChange={(val) => handleFilterChange('user', String(val ?? ''))}
                data-testid="filter-user-input"
              />
              <SelectDropdown
                label="Action Type"
                placeholder="All Actions"
                choices={ACTION_OPTIONS}
                value={filters.action ?? ''}
                onChange={(val) =>
                  handleFilterChange('action', val && val !== '' ? (val as string) : null)
                }
                data-testid="filter-action-select"
              />
              <SelectDropdown
                label="Entity Type"
                placeholder="All Entities"
                choices={COLLECTION_OPTIONS}
                value={filters.collection ?? ''}
                onChange={(val) =>
                  handleFilterChange('collection', val && val !== '' ? (val as string) : null)
                }
                data-testid="filter-collection-select"
              />
            </Group>
            <Group grow align="flex-start">
              <DateTime
                label="Date From"
                placeholder="Start date"
                type="datetime"
                value={filters.dateFrom}
                onChange={(val) => handleFilterChange('dateFrom', val)}
                clearable
                data-testid="filter-date-from"
              />
              <DateTime
                label="Date To"
                placeholder="End date"
                type="datetime"
                value={filters.dateTo}
                onChange={(val) => handleFilterChange('dateTo', val)}
                clearable
                data-testid="filter-date-to"
              />
              {/* Spacer to align with the 3-column row above */}
              <div />
            </Group>
          </Stack>
        </Paper>
      )}

      {/* Error Alert */}
      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" data-testid="error-alert">
          {error}
        </Alert>
      )}

      {/* Results Summary */}
      <Group justify="space-between" align="center">
        <Text size="sm" c="dimmed" data-testid="results-count">
          {loading ? 'Loading...' : `${totalCount} entries found`}
        </Text>
      </Group>

      {/* Activity Log Table */}
      {loading ? (
        <Stack align="center" justify="center" mih={200}>
          <Loader size="lg" />
          <Text c="dimmed">Loading audit log...</Text>
        </Stack>
      ) : entries.length === 0 ? (
        <Paper p="xl" shadow="xs" radius="md">
          <Stack align="center" gap="sm">
            <IconHistory size={48} color="gray" />
            <Text c="dimmed" ta="center">
              {hasActiveFilters
                ? 'No entries match the current filters.'
                : 'No audit log entries found.'}
            </Text>
          </Stack>
        </Paper>
      ) : (
        <Paper shadow="xs" radius="md" style={{ overflow: 'hidden' }}>
          <Table striped highlightOnHover data-testid="audit-log-table">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Timestamp</Table.Th>
                <Table.Th>User</Table.Th>
                <Table.Th>Action</Table.Th>
                <Table.Th>Entity Type</Table.Th>
                <Table.Th>Item ID</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {entries.map((entry) => (
                <Table.Tr key={entry.id} data-testid={`audit-entry-${entry.id}`}>
                  <Table.Td>
                    <Text size="sm">{formatTimestamp(entry.timestamp)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" truncate="end" maw={200}>
                      {getUserDisplay(entry.user)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={ACTION_COLORS[entry.action] || 'gray'}
                      variant="light"
                      size="sm"
                    >
                      {entry.action}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{formatCollection(entry.collection)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed" truncate="end" maw={150} title={entry.item ?? ''}>
                      {entry.item ? entry.item.substring(0, 8) + '...' : '—'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Group justify="center" mt="md">
          <Pagination
            total={totalPages}
            value={currentPage}
            onChange={setCurrentPage}
            data-testid="audit-pagination"
          />
        </Group>
      )}
    </Stack>
  );
}
