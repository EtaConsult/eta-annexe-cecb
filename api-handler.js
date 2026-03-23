/* ═══════════════════════════════════════════════════════
   CECB Plus — API Handler
   Centralise les appels Claude & Groq avec error handling
   ═══════════════════════════════════════════════════════ */

var CecbApi = (function () {

    function getApiKey() {
        return localStorage.getItem('cecb_api_key') || '';
    }

    function getModel() {
        return localStorage.getItem('cecb_api_model') || 'claude-sonnet-4-20250514';
    }

    function getGroqKey() {
        return localStorage.getItem('cecb_groq_key') || '';
    }

    function getProxyUrl() {
        return (localStorage.getItem('cecb_proxy_url') || '').replace(/\/+$/, '');
    }

    function useProxy() {
        return !!getProxyUrl();
    }

    function getHeaders() {
        return {
            'Content-Type': 'application/json',
            'x-api-key': getApiKey(),
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        };
    }

    /**
     * Call Claude API with timeout and error handling
     * Supports proxy mode (no local API key needed) or direct mode
     */
    async function callClaude(opts) {
        var proxy = getProxyUrl();

        if (!proxy && !getApiKey()) throw new Error('Clé API Claude non configurée (et aucun proxy défini)');

        var body = {
            model: getModel(),
            max_tokens: opts.maxTokens || 2048,
            messages: [{ role: 'user', content: opts.userMessage }]
        };
        if (opts.system) body.system = opts.system;

        var url, headers;
        if (proxy) {
            url = proxy + '/claude';
            headers = { 'Content-Type': 'application/json' };
        } else {
            url = 'https://api.anthropic.com/v1/messages';
            headers = getHeaders();
        }

        var resp = await fetchWithTimeout(url, {
            method: 'POST',
            headers: headers,
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
     * Call Groq Whisper for audio transcription
     * Supports proxy mode (no local API key needed) or direct mode
     */
    async function callWhisper(file, timeoutMs) {
        var proxy = getProxyUrl();

        if (!proxy && !getGroqKey()) throw new Error('Clé API Groq non configurée (et aucun proxy défini)');

        var formData = new FormData();
        formData.append('file', file);
        formData.append('model', 'whisper-large-v3');
        formData.append('language', 'fr');
        formData.append('response_format', 'text');

        var url, headers;
        if (proxy) {
            url = proxy + '/whisper';
            headers = {};
        } else {
            url = 'https://api.groq.com/openai/v1/audio/transcriptions';
            headers = { 'Authorization': 'Bearer ' + getGroqKey() };
        }

        var resp = await fetchWithTimeout(url, {
            method: 'POST',
            headers: headers,
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
     * @param {string} text - Raw response text
     * @returns {Object} Parsed JSON
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
        useProxy: useProxy,
        callClaude: callClaude,
        callWhisper: callWhisper,
        parseJsonResponse: parseJsonResponse
    };
})();
