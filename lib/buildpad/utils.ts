/**
 * @buildpad-origin @buildpad/cli/utils/utils
 * @buildpad-version 1.0.0
 *
 * This file was copied from Buildpad UI Packages.
 * To update, run: npx @buildpad/cli add utils/utils --overwrite
 *
 * Docs: https://buildpad.dev/components/utils/utils
 */

/**
 * Buildpad Utils - Barrel Export
 * 
 * This file re-exports all utilities from the utils folder.
 * It exists to support both import patterns:
 *   - import { cn } from '@/lib/buildpad/utils'     (folder import)
 *   - import { cn } from '@/lib/buildpad/utils.ts'  (file import)
 * 
 * @buildpad-origin lib/utils
 * @buildpad-version 1.0.0
 */

// Re-export everything from the utils folder
export * from './utils/index';
