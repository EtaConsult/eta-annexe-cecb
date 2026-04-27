/* ═══════════════════════════════════════════════════════
   CECB Assistant — Cloudflare Worker API Proxy
   Forward Claude / Groq / GitHub requests with server-side keys.

   Required env (set via `wrangler secret put` or dashboard):
     ANTHROPIC_API_KEY
     GROQ_API_KEY
     GITHUB_TOKEN
     WORKER_SHARED_SECRET   (32+ random bytes — clients send as Bearer)

   Required KV binding (see wrangler.toml):
     RATE_LIMIT             (namespace for per-IP + global counters)
   ═══════════════════════════════════════════════════════ */

const ALLOWED_ORIGINS = [
  'https://etaconsult.github.io',
  'http://localhost:8080',
  'http://127.0.0.1:8080'
];

// Rate-limit configuration
const RATE_LIMIT_PER_IP = 50;        // requests / window / IP
const RATE_LIMIT_GLOBAL = 500;       // requests / window globally (kill switch)
const RATE_LIMIT_WINDOW_S = 3600;    // 1 hour fixed window

/* ─── Helpers ──────────────────────────────────────────── */

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function jsonError(msg, status, cors) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...(cors || {}), 'Content-Type': 'application/json' }
  });
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function logAudit(entry) {
  // `wrangler tail` captures these; visible in CF dashboard logs too
  try { console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry })); }
  catch (e) { /* ignore */ }
}

async function checkRateLimit(env, ip) {
  if (!env.RATE_LIMIT) return { ok: true, skipped: true };
  const win = Math.floor(Date.now() / 1000 / RATE_LIMIT_WINDOW_S);
  const ipKey = `rl:ip:${ip}:${win}`;
  const globalKey = `rl:global:${win}`;

  const [ipRaw, globalRaw] = await Promise.all([
    env.RATE_LIMIT.get(ipKey),
    env.RATE_LIMIT.get(globalKey)
  ]);
  const ipCount = parseInt(ipRaw || '0', 10) || 0;
  const globalCount = parseInt(globalRaw || '0', 10) || 0;

  if (globalCount >= RATE_LIMIT_GLOBAL) return { ok: false, scope: 'global', count: globalCount };
  if (ipCount >= RATE_LIMIT_PER_IP) return { ok: false, scope: 'ip', count: ipCount };

  // Best-effort increment (KV is eventually consistent — acceptable for our scale)
  const ttl = RATE_LIMIT_WINDOW_S * 2;
  await Promise.all([
    env.RATE_LIMIT.put(ipKey, String(ipCount + 1), { expirationTtl: ttl }),
    env.RATE_LIMIT.put(globalKey, String(globalCount + 1), { expirationTtl: ttl })
  ]);

  return { ok: true };
}

/* ─── Entry point ──────────────────────────────────────── */

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const url = new URL(request.url);
    const path = url.pathname;

    // 1. CORS — reject unknown origins outright (no fallback)
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      logAudit({ ip, origin, path, status: 403, reason: 'origin_rejected' });
      return new Response('Origin not allowed', { status: 403 });
    }
    const cors = corsHeaders(origin || ALLOWED_ORIGINS[0]);

    // 2. Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== 'POST' && request.method !== 'GET') {
      return jsonError('Method not allowed', 405, cors);
    }

    // 3. Bearer token — pre-shared secret with client
    if (!env.WORKER_SHARED_SECRET) {
      logAudit({ ip, origin, path, status: 500, reason: 'shared_secret_missing' });
      return jsonError('Worker not configured (missing WORKER_SHARED_SECRET)', 500, cors);
    }
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token || !timingSafeEqual(token, env.WORKER_SHARED_SECRET)) {
      logAudit({ ip, origin, path, status: 401, reason: 'bad_token' });
      return jsonError('Unauthorized', 401, cors);
    }

    // 4. Rate limit
    const rl = await checkRateLimit(env, ip);
    if (!rl.ok) {
      logAudit({ ip, origin, path, status: 429, reason: 'rate_limit_' + rl.scope, count: rl.count });
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', scope: rl.scope }),
        {
          status: 429,
          headers: {
            ...cors,
            'Content-Type': 'application/json',
            'Retry-After': String(RATE_LIMIT_WINDOW_S)
          }
        }
      );
    }

    // 5. Dispatch
    try {
      let resp;
      if (path === '/claude') {
        resp = await proxyClaude(request, env, cors);
      } else if (path === '/whisper') {
        resp = await proxyWhisper(request, env, cors);
      } else if (path === '/github' || path.startsWith('/github/')) {
        resp = await proxyGitHub(request, env, cors);
      } else {
        resp = jsonError('Not found', 404, cors);
      }
      logAudit({ ip, origin, path, status: resp.status });
      return resp;
    } catch (err) {
      logAudit({ ip, origin, path, status: 500, reason: 'exception', message: err.message });
      return jsonError(err.message, 500, cors);
    }
  }
};

/* ─── Upstream proxies ─────────────────────────────────── */

async function proxyClaude(request, env, cors) {
  const body = await request.text();
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body
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
    headers: { 'Authorization': 'Bearer ' + env.GROQ_API_KEY },
    body: formData
  });
  const data = await resp.text();
  return new Response(data, {
    status: resp.status,
    headers: { ...cors, 'Content-Type': resp.headers.get('Content-Type') || 'text/plain' }
  });
}

async function proxyGitHub(request, env, cors) {
  // /github/repos/Owner/Repo/issues → https://api.github.com/repos/Owner/Repo/issues
  const url = new URL(request.url);
  const ghPath = url.pathname.replace(/^\/github/, '');
  const ghUrl = 'https://api.github.com' + ghPath + url.search;

  const headers = {
    'Authorization': 'token ' + env.GITHUB_TOKEN,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'CECB-Worker'
  };

  const opts = { method: request.method, headers };
  if (request.method === 'POST') {
    opts.body = await request.text();
    headers['Content-Type'] = 'application/json';
  }

  const resp = await fetch(ghUrl, opts);
  const data = await resp.text();
  return new Response(data, {
    status: resp.status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}
