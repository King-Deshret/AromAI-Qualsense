/**
 * Authenticated Route-Group Layout
 *
 * Wraps all authenticated pages with DaaSProvider and the AppShell layout
 * (sidebar navigation + header with notifications).
 *
 * Includes a server-side auth check — redirects to /login if:
 * - No valid Supabase session exists
 * - Supabase env vars are not configured (throws → caught → redirect)
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
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }
  } catch (error: unknown) {
    // If redirect() was called, it throws a special Next.js error — re-throw it
    if (error && typeof error === 'object' && 'digest' in error) {
      throw error;
    }
    // Any other error (e.g. missing env vars) → redirect to login
    redirect("/login");
  }

  return (
    <DaaSProviderWrapper>
      <AppShellLayout>{children}</AppShellLayout>
    </DaaSProviderWrapper>
  );
}
