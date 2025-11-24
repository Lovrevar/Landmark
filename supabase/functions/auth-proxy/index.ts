import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const url = new URL(req.url);
    const targetPath = url.searchParams.get('path') || '/auth/v1/token';
    
    const body = req.method !== 'GET' ? await req.text() : null;
    
    const targetUrl = `${supabaseUrl}${targetPath}${url.search.replace('?path=' + encodeURIComponent(targetPath), '')}`;
    
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'host') {
        headers[key] = value;
      }
    });
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: body || undefined,
    });
    
    const responseBody = await response.text();
    const responseHeaders = new Headers(corsHeaders);
    response.headers.forEach((value, key) => {
      if (!key.toLowerCase().startsWith('access-control-')) {
        responseHeaders.set(key, value);
      }
    });
    
    return new Response(responseBody, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});