/* ═══════════════════════════════════════════════════════
   CECB Plus — Relecture Tab (inside projet.html)
   ═══════════════════════════════════════════════════════ */

var _relExtractedText = '';

/* ─── CECB Section definitions ───────────────────────── */
var REL_SECTIONS = [
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

/* ─── Init (lazy, called on first tab click) ─────────── */
function initRelecture() {
    var dz = document.getElementById('relPdfDropzone');
    var input = document.getElementById('relPdfFileInput');
    if (!dz || !input) return;

    dz.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
        if (this.files && this.files[0]) relHandlePdf(this.files[0]);
    });
    dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.style.borderColor = '#10B981'; dz.style.background = '#ECFDF5'; });
    dz.addEventListener('dragleave', function () { dz.style.borderColor = '#CBD5E1'; dz.style.background = '#F8FAFC'; });
    dz.addEventListener('drop', function (e) {
        e.preventDefault();
        dz.style.borderColor = '#CBD5E1'; dz.style.background = '#F8FAFC';
        var file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') relHandlePdf(file);
        else relNotify('Veuillez déposer un fichier PDF');
    });
}

/* ─── PDF handling ───────────────────────────────────── */
async function relHandlePdf(file) {
    if (typeof pdfjsLib === 'undefined') { relNotify('Librairie PDF non chargée'); return; }

    relSetStatus('Lecture du PDF...');
    relShowProgress(10);

    try {
        var arrayBuffer = await file.arrayBuffer();
        var typedArray = new Uint8Array(arrayBuffer);
        var pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;

        var allText = [];
        for (var i = 1; i <= pdf.numPages; i++) {
            relShowProgress(10 + (i / pdf.numPages) * 40);
            var page = await pdf.getPage(i);
            var content = await page.getTextContent();
            var items = content.items;
            var lines = {};
            items.forEach(function (item) {
                var y = Math.round(item.transform[5]);
                if (!lines[y]) lines[y] = [];
                lines[y].push({ x: item.transform[4], str: item.str });
            });
            var sortedYs = Object.keys(lines).map(Number).sort(function (a, b) { return b - a; });
            sortedYs.forEach(function (y) {
                var lineItems = lines[y].sort(function (a, b) { return a.x - b.x; });
                var lineText = lineItems.map(function (it) { return it.str; }).join(' ').trim();
                if (lineText && !lineText.match(/^[TTFFAARDD\s]+$/) && lineText.length > 1) {
                    allText.push(lineText);
                }
            });
            allText.push('');
        }

        _relExtractedText = allText.join('\n').replace(/\n{3,}/g, '\n\n').trim();
        if (!_relExtractedText) { relNotify('PDF vide ou non lisible'); relHideProgress(); return; }

        document.getElementById('relFileInfo').style.display = 'flex';
        document.getElementById('relFileName').textContent = file.name;
        document.getElementById('relFilePages').textContent = pdf.numPages + ' pages';
        document.getElementById('relPdfDropzone').style.display = 'none';
        document.getElementById('relBtnAnalyze').style.display = 'inline-block';
        document.getElementById('relTextToggle').style.display = 'block';
        document.getElementById('relTextPreview').textContent = _relExtractedText;

        relHideProgress();
        relSetStatus('');
        relNotify('PDF importé — ' + pdf.numPages + ' pages extraites');

    } catch (err) {
        console.error('PDF read error:', err);
        relNotify('Erreur lecture PDF: ' + err.message);
        relHideProgress();
    }
}

function relRemovePdf() {
    _relExtractedText = '';
    document.getElementById('relFileInfo').style.display = 'none';
    document.getElementById('relPdfDropzone').style.display = '';
    document.getElementById('relBtnAnalyze').style.display = 'none';
    document.getElementById('relTextToggle').style.display = 'none';
    document.getElementById('relTextPreview').style.display = 'none';
    document.getElementById('relResultsPanel').style.display = 'none';
    document.getElementById('relPdfFileInput').value = '';
}

function relToggleText() {
    var preview = document.getElementById('relTextPreview');
    var toggle = document.getElementById('relTextToggle');
    if (preview.style.display === 'block') {
        preview.style.display = 'none';
        toggle.innerHTML = '&#9654; Voir le texte extrait';
    } else {
        preview.style.display = 'block';
        toggle.innerHTML = '&#9660; Masquer le texte extrait';
    }
}

/* ─── Claude Review ──────────────────────────────────── */
async function relLaunchReview() {
    var apiKey = CecbApi.getApiKey();
    if (!apiKey) { relNotify('Clé API Claude non configurée. Allez dans Paramètres sur la page Accueil.'); return; }
    if (!_relExtractedText) { relNotify('Aucun texte extrait'); return; }

    var btn = document.getElementById('relBtnAnalyze');
    btn.disabled = true;
    btn.textContent = 'Analyse en cours...';
    relSetStatus('Envoi au modèle Claude pour analyse...');
    relShowProgress(50);

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
        '    "toit": "Texte complet corrigé de la section toit (État initial + Améliorations possibles)...",',
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

    try {
        var result = await CecbApi.callClaude({
            system: systemPrompt,
            userMessage: 'Voici le texte extrait d\'un rapport CECB à relire :\n\n' + _relExtractedText,
            maxTokens: 8192,
            timeoutMs: 120000
        });

        relShowProgress(90);
        relSetStatus('Traitement des résultats...');

        var parsed = CecbApi.parseJsonResponse(result);
        relDisplayResults(parsed);

        relShowProgress(100);
        setTimeout(function () { relHideProgress(); relSetStatus(''); }, 500);

    } catch (err) {
        console.error('Review error:', err);
        relNotify('Erreur analyse : ' + err.message);
        relHideProgress();
        relSetStatus('');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Analyser le rapport';
    }
}

/* ─── Display Results ────────────────────────────────── */
function relDisplayResults(data) {
    var panel = document.getElementById('relResultsPanel');
    panel.style.display = 'block';

    var items = data.items || [];
    var counts = { ortho: 0, grammar: 0, coherence: 0, style: 0 };
    items.forEach(function (it) { if (counts[it.type] !== undefined) counts[it.type]++; });
    var total = items.length;

    // Summary
    var html = '<h2 style="margin-top:0;border:none;padding:0;font-size:1.1rem">Résumé de la relecture</h2>';
    html += '<p style="font-size:14px;color:#475569;margin-bottom:0">' + relEsc(data.summary || '') + '</p>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-top:12px">';
    html += relStatCard(counts.ortho, 'Orthographe', '#EF4444');
    html += relStatCard(counts.grammar, 'Grammaire', '#F59E0B');
    html += relStatCard(counts.coherence, 'Cohérence', '#A855F7');
    html += relStatCard(counts.style, 'Style', '#3B82F6');
    html += relStatCard(total, 'Total', '#1E293B');
    html += '</div>';
    document.getElementById('relSummaryCard').innerHTML = html;

    // Group by section
    var bySection = {};
    items.forEach(function (it) {
        var sec = it.section || 'general';
        if (!bySection[sec]) bySection[sec] = [];
        bySection[sec].push(it);
    });

    var corrected = data.sections_corrigees || {};
    var sectionsHtml = '';
    var orderedKeys = REL_SECTIONS.map(function (s) { return s.key; });
    orderedKeys.push('general');
    var copyIdx = 0;

    orderedKeys.forEach(function (key) {
        if (!bySection[key]) return;
        var sectionItems = bySection[key];
        var label = key === 'general' ? 'Général' : (REL_SECTIONS.find(function (s) { return s.key === key; }) || {}).label || key;
        var hasErrors = sectionItems.some(function (it) { return it.type === 'ortho' || it.type === 'grammar'; });
        var badgeStyle = hasErrors ? 'background:#FEE2E2;color:#DC2626' : 'background:#D1FAE5;color:#059669';

        sectionsHtml += '<div style="background:#fff;border-radius:12px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06);border:1px solid #E2E8F0;overflow:hidden">';
        sectionsHtml += '<div onclick="relToggleSection(this)" style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;cursor:pointer;border-bottom:1px solid #E2E8F0">';
        sectionsHtml += '<h3 style="margin:0;font-size:.95rem;font-weight:600;color:#1E293B"><span class="rel-arrow" style="display:inline-block;transition:transform .2s;margin-right:6px">&#9654;</span>' + relEsc(label) + ' <span style="font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600;' + badgeStyle + '">' + sectionItems.length + ' remarque' + (sectionItems.length > 1 ? 's' : '') + '</span></h3>';
        sectionsHtml += '</div>';
        sectionsHtml += '<div class="rel-section-body" style="display:none;padding:20px">';

        var typeColors = { ortho: 'background:#FEF2F2;border-left:3px solid #EF4444', grammar: 'background:#FFFBEB;border-left:3px solid #F59E0B', coherence: 'background:#FDF4FF;border-left:3px solid #A855F7', style: 'background:#EFF6FF;border-left:3px solid #3B82F6' };
        var typeLabels = { ortho: 'Orthographe', grammar: 'Grammaire', coherence: 'Cohérence', style: 'Style' };

        sectionItems.forEach(function (it) {
            var cs = typeColors[it.type] || typeColors.style;
            sectionsHtml += '<div style="padding:10px 14px;border-radius:8px;margin-bottom:8px;font-size:13.5px;line-height:1.6;' + cs + '">';
            sectionsHtml += '<div style="color:#64748B;font-size:12px;margin-bottom:2px"><span style="display:inline-block;padding:1px 8px;border-radius:4px;font-size:11px;font-weight:600;background:#F1F5F9;color:#475569">' + relEsc(typeLabels[it.type] || it.type) + '</span> ' + relEsc(it.original || '') + '</div>';
            sectionsHtml += '<div style="font-weight:600;color:#1E293B">' + relEsc(it.correction || '') + '</div>';
            if (it.explication) sectionsHtml += '<div style="color:#64748B;font-size:12px;margin-top:2px;font-style:italic">' + relEsc(it.explication) + '</div>';
            sectionsHtml += '</div>';
        });

        // Corrected full section text
        if (corrected[key]) {
            var cid = 'relCorrected' + copyIdx++;
            sectionsHtml += '<div style="margin-top:16px;border-top:1px solid #E2E8F0;padding-top:16px">';
            sectionsHtml += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
            sectionsHtml += '<span style="font-weight:600;font-size:13px;color:#059669">Texte corrigé — prêt à copier</span>';
            sectionsHtml += '<button onclick="relCopyText(\'' + cid + '\',this)" style="padding:5px 14px;background:#10B981;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">Copier</button>';
            sectionsHtml += '</div>';
            sectionsHtml += '<div id="' + cid + '" style="background:linear-gradient(135deg,#ECFDF5,#D1FAE5);border:1px solid #6EE7B7;border-radius:8px;padding:14px 16px;font-size:13px;line-height:1.65;white-space:pre-wrap;color:#065F46">' + relEsc(corrected[key]) + '</div>';
            sectionsHtml += '</div>';
        }

        sectionsHtml += '</div></div>';
    });

    if (!sectionsHtml) {
        sectionsHtml = '<div style="text-align:center;padding:40px;color:#10B981;font-size:16px;font-weight:600">Aucune remarque — le rapport est impeccable !</div>';
    }

    document.getElementById('relResultSections').innerHTML = sectionsHtml;

    // Auto-open first section
    var firstHeader = document.querySelector('#relResultSections [onclick]');
    if (firstHeader) relToggleSection(firstHeader);

    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function relStatCard(num, label, color) {
    return '<div style="text-align:center;padding:12px;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.04)"><div style="font-size:1.5rem;font-weight:700;color:' + color + '">' + num + '</div><div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:.5px;margin-top:2px">' + label + '</div></div>';
}

function relToggleSection(headerEl) {
    var body = headerEl.nextElementSibling;
    var arrow = headerEl.querySelector('.rel-arrow');
    if (body.style.display === 'block') {
        body.style.display = 'none';
        if (arrow) arrow.style.transform = '';
    } else {
        body.style.display = 'block';
        if (arrow) arrow.style.transform = 'rotate(90deg)';
    }
}

function relCopyText(id, btn) {
    var el = document.getElementById(id);
    if (!el) return;
    navigator.clipboard.writeText(el.textContent).then(function () {
        btn.textContent = 'Copié !';
        btn.style.background = '#064E3B';
        setTimeout(function () { btn.textContent = 'Copier'; btn.style.background = '#10B981'; }, 1500);
    });
}

/* ─── UI Helpers ─────────────────────────────────────── */
function relNotify(msg) {
    var el = document.getElementById('notification');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 3000);
}

function relSetStatus(msg) {
    var el = document.getElementById('relStatusMsg');
    if (msg) { el.textContent = msg; el.style.display = 'block'; }
    else { el.style.display = 'none'; }
}

function relShowProgress(pct) {
    document.getElementById('relProgressBar').style.display = 'block';
    document.getElementById('relProgressFill').style.width = Math.min(pct, 100) + '%';
}

function relHideProgress() {
    document.getElementById('relProgressBar').style.display = 'none';
    document.getElementById('relProgressFill').style.width = '0%';
}

function relEsc(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}
