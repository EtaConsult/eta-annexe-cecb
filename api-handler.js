/* ═══════════════════════════════════════════════════════
   CECB Plus — API Handler
   Centralise les appels Claude & Groq avec error handling
   ═══════════════════════════════════════════════════════ */

var CecbApi = (function () {

    // One-shot migration: remove any legacy local API keys from a previous version
    try {
        if (localStorage.getItem('cecb_api_key')) localStorage.removeItem('cecb_api_key');
        if (localStorage.getItem('cecb_groq_key')) localStorage.removeItem('cecb_groq_key');
    } catch (e) { /* ignore */ }

    // Deprecated — proxy-only mode. Kept as no-op for backward compat with callers
    // that check `!useProxy() && !getApiKey()` to surface the "configure proxy" message.
    function getApiKey() { return ''; }
    function getGroqKey() { return ''; }

    function getModel() {
        return localStorage.getItem('cecb_api_model') || 'claude-sonnet-4-20250514';
    }

    function getProxyUrl() {
        return (localStorage.getItem('cecb_proxy_url') || '').replace(/\/+$/, '');
    }

    function getProxyToken() {
        return localStorage.getItem('cecb_proxy_token') || '';
    }

    function useProxy() {
        return !!getProxyUrl();
    }

    /**
     * Build headers for a proxy request, injecting the Bearer token if present.
     * Pass extra headers (e.g. Content-Type) via `extra`.
     */
    function proxyHeaders(extra) {
        var h = Object.assign({}, extra || {});
        var token = getProxyToken();
        if (token) h['Authorization'] = 'Bearer ' + token;
        return h;
    }

    /**
     * Call Claude API via the Cloudflare Worker proxy.
     * Direct browser → Anthropic calls are no longer supported (key handling).
     */
    async function callClaude(opts) {
        var proxy = getProxyUrl();
        if (!proxy) throw new Error('Mode proxy requis. Configurez l\'URL du proxy dans Paramètres.');

        var body = {
            model: getModel(),
            max_tokens: opts.maxTokens || 2048,
            messages: [{ role: 'user', content: opts.userMessage }]
        };
        if (opts.system) body.system = opts.system;

        var resp = await fetchWithTimeout(proxy + '/claude', {
            method: 'POST',
            headers: proxyHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(body)
        }, opts.timeoutMs || 60000);

        if (!resp.ok) {
            var errText = '';
            try { errText = await resp.text(); } catch (e) { /* ignore */ }
            throw new Error('API Claude ' + resp.status + (errText ? ': ' + errText.substring(0, 200) : ''));
        }

        var data = await resp.json();
        return ((data.content || [])[0] || {}).text || '';
    }

    /**
     * Call Groq Whisper for audio transcription via the proxy.
     */
    async function callWhisper(file, timeoutMs) {
        var proxy = getProxyUrl();
        if (!proxy) throw new Error('Mode proxy requis. Configurez l\'URL du proxy dans Paramètres.');

        var formData = new FormData();
        formData.append('file', file);
        formData.append('model', 'whisper-large-v3');
        formData.append('language', 'fr');
        formData.append('response_format', 'text');

        var resp = await fetchWithTimeout(proxy + '/whisper', {
            method: 'POST',
            headers: proxyHeaders(),
            body: formData
        }, timeoutMs || 60000);

        if (!resp.ok) {
            var errText = await resp.text();
            throw new Error('Whisper ' + resp.status + ': ' + errText.substring(0, 200));
        }

        return await resp.text();
    }

    /**
     * Parse JSON from Claude response (handles markdown code blocks)
     */
    function parseJsonResponse(text) {
        var match = text.match(/\{[\s\S]*\}/);
        return JSON.parse(match ? match[0] : text);
    }

    return {
        getApiKey: getApiKey,
        getModel: getModel,
        getGroqKey: getGroqKey,
        getProxyUrl: getProxyUrl,
        getProxyToken: getProxyToken,
        proxyHeaders: proxyHeaders,
        useProxy: useProxy,
        callClaude: callClaude,
        callWhisper: callWhisper,
        parseJsonResponse: parseJsonResponse
    };
})();
