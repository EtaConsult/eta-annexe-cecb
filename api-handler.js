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
     * @param {Object} opts - { system, userMessage, maxTokens, timeoutMs }
     * @returns {Promise<string>} Response text
     */
    async function callClaude(opts) {
        var apiKey = getApiKey();
        if (!apiKey) throw new Error('Clé API Claude non configurée');

        var body = {
            model: getModel(),
            max_tokens: opts.maxTokens || 2048,
            messages: [{ role: 'user', content: opts.userMessage }]
        };
        if (opts.system) body.system = opts.system;

        var resp = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: getHeaders(),
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
     * @param {File} file - Audio file
     * @param {number} timeoutMs - Timeout in ms
     * @returns {Promise<string>} Transcript text
     */
    async function callWhisper(file, timeoutMs) {
        var groqKey = getGroqKey();
        if (!groqKey) throw new Error('Clé API Groq non configurée');

        var formData = new FormData();
        formData.append('file', file);
        formData.append('model', 'whisper-large-v3');
        formData.append('language', 'fr');
        formData.append('response_format', 'text');

        var resp = await fetchWithTimeout('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + groqKey },
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
        callClaude: callClaude,
        callWhisper: callWhisper,
        parseJsonResponse: parseJsonResponse
    };
})();
