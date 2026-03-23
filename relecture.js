/* ═══════════════════════════════════════════════════════
   CECB Plus — Relecture CECB (module unifié)
   Analyse orthographique, grammaticale et stylistique
   d'un rapport CECB importé en PDF.
   Utilisé par relecture.html (standalone) et projet.html (tab).
   ═══════════════════════════════════════════════════════ */

/* ─── Shared constants ──────────────────────────────── */

var CECB_SECTIONS = [
    { key: 'toit',          label: 'Toit',                  patterns: ['toit', 'toiture', 'couverture', 'comble'] },
    { key: 'murs',          label: 'Murs',                  patterns: ['murs', 'mur', 'façade', 'facades', 'façades'] },
    { key: 'fenetres',      label: 'Fenêtres et portes',    patterns: ['fenêtres', 'fenetres', 'fenêtre', 'vitrage', 'menuiserie', 'portes'] },
    { key: 'sol',           label: 'Sol',                   patterns: ['sol', 'plancher', 'dalle', 'sous-sol'] },
    { key: 'ventilation',   label: 'Ventilation',           patterns: ['ventilation', 'vmc', 'renouvellement de l\'air', 'aération'] },
    { key: 'chauffage',     label: 'Chauffage',             patterns: ['chauffage', 'chaudière', 'pompe à chaleur', 'pac', 'chauffer'] },
    { key: 'ecs',           label: 'Eau chaude',            patterns: ['eau chaude', 'ecs', 'sanitaire', 'boiler'] },
    { key: 'appareils',     label: 'Appareils et éclairage', patterns: ['appareils', 'éclairage', 'électricité', 'cuisson', 'électroménager'] },
    { key: 'pv',            label: 'Photovoltaïque',        patterns: ['photovoltaïque', 'solaire', 'panneau', 'kwc', 'pv'] },
    { key: 'comportement',  label: 'Comportement utilisateur', patterns: ['comportement', 'utilisateur', 'aération appropriée'] },
    { key: 'revalorisation', label: 'Revalorisation',       patterns: ['revalorisation', 'surélévation', 'extension', 'confort'] }
];

var REVIEW_SYSTEM_PROMPT = (function () {
    var today = new Date().toLocaleDateString('fr-CH');
    return [
        'Tu es un expert en relecture de rapports CECB (Certificat énergétique cantonal des bâtiments) en Suisse.',
        'Nous sommes en ' + new Date().getFullYear() + ' (date du jour : ' + today + ').',
        'Tu maîtrises parfaitement le français technique du domaine du bâtiment et de l\'énergie.',
        'Ta tâche est d\'analyser le texte d\'un rapport CECB et de fournir un rapport de relecture structuré.',
        '',
        'Tu dois identifier :',
        '1. ORTHOGRAPHE : fautes d\'orthographe (mots mal écrits)',
        '2. GRAMMAIRE : erreurs grammaticales (accords, conjugaisons, syntaxe)',
        '3. COHERENCE : incohérences dans le contenu (données contradictoires, affirmations illogiques, chiffres incohérents)',
        '4. STYLE : tournures maladroites ou améliorables pour un rapport professionnel CECB',
        '',
        'Pour chaque remarque, indique :',
        '- section : la section CECB concernée (toit, murs, fenetres, sol, ventilation, chauffage, ecs, appareils, pv, comportement, revalorisation, general)',
        '- type : "ortho", "grammar", "coherence" ou "style"',
        '- original : le passage original problématique (citation exacte)',
        '- correction : la version corrigée proposée',
        '- explication : brève explication du problème',
        '',
        'De plus, pour CHAQUE section CECB contenant des remarques, fournis "sections_corrigees" avec DEUX clés par section :',
        '- "ei" : le texte corrigé de l\'état initial, SANS le titre "État initial :" — uniquement le contenu prêt à coller',
        '- "ap" : le texte corrigé des améliorations possibles, SANS le titre "Améliorations possibles :" — uniquement le contenu prêt à coller',
        'Applique toutes les corrections (orthographe, grammaire, cohérence, style) dans ces textes.',
        '',
        'Réponds UNIQUEMENT avec un objet JSON valide de la forme :',
        '{',
        '  "summary": "Résumé global en 2-3 phrases",',
        '  "sections_corrigees": {',
        '    "toit": { "ei": "Texte corrigé état initial...", "ap": "Texte corrigé améliorations..." },',
        '    "murs": { "ei": "...", "ap": "..." }',
        '  },',
        '  "items": [',
        '    { "section": "murs", "type": "ortho", "original": "...", "correction": "...", "explication": "..." },',
        '    ...',
        '  ]',
        '}',
        '',
        'Si le texte est parfait, retourne un JSON avec un summary positif, sections_corrigees vide et un tableau items vide.',
        'Ne retourne RIEN d\'autre que le JSON.'
    ].join('\n');
})();

/* ─── CECB Validation ────────────────────────────────── */

function isCecbReport(text) {
    var lower = text.toLowerCase();
    var markers = [
        'certificat énergétique cantonal',
        'enveloppe du bâtiment',
        'efficacité énergétique',
        'émissions directes de co',
        'état initial',
        'améliorations possibles',
        'technique du bâtiment',
        'programme bâtiments',
        'valeur u',
        'kwh/(m²a)'
    ];
    if (lower.indexOf('cecb') === -1) return false;
    var found = 0;
    for (var i = 0; i < markers.length; i++) {
        if (lower.indexOf(markers[i]) !== -1) found++;
    }
    return found >= 3;
}

/* ─── Section Parsing ────────────────────────────────── */

function parseSections(text) {
    var sections = {};
    var lines = text.split('\n');
    var currentSection = null;
    var buffer = [];

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        var lower = line.toLowerCase();

        var matched = null;
        for (var s = 0; s < CECB_SECTIONS.length; s++) {
            var sec = CECB_SECTIONS[s];
            for (var p = 0; p < sec.patterns.length; p++) {
                if (lower === sec.patterns[p] ||
                    lower.startsWith(sec.patterns[p] + ' ') && lower.indexOf('état initial') !== -1 ||
                    (lower === sec.patterns[p] + ' et portes') ||
                    (lower === sec.patterns[p] + ' et éclairage')) {
                    matched = sec.key;
                    break;
                }
            }
            if (matched) break;
        }

        if (matched) {
            if (currentSection && buffer.length > 0) {
                sections[currentSection] = buffer.join('\n').trim();
            }
            currentSection = matched;
            buffer = [line];
        } else if (currentSection) {
            buffer.push(line);
        }
    }
    if (currentSection && buffer.length > 0) {
        sections[currentSection] = buffer.join('\n').trim();
    }

    return sections;
}

/* ─── PDF text extraction ────────────────────────────── */

async function extractPdfText(file, onProgress) {
    if (typeof pdfjsLib === 'undefined') throw new Error('Librairie PDF non chargée');

    var arrayBuffer = await file.arrayBuffer();
    var typedArray = new Uint8Array(arrayBuffer);
    var pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;

    var allText = [];
    for (var i = 1; i <= pdf.numPages; i++) {
        if (onProgress) onProgress(10 + (i / pdf.numPages) * 40);
        var page = await pdf.getPage(i);
        var content = await page.getTextContent();
        // Group by Y coordinate to reconstruct lines
        var items = content.items;
        var lines = {};
        items.forEach(function (item) {
            var y = Math.round(item.transform[5]);
            if (!lines[y]) lines[y] = [];
            lines[y].push({ x: item.transform[4], str: item.str });
        });
        // Sort lines by Y (descending = top to bottom)
        var sortedYs = Object.keys(lines).map(Number).sort(function (a, b) { return b - a; });
        sortedYs.forEach(function (y) {
            var lineItems = lines[y].sort(function (a, b) { return a.x - b.x; });
            var lineText = lineItems.map(function (it) { return it.str; }).join(' ').trim();
            // Filter out repeated header/footer artifacts (e.g. CECB PDF watermarks)
            if (lineText && !lineText.match(/^[TTFFAARDD\s]+$/) && lineText.length > 1) {
                allText.push(lineText);
            }
        });
        allText.push(''); // Page separator
    }

    return {
        text: allText.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
        numPages: pdf.numPages
    };
}

/* ─── Shared HTML escape ─────────────────────────────── */

function _relEscapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}

/* ═══════════════════════════════════════════════════════
   RelectureContext — parametric context for each page
   ═══════════════════════════════════════════════════════ */

function RelectureContext(ids) {
    this.ids = ids;
    this._extractedText = '';
    this._copyIdx = 0;
}

/**
 * Create a context for the standalone relecture.html page
 */
RelectureContext.standalone = function () {
    return new RelectureContext({
        dropzone:    'pdfDropzone',
        fileInput:   'pdfFileInput',
        fileInfo:    'fileInfo',
        fileName:    'fileName',
        filePages:   'filePages',
        statusMsg:   'statusMsg',
        progressBar: 'progressBar',
        progressFill:'progressFill',
        btnAnalyze:  'btnAnalyze',
        textToggle:  'textToggle',
        textPreview: 'extractedTextPreview',
        resultsPanel:'resultsPanel',
        summaryCard: 'summaryCard',
        resultSections: 'resultSections'
    });
};

/**
 * Create a context for the relecture tab inside projet.html
 */
RelectureContext.tab = function () {
    return new RelectureContext({
        dropzone:    'relPdfDropzone',
        fileInput:   'relPdfFileInput',
        fileInfo:    'relFileInfo',
        fileName:    'relFileName',
        filePages:   'relFilePages',
        statusMsg:   'relStatusMsg',
        progressBar: 'relProgressBar',
        progressFill:'relProgressFill',
        btnAnalyze:  'relBtnAnalyze',
        textToggle:  'relTextToggle',
        textPreview: 'relTextPreview',
        resultsPanel:'relResultsPanel',
        summaryCard: 'relSummaryCard',
        resultSections: 'relResultSections'
    });
};

/* ─── DOM helper ─────────────────────────────────────── */

RelectureContext.prototype.el = function (key) {
    return document.getElementById(this.ids[key]);
};

/* ─── Notifications & progress ───────────────────────── */

RelectureContext.prototype.notify = function (msg) {
    var el = document.getElementById('notification');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 3000);
};

RelectureContext.prototype.setStatus = function (msg) {
    var el = this.el('statusMsg');
    if (!el) return;
    if (msg) { el.textContent = msg; el.style.display = 'block'; }
    else { el.style.display = 'none'; }
};

RelectureContext.prototype.showProgress = function (pct) {
    var bar = this.el('progressBar');
    var fill = this.el('progressFill');
    if (bar) bar.style.display = 'block';
    if (fill) fill.style.width = Math.min(pct, 100) + '%';
};

RelectureContext.prototype.hideProgress = function () {
    var bar = this.el('progressBar');
    var fill = this.el('progressFill');
    if (bar) bar.style.display = 'none';
    if (fill) fill.style.width = '0%';
};

/* ─── Dropzone init ──────────────────────────────────── */

RelectureContext.prototype.initDropzone = function () {
    var self = this;
    var dz = this.el('dropzone');
    var input = this.el('fileInput');
    if (!dz || !input) return;

    dz.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
        if (this.files && this.files[0]) self.handlePdfFile(this.files[0]);
    });
    dz.addEventListener('dragover', function (e) {
        e.preventDefault();
        dz.classList.add('dragover');
        dz.style.borderColor = '#10B981';
        dz.style.background = '#ECFDF5';
    });
    dz.addEventListener('dragleave', function () {
        dz.classList.remove('dragover');
        dz.style.borderColor = '';
        dz.style.background = '';
    });
    dz.addEventListener('drop', function (e) {
        e.preventDefault();
        dz.classList.remove('dragover');
        dz.style.borderColor = '';
        dz.style.background = '';
        var file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') self.handlePdfFile(file);
        else self.notify('Veuillez déposer un fichier PDF');
    });
};

/* ─── PDF handling ───────────────────────────────────── */

RelectureContext.prototype.handlePdfFile = async function (file) {
    var self = this;
    self.setStatus('Lecture du PDF...');
    self.showProgress(10);

    try {
        var result = await extractPdfText(file, function (pct) { self.showProgress(pct); });

        if (!result.text) {
            self.notify('PDF vide ou non lisible');
            self.hideProgress();
            return;
        }

        if (!isCecbReport(result.text)) {
            self.hideProgress();
            self.notify('Ce PDF ne semble pas être un rapport CECB');
            return;
        }

        self._extractedText = result.text;

        // Show file info
        var fileInfo = self.el('fileInfo');
        if (fileInfo) fileInfo.style.display = 'flex';
        var fileName = self.el('fileName');
        if (fileName) fileName.textContent = file.name;
        var filePages = self.el('filePages');
        if (filePages) filePages.textContent = result.numPages + ' pages';

        var dz = self.el('dropzone');
        if (dz) dz.style.display = 'none';
        var btn = self.el('btnAnalyze');
        if (btn) btn.style.display = 'inline-block';

        // Extracted text preview
        var toggle = self.el('textToggle');
        if (toggle) toggle.style.display = 'block';
        var preview = self.el('textPreview');
        if (preview) preview.textContent = self._extractedText;

        self.hideProgress();
        self.setStatus('');
        self.notify('PDF importé — ' + result.numPages + ' pages extraites');

    } catch (err) {
        console.error('PDF read error:', err);
        self.notify('Erreur lecture PDF: ' + err.message);
        self.hideProgress();
    }
};

/* ─── Remove PDF ─────────────────────────────────────── */

RelectureContext.prototype.removePdf = function () {
    this._extractedText = '';
    var fileInfo = this.el('fileInfo');
    if (fileInfo) fileInfo.style.display = 'none';
    var dz = this.el('dropzone');
    if (dz) dz.style.display = '';
    var btn = this.el('btnAnalyze');
    if (btn) btn.style.display = 'none';
    var toggle = this.el('textToggle');
    if (toggle) toggle.style.display = 'none';
    var preview = this.el('textPreview');
    if (preview) preview.style.display = 'none';
    var results = this.el('resultsPanel');
    if (results) results.style.display = 'none';
    var input = this.el('fileInput');
    if (input) input.value = '';
};

/* ─── Toggle extracted text ──────────────────────────── */

RelectureContext.prototype.toggleText = function () {
    var preview = this.el('textPreview');
    var toggle = this.el('textToggle');
    if (!preview || !toggle) return;
    if (preview.style.display === 'block') {
        preview.style.display = 'none';
        toggle.innerHTML = '&#9654; Voir le texte extrait';
    } else {
        preview.style.display = 'block';
        toggle.innerHTML = '&#9660; Masquer le texte extrait';
    }
};

/* ─── Launch Claude Review ───────────────────────────── */

RelectureContext.prototype.launchReview = async function () {
    if (!CecbApi.useProxy() && !CecbApi.getApiKey()) {
        this.notify('Clé API Claude non configurée (et aucun proxy défini). Allez dans Paramètres sur la page Accueil.');
        return;
    }

    if (!this._extractedText) {
        this.notify('Aucun texte extrait');
        return;
    }

    var self = this;
    var btn = this.el('btnAnalyze');
    if (btn) { btn.disabled = true; btn.textContent = 'Analyse en cours...'; }
    this.setStatus('Envoi au modèle Claude pour analyse...');
    this.showProgress(50);

    try {
        var result = await CecbApi.callClaude({
            system: REVIEW_SYSTEM_PROMPT,
            userMessage: 'Voici le texte extrait d\'un rapport CECB à relire :\n\n' + this._extractedText,
            maxTokens: 8192,
            timeoutMs: 120000
        });

        self.showProgress(90);
        self.setStatus('Traitement des résultats...');

        var parsed = CecbApi.parseJsonResponse(result);
        self.displayResults(parsed);

        self.showProgress(100);
        setTimeout(function () { self.hideProgress(); self.setStatus(''); }, 500);

    } catch (err) {
        console.error('Review error:', err);
        self.notify('Erreur analyse : ' + err.message);
        self.hideProgress();
        self.setStatus('');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Analyser le rapport'; }
    }
};

/* ─── Display Results ────────────────────────────────── */

RelectureContext.prototype.displayResults = function (data) {
    var self = this;
    var panel = this.el('resultsPanel');
    if (!panel) return;
    panel.style.display = 'block';

    var items = data.items || [];
    var corrected = data.sections_corrigees || {};

    // Count by type
    var counts = { ortho: 0, grammar: 0, coherence: 0, style: 0 };
    items.forEach(function (it) { if (counts[it.type] !== undefined) counts[it.type]++; });
    var total = items.length;

    // Summary card
    var summaryHtml = '<h2 style="margin-top:0;border:none;padding:0;font-size:1.1rem">Résumé de la relecture</h2>';
    summaryHtml += '<p style="font-size:14px;color:#475569;margin-bottom:0">' + _relEscapeHtml(data.summary || '') + '</p>';
    summaryHtml += '<div class="summary-grid">';
    summaryHtml += _relStatCard(counts.ortho, 'Orthographe', '#EF4444');
    summaryHtml += _relStatCard(counts.grammar, 'Grammaire', '#F59E0B');
    summaryHtml += _relStatCard(counts.coherence, 'Cohérence', '#A855F7');
    summaryHtml += _relStatCard(counts.style, 'Style', '#3B82F6');
    summaryHtml += _relStatCard(total, 'Total', '#1E293B');
    summaryHtml += '</div>';
    var summaryCard = this.el('summaryCard');
    if (summaryCard) summaryCard.innerHTML = summaryHtml;

    // Group items by section
    var bySection = {};
    items.forEach(function (it) {
        var sec = it.section || 'general';
        if (!bySection[sec]) bySection[sec] = [];
        bySection[sec].push(it);
    });

    // Build section panels
    var sectionsHtml = '';
    var orderedKeys = CECB_SECTIONS.map(function (s) { return s.key; });
    orderedKeys.push('general');
    self._copyIdx = 0;

    var typeLabels = { ortho: 'Orthographe', grammar: 'Grammaire', coherence: 'Cohérence', style: 'Style' };

    orderedKeys.forEach(function (key) {
        if (!bySection[key]) return;
        var sectionItems = bySection[key];
        var label = key === 'general' ? 'Général' : (CECB_SECTIONS.find(function (s) { return s.key === key; }) || {}).label || key;

        var hasErrors = sectionItems.some(function (it) { return it.type === 'ortho' || it.type === 'grammar'; });
        var badgeClass = hasErrors ? 'badge-error' : (sectionItems.some(function (it) { return it.type === 'coherence'; }) ? 'badge-warn' : 'badge-ok');

        sectionsHtml += '<div class="result-section">';
        sectionsHtml += '<div class="result-header" onclick="toggleResultSection(this)">';
        sectionsHtml += '<h3><span class="arrow">&#9654;</span> ' + _relEscapeHtml(label) + ' <span class="badge ' + badgeClass + '">' + sectionItems.length + ' remarque' + (sectionItems.length > 1 ? 's' : '') + '</span></h3>';
        sectionsHtml += '</div>';
        sectionsHtml += '<div class="result-body">';

        sectionItems.forEach(function (it) {
            var tl = typeLabels[it.type] || it.type;
            sectionsHtml += '<div class="review-item ' + (it.type || 'style') + '">';
            sectionsHtml += '<div class="original"><span class="section-tag">' + _relEscapeHtml(tl) + '</span> ' + _relEscapeHtml(it.original || '') + '</div>';
            sectionsHtml += '<div class="correction">' + _relEscapeHtml(it.correction || '') + '</div>';
            if (it.explication) sectionsHtml += '<div class="explanation">' + _relEscapeHtml(it.explication) + '</div>';
            sectionsHtml += '</div>';
        });

        // Corrected section text (EI + AP)
        if (corrected[key]) {
            var sec = corrected[key];
            var eiText = typeof sec === 'object' ? (sec.ei || '') : sec;
            var apText = typeof sec === 'object' ? (sec.ap || '') : '';

            sectionsHtml += '<div class="corrected-texts">';

            if (eiText) {
                var cidEi = 'relCorrEI' + self._copyIdx;
                sectionsHtml += '<div class="corrected-block">';
                sectionsHtml += '<div class="corrected-header"><span class="corrected-label corrected-ei">EI corrigé</span>';
                sectionsHtml += '<button onclick="relCopyText(\'' + cidEi + '\',this)" class="btn-copy btn-copy-ei">Copier</button></div>';
                sectionsHtml += '<div id="' + cidEi + '" class="corrected-content corrected-content-ei">' + _relEscapeHtml(eiText) + '</div>';
                sectionsHtml += '</div>';
            }

            if (apText) {
                var cidAp = 'relCorrAP' + self._copyIdx;
                sectionsHtml += '<div class="corrected-block">';
                sectionsHtml += '<div class="corrected-header"><span class="corrected-label corrected-ap">AP corrigé</span>';
                sectionsHtml += '<button onclick="relCopyText(\'' + cidAp + '\',this)" class="btn-copy btn-copy-ap">Copier</button></div>';
                sectionsHtml += '<div id="' + cidAp + '" class="corrected-content corrected-content-ap">' + _relEscapeHtml(apText) + '</div>';
                sectionsHtml += '</div>';
            }

            self._copyIdx++;
            sectionsHtml += '</div>';
        }

        sectionsHtml += '</div></div>';
    });

    if (!sectionsHtml) {
        sectionsHtml = '<div style="text-align:center;padding:40px;color:#10B981;font-size:16px;font-weight:600">Aucune remarque — le rapport est impeccable !</div>';
    }

    var resultSections = this.el('resultSections');
    if (resultSections) resultSections.innerHTML = sectionsHtml;

    // Auto-open first section
    var container = panel;
    var firstHeader = container.querySelector('.result-header');
    if (firstHeader) toggleResultSection(firstHeader);

    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/* ─── Shared UI functions (global) ───────────────────── */

function _relStatCard(num, label, color) {
    return '<div class="summary-stat"><div class="num" style="color:' + color + '">' + num + '</div><div class="lbl">' + label + '</div></div>';
}

function toggleResultSection(headerEl) {
    var body = headerEl.nextElementSibling;
    var arrow = headerEl.querySelector('.arrow');
    if (body.classList.contains('open')) {
        body.classList.remove('open');
        body.style.display = 'none';
        if (arrow) arrow.classList.remove('open');
    } else {
        body.classList.add('open');
        body.style.display = 'block';
        if (arrow) arrow.classList.add('open');
    }
}

function relCopyText(id, btn) {
    var el = document.getElementById(id);
    if (!el) return;
    navigator.clipboard.writeText(el.textContent).then(function () {
        btn.textContent = 'Copié !';
        btn.style.background = '#064E3B';
        setTimeout(function () { btn.textContent = 'Copier'; btn.style.background = ''; }, 1500);
    });
}

/* ═══════════════════════════════════════════════════════
   Standalone page (relecture.html) — auto-init
   ═══════════════════════════════════════════════════════ */

(function () {
    // Only auto-init on the standalone page (has #pdfDropzone)
    var dz = document.getElementById('pdfDropzone');
    if (!dz) return;

    var ctx = RelectureContext.standalone();
    ctx.initDropzone();

    // Expose global functions for onclick handlers in HTML
    window.launchReview = function () { ctx.launchReview(); };
    window.removePdf = function () { ctx.removePdf(); };
    window.toggleExtractedText = function () { ctx.toggleText(); };

    // showNotification used by standalone page's auth.js
    window.showNotification = function (msg) { ctx.notify(msg); };
    window.setStatus = function (msg) { ctx.setStatus(msg); };
    window.showProgress = function (pct) { ctx.showProgress(pct); };
    window.hideProgress = function () { ctx.hideProgress(); };
    window.escapeHtml = _relEscapeHtml;
})();

/* ═══════════════════════════════════════════════════════
   Tab page (projet.html) — lazy init via initRelecture()
   ═══════════════════════════════════════════════════════ */

var _relCtx = null;

function initRelecture() {
    _relCtx = RelectureContext.tab();
    _relCtx.initDropzone();
}

// Global functions for onclick handlers in projet.html
function relLaunchReview() { if (_relCtx) _relCtx.launchReview(); }
function relRemovePdf() { if (_relCtx) _relCtx.removePdf(); }
function relToggleText() { if (_relCtx) _relCtx.toggleText(); }
