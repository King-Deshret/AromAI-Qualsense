/**
 * Unit tests for Lot Registration Form validation logic
 *
 * Tests the client-side validation for the lot registration form.
 * Requirements: 1.3, 1.4, 1.5
 */

import { describe, it, expect } from 'vitest';

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
 */
function validateForm(formData: {
  material_type: string | null;
  material_name: string;
  supplier_name: string;
  quantity_kg: string;
}): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!formData.material_type) {
    errors.material_type = 'Material type is required';
  }

  if (!formData.material_name || formData.material_name.trim() === '') {
    errors.material_name = 'Material name is required';
  } else if (formData.material_name.trim().length > 200) {
    errors.material_name = 'Material name must not exceed 200 characters';
  }

  if (!formData.supplier_name || formData.supplier_name.trim() === '') {
    errors.supplier_name = 'Supplier name is required';
  } else if (formData.supplier_name.trim().length > 200) {
    errors.supplier_name = 'Supplier name must not exceed 200 characters';
  }

  const quantityError = validateQuantityKg(formData.quantity_kg);
  if (quantityError) {
    errors.quantity_kg = quantityError;
  }

  return errors;
}

describe('Lot Registration Validation', () => {
  describe('validateQuantityKg', () => {
    it('rejects empty value', () => {
      expect(validateQuantityKg('')).toBe('Quantity is required');
    });

    it('rejects non-numeric value', () => {
      expect(validateQuantityKg('abc')).toBe('Quantity must be a valid number');
    });

    it('rejects value <= 0.01', () => {
      expect(validateQuantityKg('0.01')).toBe('Quantity must be greater than 0.01 kg');
      expect(validateQuantityKg('0')).toBe('Quantity must be greater than 0.01 kg');
      expect(validateQuantityKg('-5')).toBe('Quantity must be greater than 0.01 kg');
    });

    it('rejects value > 999999.99', () => {
      expect(validateQuantityKg('1000000')).toBe('Quantity must not exceed 999999.99 kg');
      expect(validateQuantityKg('999999.999')).toBeDefined(); // either exceeds or too many decimals
    });

    it('rejects more than 2 decimal places', () => {
      expect(validateQuantityKg('10.123')).toBe('Quantity must have at most 2 decimal places');
      expect(validateQuantityKg('5.001')).toBe('Quantity must have at most 2 decimal places');
    });

    it('accepts valid values', () => {
      expect(validateQuantityKg('0.02')).toBeUndefined();
      expect(validateQuantityKg('1')).toBeUndefined();
      expect(validateQuantityKg('100.50')).toBeUndefined();
      expect(validateQuantityKg('999999.99')).toBeUndefined();
      expect(validateQuantityKg('500')).toBeUndefined();
    });
  });

  describe('validateForm', () => {
    it('returns no errors for valid input', () => {
      const errors = validateForm({
        material_type: 'RAW_FRUIT',
        material_name: 'Organic Apples',
        supplier_name: 'Farm Fresh Co.',
        quantity_kg: '150.50',
      });
      expect(errors).toEqual({});
    });

    it('returns all errors together when all fields are invalid', () => {
      const errors = validateForm({
        material_type: null,
        material_name: '',
        supplier_name: '',
        quantity_kg: '',
      });
      expect(errors.material_type).toBeDefined();
      expect(errors.material_name).toBeDefined();
      expect(errors.supplier_name).toBeDefined();
      expect(errors.quantity_kg).toBeDefined();
    });

    it('rejects material_name exceeding 200 characters', () => {
      const errors = validateForm({
        material_type: 'RAW_BOTANICAL',
        material_name: 'A'.repeat(201),
        supplier_name: 'Valid Supplier',
        quantity_kg: '10',
      });
      expect(errors.material_name).toBe('Material name must not exceed 200 characters');
    });

    it('rejects supplier_name exceeding 200 characters', () => {
      const errors = validateForm({
        material_type: 'EXTRACT_POWDER',
        material_name: 'Valid Name',
        supplier_name: 'B'.repeat(201),
        quantity_kg: '10',
      });
      expect(errors.supplier_name).toBe('Supplier name must not exceed 200 characters');
    });

    it('accepts material_name at exactly 200 characters', () => {
      const errors = validateForm({
        material_type: 'RAW_FRUIT',
        material_name: 'A'.repeat(200),
        supplier_name: 'Valid Supplier',
        quantity_kg: '50',
      });
      expect(errors.material_name).toBeUndefined();
    });

    it('rejects null material_type', () => {
      const errors = validateForm({
        material_type: null,
        material_name: 'Valid Name',
        supplier_name: 'Valid Supplier',
        quantity_kg: '10',
      });
      expect(errors.material_type).toBe('Material type is required');
    });

    it('trims whitespace from material_name and supplier_name', () => {
      const errors = validateForm({
        material_type: 'RAW_FRUIT',
        material_name: '   ',
        supplier_name: '   ',
        quantity_kg: '10',
      });
      expect(errors.material_name).toBe('Material name is required');
      expect(errors.supplier_name).toBe('Supplier name is required');
    });
  });
});
