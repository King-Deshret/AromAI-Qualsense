'use client';

/**
 * System Configuration Page (/admin/config)
 *
 * Allows Admins to configure system-level settings including:
 * - Maximum inspection retry count (integer 1-10)
 * - AI service response timeout in seconds (decimal 1.0-30.0)
 * - Displays AI service health status and last health check timestamp
 *
 * Requirements: 19.1, 19.2, 19.3, 19.4
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Paper,
  Title,
  Stack,
  Group,
  Button,
  Alert,
  Text,
  Badge,
  Loader,
  Divider,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCheck,
  IconSettings,
  IconHeartbeat,
} from '@tabler/icons-react';
import { Input } from '@/components/ui/input';
import { ItemsService } from '@/lib/buildpad/services';

/** Validation error structure */
interface ValidationErrors {
  max_retry_count?: string;
  ai_timeout_seconds?: string;
}

/** System config data from the API */
interface SystemConfig {
  id: string;
  max_retry_count: number;
  ai_timeout_seconds: number;
  ai_health_check_interval: number;
  ai_service_url: string;
  ai_service_status: 'HEALTHY' | 'UNHEALTHY';
  ai_last_health_check: string | null;
}

/**
 * Validates max_retry_count:
 * - Must be a positive integer between 1 and 10
 */
function validateMaxRetryCount(value: number | string | null): string | undefined {
  if (value === null || value === '' || value === undefined) {
    return 'Maximum retry count is required';
  }

  const num = Number(value);

  if (isNaN(num)) {
    return 'Maximum retry count must be a valid number';
  }

  if (!Number.isInteger(num)) {
    return 'Maximum retry count must be a whole number (integer)';
  }

  if (num < 1) {
    return 'Maximum retry count must be at least 1';
  }

  if (num > 10) {
    return 'Maximum retry count must not exceed 10';
  }

  return undefined;
}

/**
 * Validates ai_timeout_seconds:
 * - Must be a positive decimal between 1.0 and 30.0
 */
function validateAiTimeoutSeconds(value: number | string | null): string | undefined {
  if (value === null || value === '' || value === undefined) {
    return 'AI timeout is required';
  }

  const num = Number(value);

  if (isNaN(num)) {
    return 'AI timeout must be a valid number';
  }

  if (num < 1.0) {
    return 'AI timeout must be at least 1.0 seconds';
  }

  if (num > 30.0) {
    return 'AI timeout must not exceed 30.0 seconds';
  }

  return undefined;
}

/**
 * Validates all form fields and returns errors object.
 */
function validateForm(formData: {
  max_retry_count: number | string | null;
  ai_timeout_seconds: number | string | null;
}): ValidationErrors {
  const errors: ValidationErrors = {};

  const retryError = validateMaxRetryCount(formData.max_retry_count);
  if (retryError) {
    errors.max_retry_count = retryError;
  }

  const timeoutError = validateAiTimeoutSeconds(formData.ai_timeout_seconds);
  if (timeoutError) {
    errors.ai_timeout_seconds = timeoutError;
  }

  return errors;
}

/**
 * Formats a timestamp for display.
 */
function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) {
    return 'Never';
  }

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
    return 'Invalid date';
  }
}

export default function SystemConfigPage() {
  // Form state
  const [maxRetryCount, setMaxRetryCount] = useState<number | string | null>(3);
  const [aiTimeoutSeconds, setAiTimeoutSeconds] = useState<number | string | null>(5.0);

  // Health status display state
  const [aiServiceStatus, setAiServiceStatus] = useState<'HEALTHY' | 'UNHEALTHY' | null>(null);
  const [aiLastHealthCheck, setAiLastHealthCheck] = useState<string | null>(null);

  // Config record ID (singleton)
  const [configId, setConfigId] = useState<string | null>(null);

  // UI state
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load system config on mount
  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      setServerError(null);

      const itemsService = new ItemsService('system_config');
      const response = await itemsService.readByQuery({ limit: 1 });

      if (response.data && response.data.length > 0) {
        const config = response.data[0] as unknown as SystemConfig;
        setConfigId(config.id);
        setMaxRetryCount(config.max_retry_count);
        setAiTimeoutSeconds(config.ai_timeout_seconds);
        setAiServiceStatus(config.ai_service_status);
        setAiLastHealthCheck(config.ai_last_health_check);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setServerError(err.message);
      } else {
        setServerError('Failed to load system configuration.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSuccess(false);

    // Validate all fields
    const validationErrors = validateForm({
      max_retry_count: maxRetryCount,
      ai_timeout_seconds: aiTimeoutSeconds,
    });

    setErrors(validationErrors);

    // If there are validation errors, stop submission
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    if (!configId) {
      setServerError('System configuration record not found. Please contact an administrator.');
      return;
    }

    setSaving(true);

    try {
      const itemsService = new ItemsService('system_config');
      await itemsService.updateOne(configId, {
        max_retry_count: Number(maxRetryCount),
        ai_timeout_seconds: Number(aiTimeoutSeconds),
      });

      setSuccess(true);
    } catch (err: unknown) {
      // Parse server-side validation errors
      if (err && typeof err === 'object' && 'errors' in err) {
        const serverErrors = (err as { errors: Array<{ message?: string; extensions?: { field?: string } }> }).errors;
        if (Array.isArray(serverErrors) && serverErrors.length > 0) {
          const fieldErrors: ValidationErrors = {};
          const generalErrors: string[] = [];

          for (const serverErr of serverErrors) {
            const field = serverErr.extensions?.field;
            const message = serverErr.message || 'Validation failed';
            if (field === 'max_retry_count' || field === 'ai_timeout_seconds') {
              fieldErrors[field] = message;
            } else {
              generalErrors.push(message);
            }
          }

          if (Object.keys(fieldErrors).length > 0) {
            setErrors(fieldErrors);
          }
          if (generalErrors.length > 0) {
            setServerError(generalErrors.join('. '));
          } else if (Object.keys(fieldErrors).length === 0) {
            setServerError(serverErrors.map(e => e.message).join('. '));
          }
        } else {
          setServerError('Failed to update configuration. Please try again.');
        }
      } else if (err instanceof Error) {
        setServerError(err.message);
      } else {
        setServerError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Stack gap="lg" p="md" align="center" justify="center" mih={300}>
        <Loader size="lg" />
        <Text c="dimmed">Loading system configuration...</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg" p="md">
      <Group>
        <IconSettings size={28} />
        <Title order={2}>System Configuration</Title>
      </Group>

      {/* AI Service Health Status Section */}
      <Paper p="lg" shadow="xs" radius="md" data-testid="ai-health-section">
        <Stack gap="md">
          <Group>
            <IconHeartbeat size={20} />
            <Title order={4}>AI Service Health</Title>
          </Group>

          <Group gap="xl">
            <Stack gap={4}>
              <Text size="sm" c="dimmed">Status</Text>
              {aiServiceStatus === 'HEALTHY' ? (
                <Badge
                  color="green"
                  variant="filled"
                  size="lg"
                  data-testid="ai-status-badge"
                >
                  HEALTHY
                </Badge>
              ) : aiServiceStatus === 'UNHEALTHY' ? (
                <Badge
                  color="red"
                  variant="filled"
                  size="lg"
                  data-testid="ai-status-badge"
                >
                  UNHEALTHY
                </Badge>
              ) : (
                <Badge
                  color="gray"
                  variant="filled"
                  size="lg"
                  data-testid="ai-status-badge"
                >
                  UNKNOWN
                </Badge>
              )}
            </Stack>

            <Stack gap={4}>
              <Text size="sm" c="dimmed">Last Health Check</Text>
              <Text size="sm" fw={500} data-testid="ai-last-health-check">
                {formatTimestamp(aiLastHealthCheck)}
              </Text>
            </Stack>
          </Group>
        </Stack>
      </Paper>

      <Divider />

      {/* Configuration Form Section */}
      <Paper p="xl" shadow="xs" radius="md" maw={600} data-testid="config-form-section">
        <Title order={4} mb="md">Configuration Parameters</Title>

        {serverError && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="red"
            mb="md"
            data-testid="server-error"
          >
            {serverError}
          </Alert>
        )}

        {success && (
          <Alert
            icon={<IconCheck size={16} />}
            color="green"
            mb="md"
            data-testid="success-message"
          >
            Configuration updated successfully!
          </Alert>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <Stack gap="md">
            <Input
              label="Maximum Retry Count"
              placeholder="Enter max retry count (1-10)"
              type="integer"
              value={maxRetryCount as number}
              onChange={(val) => {
                setMaxRetryCount(val);
                setSuccess(false);
                if (errors.max_retry_count) {
                  setErrors((prev) => ({ ...prev, max_retry_count: undefined }));
                }
              }}
              required
              min={1}
              max={10}
              step={1}
              error={errors.max_retry_count}
              description="Number of times an inspection can be retried after an AI service error (1-10)"
              data-testid="max-retry-count-input"
            />

            <Input
              label="AI Timeout (seconds)"
              placeholder="Enter AI timeout in seconds (1.0-30.0)"
              type="decimal"
              value={aiTimeoutSeconds as number}
              onChange={(val) => {
                setAiTimeoutSeconds(val);
                setSuccess(false);
                if (errors.ai_timeout_seconds) {
                  setErrors((prev) => ({ ...prev, ai_timeout_seconds: undefined }));
                }
              }}
              required
              min={1.0}
              max={30.0}
              step={0.1}
              error={errors.ai_timeout_seconds}
              description="Maximum time to wait for AI service response before treating as timeout (1.0-30.0 seconds)"
              data-testid="ai-timeout-seconds-input"
            />

            {/* Display all validation errors together */}
            {Object.keys(errors).length > 0 && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                color="red"
                variant="light"
                data-testid="validation-summary"
              >
                <Text size="sm" fw={500} mb={4}>
                  Please fix the following errors:
                </Text>
                <Stack gap={2}>
                  {errors.max_retry_count && (
                    <Text size="sm">• {errors.max_retry_count}</Text>
                  )}
                  {errors.ai_timeout_seconds && (
                    <Text size="sm">• {errors.ai_timeout_seconds}</Text>
                  )}
                </Stack>
              </Alert>
            )}

            <Group justify="flex-end" mt="md">
              <Button
                type="submit"
                loading={saving}
                leftSection={<IconCheck size={16} />}
                data-testid="save-config-btn"
              >
                Save Configuration
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
