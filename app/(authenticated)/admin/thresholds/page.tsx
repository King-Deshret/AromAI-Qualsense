'use client';

/**
 * QC Thresholds Configuration Page (/admin/thresholds)
 *
 * Allows Admins to configure quality thresholds per material type.
 * Displays one form per material_type (RAW_FRUIT, RAW_BOTANICAL, EXTRACT_POWDER).
 * Uses Buildpad Input and SelectDropdown components with field-specific validation.
 *
 * Requirements: 11.1, 11.2, 11.3
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconSettings } from '@tabler/icons-react';
import { Input } from '@/components/ui/input';
import { SelectDropdown } from '@/components/ui/select-dropdown';
import { ItemsService } from '@/lib/buildpad/services';

/** Grade options for the pass_grade dropdown */
const GRADE_OPTIONS = [
  { text: 'A (Highest)', value: 'A' },
  { text: 'B', value: 'B' },
  { text: 'C', value: 'C' },
  { text: 'D', value: 'D' },
  { text: 'F (Lowest)', value: 'F' },
];

/** Material type display labels */
const MATERIAL_TYPE_LABELS: Record<string, string> = {
  RAW_FRUIT: 'Raw Fruit',
  RAW_BOTANICAL: 'Raw Botanical',
  EXTRACT_POWDER: 'Extract Powder',
};

/** Material type display order */
const MATERIAL_TYPES = ['RAW_FRUIT', 'RAW_BOTANICAL', 'EXTRACT_POWDER'] as const;

/** Threshold record from the API */
interface ThresholdRecord {
  id: string;
  material_type: string;
  min_confidence: number;
  pass_grade: string;
  max_color_delta: number;
}

/** Per-field validation errors for a single threshold form */
interface ThresholdErrors {
  min_confidence?: string;
  pass_grade?: string;
  max_color_delta?: string;
}

/** Form state for a single threshold */
interface ThresholdFormState {
  min_confidence: string;
  pass_grade: string | null;
  max_color_delta: string;
}

/**
 * Validates a single threshold form and returns field-specific errors.
 */
function validateThreshold(form: ThresholdFormState): ThresholdErrors {
  const errors: ThresholdErrors = {};

  // min_confidence: decimal between 0.0 and 1.0 inclusive
  if (!form.min_confidence && form.min_confidence !== '0') {
    errors.min_confidence = 'Minimum confidence is required';
  } else {
    const val = Number(form.min_confidence);
    if (isNaN(val)) {
      errors.min_confidence = 'Must be a valid number';
    } else if (val < 0.0) {
      errors.min_confidence = 'Must be at least 0.0';
    } else if (val > 1.0) {
      errors.min_confidence = 'Must not exceed 1.0';
    }
  }

  // pass_grade: one of A, B, C, D, F
  if (!form.pass_grade) {
    errors.pass_grade = 'Pass grade is required';
  } else if (!['A', 'B', 'C', 'D', 'F'].includes(form.pass_grade)) {
    errors.pass_grade = 'Must be one of A, B, C, D, or F';
  }

  // max_color_delta: positive decimal between 0.1 and 100.0 inclusive
  if (!form.max_color_delta && form.max_color_delta !== '0') {
    errors.max_color_delta = 'Maximum color delta is required';
  } else {
    const val = Number(form.max_color_delta);
    if (isNaN(val)) {
      errors.max_color_delta = 'Must be a valid number';
    } else if (val < 0.1) {
      errors.max_color_delta = 'Must be at least 0.1';
    } else if (val > 100.0) {
      errors.max_color_delta = 'Must not exceed 100.0';
    }
  }

  return errors;
}

/**
 * Single threshold form component for one material type.
 */
function ThresholdForm({
  record,
  onSaveSuccess,
}: {
  record: ThresholdRecord;
  onSaveSuccess: () => void;
}) {
  const [form, setForm] = useState<ThresholdFormState>({
    min_confidence: String(record.min_confidence),
    pass_grade: record.pass_grade,
    max_color_delta: String(record.max_color_delta),
  });
  const [errors, setErrors] = useState<ThresholdErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);

    // Validate
    const validationErrors = validateThreshold(form);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSaving(true);

    try {
      const itemsService = new ItemsService('qc_thresholds');
      await itemsService.updateOne(record.id, {
        min_confidence: Number(form.min_confidence),
        pass_grade: form.pass_grade,
        max_color_delta: Number(form.max_color_delta),
      });

      setSaveSuccess(true);
      onSaveSuccess();

      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errors' in err) {
        const serverErrors = (
          err as { errors: Array<{ message?: string; extensions?: { field?: string } }> }
        ).errors;
        if (Array.isArray(serverErrors) && serverErrors.length > 0) {
          // Map server errors to field-level errors
          const fieldErrors: ThresholdErrors = {};
          const generalErrors: string[] = [];

          for (const serverErr of serverErrors) {
            const field = serverErr.extensions?.field;
            const message = serverErr.message || 'Validation failed';
            if (field === 'min_confidence' || field === 'pass_grade' || field === 'max_color_delta') {
              fieldErrors[field] = message;
            } else {
              generalErrors.push(message);
            }
          }

          if (Object.keys(fieldErrors).length > 0) {
            setErrors(fieldErrors);
          }
          if (generalErrors.length > 0) {
            setSaveError(generalErrors.join('. '));
          }
        } else {
          setSaveError('Failed to update threshold. Please try again.');
        }
      } else if (err instanceof Error) {
        setSaveError(err.message);
      } else {
        setSaveError('An unexpected error occurred.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper p="lg" shadow="xs" radius="md" data-testid={`threshold-form-${record.material_type}`}>
      <Stack gap="md">
        <Group gap="xs">
          <IconSettings size={20} />
          <Title order={4}>{MATERIAL_TYPE_LABELS[record.material_type] || record.material_type}</Title>
        </Group>

        {saveError && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" data-testid="save-error">
            {saveError}
          </Alert>
        )}

        {saveSuccess && (
          <Alert icon={<IconCheck size={16} />} color="green" data-testid="save-success">
            Threshold updated successfully!
          </Alert>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <Stack gap="md">
            <Input
              label="Minimum Confidence"
              placeholder="0.0 - 1.0"
              type="decimal"
              value={form.min_confidence}
              onChange={(val) => {
                setForm((prev) => ({ ...prev, min_confidence: String(val ?? '') }));
                if (errors.min_confidence) {
                  setErrors((prev) => ({ ...prev, min_confidence: undefined }));
                }
                setSaveSuccess(false);
              }}
              required
              min={0}
              max={1}
              step={0.01}
              error={errors.min_confidence}
              description="AI confidence threshold (0.0 to 1.0). Inspections below this value will fail."
              data-testid="min-confidence-input"
            />

            <SelectDropdown
              label="Pass Grade"
              placeholder="Select minimum pass grade"
              choices={GRADE_OPTIONS}
              value={form.pass_grade}
              onChange={(val) => {
                setForm((prev) => ({ ...prev, pass_grade: val as string | null }));
                if (errors.pass_grade) {
                  setErrors((prev) => ({ ...prev, pass_grade: undefined }));
                }
                setSaveSuccess(false);
              }}
              required
              error={errors.pass_grade}
              data-testid="pass-grade-select"
            />

            <Input
              label="Maximum Color Delta"
              placeholder="0.1 - 100.0"
              type="decimal"
              value={form.max_color_delta}
              onChange={(val) => {
                setForm((prev) => ({ ...prev, max_color_delta: String(val ?? '') }));
                if (errors.max_color_delta) {
                  setErrors((prev) => ({ ...prev, max_color_delta: undefined }));
                }
                setSaveSuccess(false);
              }}
              required
              min={0.1}
              max={100}
              step={0.1}
              error={errors.max_color_delta}
              description="Maximum allowed color deviation for powder inspections (0.1 to 100.0)."
              data-testid="max-color-delta-input"
            />

            {/* Validation error summary */}
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
                  {errors.min_confidence && (
                    <Text size="sm">• Min Confidence: {errors.min_confidence}</Text>
                  )}
                  {errors.pass_grade && (
                    <Text size="sm">• Pass Grade: {errors.pass_grade}</Text>
                  )}
                  {errors.max_color_delta && (
                    <Text size="sm">• Max Color Delta: {errors.max_color_delta}</Text>
                  )}
                </Stack>
              </Alert>
            )}

            <Group justify="flex-end">
              <Button
                type="submit"
                loading={saving}
                leftSection={<IconCheck size={16} />}
                data-testid="save-threshold-btn"
              >
                Save Threshold
              </Button>
            </Group>
          </Stack>
        </form>
      </Stack>
    </Paper>
  );
}

/**
 * QC Thresholds Configuration Page
 */
export default function QCThresholdsPage() {
  const [thresholds, setThresholds] = useState<ThresholdRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchThresholds = useCallback(async () => {
    try {
      setLoadError(null);
      const itemsService = new ItemsService('qc_thresholds');
      const response = await itemsService.readByQuery({
        fields: ['id', 'material_type', 'min_confidence', 'pass_grade', 'max_color_delta'],
        sort: 'material_type',
      });
      setThresholds(response.data as unknown as ThresholdRecord[]);
    } catch (err) {
      console.error('Failed to load thresholds:', err);
      setLoadError(
        err instanceof Error ? err.message : 'Failed to load QC thresholds.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchThresholds();
  }, [fetchThresholds]);

  if (loading) {
    return (
      <Stack align="center" justify="center" mih={300}>
        <Loader size="lg" />
        <Text c="dimmed">Loading QC thresholds...</Text>
      </Stack>
    );
  }

  if (loadError) {
    return (
      <Stack gap="md" p="md">
        <Title order={2}>QC Thresholds Configuration</Title>
        <Alert icon={<IconAlertCircle size={16} />} color="red" data-testid="load-error">
          {loadError}
        </Alert>
        <Button onClick={fetchThresholds} variant="light">
          Retry
        </Button>
      </Stack>
    );
  }

  // Sort thresholds by the defined material type order
  const sortedThresholds = MATERIAL_TYPES.map((type) =>
    thresholds.find((t) => t.material_type === type)
  ).filter(Boolean) as ThresholdRecord[];

  return (
    <Stack gap="lg" p="md">
      <Stack gap={4}>
        <Title order={2}>QC Thresholds Configuration</Title>
        <Text c="dimmed" size="sm">
          Configure quality control pass/fail thresholds for each material type.
          Changes apply to future inspections only.
        </Text>
      </Stack>

      {sortedThresholds.length === 0 ? (
        <Alert icon={<IconAlertCircle size={16} />} color="yellow">
          No threshold records found. Please ensure the qc_thresholds collection is seeded with default values.
        </Alert>
      ) : (
        <Stack gap="lg">
          {sortedThresholds.map((record) => (
            <ThresholdForm
              key={record.id}
              record={record}
              onSaveSuccess={fetchThresholds}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
