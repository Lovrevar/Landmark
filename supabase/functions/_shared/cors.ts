// Shared CORS helpers for browser-callable edge functions.
// Every browser-facing Response must spread `corsHeaders` into its headers.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
} as const

// Returns a 200 preflight response when the request is an OPTIONS preflight,
// otherwise null so the caller can continue with the real handler.
export function handlePreflight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null
  return new Response(null, { status: 200, headers: corsHeaders })
}
