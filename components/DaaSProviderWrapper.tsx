/**
 * DaaS Provider Wrapper
 *
 * Configures DaaSProvider to use the Next.js API proxy routes instead of
 * calling DaaS directly. This avoids CORS issues and ensures auth tokens
 * are handled server-side via the proxy routes.
 *
 * All Buildpad services (ItemsService, FieldsService, etc.) will call
 * /api/items/*, /api/fields/*, etc. on the same origin.
 */

"use client";

import { DaaSProvider } from "@/lib/buildpad/services";
import { useMemo, type ReactNode } from "react";

export function DaaSProviderWrapper({ children }: { children: ReactNode }) {
  const config = useMemo(
    () => ({
      // Use same-origin proxy routes (e.g. /api/items/lots)
      // instead of calling DaaS directly from the browser.
      // Empty string = relative URLs = same origin.
      url: "",
      getToken: async () => {
        // No token needed for proxy mode — the proxy routes
        // read the Supabase session cookie and forward the JWT server-side.
        return null;
      },
    }),
    []
  );

  return (
    <DaaSProvider config={config} autoFetchUser={false}>
      {children}
    </DaaSProvider>
  );
}
