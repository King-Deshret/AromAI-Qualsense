'use client';

/**
 * Dashboard Page (/dashboard)
 *
 * Displays summary metrics for a configurable trailing period (default 30 days):
 * - Total lots grouped by status
 * - Pass rate and fail rate as percentages
 * - Average AI confidence score across completed inspections
 * - Count of lots currently in MANAGER_REVIEW status
 *
 * Role-based views:
 * - Operator: scoped to own lots (created_by = current user) — enforced server-side
 * - QC_Manager: all lots
 * - Admin: all lots + AI service health status + inspection error rate
 *
 * Auto-refreshes metrics every 30 seconds to reflect lot status changes.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Badge,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Alert,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCalendar,
  IconChartBar,
  IconChecks,
  IconClipboardCheck,
  IconHeartbeat,
  IconPackage,
  IconPercentage,
  IconRefresh,
  IconX,
} from '@tabler/icons-react';
import { Input } from '@/components/ui/input';
import { ItemsService } from '@/lib/buildpad/services';

// ─── Types ───────────────────────────────────────────────────────────────────

type UserRole = 'operator' | 'qc_manager' | 'admin';

interface SessionUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
}

interface LotStatusCounts {
  PENDING_QC: number;
  QC_IN_PROGRESS: number;
  QC_PASSED: number;
  QC_FAILED: number;
  MANAGER_REVIEW: number;
  APPROVED: number;
  REJECTED: number;
  QUARANTINED: number;
}

interface DashboardMetrics {
  totalLots: number;
  statusCounts: LotStatusCounts;
  passRate: number;
  failRate: number;
  avgConfidence: number | null;
  lotsInReview: number;
}

interface AdminMetrics {
  aiServiceStatus: 'HEALTHY' | 'UNHEALTHY' | null;
  aiLastHealthCheck: string | null;
  inspectionErrorRate: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

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

const STATUS_LABELS: Record<string, string> = {
  PENDING_QC: 'Pending QC',
  QC_IN_PROGRESS: 'In Progress',
  QC_PASSED: 'Passed',
  QC_FAILED: 'Failed',
  MANAGER_REVIEW: 'In Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  QUARANTINED: 'Quarantined',
};

const TRAILING_DAYS_DEFAULT = 30;
const TRAILING_DAYS_MIN = 1;
const TRAILING_DAYS_MAX = 365;
const AUTO_REFRESH_INTERVAL_MS = 30_000; // 30 seconds

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeRole(role: string | null | undefined): UserRole | null {
  if (!role) return null;
  const lower = role.toLowerCase();
  if (lower === 'admin') return 'admin';
  if (lower === 'qc_manager') return 'qc_manager';
  if (lower === 'operator') return 'operator';
  return null;
}

function getTrailingDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatConfidence(value: number | null): string {
  if (value === null) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) return 'Never';
  try {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Invalid date';
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [adminMetrics, setAdminMetrics] = useState<AdminMetrics | null>(null);
  const [trailingDays, setTrailingDays] = useState<number>(TRAILING_DAYS_DEFAULT);
  const [daysInputValue, setDaysInputValue] = useState<string>(String(TRAILING_DAYS_DEFAULT));
  const [daysError, setDaysError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const userRole = normalizeRole(user?.role);

  // Fetch session user
  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch('/api/auth/session', { credentials: 'include' });
        if (!res.ok) return;
        const json = await res.json();
        setUser(json.data?.user ?? null);
      } catch {
        // Session fetch handled by layout — ignore here
      }
    }
    fetchSession();
  }, []);

  // Fetch dashboard metrics once user is loaded
  const fetchMetrics = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const sinceDate = getTrailingDate(trailingDays);
      const lotsService = new ItemsService('lots');
      const inspectionsService = new ItemsService('inspections');

      // Fetch lots created in the trailing period
      // Server-side permissions handle scoping for operators (created_by = $CURRENT_USER)
      const lotsResponse = await lotsService.readByQuery({
        filter: {
          date_created: { _gte: sinceDate },
        },
        fields: ['id', 'status'],
        limit: -1,
      });

      const lots = lotsResponse.data || [];

      // Calculate status counts
      const statusCounts: LotStatusCounts = {
        PENDING_QC: 0,
        QC_IN_PROGRESS: 0,
        QC_PASSED: 0,
        QC_FAILED: 0,
        MANAGER_REVIEW: 0,
        APPROVED: 0,
        REJECTED: 0,
        QUARANTINED: 0,
      };

      for (const lot of lots) {
        const status = lot.status as string;
        if (status in statusCounts) {
          statusCounts[status as keyof LotStatusCounts]++;
        }
      }

      const totalLots = lots.length;

      // Pass = QC_PASSED + APPROVED, Fail = QC_FAILED + REJECTED + QUARANTINED
      const passCount = statusCounts.QC_PASSED + statusCounts.APPROVED;
      const failCount = statusCounts.QC_FAILED + statusCounts.REJECTED + statusCounts.QUARANTINED;
      const decidedCount = passCount + failCount;

      const passRate = decidedCount > 0 ? (passCount / decidedCount) * 100 : 0;
      const failRate = decidedCount > 0 ? (failCount / decidedCount) * 100 : 0;

      // Fetch completed inspections for average confidence
      const inspectionsResponse = await inspectionsService.readByQuery({
        filter: {
          status: { _eq: 'COMPLETED' },
          date_created: { _gte: sinceDate },
        },
        fields: ['id', 'ai_confidence'],
        limit: -1,
      });

      const inspections = inspectionsResponse.data || [];
      let avgConfidence: number | null = null;

      if (inspections.length > 0) {
        const confidenceValues = inspections
          .map((i) => i.ai_confidence as number | null)
          .filter((c): c is number => c !== null && c !== undefined);

        if (confidenceValues.length > 0) {
          const sum = confidenceValues.reduce((acc, val) => acc + val, 0);
          avgConfidence = sum / confidenceValues.length;
        }
      }

      setMetrics({
        totalLots,
        statusCounts,
        passRate,
        failRate,
        avgConfidence,
        lotsInReview: statusCounts.MANAGER_REVIEW,
      });

      // Admin-specific metrics: AI health + inspection error rate
      if (normalizeRole(user.role) === 'admin') {
        try {
          const configService = new ItemsService('system_config');
          const configResponse = await configService.readByQuery({ limit: 1 });
          const config = configResponse.data?.[0];

          // Inspection error rate: inspections with ERROR status / total inspections
          const allInspectionsResponse = await inspectionsService.readByQuery({
            filter: {
              date_created: { _gte: sinceDate },
            },
            fields: ['id', 'status'],
            limit: -1,
          });

          const allInspections = allInspectionsResponse.data || [];
          const errorInspections = allInspections.filter(
            (i) => i.status === 'ERROR'
          );
          const inspectionErrorRate =
            allInspections.length > 0
              ? (errorInspections.length / allInspections.length) * 100
              : 0;

          setAdminMetrics({
            aiServiceStatus: (config?.ai_service_status as 'HEALTHY' | 'UNHEALTHY') ?? null,
            aiLastHealthCheck: (config?.ai_last_health_check as string) ?? null,
            inspectionErrorRate,
          });
        } catch {
          // Non-critical — admin metrics may fail without blocking dashboard
          setAdminMetrics(null);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard metrics';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user, trailingDays]);

  useEffect(() => {
    if (user) {
      fetchMetrics();
    }
  }, [user, fetchMetrics]);

  // Auto-refresh metrics every 30 seconds (Requirement 12.4)
  useEffect(() => {
    if (!user) return;

    intervalRef.current = setInterval(() => {
      fetchMetrics();
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user, fetchMetrics]);

  // Handle date range input change
  const handleDaysChange = useCallback((value: string | number | null) => {
    const raw = value === null ? '' : String(value);
    setDaysInputValue(raw);

    const num = Number(raw);
    if (raw === '' || isNaN(num)) {
      setDaysError('Enter a number between 1 and 365');
      return;
    }
    if (!Number.isInteger(num)) {
      setDaysError('Must be a whole number');
      return;
    }
    if (num < TRAILING_DAYS_MIN) {
      setDaysError(`Minimum is ${TRAILING_DAYS_MIN} day`);
      return;
    }
    if (num > TRAILING_DAYS_MAX) {
      setDaysError(`Maximum is ${TRAILING_DAYS_MAX} days`);
      return;
    }

    setDaysError(null);
    setTrailingDays(num);
  }, []);

  // ─── Loading State ───────────────────────────────────────────────────────────

  if (loading || !user) {
    return (
      <Stack align="center" justify="center" mih={400}>
        <Loader size="lg" />
        <Text c="dimmed">Loading dashboard...</Text>
      </Stack>
    );
  }

  // ─── Error State ─────────────────────────────────────────────────────────────

  if (error) {
    return (
      <Stack gap="md">
        <Title order={2}>Dashboard</Title>
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          {error}
        </Alert>
      </Stack>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <Stack gap={4}>
          <Title order={2}>Dashboard</Title>
          <Text c="dimmed" size="sm">
            Quality control metrics for the last {trailingDays} day{trailingDays !== 1 ? 's' : ''}
            {userRole === 'operator' && ' (your lots)'}
          </Text>
        </Stack>
        <Group gap="sm" align="flex-end">
          {/* Date range filter (Requirement 12.5) */}
          <Stack gap={2}>
            <Group gap={4}>
              <IconCalendar size={14} color="var(--mantine-color-dimmed)" />
              <Text size="xs" c="dimmed" fw={500}>
                Period (days)
              </Text>
            </Group>
            <div style={{ width: 100 }} data-testid="trailing-days-input">
              <Input
                value={daysInputValue}
                onChange={handleDaysChange}
                type="integer"
                placeholder="30"
              />
            </div>
            {daysError && (
              <Text size="xs" c="red" data-testid="trailing-days-error">
                {daysError}
              </Text>
            )}
          </Stack>
          <Group gap={4}>
            <IconRefresh size={14} color="var(--mantine-color-dimmed)" />
            <Text size="xs" c="dimmed">
              Auto-refreshes every 30s
            </Text>
          </Group>
          {userRole && (
            <Badge variant="light" size="lg">
              {userRole.replace('_', ' ').toUpperCase()}
            </Badge>
          )}
        </Group>
      </Group>

      {metrics && (
        <>
          {/* Summary Metrics Cards */}
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
            {/* Total Lots */}
            <Paper p="md" shadow="xs" radius="md" data-testid="metric-total-lots">
              <Stack gap={4}>
                <Group gap="xs">
                  <IconPackage size={18} color="var(--mantine-color-blue-6)" />
                  <Text size="sm" c="dimmed" fw={500}>
                    Total Lots
                  </Text>
                </Group>
                <Text size="xl" fw={700}>
                  {metrics.totalLots}
                </Text>
              </Stack>
            </Paper>

            {/* Pass Rate */}
            <Paper p="md" shadow="xs" radius="md" data-testid="metric-pass-rate">
              <Stack gap={4}>
                <Group gap="xs">
                  <IconChecks size={18} color="var(--mantine-color-green-6)" />
                  <Text size="sm" c="dimmed" fw={500}>
                    Pass Rate
                  </Text>
                </Group>
                <Text size="xl" fw={700} c="green">
                  {formatPercentage(metrics.passRate)}
                </Text>
              </Stack>
            </Paper>

            {/* Fail Rate */}
            <Paper p="md" shadow="xs" radius="md" data-testid="metric-fail-rate">
              <Stack gap={4}>
                <Group gap="xs">
                  <IconX size={18} color="var(--mantine-color-red-6)" />
                  <Text size="sm" c="dimmed" fw={500}>
                    Fail Rate
                  </Text>
                </Group>
                <Text size="xl" fw={700} c="red">
                  {formatPercentage(metrics.failRate)}
                </Text>
              </Stack>
            </Paper>

            {/* Average AI Confidence */}
            <Paper p="md" shadow="xs" radius="md" data-testid="metric-avg-confidence">
              <Stack gap={4}>
                <Group gap="xs">
                  <IconPercentage size={18} color="var(--mantine-color-violet-6)" />
                  <Text size="sm" c="dimmed" fw={500}>
                    Avg AI Confidence
                  </Text>
                </Group>
                <Text size="xl" fw={700}>
                  {formatConfidence(metrics.avgConfidence)}
                </Text>
              </Stack>
            </Paper>
          </SimpleGrid>

          {/* Lots in Review */}
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
            <Paper p="md" shadow="xs" radius="md" data-testid="metric-in-review">
              <Stack gap={4}>
                <Group gap="xs">
                  <IconClipboardCheck size={18} color="var(--mantine-color-orange-6)" />
                  <Text size="sm" c="dimmed" fw={500}>
                    Lots in Review
                  </Text>
                </Group>
                <Text size="xl" fw={700} c="orange">
                  {metrics.lotsInReview}
                </Text>
              </Stack>
            </Paper>
          </SimpleGrid>

          {/* Lots by Status Breakdown */}
          <Paper p="md" shadow="xs" radius="md" data-testid="status-breakdown">
            <Stack gap="sm">
              <Group gap="xs">
                <IconChartBar size={18} />
                <Text fw={600}>Lots by Status</Text>
              </Group>
              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
                {Object.entries(metrics.statusCounts).map(([status, count]) => (
                  <Group key={status} gap="xs">
                    <Badge
                      color={STATUS_COLORS[status] || 'gray'}
                      variant="light"
                      size="sm"
                    >
                      {STATUS_LABELS[status] || status}
                    </Badge>
                    <Text size="sm" fw={600}>
                      {count}
                    </Text>
                  </Group>
                ))}
              </SimpleGrid>
            </Stack>
          </Paper>

          {/* Admin-only: AI Service Health + Inspection Error Rate */}
          {userRole === 'admin' && adminMetrics && (
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {/* AI Service Health */}
              <Paper p="md" shadow="xs" radius="md" data-testid="admin-ai-health">
                <Stack gap="sm">
                  <Group gap="xs">
                    <IconHeartbeat size={18} />
                    <Text fw={600}>AI Service Health</Text>
                  </Group>
                  <Group gap="lg">
                    <Stack gap={2}>
                      <Text size="xs" c="dimmed">
                        Status
                      </Text>
                      <Badge
                        color={
                          adminMetrics.aiServiceStatus === 'HEALTHY'
                            ? 'green'
                            : adminMetrics.aiServiceStatus === 'UNHEALTHY'
                              ? 'red'
                              : 'gray'
                        }
                        variant="filled"
                        size="lg"
                      >
                        {adminMetrics.aiServiceStatus || 'UNKNOWN'}
                      </Badge>
                    </Stack>
                    <Stack gap={2}>
                      <Text size="xs" c="dimmed">
                        Last Check
                      </Text>
                      <Text size="sm" fw={500}>
                        {formatTimestamp(adminMetrics.aiLastHealthCheck)}
                      </Text>
                    </Stack>
                  </Group>
                </Stack>
              </Paper>

              {/* Inspection Error Rate */}
              <Paper p="md" shadow="xs" radius="md" data-testid="admin-error-rate">
                <Stack gap="sm">
                  <Group gap="xs">
                    <IconAlertCircle size={18} color="var(--mantine-color-red-6)" />
                    <Text fw={600}>Inspection Error Rate</Text>
                  </Group>
                  <Text size="xl" fw={700} c={adminMetrics.inspectionErrorRate > 10 ? 'red' : 'dimmed'}>
                    {formatPercentage(adminMetrics.inspectionErrorRate)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Percentage of inspections with ERROR status (last {trailingDays} days)
                  </Text>
                </Stack>
              </Paper>
            </SimpleGrid>
          )}
        </>
      )}
    </Stack>
  );
}
