/**
 * AI Service Configuration Helper
 *
 * Fetches AI service URL and timeout from the system_config collection.
 * Used by AI proxy routes to enforce configurable timeout and routing.
 */

import { getAuthHeaders, getDaaSUrl } from '@/lib/api/auth-headers';

export interface AiServiceConfig {
  aiServiceUrl: string;
  timeoutMs: number;
}

const DEFAULT_AI_SERVICE_URL = 'https://ai-service.example.com';
const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Fetch AI service configuration from the system_config singleton.
 * Falls back to defaults if the config cannot be read.
 */
export async function getAiServiceConfig(): Promise<AiServiceConfig> {
  try {
    const headers = await getAuthHeaders();
    const daasUrl = getDaaSUrl();

    const configRes = await fetch(
      `${daasUrl}/api/items/system_config?limit=1&fields[]=ai_service_url&fields[]=ai_timeout_seconds`,
      { headers, cache: 'no-store' }
    );

    if (configRes.ok) {
      const configData = await configRes.json();
      const config = Array.isArray(configData.data)
        ? configData.data[0]
        : configData.data;

      return {
        aiServiceUrl: config?.ai_service_url || DEFAULT_AI_SERVICE_URL,
        timeoutMs: config?.ai_timeout_seconds
          ? config.ai_timeout_seconds * 1000
          : DEFAULT_TIMEOUT_MS,
      };
    }
  } catch {
    // Fall through to defaults
  }

  return {
    aiServiceUrl: DEFAULT_AI_SERVICE_URL,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
}
