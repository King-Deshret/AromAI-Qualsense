/**
 * @buildpad-origin @buildpad/hooks/hooks/useDaaSContext
 * @buildpad-version 0.2.0
 *
 * This file was copied from Buildpad UI Packages.
 * To update, run: npx @buildpad/cli add hooks/useDaaSContext --overwrite
 *
 * Docs: https://buildpad.dev/components/hooks/useDaaSContext
 */

/**
 * useDaaSContext Hook
 *
 * Re-exports DaaS context utilities from @buildpad/services.
 * The browser calls DaaS directly — no Next.js proxy routes are used.
 * CORS is handled on the DaaS side via CORS_ORIGINS env variable.
 *
 * @module @buildpad/hooks/useDaaSContext
 */

export {
  DaaSProvider,
  useDaaSContext,
  useIsDaaSReady,
  useIsDirectDaaSMode,
  type DaaSConfig,
  type DaaSContextValue,
  type DaaSProviderProps,
  type DaaSUser,
} from '@/lib/buildpad/services';

export { useDaaSContext as default } from '@/lib/buildpad/services';
