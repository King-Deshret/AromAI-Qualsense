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
 * Utility exports for VForm
 * 
 * VForm-specific utilities that don't exist in @buildpad/utils.
 * For field interface mapping and readonly checks, use @buildpad/utils directly.
 */

export { getDefaultValuesFromFields } from './get-default-values';
export { 
  getFormFields, 
  isFieldVisible, 
  isGroupField, 
  getFieldsInGroup 
} from './get-form-fields';
export { 
  updateFieldWidths, 
  getFieldWidthClass 
} from './update-field-widths';
export { applyConditions, type FieldCondition } from './apply-conditions';
export { pushGroupOptionsDown } from './push-group-options-down';
export { updateSystemDivider } from './update-system-divider';
export { setPrimaryKeyReadonly } from './set-primary-key-readonly';

// Re-export commonly used utilities from @buildpad/utils for convenience
export { 
  getFieldInterface,
  getFieldDefault,
  isFieldReadOnly,
  getFieldValidation,
  isPresentationField,
  type InterfaceConfig,
  type InterfaceType,
} from '@/lib/buildpad/utils';
