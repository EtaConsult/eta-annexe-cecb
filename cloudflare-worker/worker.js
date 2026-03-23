/* ═══════════════════════════════════════════════════════
   CECB Assistant — Cloudflare Worker API Proxy
   Forward Claude & Groq requests with server-side API keys

   Secrets (set via `wrangler secret put`):
     ANTHROPIC_API_KEY
     GROQ_API_KEY
   ═══════════════════════════════════════════════════════ */

const ALLOWED_ORIGINS = [
  'https://etaconsult.github.io',
  'http://localhost:8080',
  'http://127.0.0.1:8080'
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: cors });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/claude') {
        return await proxyClaude(request, env, cors);
      } else if (path === '/whisper') {
        return await proxyWhisper(request, env, cors);
      } else {
        return new Response('Not found', { status: 404, headers: cors });
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }
  }
};

async function proxyClaude(request, env, cors) {
  const body = await request.text();

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: body
  });

  const data = await resp.text();
  return new Response(data, {
    status: resp.status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}

async function proxyWhisper(request, env, cors) {
  const formData = await request.formData();

  const resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + env.GROQ_API_KEY
    },
    body: formData
  });

  const data = await resp.text();
  return new Response(data, {
    status: resp.status,
    headers: { ...cors, 'Content-Type': resp.headers.get('Content-Type') || 'text/plain' }
  });
}
