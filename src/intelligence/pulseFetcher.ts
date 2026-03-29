/**
 * Pulse Fetcher
 * Thin adapter for querying Pulse data from the intelligence module.
 * Re-uses the same Supabase REST pattern as pulseChatService.ts.
 */

// @ts-ignore - defined by vite.config.ts
const PULSE_URL = process.env.VITE_SUPABASE_URL as string;
// @ts-ignore - defined by vite.config.ts
const PULSE_KEY = process.env.VITE_SUPABASE_ANON_KEY as string;

/**
 * Fetch data from Pulse via Supabase REST API
 */
export async function fetchFromPulseApi(endpoint: string, query: string = ''): Promise<any> {
  const response = await fetch(`${PULSE_URL}/rest/v1/${endpoint}${query}`, {
    headers: {
      'apikey': PULSE_KEY,
      'Authorization': `Bearer ${PULSE_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Pulse API error: ${errorText}`);
  }

  return response.json();
}

/**
 * Check if Pulse connection is working
 */
export async function checkPulseConnection(): Promise<boolean> {
  if (!PULSE_URL || !PULSE_KEY) return false;

  try {
    const response = await fetch(`${PULSE_URL}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'apikey': PULSE_KEY,
        'Authorization': `Bearer ${PULSE_KEY}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
