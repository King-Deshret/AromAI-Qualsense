/**
 * @buildpad-origin @buildpad/services/services/index
 * @buildpad-version 0.2.0
 *
 * This file was copied from Buildpad UI Packages.
 * To update, run: npx @buildpad/cli add services/index --overwrite
 *
 * Docs: https://buildpad.dev/components/services/index
 */

/**
 * @buildpad/services/auth
 * 
 * Authentication and authorization utilities for DaaS applications.
 * Provides reusable session management, permission enforcement, and filter utilities.
 * 
 * @module @buildpad/services/auth
 */

export {
  // Configuration
  configureAuth,
  getAuthConfig,
  // Session management
  createAuthenticatedClient,
  getCurrentUser,
  isAdmin,
  getUserRole,
  getUserProfile,
  getAccountability,
  isAuthenticationError,
  // Error types
  AuthenticationError,
  // Types
  type AuthClientConfig,
  type AuthenticatedClient,
  type AccountabilityInfo,
} from './session';

export {
  enforcePermission,
  getAccessibleFields,
  getUserPermissions,
  validateFieldsAccess,
  filterFields,
  filterFieldsArray,
  filterResponseFields,
  isFieldAccessible,
  getPermissionFilters,
  applyFilterToQuery,
  resolveFilterDynamicValues,
  PermissionError,
  type PermissionCheck,
  type PermissionDetails,
  type FilterObject,
} from './enforcer';

export {
  applyFilter,
  applyFieldOperators,
  type QueryBuilder,
  FILTER_OPERATORS,
} from './filter-to-query';
