/* ═══════════════════════════════════════════════════════
   CECB Plus — Textes CECB Engine
   Port HTML/JS du générateur de textes Streamlit
   ═══════════════════════════════════════════════════════ */

// Ordre CECB des catégories
const ORDRE_CECB = [
    'batiment', 'tcext', 'mcext', 'fen', 'asols',
    'chauffage', 'ecs', 'elec', 'photo'
];

const ENVELOPPE_IDS = new Set(['batiment', 'tcext', 'mcext', 'fen', 'asols']);
const TECHNIQUE_IDS = new Set(['chauffage', 'ecs', 'elec', 'photo']);

// Cache des bibliothèques chargées
const biblioCache = {};

// State: valeurs saisies par l'utilisateur
const valeurs = {};

// State: textes assemblés
const textesGeneres = {};

// ─── Init ───────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    // Attendre que l'auth soit prête (checkAuth dans auth.js)
    await chargerToutesLesBibliotheques();
    renderTabs();
});

// ─── Chargement des bibliothèques JSON ──────────────────

async function chargerBibliotheque(categorie) {
    if (biblioCache[categorie]) return biblioCache[categorie];
    try {
        const resp = await fetch(`bibliotheque/${categorie}.json`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        biblioCache[categorie] = data;
        return data;
    } catch (e) {
        console.error(`Erreur chargement ${categorie}:`, e);
        return null;
    }
}

async function chargerToutesLesBibliotheques() {
    await Promise.all(ORDRE_CECB.map(cat => chargerBibliotheque(cat)));
}

// ─── Lister catégories ──────────────────────────────────

function listerCategories() {
    const result = [];
    for (const catId of ORDRE_CECB) {
        const biblio = biblioCache[catId];
        if (biblio) {
            result.push({ id: catId, name: biblio.name || catId });
        }
    }
    return result;
}

// ─── Render Tabs ────────────────────────────────────────

function renderTabs() {
    const categories = listerCategories();
    const catsEnv = categories.filter(c => ENVELOPPE_IDS.has(c.id));
    const catsTech = categories.filter(c => TECHNIQUE_IDS.has(c.id));

    renderTabGroup('tabsEnveloppe', 'contentEnveloppe', catsEnv);
    renderTabGroup('tabsTechnique', 'contentTechnique', catsTech);
}

function renderTabGroup(tabsContainerId, contentContainerId, categories) {
    const tabsContainer = document.getElementById(tabsContainerId);
    const contentContainer = document.getElementById(contentContainerId);
    tabsContainer.innerHTML = '';
    contentContainer.innerHTML = '';

    categories.forEach((cat, i) => {
        // Tab button
        const btn = document.createElement('button');
        btn.className = 'tab-btn' + (i === 0 ? ' active' : '');
        btn.textContent = cat.name;
        btn.dataset.catId = cat.id;
        btn.addEventListener('click', () => {
            tabsContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            contentContainer.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            document.getElementById(`panel-${cat.id}`).classList.add('active');
        });
        tabsContainer.appendChild(btn);

        // Tab panel
        const panel = document.createElement('div');
        panel.className = 'tab-panel' + (i === 0 ? ' active' : '');
        panel.id = `panel-${cat.id}`;
        contentContainer.appendChild(panel);

        renderCategoryPanel(panel, cat.id);
    });
}

// ─── Render Category Panel ──────────────────────────────

function renderCategoryPanel(panel, catId) {
    const biblio = biblioCache[catId];
    if (!biblio) {
        panel.innerHTML = '<p class="error-msg">Biblioth&egrave;que introuvable</p>';
        return;
    }

    const isBatiment = catId === 'batiment';
    const hasAmeliorations = !isBatiment && biblio.ameliorations;

    // Initialize valeurs
    if (!valeurs[`${catId}_ei`]) valeurs[`${catId}_ei`] = {};
    if (hasAmeliorations && !valeurs[`${catId}_am`]) valeurs[`${catId}_am`] = {};

    // Layout
    let html = '';

    if (hasAmeliorations) {
        html += '<div class="two-columns">';
        html += '<div class="column">';
        html += renderSectionParams(catId, 'etat_initial', biblio.etat_initial, 'ei');
        html += '</div>';
        html += '<div class="column">';
        html += renderSectionParams(catId, 'ameliorations', biblio.ameliorations, 'am');
        html += '</div>';
        html += '</div>';
    } else {
        html += renderSectionParams(catId, 'etat_initial', biblio.etat_initial, 'ei');
    }

    // Text output section
    html += '<hr class="separator">';

    if (hasAmeliorations) {
        html += '<div class="two-columns">';
        html += '<div class="column">';
        html += renderTextBlock(catId, 'ei', 'État initial', 'texte-dyn-ei');
        html += '</div>';
        html += '<div class="column">';
        html += renderTextBlock(catId, 'am', 'Améliorations', 'texte-dyn-am');
        html += '</div>';
        html += '</div>';
    } else {
        html += renderTextBlock(catId, 'ei', 'État initial', 'texte-dyn-ei');
    }

    panel.innerHTML = html;

    // Attach event listeners to all form controls
    panel.querySelectorAll('select, input').forEach(el => {
        el.addEventListener('change', () => onParamChange(catId));
        el.addEventListener('input', () => onParamChange(catId));
    });

    // Initial text assembly
    onParamChange(catId);
}

// ─── Render Section Parameters ──────────────────────────

function renderSectionParams(catId, sectionName, sectionData, suffix) {
    if (!sectionData) return '';

    const label = suffix === 'ei' ? 'État initial' : 'Améliorations possibles';
    const icon = suffix === 'ei' ? '&#x1F4CB;' : '&#x1F527;';

    let html = `<div class="section-header">${icon} <strong>${label}</strong></div>`;
    const params = sectionData.parametres || [];

    params.forEach(param => {
        const pid = param.id;
        const nom = param.nom || pid;
        const paramType = param.type || 'select';
        const options = (param.options || []).filter(o => o.value).map(o => o.value);
        const widgetId = `${catId}_${suffix}_${pid}`;

        html += `<div class="form-field">`;
        html += `<label for="${widgetId}">${nom}</label>`;

        if (paramType === 'number') {
            html += `<input type="number" id="${widgetId}" data-cat="${catId}" data-suffix="${suffix}" data-pid="${pid}" value="0">`;
        } else if (paramType === 'text') {
            html += `<input type="text" id="${widgetId}" data-cat="${catId}" data-suffix="${suffix}" data-pid="${pid}" value="" placeholder="${nom}">`;
        } else if (options.length > 0) {
            html += `<select id="${widgetId}" data-cat="${catId}" data-suffix="${suffix}" data-pid="${pid}">`;
            html += `<option value="">(non renseign&eacute;)</option>`;
            options.forEach(opt => {
                html += `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`;
            });
            html += `</select>`;
        } else {
            html += `<input type="text" id="${widgetId}" data-cat="${catId}" data-suffix="${suffix}" data-pid="${pid}" value="" placeholder="${nom}">`;
        }

        html += `</div>`;
    });

    return html;
}

// ─── Render Text Block ──────────────────────────────────

function renderTextBlock(catId, suffix, label, cssClass) {
    const key = `${catId}_${suffix}`;
    return `
        <div class="text-block">
            <div class="text-block-header">Texte assembl&eacute; — ${label}</div>
            <div class="${cssClass}" id="texte-${key}"><em>(aucun texte)</em></div>
            <div class="text-actions">
                <button class="btn-copy" onclick="copierTexte('${key}')">Copier</button>
            </div>
            <div class="text-editor-section">
                <textarea id="editeur-${key}" class="text-editor" placeholder="Copiez le texte ci-dessus pour le modifier librement..."></textarea>
            </div>
        </div>
    `;
}

// ─── Parameter Change Handler ───────────────────────────

function onParamChange(catId) {
    const biblio = biblioCache[catId];
    if (!biblio) return;

    // Collect EI values
    const eiParams = (biblio.etat_initial || {}).parametres || [];
    const valeursEI = {};
    eiParams.forEach(param => {
        const el = document.getElementById(`${catId}_ei_${param.id}`);
        if (el) {
            const val = el.value;
            valeursEI[param.id] = (val === '(non renseigné)' || val === '') ? '' : val;
        }
    });
    valeurs[`${catId}_ei`] = valeursEI;

    // Assemble EI text
    const texteEI = assemblerTexte(catId, 'etat_initial', valeursEI);
    const elEI = document.getElementById(`texte-${catId}_ei`);
    if (elEI) {
        elEI.textContent = texteEI || '';
        if (!texteEI) elEI.innerHTML = '<em>(aucun texte)</em>';
    }
    textesGeneres[`${catId}_ei`] = texteEI;

    // Collect AM values if applicable
    if (biblio.ameliorations) {
        const amParams = (biblio.ameliorations || {}).parametres || [];
        const valeursAM = {};
        amParams.forEach(param => {
            const el = document.getElementById(`${catId}_am_${param.id}`);
            if (el) {
                const val = el.value;
                valeursAM[param.id] = (val === '(non renseigné)' || val === '') ? '' : val;
            }
        });
        valeurs[`${catId}_am`] = valeursAM;

        const texteAM = assemblerTexte(catId, 'ameliorations', valeursAM);
        const elAM = document.getElementById(`texte-${catId}_am`);
        if (elAM) {
            elAM.textContent = texteAM || '';
            if (!texteAM) elAM.innerHTML = '<em>(aucun texte)</em>';
        }
        textesGeneres[`${catId}_am`] = texteAM;
    }
}

// ─── Text Assembly Engine ───────────────────────────────

function assemblerTexte(catId, sectionName, vals) {
    const biblio = biblioCache[catId];
    if (!biblio) return '';

    const sectionData = biblio[sectionName] || {};
    let template = sectionData.template || '';
    if (!template) return '';

    // Find all placeholders in template
    const placeholders = new Set();
    const regex = /\{(\w+)\}/g;
    let match;
    while ((match = regex.exec(template)) !== null) {
        placeholders.add(match[1]);
    }

    // Track empty placeholders
    const placeholderVides = new Set();
    for (const ph of placeholders) {
        const val = vals[ph];
        if (val === undefined || val === null || val === '' || val === 0 || val === '0') {
            placeholderVides.add(ph);
        }
    }

    // Replace placeholders
    let texte = template;
    for (const [paramId, valeur] of Object.entries(vals)) {
        const placeholder = `{${paramId}}`;
        if (valeur === undefined || valeur === null || valeur === '' ||
            (valeur === 0 && placeholders.has(paramId))) {
            texte = texte.replace(` ${placeholder}`, '');
            texte = texte.replace(placeholder, '');
        } else {
            texte = texte.replaceAll(placeholder, String(valeur));
        }
    }

    // Remove remaining unreplaced placeholders
    for (const ph of placeholders) {
        const placeholder = `{${ph}}`;
        if (texte.includes(placeholder)) {
            texte = texte.replace(` ${placeholder}`, '');
            texte = texte.replace(placeholder, '');
        }
    }

    // Clean conditional phrases for empty placeholders
    if (placeholderVides.has('delai')) {
        texte = texte.replace(/Ces travaux sont à planifier\s*\.?/gi, '');
    }

    // Remove "La valeur U moyenne ... est de  W/m²K." if U empty
    texte = texte.replace(/La valeur U moyenne [^.]*est de\s+W\/m²K\./g, '');

    // Clean text
    texte = nettoyerTexte(texte);

    return texte;
}

function nettoyerTexte(texte) {
    // Multiple spaces
    texte = texte.replace(/ {2,}/g, ' ');

    // Double dots (keep ...)
    texte = texte.replace(/\.{2}(?!\.)/g, '.');

    // Orphan punctuation at start
    texte = texte.replace(/^\s*[,.]\s*/, '');

    // Sequences ". ." or ",  ,"
    texte = texte.replace(/\.\s*\./g, '.');
    texte = texte.replace(/,\s*,/g, ',');
    texte = texte.replace(/,\s*\./g, '.');

    // Spaces before punctuation
    texte = texte.replace(/\s+([.,;:!?])/g, '$1');

    // Space after punctuation if missing
    texte = texte.replace(/([.,;:!?])([A-ZÀ-Ýa-zà-ý])/g, '$1 $2');

    texte = texte.trim();

    // Ensure ends with period
    if (texte && !'.!?'.includes(texte[texte.length - 1])) {
        texte += '.';
    }

    return texte;
}

// ─── Copy Text ──────────────────────────────────────────

function copierTexte(key) {
    const texte = textesGeneres[key] || '';
    const editeur = document.getElementById(`editeur-${key}`);
    if (editeur) {
        editeur.value = texte;
    }

    // Also copy to clipboard
    if (texte && navigator.clipboard) {
        navigator.clipboard.writeText(texte).then(() => {
            showNotification('Texte copié dans le presse-papier');
        });
    }
}

// ─── Notification ───────────────────────────────────────

function showNotification(message) {
    const el = document.getElementById('notification');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2500);
}

// ─── Utilities ──────────────────────────────────────────

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
