/* ════════════════════════════════════════════════════════════
 * recueil-sections.js
 * Générateurs de texte pour les 13 sections du rapport CECB
 * (toit, murs-ext, murs-terre, murs-nc, fenêtres, sols-terre, sols-nc,
 * ponts thermiques, ventilation, chauffage, ECS, appareils, PV).
 * Inclut le dispatcher generateSection(), la validation des champs
 * requis, et generateAllWithProgress().
 * Extrait de recueil.js — Phase 4 (split god-file).
 *
 * Dépendances runtime (globales déjà chargées via projet.html) :
 *   - rv, rvi, rvf, sv (recueil.js)              — accesseurs DOM
 *   - BLOCS, fillTemplate (recueil.js)            — templates de texte
 *   - recueilToast, recueilAutoSave (recueil.js)
 *   - renderSectionOutput (recueil.js)            — rendu du résultat
 *
 * API publique :
 *   - generateSection(section), generateText()
 *   - generateAllWithProgress()
 *   - validateSectionFields(section)
 *   - SECTION_REQUIRED_FIELDS (config)
 *   - generateXxxText() pour chaque section (13 fonctions)
 * ════════════════════════════════════════════════════════════ */

/* ===== FIELD VALIDATION ===== */

var SECTION_REQUIRED_FIELDS = {
    'toit': ['meta-year', 'toit-config'],
    'murs-ext': ['murs-composition'],
    'fenetres': ['fen-cadre', 'fen-vitrage'],
    'chauffage': ['chauf-source'],
    'ecs': ['ecs-type']
};

function validateSectionFields(section) {
    var required = SECTION_REQUIRED_FIELDS[section];
    if (!required) return true;
    var allOk = true;
    required.forEach(function (fieldId) {
        var el = document.getElementById(fieldId);
        if (!el) return;
        // Clear previous
        el.classList.remove('field-missing');
        var hint = el.parentElement.querySelector('.field-missing-hint');
        if (hint) hint.remove();
        // Check
        if (!el.value || el.value === '') {
            el.classList.add('field-missing');
            var h = document.createElement('span');
            h.className = 'field-missing-hint';
            h.textContent = 'Requis pour la génération';
            el.parentElement.appendChild(h);
            allOk = false;
            // Auto-clear on change
            el.addEventListener('change', function clearMissing() {
                el.classList.remove('field-missing');
                var hh = el.parentElement.querySelector('.field-missing-hint');
                if (hh) hh.remove();
                el.removeEventListener('change', clearMissing);
            });
        }
    });
    return allOk;
}

/* ===== PER-SECTION TEXT GENERATION ===== */

function generateSection(section) {
    validateSectionFields(section);
    var result;
    switch (section) {
        case 'toit': result = generateToitText(); break;
        case 'murs-ext': result = generateMursExtText(); break;
        case 'murs-terre': result = generateMursTerreText(); break;
        case 'murs-nc': result = generateMursNcText(); break;
        case 'fenetres': result = generateFenetresText(); break;
        case 'sols-terre': result = generateSolsTerreText(); break;
        case 'sols-nc': result = generateSolsNcText(); break;
        case 'ponts-thermiques': result = generatePontsThermiquesText(); break;
        case 'ventilation': result = generateVentilationText(); break;
        case 'chauffage': result = generateChauffageText(); break;
        case 'ecs': result = generateEcsText(); break;
        case 'appareils': result = generateAppareilsText(); break;
        case 'pv': result = generatePvText(); break;
        default: result = { ei: '[Section inconnue]', ap: '' };
    }
    renderSectionOutput(section, result);
    recueilToast(section + ' — texte généré');
    recueilAutoSave();
}

function generateToitText() {
    var year = rv('meta-year');
    var toitConfig = rv('toit-config');
    var toitType = rv('toit-type');
    var toitYear = rv('toit-year') || year;
    var toitIsol = rv('toit-isolation');
    var toitEtat = rv('toit-etat');
    var toitCm = rv('toit-isol-cm');
    var toitMatEl = document.getElementById('toit-isol-mat');
    var toitMat = toitMatEl && toitMatEl.selectedIndex > 0 ? toitMatEl.options[toitMatEl.selectedIndex].text : '';
    if (toitMat === 'Autre') toitMat = '';
    var toitAge = new Date().getFullYear() - (parseInt(toitYear) || new Date().getFullYear());
    var ei = '', ap = '';

    // Build isolation detail string (e.g. ", estimée à 12 cm de laine de verre")
    var isolDetail = '';
    if (toitCm && toitMat) isolDetail = ', estimée à ' + toitCm + ' cm de ' + toitMat.toLowerCase();
    else if (toitCm) isolDetail = ', estimée à ' + toitCm + ' cm';
    else if (toitMat) isolDetail = ', constituée de ' + toitMat.toLowerCase();

    if (toitConfig === 'toiture_isolee') {
        if (toitIsol === 'conforme') {
            ei = fillTemplate(toitType === 'plate' ? BLOCS.toit.ei_plate_renovee : BLOCS.toit.ei_inclinee, { year: toitYear, isolation_desc: 'satisfaisante', isolation_detail: isolDetail, cm: toitCm });
            ap = BLOCS.toit.ap_non_prioritaire;
        } else if (toitIsol === 'partielle' || toitEtat === 'vetuste') {
            ei = fillTemplate(BLOCS.toit.ei_inclinee, { year: toitYear, isolation_desc: 'insuffisante', isolation_detail: isolDetail });
            if (toitEtat === 'vetuste') ei += ' ' + fillTemplate(BLOCS.toit.ei_vieillissante, { year: toitYear, age: String(toitAge) });
            ap = BLOCS.toit.ap_renovation;
        } else {
            ei = fillTemplate(BLOCS.toit.ei_inclinee, { year: toitYear, isolation_desc: 'absente ou très limitée', isolation_detail: '' });
            ap = BLOCS.toit.ap_renovation;
        }
    } else if (toitConfig === 'plancher_combles') {
        var comp = rv('toit-combles-comp') === 'ossature_bois' ? 'une ossature bois' : 'une dalle béton';
        ei = fillTemplate(BLOCS.toit.ei_plancher_combles, { composition: comp, isolation_desc: toitIsol === 'conforme' ? 'convenablement isolé' : 'faiblement isolé', materiau: (toitMat || 'laine minérale').toLowerCase() });
        ap = toitIsol === 'conforme' ? BLOCS.toit.ap_non_prioritaire : BLOCS.toit.ap_plancher_combles;
    } else if (toitConfig === 'plafond_non_chauffe') {
        ei = fillTemplate(BLOCS.toit.ei_plancher_combles, { composition: 'un plafond', isolation_desc: toitIsol === 'conforme' ? 'convenable' : 'insuffisante', materiau: (toitMat || 'laine minérale').toLowerCase() });
        ap = toitIsol === 'conforme' ? BLOCS.toit.ap_non_prioritaire : BLOCS.toit.ap_plancher_combles;
    } else {
        ei = '[DONNÉES MANQUANTES — à compléter]';
        ap = '[DONNÉES MANQUANTES — à compléter]';
    }
    if (rv('toit-pv') === 'oui' && toitEtat !== 'intact') ap += ' ' + BLOCS.toit.ap_pv;
    return { ei: ei, ap: ap };
}

function generateMursExtText() {
    var year = rv('murs-year') || rv('meta-year');
    var mursComp = rv('murs-composition');
    var mursIsol = rv('murs-isolation');
    var mursMit = rv('murs-mitoyen');
    var compDescs = { maconnerie: 'Les façades sont constituées de maçonnerie homogène', double_paroi: 'Les façades présentent une double paroi', ossature_bois: 'Les façades présentent une ossature bois', moellons: 'Les façades sont constituées de moellons' };
    var ei = '', ap = '';

    if (mursComp === 'ossature_bois') {
        ei = fillTemplate(BLOCS.murs.ei_ossature, { type_ossature: 'ossature bois', revetement: rv('murs-revetement') === 'eternit' ? 'Eternit' : rv('murs-revetement') === 'bardage' ? 'bardage bois' : 'crépi' });
    } else if (mursComp === 'double_paroi') {
        ei = fillTemplate(BLOCS.murs.ei_double_paroi, { cm: rv('murs-isol-cm') || '[X]' });
    } else if (mursComp === 'moellons') {
        ei = BLOCS.murs.ei_moellons;
    } else if (mursIsol === 'ite') {
        ei = fillTemplate(BLOCS.murs.ei_ite, { cm: rv('murs-isol-cm') || '[X]' });
    } else if (mursComp) {
        ei = fillTemplate(BLOCS.murs.ei_sans_isolation, { year: year, composition_desc: compDescs[mursComp] || '' });
    } else {
        ei = '[DONNÉES MANQUANTES — à compléter]';
    }
    if (mursMit !== 'non' && mursMit) ei += ' ' + fillTemplate(BLOCS.murs.ei_mitoyen, { cotes: mursMit });

    if (mursIsol === 'aucune' || mursComp === 'moellons' || mursComp === 'ossature_bois') ap = BLOCS.murs.ap_ite + ' ' + BLOCS.murs.ap_sondage;
    else if (mursIsol === 'ite') ap = BLOCS.toit.ap_non_prioritaire.replace('toiture', 'façade');
    else ap = BLOCS.murs.ap_ite;

    return { ei: ei, ap: ap };
}

function generateMursTerreText() {
    var comp = rv('murs-terre-composition');
    var isol = rv('murs-terre-isolation');
    var cm = rv('murs-terre-isol-cm');
    var compLabels = { beton: 'béton armé', maconnerie: 'maçonnerie', moellons: 'moellons' };
    var ei = '', ap = '';

    if (!comp) {
        return { ei: '[DONNÉES MANQUANTES — à compléter]', ap: '[DONNÉES MANQUANTES — à compléter]' };
    }
    var compDesc = compLabels[comp] || comp;
    if (isol === 'interieur') {
        ei = fillTemplate(BLOCS.murs_terre.ei_isole_interieur, { composition_desc: compDesc, cm: cm || '[X]' });
        ap = BLOCS.murs_terre.ap_non_prioritaire;
    } else if (isol === 'perimetrique') {
        ei = fillTemplate(BLOCS.murs_terre.ei_isole_perimetrique, { composition_desc: compDesc, cm: cm || '[X]' });
        ap = BLOCS.murs_terre.ap_non_prioritaire;
    } else {
        ei = fillTemplate(BLOCS.murs_terre.ei_sans_isolation, { composition_desc: compDesc });
        ap = BLOCS.murs_terre.ap_isolation;
    }
    return { ei: ei, ap: ap };
}

function generateMursNcText() {
    var comp = rv('murs-nc-composition');
    var isol = rv('murs-nc-isolation');
    var cm = rv('murs-nc-isol-cm');
    var compLabels = { maconnerie: 'maçonnerie', beton: 'béton', ossature_bois: 'ossature bois' };
    var ei = '', ap = '';

    if (!comp) {
        return { ei: '[DONNÉES MANQUANTES — à compléter]', ap: '[DONNÉES MANQUANTES — à compléter]' };
    }
    var compDesc = compLabels[comp] || comp;
    if (isol === 'oui' || isol === 'interieur') {
        ei = fillTemplate(BLOCS.murs_nc.ei_isole, { composition_desc: compDesc, cm: cm || '[X]' });
        ap = BLOCS.murs_nc.ap_non_prioritaire;
    } else {
        ei = fillTemplate(BLOCS.murs_nc.ei_sans_isolation, { composition_desc: compDesc });
        ap = BLOCS.murs_nc.ap_isolation;
    }
    return { ei: ei, ap: ap };
}

function generateFenetresText() {
    var year = rv('meta-year');
    var uw = rvf('fen-uw');
    var fenYear = rv('fen-year') || year;
    var fenVitrage = rv('fen-vitrage');
    var fenRenov = rv('fen-renov');
    var vitrageLabels = { simple: 'simple vitrage', double_ancien: 'double vitrage ancien', double_isolant: 'double vitrage isolant', double_selectif: 'double vitrage sélectif', triple: 'triple vitrage' };
    var cadreLabels = { bois: 'bois', pvc: 'PVC', alu: 'aluminium', mixte: 'mixte bois-aluminium' };
    var ei = '', ap = '';

    if (uw > 0) {
        if (uw <= 1.0) {
            ei = fillTemplate(fenRenov === 'oui' ? BLOCS.fenetres.ei_cadres_renov : BLOCS.fenetres.ei_recentes, { year: fenYear, vitrage: vitrageLabels[fenVitrage] || fenVitrage });
            ap = BLOCS.fenetres.ap_non_prioritaire;
        } else {
            ei = fillTemplate(BLOCS.fenetres.ei_insuffisante, { cadre: cadreLabels[rv('fen-cadre')] || rv('fen-cadre'), vitrage: vitrageLabels[fenVitrage] || fenVitrage, niveau: uw <= 1.3 ? 'légèrement' : '' });
            ap = fenRenov === 'oui' ? BLOCS.fenetres.ap_remplacement_cadre_renov : BLOCS.fenetres.ap_remplacement;
        }
    } else { ei = '[DONNÉES MANQUANTES — à compléter]'; ap = '[DONNÉES MANQUANTES — à compléter]'; }
    if (rv('fen-porte') === 'deperditions') ei += ' ' + BLOCS.fenetres.ei_porte;
    return { ei: ei, ap: ap };
}

function generateSolsTerreText() {
    var config = rv('sols-terre-config');
    var isol = rv('sols-terre-isolation');
    var cm = rv('sols-terre-isol-cm');
    var ei = '', ap = '';

    if (!config) {
        return { ei: '[DONNÉES MANQUANTES — à compléter]', ap: '[DONNÉES MANQUANTES — à compléter]' };
    }
    if (isol === 'oui' || (isol === 'partielle' && cm)) {
        ei = fillTemplate(BLOCS.sols_terre.ei_isole, { cm: cm || '[X]' });
        ap = BLOCS.sols_terre.ap_non_prioritaire;
    } else if (config === 'radier') {
        ei = BLOCS.sols_terre.ei_radier;
        ap = BLOCS.sols_terre.ap_radier;
    } else {
        ei = BLOCS.sols_terre.ei_terre_plein;
        ap = BLOCS.sols_terre.ap_terre_plein;
    }
    return { ei: ei, ap: ap };
}

function generateSolsNcText() {
    var config = rv('sols-nc-config');
    var isol = rv('sols-nc-isolation');
    var cm = rv('sols-nc-isol-cm');
    var ei = '', ap = '';

    if (!config) {
        return { ei: '[DONNÉES MANQUANTES — à compléter]', ap: '[DONNÉES MANQUANTES — à compléter]' };
    }
    if (isol === 'oui' || (isol === 'partielle' && cm)) {
        ei = fillTemplate(BLOCS.sols_nc.ei_isole, { cm: cm || '[X]' });
        ap = BLOCS.sols_nc.ap_non_prioritaire;
    } else if (config === 'hourdis') {
        ei = BLOCS.sols_nc.ei_hourdis;
        ap = BLOCS.sols_nc.ap_dalle;
    } else {
        ei = BLOCS.sols_nc.ei_dalle;
        ap = BLOCS.sols_nc.ap_dalle;
    }
    return { ei: ei, ap: ap };
}

function generatePontsThermiquesText() {
    var ptFen = rv('pt-fenetres');
    var ei = '', ap = '';
    if (ptFen === 'oui') {
        ei = BLOCS.ponts_thermiques.ei_avec_fenetres;
        ap = BLOCS.ponts_thermiques.ap_avec_fenetres;
    } else {
        ei = BLOCS.ponts_thermiques.ei_standard;
        ap = BLOCS.ponts_thermiques.ap_standard;
    }
    return { ei: ei, ap: ap };
}

function generateVentilationText() {
    var vmc = rv('vent-vmc');
    var ei = '', ap = '';
    if (vmc === 'non' || !vmc) {
        ei = BLOCS.ventilation.ei_standard;
        ap = BLOCS.ventilation.ap_standard;
    } else {
        ei = "Le bâtiment est équipé d'une ventilation mécanique contrôlée (" + (vmc === 'double_flux' ? 'double' : 'simple') + " flux).";
        ap = "Le système de ventilation existant est conforme. Son entretien régulier est recommandé.";
    }
    return { ei: ei, ap: ap };
}

function generateChauffageText() {
    var canton = rv('meta-canton');
    var commune = rv('meta-commune');
    var altitude = rvi('meta-altitude');
    var conditionPB = altitude > 1000 ?
        "Pour les bâtiments construits avant l'an 2000, une classe CECB® de l'enveloppe comprise entre A et C (mise à jour 2023) doit être justifiée." :
        "Pour les bâtiments construits avant l'an 2000, une classe CECB® de l'enveloppe comprise entre A et E (mise à jour 2023) doit être justifiée.";
    var chaufSrc = rv('chauf-source');
    var chaufYear = rv('chauf-year');
    var chaufPuiss = rv('chauf-puissance');
    var distribLabels = { radiateurs: 'des radiateurs', plancher: 'un chauffage au sol hydraulique avec régulation individuelle par pièce', convecteurs: 'des convecteurs', radiateurs_elec: 'des radiateurs électriques' };
    var pacTypes = { pac_air: 'air-eau', pac_sol: 'sol-eau', pac_eau: 'eau-eau' };
    var ei = '', ap = '';

    if (chaufSrc === 'mazout' || chaufSrc === 'gaz') {
        ei = fillTemplate(BLOCS.chauffage.ei_fossile, { source: chaufSrc === 'mazout' ? 'mazout' : 'gaz', puissance: chaufPuiss, year: chaufYear, distribution: distribLabels[rv('chauf-distrib')] || 'radiateurs' });
        ap = fillTemplate(BLOCS.chauffage.ap_fossile, { condition_pb: conditionPB });
    } else if (chaufSrc === 'elec_central') {
        ei = fillTemplate(BLOCS.chauffage.ei_elec, { distribution: distribLabels[rv('chauf-distrib')] || 'des convecteurs électriques' });
        ap = canton === 'VD' ? fillTemplate(BLOCS.chauffage.ap_elec_central_vd, { condition_pb: conditionPB }) : BLOCS.chauffage.ap_elec_ge;
    } else if (chaufSrc === 'elec_decentral') {
        ei = fillTemplate(BLOCS.chauffage.ei_elec, { distribution: distribLabels[rv('chauf-distrib')] || 'des convecteurs électriques' });
        ap = canton === 'VD' ? BLOCS.chauffage.ap_elec_decentral_vd : BLOCS.chauffage.ap_elec_ge;
    } else if (chaufSrc && chaufSrc.startsWith('pac_')) {
        ei = fillTemplate(BLOCS.chauffage.ei_pac, { type_pac: pacTypes[chaufSrc], puissance: chaufPuiss, year: chaufYear, distribution: distribLabels[rv('chauf-distrib')] || 'des radiateurs' });
        ap = BLOCS.chauffage.ap_pac;
    } else if (chaufSrc === 'cad') {
        ei = fillTemplate(BLOCS.chauffage.ei_cad, { commune: commune });
        ap = BLOCS.chauffage.ap_cad;
    } else if (chaufSrc === 'bois_buches' || chaufSrc === 'bois_pellets') {
        ei = "Le bâtiment est équipé d'un chauffage au bois (" + (chaufSrc === 'bois_buches' ? 'bûches' : 'pellets') + ") d'une puissance de " + (chaufPuiss || '[X]') + " kW.";
        ap = "Le système de chauffage au bois est conforme aux recommandations en matière d'énergies renouvelables. Son entretien régulier est recommandé.";
    } else { ei = '[DONNÉES MANQUANTES — à compléter]'; ap = '[DONNÉES MANQUANTES — à compléter]'; }

    if (rv('chauf-conso') === 'oui') ei += ' ' + fillTemplate(BLOCS.chauffage.ei_conso_oui, { years: rv('chauf-conso-years') || '3' });
    else if (rv('chauf-conso') === 'non') ei += ' ' + BLOCS.chauffage.ei_conso_non;
    if (rv('chauf-appoint') === 'insert') ei += ' ' + BLOCS.chauffage.ei_appoint_insert;
    else if (rv('chauf-appoint') === 'foyer_ouvert') ei += ' ' + BLOCS.chauffage.ei_appoint_foyer;
    return { ei: ei, ap: ap };
}

function generateEcsText() {
    var canton = rv('meta-canton');
    var ecsType = rv('ecs-type');
    var ei = '', ap = '';
    var ecsYear = rv('ecs-year');
    if (ecsType === 'chaudiere') { ei = fillTemplate(BLOCS.ecs.ei_chaudiere, { year: ecsYear || '[année]' }); ap = BLOCS.ecs.ap_chaudiere; }
    else if (ecsType === 'ce_elec_central') { ei = BLOCS.ecs.ei_ce_elec_central; ap = canton === 'VD' ? BLOCS.ecs.ap_dacce_vd : BLOCS.ecs.ap_chaudiere; }
    else if (ecsType === 'ce_elec_decentral') { ei = BLOCS.ecs.ei_ce_elec_decentral; ap = canton === 'VD' ? BLOCS.ecs.ap_dacce_vd : BLOCS.ecs.ap_chaudiere; }
    else if (ecsType === 'boiler_elec') { ei = fillTemplate(BLOCS.ecs.ei_boiler_elec, { year: ecsYear || '[année]' }); ap = canton === 'VD' ? BLOCS.ecs.ap_dacce_vd : BLOCS.ecs.ap_boiler_renouvelable; }
    else if (ecsType === 'thermodynamique') { ei = fillTemplate(BLOCS.ecs.ei_thermo, { volume: rv('ecs-volume') || '[X]' }); ap = BLOCS.ecs.ap_cad_pac; }
    else if (ecsType === 'pac') { ei = BLOCS.ecs.ei_pac; ap = BLOCS.ecs.ap_cad_pac; }
    else if (ecsType === 'cad') { ei = BLOCS.ecs.ei_cad; ap = BLOCS.ecs.ap_cad_pac; }
    else if (ecsType === 'solaire_pac') { ei = fillTemplate(BLOCS.ecs.ei_solaire_pac, { surface: rv('ecs-volume') || '[X]' }); ap = BLOCS.ecs.ap_cad_pac; }
    else { ei = '[DONNÉES MANQUANTES — à compléter]'; ap = '[DONNÉES MANQUANTES — à compléter]'; }
    return { ei: ei, ap: ap };
}

function generateAppareilsText() {
    var consoMention = rv('app-conso') === 'oui' ? "Les consommations d'électricité ont été fournies par le mandant." : "Les consommations d'électricité n'ont pas été fournies par le mandant.";
    return { ei: fillTemplate(BLOCS.appareils.ei, { conso_mention: consoMention }), ap: BLOCS.appareils.ap };
}

function generatePvText() {
    var chaufSrc = rv('chauf-source');
    var pvExist = rv('pv-existant');
    var pvBatterie = rv('pv-batterie');
    var pvPuissance = rv('pv-puissance') || '[X]';
    var ei = '', ap = '';
    if (pvExist === 'oui') {
        if (pvBatterie === 'oui') {
            ei = fillTemplate(BLOCS.pv.ei_oui_batterie, { puissance: pvPuissance, year_pv: '[année]' });
        } else {
            ei = fillTemplate(BLOCS.pv.ei_oui_sans_batterie, { puissance: pvPuissance, year_pv: '[année]' });
        }
        ap = BLOCS.pv.ap_extension;
    } else {
        ei = BLOCS.pv.ei_non;
        ap = BLOCS.pv.ap_installation;
    }
    if (chaufSrc && chaufSrc.startsWith('pac_')) ap += ' ' + BLOCS.pv.ap_pac;
    return { ei: ei, ap: ap };
}

/* ===== LEGACY generateText() — generates all sections at once ===== */

function generateText() {
    var allSections = ['toit', 'murs-ext', 'murs-terre', 'murs-nc', 'fenetres', 'sols-terre', 'sols-nc', 'ventilation', 'chauffage', 'ecs', 'appareils', 'pv'];
    allSections.forEach(function (s) { generateSection(s); });
    recueilToast('Tous les textes générés');
}

/* ===== GENERATE ALL WITH PROGRESS BAR ===== */

function generateAllWithProgress() {
    var sections = ['toit', 'murs-ext', 'murs-terre', 'murs-nc', 'fenetres', 'sols-terre', 'sols-nc', 'ponts-thermiques', 'ventilation', 'chauffage', 'ecs', 'appareils', 'pv'];
    var sectionLabels = {
        'toit': 'Toit', 'murs-ext': 'Murs extérieurs', 'murs-terre': 'Murs c/ terre',
        'murs-nc': 'Murs c/ non chauffé', 'fenetres': 'Fenêtres', 'sols-terre': 'Sols c/ terre',
        'sols-nc': 'Sols c/ non chauffé', 'ponts-thermiques': 'Ponts thermiques',
        'ventilation': 'Ventilation', 'chauffage': 'Chauffage', 'ecs': 'ECS',
        'appareils': 'Appareils', 'pv': 'Photovoltaïque'
    };

    var btn = document.getElementById('btnGenerateAll');
    var progressDiv = document.getElementById('generateAllProgress');
    var bar = document.getElementById('generateAllBar');
    var label = document.getElementById('generateAllLabel');
    if (!btn) return;

    btn.disabled = true;
    btn.textContent = 'Génération en cours...';
    if (progressDiv) progressDiv.style.display = 'block';

    var i = 0;
    function nextSection() {
        if (i >= sections.length) {
            btn.disabled = false;
            btn.textContent = 'Générer toutes les sections';
            if (bar) bar.style.width = '100%';
            if (label) label.textContent = 'Terminé !';
            recueilToast('Toutes les sections générées');
            setTimeout(function () {
                if (progressDiv) progressDiv.style.display = 'none';
                if (bar) bar.style.width = '0';
            }, 2000);
            return;
        }
        var pct = Math.round(((i + 1) / sections.length) * 100);
        if (bar) bar.style.width = pct + '%';
        if (label) label.textContent = (i + 1) + '/' + sections.length + ' — ' + sectionLabels[sections[i]];
        generateSection(sections[i]);
        i++;
        setTimeout(nextSection, 100); // Small delay for visual feedback
    }
    nextSection();
}

