/**
 * @buildpad-origin @buildpad/cli/utils/utils-index
 * @buildpad-version 1.0.0
 *
 * This file was copied from Buildpad UI Packages.
 * To update, run: npx @buildpad/cli add utils/utils-index --overwrite
 *
 * Docs: https://buildpad.dev/components/utils/utils-index
 */

// @ts-nocheck
/**
 * Buildpad Utils
 * 
 * Re-exports all utility functions.
 * This file is copied to your project and can be customized.
 */

// Basic utilities
export { cn, formatFileSize, getFileCategory, getAssetUrl, slugify, slugify as generateSlug, debounce, isValidPrimaryKey, deepMerge, generateId } from '../common-utils';

// New item detection
export { isNewItem, isExistingItem } from '../is-new-item';

// Field interface mapping (from @buildpad/utils)
export { 
  getFieldInterface,
  getFieldDefault,
  getFieldDisplayName,
  formatFieldTitle,
  type InterfaceType,
  type InterfaceConfig,
} from '../field-interface-mapper';

// Field utilities
export {
  isFieldReadOnly,
  isPresentationField,
  getFieldValidation,
  formatFieldValue,
} from '../field-interface-mapper';

// Interface type definitions
export type {
  InterfaceDefinition,
  InterfaceGroup,
} from '../interface-types';
