/* ═══════════════════════════════════════════════════════
   CECB Plus — Relecture CECB
   Analyse orthographique, grammaticale et stylistique
   d'un rapport CECB importé en PDF
   ═══════════════════════════════════════════════════════ */

var _extractedText = '';
var _extractedSections = {};

/* ─── CECB Section definitions ───────────────────────── */
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

/* ─── PDF Upload ─────────────────────────────────────── */
(function initDropzone() {
    var dz = document.getElementById('pdfDropzone');
    var input = document.getElementById('pdfFileInput');
    if (!dz || !input) return;

    dz.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
        if (this.files && this.files[0]) handlePdfFile(this.files[0]);
    });
    dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', function () { dz.classList.remove('dragover'); });
    dz.addEventListener('drop', function (e) {
        e.preventDefault();
        dz.classList.remove('dragover');
        var file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') handlePdfFile(file);
        else showNotification('Veuillez déposer un fichier PDF');
    });
})();

async function handlePdfFile(file) {
    if (typeof pdfjsLib === 'undefined') {
        showNotification('Librairie PDF non chargée');
        return;
    }

    setStatus('Lecture du PDF...');
    showProgress(10);

    try {
        var arrayBuffer = await file.arrayBuffer();
        var typedArray = new Uint8Array(arrayBuffer);
        var pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;

        var allText = [];
        for (var i = 1; i <= pdf.numPages; i++) {
            showProgress(10 + (i / pdf.numPages) * 40);
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
                // Filter out repeated header/footer artifacts
                if (lineText && !lineText.match(/^[TTFFAARDD\s]+$/) && lineText.length > 1) {
                    allText.push(lineText);
                }
            });
            allText.push(''); // Page separator
        }

        _extractedText = allText.join('\n').replace(/\n{3,}/g, '\n\n').trim();

        if (!_extractedText) {
            showNotification('PDF vide ou non lisible');
            hideProgress();
            return;
        }

        // Parse sections
        _extractedSections = parseSections(_extractedText);

        // Show file info
        document.getElementById('fileInfo').style.display = 'flex';
        document.getElementById('fileName').textContent = file.name;
        document.getElementById('filePages').textContent = pdf.numPages + ' pages';
        document.getElementById('pdfDropzone').style.display = 'none';
        document.getElementById('btnAnalyze').style.display = 'inline-block';

        // Show extracted text toggle
        document.getElementById('textToggle').style.display = 'block';
        document.getElementById('extractedTextPreview').textContent = _extractedText;

        hideProgress();
        setStatus('');
        showNotification('PDF importé — ' + pdf.numPages + ' pages extraites');

    } catch (err) {
        console.error('PDF read error:', err);
        showNotification('Erreur lecture PDF: ' + err.message);
        hideProgress();
    }
}

function removePdf() {
    _extractedText = '';
    _extractedSections = {};
    document.getElementById('fileInfo').style.display = 'none';
    document.getElementById('pdfDropzone').style.display = '';
    document.getElementById('btnAnalyze').style.display = 'none';
    document.getElementById('textToggle').style.display = 'none';
    document.getElementById('extractedTextPreview').style.display = 'none';
    document.getElementById('resultsPanel').style.display = 'none';
    document.getElementById('pdfFileInput').value = '';
}

function toggleExtractedText() {
    var preview = document.getElementById('extractedTextPreview');
    var toggle = document.getElementById('textToggle');
    if (preview.style.display === 'block') {
        preview.style.display = 'none';
        toggle.innerHTML = '&#9654; Voir le texte extrait';
    } else {
        preview.style.display = 'block';
        toggle.innerHTML = '&#9660; Masquer le texte extrait';
    }
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

        // Detect section headers
        var matched = null;
        for (var s = 0; s < CECB_SECTIONS.length; s++) {
            var sec = CECB_SECTIONS[s];
            for (var p = 0; p < sec.patterns.length; p++) {
                // Match line that starts with the section keyword (as a header)
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
            // Save previous section
            if (currentSection && buffer.length > 0) {
                sections[currentSection] = buffer.join('\n').trim();
            }
            currentSection = matched;
            buffer = [line];
        } else if (currentSection) {
            buffer.push(line);
        }
    }
    // Save last section
    if (currentSection && buffer.length > 0) {
        sections[currentSection] = buffer.join('\n').trim();
    }

    return sections;
}

/* ─── Claude Review ──────────────────────────────────── */
async function launchReview() {
    var apiKey = CecbApi.getApiKey();
    if (!apiKey) {
        showNotification('Clé API Claude non configurée. Allez dans Paramètres sur la page Accueil.');
        return;
    }

    if (!_extractedText) {
        showNotification('Aucun texte extrait');
        return;
    }

    var btn = document.getElementById('btnAnalyze');
    btn.disabled = true;
    btn.textContent = 'Analyse en cours...';
    setStatus('Envoi au modèle Claude pour analyse...');
    showProgress(50);

    var today = new Date().toLocaleDateString('fr-CH');
    var systemPrompt = [
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
        'De plus, pour CHAQUE section CECB contenant des remarques, fournis un champ "sections_corrigees" avec le texte complet corrigé de la section (État initial + Améliorations possibles), prêt à copier-coller. Applique toutes les corrections (orthographe, grammaire, cohérence, style) dans ce texte.',
        '',
        'Réponds UNIQUEMENT avec un objet JSON valide de la forme :',
        '{',
        '  "summary": "Résumé global en 2-3 phrases",',
        '  "sections_corrigees": {',
        '    "toit": "Texte complet corrigé de la section toit...",',
        '    "murs": "Texte complet corrigé de la section murs..."',
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

    var userMsg = 'Voici le texte extrait d\'un rapport CECB à relire :\n\n' + _extractedText;

    try {
        var result = await CecbApi.callClaude({
            system: systemPrompt,
            userMessage: userMsg,
            maxTokens: 8192,
            timeoutMs: 120000
        });

        showProgress(90);
        setStatus('Traitement des résultats...');

        var parsed = CecbApi.parseJsonResponse(result);
        displayResults(parsed);

        showProgress(100);
        setTimeout(function () { hideProgress(); setStatus(''); }, 500);

    } catch (err) {
        console.error('Review error:', err);
        showNotification('Erreur analyse : ' + err.message);
        hideProgress();
        setStatus('');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Analyser le rapport';
    }
}

/* ─── Display Results ────────────────────────────────── */
function displayResults(data) {
    var panel = document.getElementById('resultsPanel');
    panel.style.display = 'block';

    var items = data.items || [];

    // Count by type
    var counts = { ortho: 0, grammar: 0, coherence: 0, style: 0 };
    items.forEach(function (it) { if (counts[it.type] !== undefined) counts[it.type]++; });
    var total = items.length;

    // Summary card
    var summaryHtml = '<h2 style="margin-top:0;border:none;padding:0;font-size:1.1rem">Résumé de la relecture</h2>';
    summaryHtml += '<p style="font-size:14px;color:#475569;margin-bottom:0">' + escapeHtml(data.summary || '') + '</p>';
    summaryHtml += '<div class="summary-grid">';
    summaryHtml += statCard(counts.ortho, 'Orthographe', '#EF4444');
    summaryHtml += statCard(counts.grammar, 'Grammaire', '#F59E0B');
    summaryHtml += statCard(counts.coherence, 'Cohérence', '#A855F7');
    summaryHtml += statCard(counts.style, 'Style', '#3B82F6');
    summaryHtml += statCard(total, 'Total', '#1E293B');
    summaryHtml += '</div>';
    document.getElementById('summaryCard').innerHTML = summaryHtml;

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

    orderedKeys.forEach(function (key) {
        if (!bySection[key]) return;
        var sectionItems = bySection[key];
        var label = key === 'general' ? 'Général' : (CECB_SECTIONS.find(function (s) { return s.key === key; }) || {}).label || key;

        var hasErrors = sectionItems.some(function (it) { return it.type === 'ortho' || it.type === 'grammar'; });
        var badgeClass = hasErrors ? 'badge-error' : (sectionItems.some(function (it) { return it.type === 'coherence'; }) ? 'badge-warn' : 'badge-ok');

        sectionsHtml += '<div class="result-section">';
        sectionsHtml += '<div class="result-header" onclick="toggleResultSection(this)">';
        sectionsHtml += '<h3><span class="arrow">&#9654;</span> ' + escapeHtml(label) + ' <span class="badge ' + badgeClass + '">' + sectionItems.length + ' remarque' + (sectionItems.length > 1 ? 's' : '') + '</span></h3>';
        sectionsHtml += '</div>';
        sectionsHtml += '<div class="result-body">';

        sectionItems.forEach(function (it) {
            var typeLabel = { ortho: 'Orthographe', grammar: 'Grammaire', coherence: 'Cohérence', style: 'Style' }[it.type] || it.type;
            sectionsHtml += '<div class="review-item ' + (it.type || 'style') + '">';
            sectionsHtml += '<div class="original"><span class="section-tag">' + escapeHtml(typeLabel) + '</span> ' + escapeHtml(it.original || '') + '</div>';
            sectionsHtml += '<div class="correction">' + escapeHtml(it.correction || '') + '</div>';
            if (it.explication) sectionsHtml += '<div class="explanation">' + escapeHtml(it.explication) + '</div>';
            sectionsHtml += '</div>';
        });

        sectionsHtml += '</div></div>';
    });

    if (!sectionsHtml) {
        sectionsHtml = '<div style="text-align:center;padding:40px;color:#10B981;font-size:16px;font-weight:600">Aucune remarque — le rapport est impeccable !</div>';
    }

    document.getElementById('resultSections').innerHTML = sectionsHtml;

    // Auto-open first section
    var firstHeader = document.querySelector('.result-header');
    if (firstHeader) toggleResultSection(firstHeader);

    // Scroll to results
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function statCard(num, label, color) {
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

/* ─── UI Helpers ─────────────────────────────────────── */
function showNotification(msg) {
    var el = document.getElementById('notification');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 3000);
}

function setStatus(msg) {
    var el = document.getElementById('statusMsg');
    if (msg) { el.textContent = msg; el.style.display = 'block'; }
    else { el.style.display = 'none'; }
}

function showProgress(pct) {
    var bar = document.getElementById('progressBar');
    var fill = document.getElementById('progressFill');
    bar.style.display = 'block';
    fill.style.width = Math.min(pct, 100) + '%';
}

function hideProgress() {
    document.getElementById('progressBar').style.display = 'none';
    document.getElementById('progressFill').style.width = '0%';
}

function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}
