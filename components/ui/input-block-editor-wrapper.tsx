/**
 * @buildpad-origin @buildpad/ui-interfaces/input-block-editor
 * @buildpad-version 0.2.0
 *
 * This file was copied from Buildpad UI Packages.
 * To update, run: npx @buildpad/cli add input-block-editor --overwrite
 *
 * Docs: https://buildpad.dev/components/input-block-editor
 */

/**
 * InputBlockEditor SSR-Safe Wrapper
 * 
 * EditorJS requires browser APIs (document, Element, etc.) that don't exist on the server.
 * This wrapper uses Next.js dynamic import to load the editor only on the client.
 * 
 * @module @buildpad/ui-interfaces/input-block-editor
 */

'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { Skeleton, Box, Text } from '@mantine/core';
import type { InputBlockEditorProps } from './input-block-editor';

/**
 * Loading placeholder shown while EditorJS loads
 */
function LoadingPlaceholder({ label }: { label?: string }) {
  return (
    <Box>
      {label && (
        <Text size="sm" fw={500} mb={4}>
          {label}
        </Text>
      )}
      <Skeleton height={200} radius="sm" animate />
    </Box>
  );
}

/**
 * SSR-safe InputBlockEditor
 * 
 * Uses dynamic import with ssr: false to prevent server-side rendering errors
 * from EditorJS's use of browser-only APIs.
 */
export const InputBlockEditor = dynamic<InputBlockEditorProps>(
  () => import('./input-block-editor').then(mod => mod.InputBlockEditor),
  {
    ssr: false,
    loading: () => <LoadingPlaceholder />,
  }
);

// Re-export the props type
export type { InputBlockEditorProps } from './input-block-editor';

export default InputBlockEditor;
