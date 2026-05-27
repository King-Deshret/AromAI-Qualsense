/**
 * Authenticated Route-Group Layout
 *
 * Wraps all authenticated pages with DaaSProvider and the AppShell layout
 * (sidebar navigation + header with notifications).
 *
 * Includes a server-side auth check as defense-in-depth — if middleware
 * fails to redirect (e.g. env vars not configured), this layout will
 * redirect unauthenticated users to /login.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DaaSProviderWrapper } from "@/components/DaaSProviderWrapper";
import { AppShellLayout } from "./AppShellLayout";
import type { ReactNode } from "react";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  // Server-side auth check — redirect to login if no valid session
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <DaaSProviderWrapper>
      <AppShellLayout>{children}</AppShellLayout>
    </DaaSProviderWrapper>
  );
}
