/* ════════════════════════════════════════════════════════════
 * word-plus-project.js
 * Lien entre le projet CECB existant et le formulaire CECB Plus Word.
 * Charge les données déjà saisies dans l'outil CECB (recueil, variantes,
 * classes, textes générés) pour pré-remplir le formulaire de génération
 * du rapport Word.
 * ════════════════════════════════════════════════════════════ */

(function (global) {
    'use strict';

    /* ──── Libellés dérivés des codes SIA et sources de chauffage ──── */

    var WP_SIA_LABELS = {
        '1020': 'Habitat individuel (Cat. I)',
        '1025': 'Habitat collectif (Cat. II)',
        '1030': 'Administration (Cat. III)',
        '1040': 'Écoles (Cat. IV)',
        '1050': 'Commerce (Cat. V)',
        '1060': 'Restauration (Cat. VI)',
        '1070': 'Lieux de rassemblement (Cat. VII)',
        '1080': 'Hôpitaux (Cat. VIII)',
        '1090': 'Industrie (Cat. IX)',
        '1100': 'Dépôts (Cat. X)',
        '1110': 'Installations sportives (Cat. XI)',
        '1120': 'Piscines couvertes (Cat. XII)'
    };

    var WP_CHAUF_LABELS = {
        'mazout': 'chaudière à mazout à condensation',
        'gaz': 'chaudière à gaz à condensation',
        'elec_central': 'chaudière électrique centrale',
        'elec_decentral': 'chauffage électrique décentralisé',
        'pac_air': 'pompe à chaleur air/eau',
        'pac_sol': 'pompe à chaleur sol/eau (sonde géothermique)',
        'pac_eau': 'pompe à chaleur eau/eau',
        'cad': 'raccordement au chauffage à distance',
        'bois_buches': 'chaudière à bûches',
        'bois_pellets': 'chaudière à pellets'
    };

    var WP_ECS_LABELS = {
        'chaudiere': 'production ECS par la chaudière',
        'ce_elec_central': 'chauffe-eau électrique central',
        'ce_elec_decentral': 'chauffe-eau électriques décentralisés',
        'boiler_elec': 'boiler électrique',
        'thermodynamique': 'chauffe-eau thermodynamique',
        'pac': 'production ECS par pompe à chaleur',
        'cad': 'raccordement au chauffage à distance',
        'solaire_pac': 'solaire thermique + appoint PAC'
    };

    var WP_VENT_LABELS = {
        'non': 'Aération naturelle, Hotte aspirante, Extraction air vicié Salle de bains/WC',
        'simple_flux': 'VMC simple flux hygroréglable',
        'double_flux': 'VMC double flux avec récupération de chaleur'
    };

    /* ──── Mapping des clés varState.checks vers les clés du tableau Word ──── */

    var WP_VAR_MAPPING = [
        { wpKey: 'isolToits',       srcKey: 'toits',           label: 'Isolation des toits / plafonds contre extérieur (toiture terrasse)', group: 'enveloppe' },
        { wpKey: 'isolCombles',     srcKey: 'combles',         label: 'Isolation des plafonds contre combles non chauffés',                  group: 'enveloppe' },
        { wpKey: 'isolFacades',     srcKey: 'facades',         label: 'Isolation des façades / murs contre extérieur',                       group: 'enveloppe' },
        { wpKey: 'isolMursNc',      srcKey: 'murs_nc',         label: 'Isolation des murs contre locaux non chauffés',                       group: 'enveloppe' },
        { wpKey: 'isolMursTerre',   srcKey: 'murs_terre',      label: 'Isolation des murs contre terre',                                     group: 'enveloppe' },
        { wpKey: 'isolFenetres',    srcKey: 'fenetres',        label: 'Remplacement des fenêtres',                                           group: 'enveloppe' },
        { wpKey: 'isolSolsExt',     srcKey: 'sols_ext',        label: 'Isolation des sols contre extérieur',                                 group: 'enveloppe' },
        { wpKey: 'isolSolsNc',      srcKey: 'sols_nc',         label: 'Isolation des sols contre locaux non chauffés',                       group: 'enveloppe' },
        { wpKey: 'isolSolsTerrain', srcKey: 'sols_terrain',    label: 'Isolation des sols contre terrain',                                   group: 'enveloppe' },
        { wpKey: 'pontsTh',         srcKey: 'ponts',           label: 'Ponts thermiques',                                                    group: 'enveloppe' },
        { wpKey: 'chauffage',       srcKey: 'chauffage',       label: 'Remplacement du producteur de chaleur',                               group: 'technique' },
        { wpKey: 'ecs',             srcKey: 'ecs',             label: 'Remplacement du producteur d\u2019ECS',                               group: 'technique' },
        { wpKey: 'distribChal',     srcKey: 'distrib_chaleur', label: 'Distributeur de chaleur',                                             group: 'technique' },
        { wpKey: 'distribEcs',      srcKey: 'distrib_ecs',     label: 'Distribution ECS',                                                    group: 'technique' },
        { wpKey: 'ventilation',     srcKey: 'ventilation',     label: 'Système de ventilation',                                              group: 'technique' },
        { wpKey: 'appareilsElec',   srcKey: 'appareils_elec',  label: 'Remplacement des appareils électroniques',                            group: 'electricite' },
        { wpKey: 'photovolt',       srcKey: 'photovoltaique',  label: 'Installation photovoltaïque',                                         group: 'electricite' }
    ];

    /* ──── Helpers de libellé ──── */

    function wpSiaLabel(code) {
        return WP_SIA_LABELS[String(code || '').trim()] || '';
    }

    function wpChaufLabel(code) {
        return WP_CHAUF_LABELS[String(code || '').trim()] || '';
    }

    function wpEcsLabel(code) {
        return WP_ECS_LABELS[String(code || '').trim()] || '';
    }

    function wpVentLabel(code) {
        return WP_VENT_LABELS[String(code || '').trim()] || '';
    }

    /* ──── Récupération des classes CECB depuis localStorage (onglet Classes CECB) ──── */

    function wpLoadClasses() {
        try {
            var raw = localStorage.getItem('cecb-classes-data');
            if (!raw) return { enveloppe: '', efficacite: '', co2: '' };
            var data = JSON.parse(raw);
            var state = (data && data.state) || {};
            return {
                enveloppe: state.enveloppe || '',
                efficacite: state.efficacite || '',
                co2: state.co2 || ''
            };
        } catch (e) {
            return { enveloppe: '', efficacite: '', co2: '' };
        }
    }

    /* ──── Mapping des checks variantes vers le tableau Word ──── */

    function wpMapVariantesToWord(checks) {
        var out = {};
        var src = checks || {};
        WP_VAR_MAPPING.forEach(function (row) {
            var val = src[row.srcKey];
            out[row.wpKey] = (val && val.length === 3) ? val.slice() : [false, false, false];
        });
        return out;
    }

    /* ──── Chargement complet depuis un projet existant ──── */

    function wpLoadFromProject(pid) {
        if (!pid && typeof ProjectStore !== 'undefined') {
            pid = ProjectStore.getCurrentId();
        }
        var project = (pid && typeof ProjectStore !== 'undefined') ? ProjectStore.get(pid) : null;
        if (!project) project = {};

        var fd = (project.recueil && project.recueil.formData) || {};
        var gt = (project.recueil && project.recueil.generatedTexts) || {};
        var varState = project.variantes || {};
        var classes = wpLoadClasses();
        var saved = project.wordPlus || {};

        var data = {
            /* ── Identité & adresse bâtiment ── */
            adresse:       fd['meta-address']        || (project.address && project.address.label) || '',
            commune:       fd['meta-commune']        || '',
            canton:        fd['meta-canton']         || '',
            egid:          fd['meta-egid']           || '',
            annee:         fd['meta-year']           || '',
            siaType:       fd['meta-type']           || '',
            affectation:   wpSiaLabel(fd['meta-type']),
            sre:           fd['meta-sre']            || '',
            altitude:      fd['meta-altitude']       || '',
            nbEtages:      fd['meta-floors']         || '',
            nbAppart:      fd['meta-apartments']     || '',
            coordE:        fd['meta-coord-e']        || '',
            coordN:        fd['meta-coord-n']        || '',

            /* ── Classes CECB (localStorage séparé) ── */
            classeEnv:     saved.classeEnv           || classes.enveloppe   || '',
            classeGlob:    saved.classeGlob          || classes.efficacite  || '',
            classeCo2:     saved.classeCo2           || classes.co2         || '',

            /* ── Technique ── */
            chaufSource:     fd['chauf-source']      || '',
            chaufSourceLbl:  wpChaufLabel(fd['chauf-source']),
            chaufYear:       fd['chauf-year']        || '',
            chaufPuissance:  fd['chauf-puissance']   || '',
            chaufDistrib:    fd['chauf-distrib']     || '',
            ecsType:         fd['ecs-type']          || '',
            ecsTypeLbl:      wpEcsLabel(fd['ecs-type']),
            ecsYear:         fd['ecs-year']          || '',
            ecsVolume:       fd['ecs-volume']        || '',
            ventType:        fd['vent-vmc']          || '',
            ventTypeLbl:     wpVentLabel(fd['vent-vmc']),

            /* ── PV ── */
            pvExistant:      fd['pv-existant']       || 'non',
            pvPuissance:     fd['pv-puissance']      || '',
            pvBatterie:      fd['pv-batterie']       || 'non',

            /* ── Variantes ── */
            variantNames:   (varState.variantNames || ['Variante 1', 'Variante 2', 'Variante 3']).slice(),
            variantCosts:   (varState.variantCosts || ['', '', '']).slice(),
            variantsCheck:  wpMapVariantesToWord(varState.checks),

            /* ── Textes générés (recueil) pour pré-remplir Commentaires état initial ── */
            textToitEi:      gt['gen-toit-ei']        || '',
            textMursEi:      gt['gen-murs-ext-ei']    || '',
            textMursTerreEi: gt['gen-murs-terre-ei']  || '',
            textMursNcEi:    gt['gen-murs-nc-ei']     || '',
            textFenEi:       gt['gen-fenetres-ei']    || '',
            textSolsTerreEi: gt['gen-sols-terre-ei']  || '',
            textSolsNcEi:    gt['gen-sols-nc-ei']     || '',
            textPontsEi:     gt['gen-ponts-thermiques-ei'] || '',
            textVentEi:      gt['gen-ventilation-ei'] || '',
            textChaufEi:     gt['gen-chauffage-ei']   || '',
            textEcsEi:       gt['gen-ecs-ei']         || '',
            textAppEi:       gt['gen-appareils-ei']   || '',
            textPvEi:        gt['gen-pv-ei']          || '',

            /* ── Mandataire (à saisir manuellement — absent de l'outil pour l'instant) ── */
            civilite:       saved.civilite           || 'Monsieur',
            mandNom:        saved.mandNom            || '',
            mandAdr:        saved.mandAdr            || '',
            mandMail:       saved.mandMail           || '',
            mandTel:        saved.mandTel            || '',

            /* ── Métadonnées rapport (à saisir) ── */
            numCecb:        saved.numCecb            || '',
            dateRapport:    saved.dateRapport        || new Date().toISOString().slice(0, 10),
            dateVisite:     saved.dateVisite         || '',

            /* ── Données à compléter via PDF CECB (optionnel) ── */
            valeursU:       saved.valeursU           || { toit: '', mursExt: '', mursNc: '', mursTerre: '', fenetres: '', solExt: '', solNc: '' },
            surfaces:       saved.surfaces           || { toit: '', murs: '', fenetres: '', sol: '' },
            consoMesuree:   saved.consoMesuree       || { mazout: '', gaz: '', elec: '' },

            /* ── Textes éditables (Phase 2) ── */
            introduction:   saved.introduction       || '',
            resume:         saved.resume             || '',
            commentEnv:     saved.commentEnv         || '',
            commentEff:     saved.commentEff         || '',
            commentCo2:     saved.commentCo2         || '',
            recoVariante:   saved.recoVariante       || 'V2',
            recoTexte:      saved.recoTexte          || '',
            remarques:      saved.remarques          || '',

            /* ── Tableau Bases Documents ── */
            bases:          saved.bases              || { plan: '', facade: '', coupe: '', consoElec: '', consoChauff: '', autres: '' }
        };

        /* Expert (Gérard / Êta Consult) — valeurs fixes */
        data.expertNom = 'Gérard Merminod';
        data.expertSociete = 'Êta Consult Sàrl, Expertise et pilotage de projets immobiliers';
        data.expertRue = 'Route de l\u2019Hôpital 16b';
        data.expertLieu = '1180 Rolle';
        data.expertMail = 'info@etaconsult.ch';
        data.expertTel = '078 303 81 01';

        return data;
    }

    /* ──── Fusion PDF avec données projet (Phase 3) ──── */

    function wpMergePdfData(projectData, pdfData) {
        if (!pdfData) return projectData;
        var merged = Object.assign({}, projectData);
        // Les valeurs saisies dans le projet sont prioritaires : on ne remplace que si champ vide.
        ['numCecb', 'classeEnv', 'classeGlob', 'classeCo2', 'annee', 'sre'].forEach(function (k) {
            if (!merged[k] && pdfData[k]) merged[k] = pdfData[k];
        });
        if (pdfData.valeursU) {
            merged.valeursU = Object.assign({}, merged.valeursU || {});
            Object.keys(pdfData.valeursU).forEach(function (k) {
                if (!merged.valeursU[k] && pdfData.valeursU[k]) merged.valeursU[k] = pdfData.valeursU[k];
            });
        }
        if (pdfData.surfaces) {
            merged.surfaces = Object.assign({}, merged.surfaces || {});
            Object.keys(pdfData.surfaces).forEach(function (k) {
                if (!merged.surfaces[k] && pdfData.surfaces[k]) merged.surfaces[k] = pdfData.surfaces[k];
            });
        }
        if (pdfData.consoMesuree) {
            merged.consoMesuree = Object.assign({}, merged.consoMesuree || {});
            Object.keys(pdfData.consoMesuree).forEach(function (k) {
                if (!merged.consoMesuree[k] && pdfData.consoMesuree[k]) merged.consoMesuree[k] = pdfData.consoMesuree[k];
            });
        }
        return merged;
    }

    /* ──── Exports globaux ──── */

    global.WP_VAR_MAPPING = WP_VAR_MAPPING;
    global.wpSiaLabel = wpSiaLabel;
    global.wpChaufLabel = wpChaufLabel;
    global.wpEcsLabel = wpEcsLabel;
    global.wpVentLabel = wpVentLabel;
    global.wpLoadClasses = wpLoadClasses;
    global.wpMapVariantesToWord = wpMapVariantesToWord;
    global.wpLoadFromProject = wpLoadFromProject;
    global.wpMergePdfData = wpMergePdfData;

})(typeof window !== 'undefined' ? window : this);
