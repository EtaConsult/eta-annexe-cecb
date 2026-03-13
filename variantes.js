/* ═══════════════════════════════════════════════════════
   CECB Plus — Variantes d'assainissement
   Extrait de variantes.html, adapté pour mode projet
   ═══════════════════════════════════════════════════════ */

/* ═══════ DATA ═══════ */

const CATEGORIES = [
    {
        name: "Enveloppe du bâtiment",
        items: [
            { id: "toits", label: "Isolation des toits / plafonds contre extérieur" },
            { id: "combles", label: "Isolation des plafonds contre combles non chauffés" },
            { id: "facades", label: "Isolation des façades / murs contre extérieur" },
            { id: "murs_nc", label: "Isolation des murs contre locaux non chauffés" },
            { id: "murs_terre", label: "Isolation des murs contre terrain" },
            { id: "fenetres", label: "Remplacement des fenêtres" },
            { id: "sols_ext", label: "Isolation des sols contre extérieur" },
            { id: "sols_nc", label: "Isolation des sols contre locaux non chauffés" },
            { id: "sols_terrain", label: "Isolation des sols contre terrain" },
            { id: "ponts", label: "Ponts thermiques" }
        ]
    },
    {
        name: "Technique du bâtiment",
        items: [
            { id: "chauffage", label: "Remplacement du producteur de chaleur" },
            { id: "ecs", label: "Remplacement du producteur d'ECS" },
            { id: "distrib_chaleur", label: "Distributeur de chaleur" },
            { id: "distrib_ecs", label: "Distribution ECS" },
            { id: "ventilation", label: "Système de ventilation" }
        ]
    },
    {
        name: "Électricité",
        items: [
            { id: "appareils_elec", label: "Remplacement des appareils électroniques" },
            { id: "photovoltaique", label: "Production d'électricité / Installation photovoltaïque" }
        ]
    }
];

const TEXT_LIBRARY = {
    toits: ["Isolation améliorée de la toiture pour limiter les pertes thermiques, atteindre une valeur U \u2264 0,20 W/m\u00b2K et être éligible aux subventions du Programme Bâtiment de CHF 50.-/m\u00b2 de surface isolée (Mesure M01).","Isolation améliorée de la toiture pour limiter les pertes thermiques, atteindre une valeur U \u2264 0,15 W/m\u00b2K et être éligible aux subventions du Programme Bâtiment de CHF 80.-/m\u00b2 de surface isolée (Mesure M01).","Aucune mesure relative aux toits contre extérieur n'est prise en compte dans le bilan thermique."],
    combles: ["Isolation améliorée du plancher des combles pour limiter les pertes thermiques et atteindre une valeur U \u2264 0,25 W/m\u00b2K.","Isolation améliorée du plancher des combles pour limiter les pertes thermiques et atteindre une valeur U \u2264 0,20 W/m\u00b2K.","Isolation améliorée du plancher des combles pour limiter les pertes thermiques et atteindre une valeur U \u2264 0,15 W/m\u00b2K.","Aucune mesure relative aux plafonds contre combles non chauffés n'est prise en compte dans le bilan thermique."],
    facades: ["Isolation améliorée de la façade pour limiter les pertes thermiques, atteindre une valeur U \u2264 0,20 W/m\u00b2K et être éligible aux subventions du Programme Bâtiments de CHF 50.-/m\u00b2 de surface isolée (Mesure M01).","Isolation améliorée de la façade pour limiter les pertes thermiques, atteindre une valeur U \u2264 0,15 W/m\u00b2K et être éligible aux subventions du Programme Bâtiments de CHF 80.-/m\u00b2 de surface isolée (Mesure M01).","Isolation améliorée de la façade pour limiter les pertes thermiques, atteindre une valeur U \u2264 0,40 W/m\u00b2K. La valeur U n'étant pas une valeur rénovative, l'intervention n'est pas éligible aux subventions.","Aucune mesure n'est prise en compte dans le bilan thermique."],
    murs_nc: ["Isolation améliorée des murs adjacents aux espaces non chauffés pour limiter les pertes thermiques et atteindre une valeur U \u2264 0,20 W/m\u00b2K.","Isolation améliorée des murs adjacents aux espaces non chauffés pour limiter les pertes thermiques et atteindre une valeur U \u2264 0,25 W/m\u00b2K.","Aucune mesure n'est prise en compte dans le bilan thermique."],
    murs_terre: ["Isolation améliorée des murs du sous-sol en contact avec le terrain pour limiter les pertes thermiques et atteindre une valeur U ≤ 0,20 W/m²K. Ces travaux ne sont pas éligibles aux subventions du Programme Bâtiments.","Isolation améliorée des murs du sous-sol en contact avec le terrain pour limiter les pertes thermiques et atteindre une valeur U ≤ 0,25 W/m²K. Ces travaux ne sont pas éligibles aux subventions du Programme Bâtiments.","Aucune mesure n'est prise en compte dans le bilan thermique pour les murs en contact avec le terrain."],
    fenetres: ["Remplacement des fenêtres par des fenêtres avec triple vitrage performant et cadre PVC: Ug=0.7 W/m\u00b2K - gp=0.5 - Uf=1.4 W/m\u00b2K - \u03a8g=0.04 W/mK.","Aucune mesure n'est prise en compte dans le bilan thermique."],
    sols_ext: ["Isolation améliorée des sols contre extérieur pour limiter les pertes thermiques et atteindre une valeur U \u2264 0,15 W/m\u00b2K.","Isolation améliorée des sols contre extérieur pour limiter les pertes thermiques et atteindre une valeur U \u2264 0,20 W/m\u00b2K.","Aucune mesure n'est prise en compte dans le bilan thermique."],
    sols_nc: ["Isolation améliorée du sol contre espace non chauffé (sous dalle) pour limiter les pertes thermiques, atteindre une valeur U \u2264 0,20 W/m\u00b2K.","Isolation améliorée du sol contre espace non chauffé (sous dalle) pour limiter les pertes thermiques, atteindre une valeur U \u2264 0,25 W/m\u00b2K.","Aucune mesure n'est prise en compte dans le bilan thermique pour le sol contre espaces non chauffés."],
    sols_terrain: ["Isolation améliorée du sol enterré contre terrain (sur dalle) pour limiter les pertes thermiques, atteindre une valeur U \u2264 0,25 W/m\u00b2K et être éligible aux subventions du Programme Bâtiment de CHF 50.-/m\u00b2 (Mesure M01).","Isolation améliorée du sol enterré contre terrain (sur dalle) pour limiter les pertes thermiques, atteindre une valeur U \u2264 0,15 W/m\u00b2K et être éligible aux subventions du Programme Bâtiment de CHF 80.-/m\u00b2 (Mesure M01).","Aucune mesure n'est prise en compte dans le bilan thermique pour le sol enterré contre terrain."],
    ponts: ["Les ponts thermiques relatifs aux travaux de rénovation ont été pris en compte.","En l'absence d'isolation, les ponts thermiques sont négligeables."],
    chauffage: ["Remplacement du système existant au profit de l'installation d'un chauffage centralisé PAC air/eau.","Remplacement du système existant au profit d'un raccordement au réseau CAD.","Aucune mesure relative au remplacement du producteur de chaleur n'a été prise en compte dans le bilan thermique."],
    ecs: ["Couplage de la production d'eau chaude sanitaire au nouveau système de chauffage.","Aucune mesure relative au remplacement du producteur d'eau chaude sanitaire (ECS) n'a été prise en compte dans le bilan thermique.","Remplacement du boiler électrique par un modèle plus performant ou une production couplée au chauffage.","Remplacement du système d'ECS par un boiler pompe à chaleur indépendant.","Remplacement du boiler existant par un système solaire thermique en appoint.","Installation d'un système de production d'ECS décentralisé.","Séparation de la production d'ECS et du chauffage."],
    distrib_chaleur: ["Création d'un système de distribution de chaleur hydraulique par radiateurs.","Création d'un système de distribution de chaleur hydraulique par chauffage au sol.","Aucune mesure relative à la distribution de chaleur n'a été prise en compte dans le bilan thermique."],
    distrib_ecs: ["Aucune mesure relative à la distribution d'eau chaude sanitaire (ECS) n'a été prise en compte dans le bilan thermique."],
    ventilation: ["Aucune mesure relative à la ventilation n'a été prise en compte dans le bilan thermique.","Installation d'un système de ventilation simple flux avec récupération de chaleur.","Installation d'un système de ventilation simple flux sans récupération de chaleur.","Installation d'un système de ventilation double flux avec récupération de chaleur centralisée.","Installation d'un système de ventilation double flux sans récupération de chaleur centralisée.","Amélioration de la ventilation naturelle par la pose de grilles hygroréglables.","Installation d'un système de ventilation mécanique contrôlée (VMC) simple flux hygroréglable.","Aération naturelle suffisante, aucune intervention recommandée.","Présence d'un système de ventilation déjà performant.","L'amélioration de l'étanchéité impose la mise en place d'un système de ventilation contrôlée."],
    appareils_elec: ["Aucune mesure relative au remplacement des appareils électriques n'a été prise en compte dans le bilan thermique."],
    photovoltaique: ["Installation d'un système de panneaux solaires photovoltaïques en ajouté sur la toiture rénovée.","Aucune mesure relative à l'installation photovoltaïque n'a été prise en compte dans le bilan thermique."]
};

const TEXT_SHORT_LABELS = {
    toits: ["Isolation toiture, U \u2264 0,20 — subv. 50.-/m\u00b2 (M01)","Isolation toiture, U \u2264 0,15 — subv. 80.-/m\u00b2 (M01)","Aucune mesure (toits)"],
    combles: ["Isolation combles, U \u2264 0,25","Isolation combles, U \u2264 0,20","Isolation combles, U \u2264 0,15","Aucune mesure (combles)"],
    facades: ["Isolation façade, U \u2264 0,20 — subv. 50.-/m\u00b2 (M01)","Isolation façade, U \u2264 0,15 — subv. 80.-/m\u00b2 (M01)","Isolation façade, U \u2264 0,40 — non éligible subv.","Aucune mesure (façade)"],
    murs_nc: ["Isolation murs non chauffés, U \u2264 0,20","Isolation murs non chauffés, U \u2264 0,25","Aucune mesure (murs non chauffés)"],
    murs_terre: ["Isolation murs terrain, U ≤ 0,20","Isolation murs terrain, U ≤ 0,25","Aucune mesure (murs terrain)"],
    fenetres: ["Triple vitrage PVC, Ug=0.7 W/m\u00b2K","Aucune mesure (fenêtres)"],
    sols_ext: ["Isolation sols ext., U \u2264 0,15","Isolation sols ext., U \u2264 0,20","Aucune mesure (sols ext.)"],
    sols_nc: ["Isolation sol non chauffé, U \u2264 0,20","Isolation sol non chauffé, U \u2264 0,25","Aucune mesure (sol non chauffé)"],
    sols_terrain: ["Isolation sol terrain, U \u2264 0,25 — subv. 50.-/m\u00b2","Isolation sol terrain, U \u2264 0,15 — subv. 80.-/m\u00b2","Aucune mesure (sol terrain)"],
    ponts: ["Ponts thermiques pris en compte","Ponts thermiques négligeables"],
    chauffage: ["PAC air/eau centralisée","Raccordement au réseau CAD","Aucune mesure (recommandation remplacement)"],
    ecs: ["ECS couplée au nouveau chauffage","Aucune mesure (recommandation ECS)","Remplacement boiler élec.","Boiler PAC indépendant","Système solaire thermique","Production ECS décentralisée","Séparation ECS / chauffage"],
    distrib_chaleur: ["Distribution hydraulique radiateurs","Distribution hydraulique chauffage au sol","Aucune mesure (vérification conduites)"],
    distrib_ecs: ["Aucune mesure (contrôle conduites ECS)"],
    ventilation: ["Aucune mesure (évaluation ventilation)","VMC simple flux avec récup.","VMC simple flux sans récup.","VMC double flux avec récup.","VMC double flux sans récup.","Ventilation naturelle améliorée","VMC simple flux hygroréglable","Aération naturelle suffisante","Ventilation existante performante","Ventilation contrôlée imposée"],
    appareils_elec: ["Aucune mesure (impact marginal)"],
    photovoltaique: ["Installation PV sur toiture rénovée","Aucune mesure (opportunité PV)"]
};

const DEFAULT_FRAMEWORK = {
    intro_1: "La rénovation d'un édifice représente un projet de grande envergure, nécessitant une analyse exhaustive des différentes possibilités de rénovation.",
    intro_2: "Nous préconisons une approche holistique et globale pour la rénovation énergétique des bâtiments, qui constitue une stratégie efficace pour maximiser les résultats sur le long terme et limiter significativement les consommations.",
    intro_3: "Le CECB Plus ne constitue pas une base de planification pour l'exécution des travaux mais une base décisionnelle sur les travaux à entreprendre. Ce rapport permet d'évaluer les conséquences des 3 variantes de mesures d'assainissement énergétique sur les performances du bâtiment dans son état actuel.",
    intro_ponts: "Lors des travaux de rénovation de la façade, il est essentiel de minimiser autant que possible les ponts thermiques existants.",
    variante1_intro: "La Variante 1 propose des mesures correctives de l'enveloppe du bâtiment, tout en minimisant les désagréments pour les utilisateurs des locaux.",
    variante1_conclusion: "Ces mesures ne sont pas suffisantes pour atteindre les standards d'un assainissement énergétique pertinent.",
    variante2_intro: "La Variante 2 propose l'ensemble des travaux suivants :",
    variante3_intro: "La Variante 3, quant à elle, propose d'atteindre un niveau d'efficacité énergétique satisfaisant. Elle prévoit :",
    conclusion: "Les variantes 2 et 3 autorisent, une fois l'enveloppe thermique améliorée, le remplacement du système de production de chaleur au profit d'une pompe à chaleur air eau et permettent d'exploiter les énergies renouvelables."
};

const FRAMEWORK_LABELS = {
    intro_1: "Introduction (partie 1)", intro_2: "Introduction (partie 2)", intro_3: "Introduction (partie 3)",
    intro_ponts: "Remarque ponts thermiques",
    variante1_intro: "Variante 1 — Introduction", variante1_conclusion: "Variante 1 — Conclusion",
    variante2_intro: "Variante 2 — Introduction",
    variante3_intro: "Variante 3 — Introduction",
    conclusion: "Conclusion générale"
};

const ALL_ITEM_IDS = CATEGORIES.flatMap(function (c) { return c.items.map(function (i) { return i.id; }); });

/* ═══════ STATE ═══════ */

var varState = getDefaultVarState();
var activeVariantTab = 0;

function getDefaultVarState() {
    var checks = {}, selectedTexts = {}, customTexts = {};
    ALL_ITEM_IDS.forEach(function (id) { checks[id] = [false, false, false]; selectedTexts[id] = 0; customTexts[id] = ''; });
    return { variantNames: ['Travaux correctifs', 'Toiture', 'Global'], variantCosts: ['', '', ''], checks: checks, selectedTexts: selectedTexts, customTexts: customTexts, frameworkTexts: Object.assign({}, DEFAULT_FRAMEWORK) };
}

function varSaveState() {
    var pid = ProjectStore.getCurrentId();
    if (pid) {
        ProjectStore.update(pid, 'variantes', varState);
    }
}

function varLoadState() {
    var pid = ProjectStore.getCurrentId();
    if (!pid) return;
    var project = ProjectStore.get(pid);
    if (project && project.variantes) {
        var saved = project.variantes;
        var def = getDefaultVarState();
        varState = {
            variantNames: saved.variantNames || def.variantNames,
            variantCosts: saved.variantCosts || def.variantCosts,
            checks: Object.assign({}, def.checks, saved.checks),
            selectedTexts: Object.assign({}, def.selectedTexts, saved.selectedTexts),
            customTexts: Object.assign({}, def.customTexts, saved.customTexts),
            frameworkTexts: Object.assign({}, def.frameworkTexts, saved.frameworkTexts)
        };
    }
}

/* ═══════ INIT ═══════ */

function initVariantes() {
    varLoadState();
    varRenderMatrix();
    varRenderFrameworkTexts();
    varUpdatePreview();
    varRenderSummaryTable();
    varSetupToolbar();
    varSetupExport();
}

/* ═══════ RENDER — Matrix ═══════ */

function varRenderMatrix() {
    var table = document.getElementById('varMatrixTable');
    if (!table) return;
    var html = '<thead><tr><th>Poste</th>';
    for (var v = 0; v < 3; v++) html += '<th>Variante ' + (v + 1) + '<input type="text" class="v-name-input" data-v="' + v + '" placeholder="Nom..."></th>';
    html += '</tr></thead><tbody>';

    CATEGORIES.forEach(function (cat) {
        html += '<tr class="category-row"><td colspan="4">' + varEscapeHtml(cat.name) + '</td></tr>';
        cat.items.forEach(function (item) {
            html += '<tr class="item-row"><td>' + varEscapeHtml(item.label);
            html += '<select class="item-select" data-item="' + item.id + '">';
            var options = TEXT_LIBRARY[item.id];
            var shortLabels = TEXT_SHORT_LABELS[item.id] || [];
            options.forEach(function (text, idx) {
                var sel = varState.selectedTexts[item.id] === idx ? ' selected' : '';
                var label = shortLabels[idx] || varTruncate(text, 90);
                html += '<option value="' + idx + '"' + sel + '>' + varEscapeHtml(label) + '</option>';
            });
            var customSel = varState.selectedTexts[item.id] === 'custom' ? ' selected' : '';
            html += '<option value="custom"' + customSel + '>Texte personnalisé...</option></select>';
            var showCustom = varState.selectedTexts[item.id] === 'custom' ? ' visible' : '';
            html += '<textarea class="item-custom-ta' + showCustom + '" data-item="' + item.id + '" placeholder="Texte personnalisé...">' + varEscapeHtml(varState.customTexts[item.id]) + '</textarea></td>';
            for (var v = 0; v < 3; v++) {
                var checked = varState.checks[item.id][v] ? ' checked' : '';
                html += '<td><input type="checkbox" data-item="' + item.id + '" data-v="' + v + '"' + checked + '></td>';
            }
            html += '</tr>';
        });
    });
    html += '<tr class="cost-row"><td>Coûts estimés (CHF)</td>';
    for (var v = 0; v < 3; v++) html += '<td><input type="text" class="cost-input-matrix" data-v="' + v + '" placeholder="ex: 120\'000.-"></td>';
    html += '</tr></tbody>';
    table.innerHTML = html;

    for (var v = 0; v < 3; v++) {
        table.querySelector('.v-name-input[data-v="' + v + '"]').value = varState.variantNames[v];
        table.querySelector('.cost-input-matrix[data-v="' + v + '"]').value = varState.variantCosts[v];
    }

    table.addEventListener('change', function (e) {
        if (e.target.type === 'checkbox') {
            varState.checks[e.target.dataset.item][parseInt(e.target.dataset.v)] = e.target.checked;
            varSaveState(); varUpdatePreview(); varRenderSummaryTable();
        }
        if (e.target.classList.contains('item-select')) {
            var id = e.target.dataset.item;
            var val = e.target.value === 'custom' ? 'custom' : parseInt(e.target.value);
            varState.selectedTexts[id] = val;
            var ta = e.target.parentElement.querySelector('.item-custom-ta');
            if (ta) ta.classList.toggle('visible', val === 'custom');
            varSaveState(); varUpdatePreview();
        }
    });
    table.addEventListener('input', function (e) {
        if (e.target.classList.contains('item-custom-ta')) { varState.customTexts[e.target.dataset.item] = e.target.value; varSaveState(); varUpdatePreview(); }
        if (e.target.classList.contains('v-name-input')) { varState.variantNames[parseInt(e.target.dataset.v)] = e.target.value; varSaveState(); varUpdatePreview(); varRenderSummaryTable(); }
        if (e.target.classList.contains('cost-input-matrix')) { varState.variantCosts[parseInt(e.target.dataset.v)] = e.target.value; varSaveState(); varRenderSummaryTable(); }
    });
}

function varGetSelectedText(itemId) {
    var sel = varState.selectedTexts[itemId];
    if (sel === 'custom') return varState.customTexts[itemId] || '';
    return TEXT_LIBRARY[itemId][sel] || '';
}

/* ═══════ RENDER — Framework Texts ═══════ */

function varRenderFrameworkTexts() {
    var container = document.getElementById('varFrameworkTexts');
    if (!container) return;
    container.innerHTML = '';
    Object.keys(FRAMEWORK_LABELS).forEach(function (key) {
        var div = document.createElement('div');
        div.className = 'fw-item';
        var label = document.createElement('label');
        label.textContent = FRAMEWORK_LABELS[key];
        div.appendChild(label);
        var ta = document.createElement('textarea');
        ta.value = varState.frameworkTexts[key];
        ta.dataset.key = key;
        ta.addEventListener('input', function () { varState.frameworkTexts[key] = this.value; varSaveState(); varUpdatePreview(); });
        div.appendChild(ta);
        container.appendChild(div);
    });
}

/* ═══════ PREVIEW — Blocs & Report ═══════ */

function varUpdatePreview() { varRenderBlocTabs(); varRenderBlocContent(); varRenderReport(); }

function varRenderBlocTabs() {
    var container = document.getElementById('varBlocTabs');
    if (!container) return;
    container.innerHTML = '';
    for (var v = 0; v < 3; v++) {
        (function (vi) {
            var tab = document.createElement('div');
            tab.className = 'bloc-tab' + (vi === activeVariantTab ? ' active' : '');
            tab.textContent = 'Variante ' + (vi + 1) + ' — ' + (varState.variantNames[vi] || '');
            tab.addEventListener('click', function () { activeVariantTab = vi; varRenderBlocTabs(); varRenderBlocContent(); });
            container.appendChild(tab);
        })(v);
    }
    document.querySelectorAll('.copy-bloc-btn').forEach(function (btn) {
        var vi = parseInt(btn.dataset.v);
        btn.textContent = 'Copier V' + (vi + 1) + ' — ' + (varState.variantNames[vi] || 'Variante ' + (vi + 1));
    });
}

function varRenderBlocContent() {
    var container = document.getElementById('varBlocContent');
    if (!container) return;
    container.innerHTML = '';
    var v = activeVariantTab;
    CATEGORIES.forEach(function (cat) {
        var div = document.createElement('div');
        div.className = 'bloc-category';
        var title = document.createElement('div');
        title.className = 'bloc-category-title';
        title.textContent = cat.name + ' :';
        div.appendChild(title);
        var checkedItems = cat.items.filter(function (item) { return varState.checks[item.id][v]; });
        if (checkedItems.length === 0) {
            var empty = document.createElement('div'); empty.className = 'bloc-empty'; empty.textContent = 'Aucun poste sélectionné'; div.appendChild(empty);
        } else {
            checkedItems.forEach(function (item) { var m = document.createElement('div'); m.className = 'bloc-measure'; m.textContent = '- ' + varGetSelectedText(item.id); div.appendChild(m); });
        }
        container.appendChild(div);
    });
}

function varGenerateVariantBloc(variantIdx) {
    var text = '';
    CATEGORIES.forEach(function (cat, catIdx) {
        var bloc = varGenerateBloc(variantIdx, catIdx, true);
        if (bloc) { if (text) text += '\n\n'; text += bloc; }
    });
    return text;
}

function varGenerateBloc(variantIdx, categoryIdx, includeTitle) {
    var cat = CATEGORIES[categoryIdx];
    var checked = cat.items.filter(function (item) { return varState.checks[item.id][variantIdx]; });
    if (checked.length === 0) return '';
    var lines = checked.map(function (item) { return '- ' + varGetSelectedText(item.id); });
    return includeTitle ? cat.name + ' :\n' + lines.join('\n') : lines.join('\n');
}

function varGenerateReport() {
    var fw = varState.frameworkTexts;
    var r = 'Remarques générales\n\n' + fw.intro_1 + ' ' + fw.intro_2 + '\n\n' + fw.intro_3 + '\n\n' + fw.intro_ponts + '\n\n';
    var v1Env = varGenerateBloc(0, 0, false), v1Tech = varGenerateBloc(0, 1, false);
    r += fw.variante1_intro + " Cette option inclut l'amélioration partielle de l'enveloppe du bâtiment, à savoir :\n";
    if (v1Env) r += v1Env + '\n';
    r += fw.variante1_conclusion + '\n\nConcernant les installations techniques du bâtiment :\n';
    if (v1Tech) r += v1Tech + '\n';
    r += '\n';
    var v2Env = varGenerateBloc(1, 0, true), v2Tech = varGenerateBloc(1, 1, true), v2Elec = varGenerateBloc(1, 2, true);
    r += fw.variante2_intro + '\n'; if (v2Env) r += v2Env + '\n'; if (v2Tech) r += v2Tech + '\n'; if (v2Elec) r += v2Elec + '\n'; r += '\n';
    var v3Env = varGenerateBloc(2, 0, true), v3Tech = varGenerateBloc(2, 1, true), v3Elec = varGenerateBloc(2, 2, true);
    r += fw.variante3_intro + '\n'; if (v3Env) r += v3Env + '\n'; if (v3Tech) r += v3Tech + '\n'; if (v3Elec) r += v3Elec + '\n'; r += '\n';
    r += fw.conclusion;
    return r;
}

function varRenderReport() {
    var el = document.getElementById('varReportPreview');
    if (el) el.textContent = varGenerateReport();
}

/* ═══════ RENDER — Summary Table ═══════ */

function varRenderSummaryTable() {
    var container = document.getElementById('varSummaryTableContainer');
    if (!container) return;
    var html = '<table class="summary-table" id="varSummaryTable">';
    html += '<colgroup><col style="width:50%"><col style="width:16.6%"><col style="width:16.6%"><col style="width:16.6%"></colgroup>';
    html += '<thead><tr><th rowspan="2" style="text-align:left">Poste</th>';
    for (var v = 0; v < 3; v++) html += '<th>Variante ' + (v + 1) + '</th>';
    html += '</tr><tr>';
    for (var v = 0; v < 3; v++) html += '<th><span class="st-sub">' + varEscapeHtml(varState.variantNames[v]) + '</span></th>';
    html += '</tr></thead><tbody>';
    CATEGORIES.forEach(function (cat) {
        html += '<tr class="st-cat"><td colspan="4">' + varEscapeHtml(cat.name) + '</td></tr>';
        cat.items.forEach(function (item) {
            html += '<tr><td>' + varEscapeHtml(item.label) + '</td>';
            for (var v = 0; v < 3; v++) html += '<td>' + (varState.checks[item.id][v] ? '<span class="st-check">\u2713</span>' : '') + '</td>';
            html += '</tr>';
        });
    });
    html += '<tr class="st-cost"><td>Coûts estimés</td>';
    for (var v = 0; v < 3; v++) {
        var cost = varState.variantCosts[v];
        var formatted = cost ? (cost.toLowerCase().startsWith('chf') ? cost : 'CHF ' + cost) : '';
        html += '<td>' + varEscapeHtml(formatted) + '</td>';
    }
    html += '</tr></tbody></table>';
    container.innerHTML = html;
}

/* ═══════ EXPORT ═══════ */

function varSetupExport() {
    document.querySelectorAll('.copy-bloc-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var v = parseInt(this.dataset.v);
            var text = varGenerateVariantBloc(v);
            if (!text) { varShowNotification('Aucun poste sélectionné pour cette variante'); return; }
            navigator.clipboard.writeText(text).then(function () { varShowNotification('Variante ' + (v + 1) + ' copiée'); });
        });
    });
    var copyReport = document.getElementById('varCopyReport');
    if (copyReport) copyReport.addEventListener('click', function () { navigator.clipboard.writeText(varGenerateReport()).then(function () { varShowNotification('Rapport copié'); }); });

    var copyTable = document.getElementById('varCopyTable');
    if (copyTable) copyTable.addEventListener('click', async function () {
        var tableEl = document.getElementById('varSummaryTable');
        var styledHTML = '<style>table{border-collapse:collapse;font-family:Urbanist,Arial,sans-serif;font-size:9.5pt}th,td{padding:5px 8px;border-bottom:1px solid #E3DAD1;overflow:hidden}th{font-weight:700;border-bottom:2px solid #333;text-align:center}th:first-child,td:first-child{text-align:left}td:not(:first-child){text-align:center}.st-cat td{font-weight:700}.st-check{color:#10B981;font-weight:700}.st-cost td{border-top:2px solid #333;font-weight:600}.st-sub{font-weight:400;font-size:8pt;color:#555}</style>' + tableEl.outerHTML;
        try {
            await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([styledHTML], { type: 'text/html' }), 'text/plain': new Blob([tableEl.innerText], { type: 'text/plain' }) })]);
            varShowNotification('Tableau copié (compatible Word)');
        } catch (e) { navigator.clipboard.writeText(tableEl.innerText); varShowNotification('Tableau copié (texte brut)'); }
    });

    var downloadPNG = document.getElementById('varDownloadPNG');
    if (downloadPNG) downloadPNG.addEventListener('click', async function () {
        var el = document.getElementById('varSummaryTable');
        try { var canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' }); var link = document.createElement('a'); link.download = 'tableau_variantes.png'; link.href = canvas.toDataURL('image/png'); link.click(); varShowNotification('PNG téléchargé'); }
        catch (e) { varShowNotification('Erreur capture'); }
    });

    var downloadHTML = document.getElementById('varDownloadHTML');
    if (downloadHTML) downloadHTML.addEventListener('click', function () {
        var tableEl = document.getElementById('varSummaryTable');
        var htmlContent = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Tableau Variantes CECB</title><style>body{margin:20px;font-family:Arial,sans-serif}table{border-collapse:collapse;font-size:9.5pt}th,td{padding:5px 8px;border-bottom:1px solid #E3DAD1}th{font-weight:700;border-bottom:2px solid #333;text-align:center}th:first-child{text-align:left}td:not(:first-child){text-align:center}.st-cat td{font-weight:700;background:#fafafa}.st-check{color:#10B981;font-weight:700;font-size:14px}.st-cost td{border-top:2px solid #333;font-weight:600;background:#fafafa}.st-sub{font-weight:400;font-size:8pt;color:#555;display:block}</style></head><body>' + tableEl.outerHTML + '</body></html>';
        var blob = new Blob([htmlContent], { type: 'text/html' });
        var link = document.createElement('a'); link.download = 'tableau_variantes.html'; link.href = URL.createObjectURL(blob); link.click(); URL.revokeObjectURL(link.href);
        varShowNotification('HTML téléchargé');
    });
}

/* ═══════ TOOLBAR ═══════ */

function varSetupToolbar() {
    var loadEx = document.getElementById('varLoadExample');
    if (loadEx) loadEx.addEventListener('click', varLoadExample);
    var resetBtn = document.getElementById('varResetAll');
    if (resetBtn) resetBtn.addEventListener('click', varResetAll);
}

function varLoadExample() {
    varState = getDefaultVarState();
    varState.checks.murs_nc[0] = true; varState.checks.sols_nc[0] = true; varState.checks.chauffage[0] = true; varState.checks.ecs[0] = true;
    varState.checks.toits[1] = true; varState.checks.murs_nc[1] = true; varState.checks.sols_nc[1] = true; varState.checks.ponts[1] = true; varState.checks.chauffage[1] = true; varState.checks.ecs[1] = true; varState.checks.photovoltaique[1] = true;
    varState.checks.toits[2] = true; varState.checks.facades[2] = true; varState.checks.murs_nc[2] = true; varState.checks.sols_nc[2] = true; varState.checks.ponts[2] = true; varState.checks.chauffage[2] = true; varState.checks.ecs[2] = true; varState.checks.photovoltaique[2] = true;
    varState.selectedTexts.toits = 0; varState.selectedTexts.facades = 1; varState.selectedTexts.murs_nc = 0; varState.selectedTexts.sols_nc = 0; varState.selectedTexts.ponts = 0; varState.selectedTexts.chauffage = 0; varState.selectedTexts.ecs = 0; varState.selectedTexts.photovoltaique = 0;
    varSaveState(); varFullRender(); varShowNotification('Exemple chargé');
}

function varResetAll() {
    if (!confirm('Réinitialiser toutes les données ?')) return;
    varState = getDefaultVarState();
    varSaveState(); varFullRender(); varShowNotification('Données réinitialisées');
}

function varFullRender() { varRenderMatrix(); varRenderFrameworkTexts(); varUpdatePreview(); varRenderSummaryTable(); }

/* ═══════ UTILS ═══════ */

function varEscapeHtml(str) { var div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
function varTruncate(str, len) { return str.length > len ? str.substring(0, len) + '...' : str; }
function varShowNotification(msg) {
    var el = document.getElementById('notification');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 2500);
}
