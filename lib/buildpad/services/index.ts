/**
 * @buildpad-origin @buildpad/cli/services/index
 * @buildpad-version 1.0.0
 *
 * This file was copied from Buildpad UI Packages.
 * To update, run: npx @buildpad/cli add services/index --overwrite
 *
 * Docs: https://buildpad.dev/components/services/index
 */

/**
 * Buildpad Services
 *
 * Re-exports all service classes.
 * This file is copied to your project and can be customized.
 */

export { apiRequest, type ApiRequestOptions } from "./api-request";
export { CollectionsService, createCollectionsService } from "./collections";
export { FieldsService, createFieldsService } from "./fields";
export {
  ItemsService,
  createItemsService,
} from "./items";
export {
  PermissionsService,
  createPermissionsService,
  type CollectionAccess,
  type CollectionActionAccess,
  type FieldPermissions,
} from "./permissions";

// DaaS Context Provider — browser calls DaaS directly, no Next.js proxy needed.
// CORS is handled on the DaaS side via CORS_ORIGINS env variable.
export {
  DaaSProvider,
  buildApiUrl,
  getApiHeaders,
  getApiHeadersAsync,
  getGlobalDaaSConfig,
  setGlobalDaaSConfig,
  useDaaSContext,
  useDaaSContextOptional,
  useIsDaaSReady,
  useIsDirectDaaSMode,
  type DaaSConfig,
  type DaaSContextValue,
  type DaaSProviderProps,
  type DaaSUser,
} from "./daas-context";
