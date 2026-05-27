/**
 * @buildpad-origin @buildpad/ui-form/vform
 * @buildpad-version 0.2.0
 *
 * This file was copied from Buildpad UI Packages.
 * To update, run: npx @buildpad/cli add vform --overwrite
 *
 * Docs: https://buildpad.dev/components/vform
 */

/**
 * Get default values from field definitions
 * Uses @buildpad/utils getFieldDefault for proper handling of
 * database-generated defaults (now(), gen_random_uuid, etc.)
 */

import type { Field } from '@/lib/buildpad/types';
import { getFieldDefault } from '@/lib/buildpad/utils';
import type { FieldValues } from '../types';

/**
 * Extract default values from field schema
 * Filters out database-generated defaults that shouldn't be used as form values
 */
export function getDefaultValuesFromFields(fields: Field[]): FieldValues {
  const defaults: FieldValues = {};

  for (const field of fields) {
    const defaultValue = getFieldDefault(field);
    if (defaultValue !== undefined) {
      defaults[field.field] = defaultValue;
    }
  }

  return defaults;
}
