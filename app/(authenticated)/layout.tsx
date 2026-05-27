/**
 * Authenticated Route-Group Layout
 *
 * Wraps all authenticated pages with DaaSProvider and the AppShell layout
 * (sidebar navigation + header with notifications).
 *
 * This layout lives at app/(authenticated)/layout.tsx so that it mounts
 * fresh every time a user logs in and unmounts cleanly on logout.
 */

import { DaaSProviderWrapper } from "@/components/DaaSProviderWrapper";
import { AppShellLayout } from "./AppShellLayout";
import type { ReactNode } from "react";

export default function AuthenticatedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <DaaSProviderWrapper>
      <AppShellLayout>{children}</AppShellLayout>
    </DaaSProviderWrapper>
  );
}
