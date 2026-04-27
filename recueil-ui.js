/* ════════════════════════════════════════════════════════════
 * recueil-ui.js
 * Helpers UI de l'onglet Recueil : navigation tabs, visibilités
 * conditionnelles (toit/chauffage/PV), changement de type de bâtiment
 * (avec lookup RegBL housing), estimation Uw fenêtres, indicateurs de
 * fin de vie, copy-clipboard, enrichissement Claude (enhance + undo),
 * resetComplementField, lien RegBL.
 * Extrait de recueil.js — Phase 4 (split god-file).
 *
 * Dépendances runtime (globales déjà chargées via projet.html) :
 *   - rv, sv, rvi, rvf (recueil.js)               — accesseurs DOM
 *   - recueilToast, recueilAutoSave (recueil.js)
 *   - onGenTextChange (recueil.js)
 *   - CecbApi (api-handler.js)                    — pour enhanceField
 *   - ProjectStore (project-store.js)
 *
 * API publique :
 *   - switchRecueilTab(tab), toggleSection(header)
 *   - updateToitFields(), updateChauffageFields(), updatePVFields()
 *   - onBuildingTypeChange()
 *   - estimateUw(), updateLifeIndicator(component, lifespan)
 *   - recueilCopyField(id), recueilCopyAll()
 *   - enhanceField(fieldId, fieldLabel), showUndoEnhance(...)
 *   - resetComplementField(field), ouvrirRegbl()
 *   - COMPLEMENT_DEFAULTS, ENHANCE_SYSTEM_PROMPT (constantes)
 * ════════════════════════════════════════════════════════════ */

function switchRecueilTab(tab) {
    document.querySelectorAll('#recueil-tabs .tab').forEach(function (t) {
        t.classList.toggle('active', t.dataset.tab === tab);
    });
    document.querySelectorAll('.recueil-tab-content').forEach(function (c) { c.classList.remove('active'); });
    document.getElementById('recueil-tab-' + tab).classList.add('active');
}

function toggleSection(header) {
    var body = header.nextElementSibling;
    var toggle = header.querySelector('.toggle');
    body.classList.toggle('collapsed');
    if (toggle) toggle.classList.toggle('collapsed');
}

/* ===== CONDITIONAL FIELD VISIBILITY ===== */

function updateToitFields() {
    var val = document.getElementById('toit-config').value;
    document.getElementById('toit-combles-group').style.display = val === 'plancher_combles' ? 'flex' : 'none';
}

function updateChauffageFields() {
    var conso = document.getElementById('chauf-conso').value;
    document.getElementById('chauf-conso-years-group').style.display = conso === 'oui' ? 'flex' : 'none';
}

function updatePVFields() {
    var val = document.getElementById('pv-existant').value;
    document.getElementById('pv-puissance-group').style.display = val === 'oui' ? 'flex' : 'none';
    document.getElementById('pv-batterie-group').style.display = val === 'oui' ? 'flex' : 'none';
}

/* ===== BUILDING TYPE CHANGE (RegBL Housing) ===== */

function onBuildingTypeChange() {
    var typeVal = rv('meta-type');
    if (typeVal === '1020' || typeVal === '1025') {
        fetchRegblHousing();
    }
}

async function fetchRegblHousing() {
    var egid = rv('meta-egid');
    if (!egid) return;
    try {
        var resp = await fetchWithTimeout('https://api3.geo.admin.ch/rest/services/api/MapServer/find?layer=ch.bfs.gebaeude_wohnungs_register&searchField=egid&searchText=' + egid + '&returnGeometry=false', {}, 10000);
        var data = await resp.json();
        if (!data.results || data.results.length === 0) return;
        var b = data.results[0].attributes || {};
        var totalWhg = b.ganzwhg || 0;
        // wazim is an array of room counts per dwelling
        var wazimArr = Array.isArray(b.wazim) ? b.wazim : [];
        // Count dwellings by room size
        var counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, '7+': 0 };
        wazimArr.forEach(function(n) {
            if (n === null || n === undefined) return;
            n = parseInt(n);
            if (n <= 0) return;
            if (n === 1) counts[1]++;
            else if (n === 2) counts[2]++;
            else if (n === 3) counts[3]++;
            else if (n === 4) counts[4]++;
            else if (n === 5) counts[5]++;
            else if (n === 6) counts[6]++;
            else counts['7+']++;
        });
        // Fill form fields
        sv('meta-apartments', totalWhg);
        sv('meta-studios', counts[1]);
        sv('meta-2p', counts[2]);
        sv('meta-3p', counts[3]);
        sv('meta-4p', counts[4]);
        sv('meta-5p', counts[5]);
        sv('meta-6p', counts[6]);
        sv('meta-6p-plus', counts['7+']);
        if (typeof recueilAutoSave === 'function') recueilAutoSave();
    } catch (e) { /* silent */ }
}

/* ===== UW ESTIMATION ===== */

function estimateUw() {
    var cadre = document.getElementById('fen-cadre').value;
    var vitrage = document.getElementById('fen-vitrage').value;
    if (!cadre || !vitrage) return;

    var table = {
        simple: { bois: 5.0, pvc: 5.0, alu: 5.5, mixte: 5.0 },
        double_ancien: { bois: 2.5, pvc: 2.6, alu: 2.8, mixte: 2.5 },
        double_isolant: { bois: 1.9, pvc: 2.0, alu: 2.2, mixte: 1.9 },
        double_selectif: { bois: 1.5, pvc: 1.8, alu: 2.0, mixte: 1.6 },
        triple: { bois: 0.9, pvc: 0.8, alu: 1.0, mixte: 0.9 }
    };

    var uw = table[vitrage] && table[vitrage][cadre];
    if (uw !== undefined) {
        document.getElementById('fen-uw').value = uw;
        var hint = document.getElementById('uw-hint');
        if (uw <= 1.0) { hint.textContent = 'Conforme aux standards actuels'; hint.style.color = 'var(--success, #27ae60)'; }
        else if (uw <= 1.3) { hint.textContent = 'Légèrement inférieur aux recommandations'; hint.style.color = 'var(--warning, #e67e22)'; }
        else { hint.textContent = 'Remplacement recommandé'; hint.style.color = 'var(--danger, #c0392b)'; }
    }
}

/* ===== LIFE INDICATORS ===== */

function updateLifeIndicator(component, lifespan) {
    var yearField = document.getElementById(
        component === 'fenetres' ? 'fen-year' :
            component === 'chauffage' ? 'chauf-year' :
                component === 'ecs' ? 'ecs-year' :
                    component + '-year');
    var year = parseInt(yearField && yearField.value) || 0;
    if (!year) return;

    var currentYear = new Date().getFullYear();
    var age = currentYear - year;
    var remaining = lifespan - age;
    var pct = remaining / lifespan;

    var el = document.getElementById('life-' + component);
    if (!el) return;

    if (pct > 0.5) {
        el.innerHTML = '<span class="life-indicator life-ok">' + remaining + ' ans restants</span>';
    } else if (pct > 0) {
        el.innerHTML = '<span class="life-indicator life-warn">' + remaining + ' ans restants</span>';
    } else {
        el.innerHTML = '<span class="life-indicator life-expired">Fin de vie dépassée (' + Math.abs(remaining) + ' ans)</span>';
    }
}

/* ===== COPY ALL ===== */

function recueilCopyField(id) {
    var el = document.getElementById(id);
    if (el) { navigator.clipboard.writeText(el.value); recueilToast('Copié !'); }
}

function recueilCopyAll() {
    var textareas = document.querySelectorAll('.gen-textarea');
    var all = '';
    var sectionLabels = {
        'toit': 'Toit', 'murs-ext': 'Murs contre extérieur', 'murs-terre': 'Murs contre terre',
        'murs-nc': 'Murs c/ non chauffé', 'fenetres': 'Fenêtres et portes',
        'sols-terre': 'Sols c/ terre', 'sols-nc': 'Sols c/ non chauffé',
        'ponts-thermiques': 'Ponts thermiques',
        'ventilation': 'Ventilation', 'chauffage': 'Chauffage', 'ecs': 'Eau chaude sanitaire',
        'appareils': 'Appareils et éclairage', 'pv': 'Photovoltaïque'
    };
    textareas.forEach(function (ta) {
        if (!ta.value.trim()) return;
        var parts = ta.id.replace('gen-', '').split('-');
        var suffix = parts.pop();
        var section = parts.join('-');
        var label = sectionLabels[section] || section;
        var suffixLabel = suffix === 'ei' ? 'État initial' : 'Améliorations';
        all += label + ' — ' + suffixLabel + '\n' + ta.value + '\n\n';
    });
    if (all) {
        navigator.clipboard.writeText(all);
        recueilToast('Tout le texte copié !');
    } else {
        recueilToast('Aucun texte à copier', 'error');
    }
}

/* ===== CLAUDE API — ENHANCE ===== */

var ENHANCE_SYSTEM_PROMPT = "Tu es un rédacteur technique pour des rapports CECB/CECB Plus. Améliore le texte en corrigeant la grammaire et l'orthographe, et en reformulant légèrement pour une meilleure fluidité et clarté. Règles : conserve le sens exact et toutes les données techniques (valeurs, années, mesures). Ne rajoute aucune information ni aucune phrase nouvelle. N'utilise jamais 'nous constatons', 'nous observons', 'nous notons', 'il est à noter', 'il convient de'. Supprime les passages entre crochets [...] marqués 'à compléter'. Retourne UNIQUEMENT le texte amélioré.";

// Store original texts before enhance (keyed by fieldId)
var _enhanceOriginals = {};

async function enhanceField(fieldId, fieldLabel) {
    if (!CecbApi.useProxy() && !CecbApi.getApiKey()) { recueilToast('Configurez votre clé API ou l\'URL proxy dans les paramètres (page d\'accueil)', 'error'); return; }

    var ta = document.getElementById(fieldId);
    if (!ta || !ta.value.trim()) { recueilToast('Aucun texte à enrichir', 'error'); return; }

    // Save original text before enhancing
    _enhanceOriginals[fieldId] = ta.value;

    var outputField = ta.closest('.output-field');
    var btn = outputField.querySelector('.btn-warning');
    var btnOrig = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = '<span class="spinner"></span>En cours...'; btn.disabled = true; }

    var userMsg = 'Améliore le texte ci-dessous : corrige la grammaire et l\'orthographe, reformule légèrement les phrases pour plus de fluidité et de clarté. Ne change pas le sens, ne rajoute aucune information nouvelle. Conserve toutes les données techniques. Envoie uniquement le texte amélioré.\n\n' + ta.value;

    try {
        var enriched = await CecbApi.callClaude({
            system: ENHANCE_SYSTEM_PROMPT,
            userMessage: userMsg,
            maxTokens: 2048
        });
        // Remove any remaining [... à compléter] markers
        enriched = enriched.replace(/\s*\[[^\]]*(?:compléter|manquant)[^\]]*\]\s*/gi, ' ').replace(/\s{2,}/g, ' ');
        if (enriched.trim()) {
            ta.value = enriched.trim();
            onGenTextChange(ta);
            showUndoEnhance(fieldId, fieldLabel, outputField);
            recueilToast(fieldLabel + ' amélioré');
        }
    } catch (e) { recueilToast('Erreur: ' + e.message, 'error'); }
    finally { if (btn) { btn.innerHTML = btnOrig; btn.disabled = false; } }
}

function showUndoEnhance(fieldId, fieldLabel, outputField) {
    // Remove existing undo button if any
    var existing = outputField.querySelector('.btn-undo-enhance');
    if (existing) existing.remove();
    // Add undo button
    var btnsDiv = outputField.querySelector('.output-field-btns');
    if (!btnsDiv) return;
    var undoBtn = document.createElement('button');
    undoBtn.className = 'btn btn-sm btn-undo-enhance';
    undoBtn.textContent = 'Annuler';
    undoBtn.style.cssText = 'background:#64748B;color:#fff;';
    undoBtn.onclick = function () {
        var ta = document.getElementById(fieldId);
        if (ta && _enhanceOriginals[fieldId]) {
            ta.value = _enhanceOriginals[fieldId];
            onGenTextChange(ta);
            delete _enhanceOriginals[fieldId];
            recueilToast(fieldLabel + ' — texte initial restauré');
        }
        undoBtn.remove();
    };
    btnsDiv.appendChild(undoBtn);
}

/** Default texts for Complément sub-tab */
var COMPLEMENT_DEFAULTS = {
    revalorisation: "La rénovation énergétique offre une opportunité intéressante pour améliorer durablement le confort et préserver la valeur d'un bâtiment. Elle permet de créer des surfaces habitables supplémentaires grâce à des surélévations ou des extensions, de repenser l'agencement des espaces intérieurs ou d'agrandir les balcons existants. L'amélioration du confort et le maintien de la valeur à long terme représentent des objectifs importants de cette approche. Une rénovation énergétique est une occasion unique d'améliorer à long terme le confort et de maintenir la valeur d'un bâtiment. On peut créer des surfaces habitables supplémentaires par des surélévations ou des extensions ; on peut aussi revoir l'agencement des pièces ou agrandir des balcons. Il est pertinent d'optimiser le confort et le maintien de la valeur à long terme.",
    comportement: "Le CECB évalue la performance énergétique du bâtiment selon des conditions d'utilisation et d'occupation normalisées. La consommation énergétique effective dépend en grande partie du comportement des occupant·e·s et peut ainsi s'écarter significativement des valeurs indiquées par le CECB. Les recommandations du document CECB se concentrent exclusivement sur l'enveloppe du bâtiment et ses installations techniques. Néanmoins, une utilisation rationnelle de l'énergie demeure l'une des mesures les plus performantes et économiquement avantageuses. Des réductions importantes de la consommation peuvent être obtenues par une aération appropriée et par l'ajustement à la baisse de la température ambiante durant la période hivernale."
};

/** Reset a complement textarea to its original default text */
function resetComplementField(field) {
    var ta = document.getElementById('gen-' + field);
    if (ta && COMPLEMENT_DEFAULTS[field]) {
        ta.value = COMPLEMENT_DEFAULTS[field];
        recueilAutoSave();
    }
}

/** Open the RegBL extended info page for the current project's EGID */
function ouvrirRegbl() {
    var egid = rv('meta-egid');
    if (egid) {
        window.open('https://api3.geo.admin.ch/rest/services/ech/MapServer/ch.bfs.gebaeude_wohnungs_register/' + egid + '_0/extendedHtmlPopup?lang=fr', '_blank');
    }
}
