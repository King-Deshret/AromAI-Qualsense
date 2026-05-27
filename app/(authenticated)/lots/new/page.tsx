'use client';

/**
 * Lot Registration Form Page (/lots/new)
 *
 * Allows operators to register new lots of incoming materials.
 * Uses Buildpad VForm pattern with Input and SelectDropdown components.
 *
 * Requirements: 1.3, 1.4, 1.5
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Paper,
  Title,
  Stack,
  Group,
  Button,
  Alert,
  Text,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconArrowLeft } from '@tabler/icons-react';
import { Input } from '@/components/ui/input';
import { SelectDropdown } from '@/components/ui/select-dropdown';
import { ItemsService } from '@/lib/buildpad/services';

/** Material type options for the dropdown */
const MATERIAL_TYPE_OPTIONS = [
  { text: 'Raw Fruit', value: 'RAW_FRUIT' },
  { text: 'Raw Botanical', value: 'RAW_BOTANICAL' },
  { text: 'Extract Powder', value: 'EXTRACT_POWDER' },
];

/** Validation error structure */
interface ValidationErrors {
  material_type?: string;
  material_name?: string;
  supplier_name?: string;
  quantity_kg?: string;
}

/**
 * Validates quantity_kg value according to requirements:
 * - Must be > 0.01
 * - Must be <= 999999.99
 * - Must have max 2 decimal places
 */
function validateQuantityKg(value: string): string | undefined {
  if (!value || value.trim() === '') {
    return 'Quantity is required';
  }

  const num = Number(value);

  if (isNaN(num)) {
    return 'Quantity must be a valid number';
  }

  if (num <= 0.01) {
    return 'Quantity must be greater than 0.01 kg';
  }

  if (num > 999999.99) {
    return 'Quantity must not exceed 999999.99 kg';
  }

  // Check max 2 decimal places
  const parts = value.split('.');
  if (parts.length === 2 && parts[1].length > 2) {
    return 'Quantity must have at most 2 decimal places';
  }

  return undefined;
}

/**
 * Validates all form fields and returns errors object.
 * All errors are collected and displayed together.
 */
function validateForm(formData: {
  material_type: string | null;
  material_name: string;
  supplier_name: string;
  quantity_kg: string;
}): ValidationErrors {
  const errors: ValidationErrors = {};

  // material_type validation
  if (!formData.material_type) {
    errors.material_type = 'Material type is required';
  }

  // material_name validation (1-200 chars)
  if (!formData.material_name || formData.material_name.trim() === '') {
    errors.material_name = 'Material name is required';
  } else if (formData.material_name.trim().length > 200) {
    errors.material_name = 'Material name must not exceed 200 characters';
  }

  // supplier_name validation (1-200 chars)
  if (!formData.supplier_name || formData.supplier_name.trim() === '') {
    errors.supplier_name = 'Supplier name is required';
  } else if (formData.supplier_name.trim().length > 200) {
    errors.supplier_name = 'Supplier name must not exceed 200 characters';
  }

  // quantity_kg validation
  const quantityError = validateQuantityKg(formData.quantity_kg);
  if (quantityError) {
    errors.quantity_kg = quantityError;
  }

  return errors;
}

export default function LotRegistrationPage() {
  const router = useRouter();

  // Form state
  const [materialType, setMaterialType] = useState<string | null>(null);
  const [materialName, setMaterialName] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [quantityKg, setQuantityKg] = useState('');

  // UI state
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    // Validate all fields
    const validationErrors = validateForm({
      material_type: materialType,
      material_name: materialName,
      supplier_name: supplierName,
      quantity_kg: quantityKg,
    });

    setErrors(validationErrors);

    // If there are validation errors, stop submission
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      const itemsService = new ItemsService('lots');
      const result = await itemsService.createOne({
        material_type: materialType,
        material_name: materialName.trim(),
        supplier_name: supplierName.trim(),
        quantity_kg: Number(quantityKg),
      });

      // On success, redirect to the lot detail page
      if (result?.id) {
        router.push(`/lots/${result.id}`);
      } else {
        router.push('/lots');
      }
    } catch (err: unknown) {
      // Parse server-side validation errors
      if (err && typeof err === 'object' && 'errors' in err) {
        const serverErrors = (err as { errors: Array<{ message?: string; extensions?: { field?: string } }> }).errors;
        if (Array.isArray(serverErrors) && serverErrors.length > 0) {
          // Map server errors to field-level errors where possible
          const fieldErrors: ValidationErrors = {};
          const generalErrors: string[] = [];

          for (const serverErr of serverErrors) {
            const field = serverErr.extensions?.field;
            const message = serverErr.message || 'Validation failed';
            if (field && field in errors) {
              (fieldErrors as Record<string, string>)[field] = message;
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
          setServerError('Failed to create lot. Please try again.');
        }
      } else if (err instanceof Error) {
        setServerError(err.message);
      } else {
        setServerError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack gap="lg" p="md">
      <Group>
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => router.push('/lots')}
        >
          Back to Lots
        </Button>
      </Group>

      <Title order={2}>Register New Lot</Title>

      <Paper p="xl" shadow="xs" radius="md" maw={600}>
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

        <form onSubmit={handleSubmit} noValidate>
          <Stack gap="md">
            <SelectDropdown
              label="Material Type"
              placeholder="Select material type"
              choices={MATERIAL_TYPE_OPTIONS}
              value={materialType}
              onChange={(val) => {
                setMaterialType(val as string | null);
                if (errors.material_type) {
                  setErrors((prev) => ({ ...prev, material_type: undefined }));
                }
              }}
              required
              error={errors.material_type}
              data-testid="material-type-select"
            />

            <Input
              label="Material Name"
              placeholder="Enter material name"
              value={materialName}
              onChange={(val) => {
                setMaterialName(String(val ?? ''));
                if (errors.material_name) {
                  setErrors((prev) => ({ ...prev, material_name: undefined }));
                }
              }}
              required
              maxLength={200}
              error={errors.material_name}
              data-testid="material-name-input"
            />

            <Input
              label="Supplier Name"
              placeholder="Enter supplier name"
              value={supplierName}
              onChange={(val) => {
                setSupplierName(String(val ?? ''));
                if (errors.supplier_name) {
                  setErrors((prev) => ({ ...prev, supplier_name: undefined }));
                }
              }}
              required
              maxLength={200}
              error={errors.supplier_name}
              data-testid="supplier-name-input"
            />

            <Input
              label="Quantity (kg)"
              placeholder="Enter quantity in kg"
              type="decimal"
              value={quantityKg}
              onChange={(val) => {
                setQuantityKg(String(val ?? ''));
                if (errors.quantity_kg) {
                  setErrors((prev) => ({ ...prev, quantity_kg: undefined }));
                }
              }}
              required
              min={0.01}
              max={999999.99}
              step={0.01}
              error={errors.quantity_kg}
              data-testid="quantity-kg-input"
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
                  {errors.material_type && (
                    <Text size="sm">• {errors.material_type}</Text>
                  )}
                  {errors.material_name && (
                    <Text size="sm">• {errors.material_name}</Text>
                  )}
                  {errors.supplier_name && (
                    <Text size="sm">• {errors.supplier_name}</Text>
                  )}
                  {errors.quantity_kg && (
                    <Text size="sm">• {errors.quantity_kg}</Text>
                  )}
                </Stack>
              </Alert>
            )}

            <Group justify="flex-end" mt="md">
              <Button
                variant="default"
                onClick={() => router.push('/lots')}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={submitting}
                leftSection={<IconCheck size={16} />}
                data-testid="submit-btn"
              >
                Register Lot
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
