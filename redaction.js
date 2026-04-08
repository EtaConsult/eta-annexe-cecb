/* ═══════════════════════════════════════════════════════
   CECB Plus — Rédaction CECB (skill cecb-redaction)
   Formulaire → Claude (SKILL.md en system prompt) → textareas
   ═══════════════════════════════════════════════════════ */

var Redaction = (function () {

    var SKILL_URL = 'cecb-redaction-skill.md';
    var _skillContent = null;
    var _saveTimer = null;

    /* ═════ Sections attendues dans la réponse ═════ */
    var SECTIONS = [
        { id: 'toit',          label: 'Toit',                         keys: ['TOIT'] },
        { id: 'murs',          label: 'Murs',                         keys: ['MURS'] },
        { id: 'fenetres',      label: 'Fenêtres et porte',            keys: ['FENÊTRES', 'FENETRES', 'FENÊTRES ET PORTE', 'FENÊTRES ET PORTES'] },
        { id: 'sol',           label: 'Sol',                          keys: ['SOL'] },
        { id: 'ventilation',   label: 'Ventilation',                  keys: ['VENTILATION'] },
        { id: 'chauffage',     label: 'Chauffage',                    keys: ['CHAUFFAGE'] },
        { id: 'ecs',           label: 'Eau chaude sanitaire',         keys: ['EAU CHAUDE', 'EAU CHAUDE SANITAIRE', 'ECS'] },
        { id: 'appareils',     label: 'Appareils et éclairage',       keys: ['APPAREILS', 'APPAREILS ET ÉCLAIRAGE', 'APPAREILS ET ECLAIRAGE'] },
        { id: 'pv',            label: 'Photovoltaïque',               keys: ['PHOTOVOLTAÏQUE', 'PHOTOVOLTAIQUE', 'PV'] },
        { id: 'comportement',  label: 'Comportement utilisateur',     keys: ['COMPORTEMENT', 'COMPORTEMENT UTILISATEUR'] },
        { id: 'revalorisation',label: 'Revalorisation',               keys: ['REVALORISATION'] }
    ];

    /* ═════ Accès formulaire ═════ */
    function form() { return document.getElementById('redaction-form'); }

    function collectFormData() {
        var f = form();
        if (!f) return {};
        var o = {};
        var els = f.querySelectorAll('input, select, textarea');
        els.forEach(function (el) {
            if (!el.name) return;
            o[el.name] = (el.value || '').trim();
        });
        return o;
    }

    function loadFormData(data) {
        if (!data) return;
        var f = form();
        if (!f) return;
        Object.keys(data).forEach(function (k) {
            var el = f.elements[k];
            if (el && (data[k] !== undefined && data[k] !== null)) el.value = data[k];
        });
    }

    /* ═════ Pré-remplissage depuis le projet (recueil + address) ═════ */
    function prefillFromProject() {
        var pid = ProjectStore.getCurrentId();
        if (!pid) return;
        var project = ProjectStore.get(pid);
        if (!project) return;

        var rec = (project.recueil && project.recueil.formData) || {};
        var addr = project.address || {};
        var f = form();
        if (!f) return;

        // Helper : set seulement si vide
        function setIfEmpty(name, value) {
            if (!value) return;
            var el = f.elements[name];
            if (el && !el.value) el.value = value;
        }

        // Adresse
        var addrLabel = rec['meta-address'] || addr.label || '';
        setIfEmpty('adresse', addrLabel);

        // Canton (VD/GE → label long)
        var cantonCode = rec['meta-canton'] || addr.canton || '';
        var cantonMap = { VD: 'Vaud (VD)', GE: 'Genève (GE)', FR: 'Fribourg (FR)', VS: 'Valais (VS)', NE: 'Neuchâtel (NE)', JU: 'Jura (JU)', BE: 'Berne (BE)' };
        setIfEmpty('canton', cantonMap[cantonCode] || '');

        // Année de construction
        setIfEmpty('annee_constr', rec['meta-year'] || '');

        // Affectation (SIA → label du skill)
        var siaMap = {
            '1020': 'Cat. II — Habitat individuel',
            '1025': 'Cat. I — Habitat collectif'
        };
        setIfEmpty('affectation', siaMap[rec['meta-type']] || '');

        // Nb étages / appartements
        var etages = [];
        if (rec['meta-floors']) etages.push('R+' + Math.max(0, parseInt(rec['meta-floors'], 10) - 1));
        if (rec['meta-apartments']) etages.push(rec['meta-apartments'] + ' appt' + (parseInt(rec['meta-apartments'], 10) > 1 ? 's' : ''));
        if (etages.length) setIfEmpty('etages', etages.join(' / '));

        // Toit (mapping depuis sous-tab Enveloppe existant si présent)
        var toitTypeMap = { inclinee: 'Inclinée tuiles', plate: 'Plate' };
        setIfEmpty('toit_type', toitTypeMap[rec['toit-type']] || '');
        var toitMatMap = {
            laine_verre: 'Laine de verre', laine_roche: 'Laine de roche', laine_minerale: 'Laine minérale',
            eps: 'EPS', xps: 'XPS', pur_pir: 'PUR/PIR', fibre_bois: 'Fibre de bois', cellulose: 'Laine minérale'
        };
        setIfEmpty('toit_iso_mat', toitMatMap[rec['toit-isol-mat']] || '');
        setIfEmpty('toit_iso_ep', rec['toit-isol-cm'] || '');
        setIfEmpty('toit_annee', rec['toit-year'] || '');

        // Classes CECB — si déjà saisies dans classesState (persisté séparément)
        try {
            if (project.classes) {
                setIfEmpty('cl_env', project.classes.enveloppe || '');
                setIfEmpty('cl_eff', project.classes.efficacite || '');
                setIfEmpty('cl_co2', project.classes.co2 || '');
            }
        } catch (e) { /* ignore */ }
    }

    /* ═════ Construction du bloc Markdown pour le skill ═════ */
    function line(label, val) { return '- ' + label + ' : ' + (val || ''); }

    function buildPromptBlock() {
        var d = collectFormData();
        var L = [];
        L.push('## Données du bâtiment à rédiger', '');

        L.push('**Identité**');
        L.push(line('Adresse, commune, canton', [d.adresse, d.canton].filter(Boolean).join(' — ')));
        L.push(line('Année de construction', d.annee_constr));
        L.push(line("Années de rénovation(s) principale(s)", d.annee_reno));
        L.push(line('Affectation', d.affectation));
        L.push(line("Nombre d'étages, d'appartements", d.etages));
        L.push('');

        L.push('**Toiture**');
        L.push(line('Type', d.toit_type));
        L.push(line('Combles', d.combles));
        var iso = [d.toit_iso_mat, d.toit_iso_ep ? d.toit_iso_ep + ' cm' : '', d.toit_iso_pos].filter(Boolean).join(', ');
        L.push(line('Isolation (matériau, épaisseur, position)', iso));
        L.push(line('État et année des derniers travaux', [d.toit_etat, d.toit_annee].filter(Boolean).join(' / ')));
        L.push(line('Particularités', d.toit_notes));
        L.push('');

        L.push('**Murs**');
        L.push(line('Composition', d.murs_comp));
        L.push(line('Isolation extérieure (type, épaisseur, année)', d.murs_iso_ext));
        L.push(line('Isolation intérieure (type, épaisseur, année)', d.murs_iso_int));
        L.push(line('Murs sous-sol contre terrain', d.murs_ss_terrain));
        L.push(line('Murs sous-sol contre locaux non chauffés', d.murs_ss_lnc));
        L.push('');

        L.push("**Fenêtres et porte d'entrée**");
        L.push(line('Cadre', d.fen_cadre));
        L.push(line('Vitrage', d.fen_vit));
        L.push(line('Année de pose ou remplacement', d.fen_annee));
        L.push(line("Porte d'entrée (matériau, vitrage, état, année)", d.porte));
        L.push('');

        L.push('**Sol**');
        L.push(line('Type plancher rez', d.sol_type));
        L.push(line('Isolation (épaisseur, position, année)', d.sol_iso));
        L.push(line('Distribution chauffage au rez', d.sol_distrib));
        L.push('');

        L.push('**Ventilation**');
        L.push(line('Système', d.vent_sys));
        L.push(line('Année de pose si VMC', d.vent_annee));
        L.push(line('Particularités', d.vent_notes));
        L.push('');

        L.push('**Chauffage**');
        L.push(line('Producteur', d.ch_type));
        L.push(line('Marque, modèle, puissance', [d.ch_marque, d.ch_puiss ? d.ch_puiss + ' kW' : ''].filter(Boolean).join(' — ')));
        L.push(line("Année d'installation", d.ch_annee));
        L.push(line('État de fonctionnement', d.ch_etat));
        L.push(line('Distribution', d.ch_distrib));
        L.push(line("Cheminée ou poêle d'appoint", d.ch_appoint));
        L.push(line('Données de consommation transmises', d.ch_conso));
        if (d.ch_type && /CAD|distance/i.test(d.ch_type)) L.push(line('CAD — réseau, opérateur, mix', d.ch_cad));
        L.push('');

        L.push('**Eau chaude sanitaire**');
        L.push(line('Production', [d.ecs_type, d.ecs_details].filter(Boolean).join(' — ')));
        L.push(line('Année', d.ecs_annee));
        L.push('');

        L.push('**Appareils, éclairage**');
        L.push(line('Particularités', d.app_notes));
        L.push('');

        L.push('**Photovoltaïque**');
        L.push(line('Présence', d.pv_presence));
        if (d.pv_presence === 'Oui') {
            L.push(line('Puissance, panneaux, année', [d.pv_kwc ? d.pv_kwc + ' kWc' : '', d.pv_panneaux, d.pv_annee].filter(Boolean).join(' — ')));
            L.push(line('Batterie', [d.pv_batterie, d.pv_bat_detail].filter(Boolean).join(' — ')));
            L.push(line('Charpente', d.pv_charpente));
        }
        L.push('');

        L.push('**Contexte général**');
        L.push(line('Classe CECB® enveloppe attendue', d.cl_env));
        L.push(line('Classe CECB® efficacité globale attendue', d.cl_eff));
        L.push(line('Classe CO₂ direct attendue', d.cl_co2));
        L.push(line('Bâtiment rénové globalement et exemplairement', [d.reno_exemplaire, d.reno_annee].filter(Boolean).join(' — ')));
        L.push(line('Notes libres ou particularités', d.notes));

        return L.join('\n');
    }

    /* ═════ Chargement du skill (SKILL.md) ═════ */
    async function loadSkill() {
        if (_skillContent) return _skillContent;
        var resp = await fetch(SKILL_URL, { cache: 'no-cache' });
        if (!resp.ok) throw new Error('Impossible de charger le skill (' + resp.status + ')');
        _skillContent = await resp.text();
        return _skillContent;
    }

    /* ═════ Parsing de la réponse Claude en sections ═════ */
    function normalizeKey(s) {
        return (s || '').toUpperCase()
            .replace(/[^A-ZÀ-ÿ ]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function parseSections(text) {
        var result = {};
        if (!text) return result;
        // Split on lines starting with ## (level-2 headers)
        var parts = text.split(/\n(?=##\s)/);
        parts.forEach(function (block) {
            var m = block.match(/^##\s+(.+?)\s*\n([\s\S]*)$/);
            if (!m) return;
            var header = normalizeKey(m[1]);
            var body = m[2].trim();
            // Match header to a section id
            for (var i = 0; i < SECTIONS.length; i++) {
                var s = SECTIONS[i];
                for (var j = 0; j < s.keys.length; j++) {
                    if (header.indexOf(normalizeKey(s.keys[j])) === 0) {
                        result[s.id] = body;
                        return;
                    }
                }
            }
        });
        return result;
    }

    /* ═════ Rendu des textareas ═════ */
    function renderSections(map) {
        SECTIONS.forEach(function (s) {
            var ta = document.getElementById('red-ta-' + s.id);
            if (!ta) return;
            if (map[s.id] !== undefined) ta.value = map[s.id];
        });
        var box = document.getElementById('redaction-output');
        if (box) box.style.display = 'block';
        autoSave();
    }

    /* ═════ Generate ═════ */
    async function generateAll() {
        var btn = document.getElementById('btn-redaction-generate');
        var status = document.getElementById('redaction-status');

        try {
            if (btn) { btn.disabled = true; btn.textContent = 'Génération…'; }
            if (status) status.textContent = 'Chargement du skill…';

            var skill = await loadSkill();
            var userBlock = buildPromptBlock();

            if (status) status.textContent = 'Appel de Claude (cela peut prendre 30–60 s)…';

            var systemPrompt = skill +
                '\n\n---\n\n**INSTRUCTION IMPORTANTE D\'EXÉCUTION :** ' +
                "L'utilisateur va te fournir le formulaire complété. Ne lui repose pas de questions, ne redemande pas d'informations. " +
                'Passe directement à l\'Étape 3 (Rédaction des sections) en suivant STRICTEMENT les conventions de style et les gabarits fournis ci-dessus. ' +
                'Produis UNIQUEMENT le bloc Markdown final au format exact suivant, sans préambule ni commentaire :\n\n' +
                '```\n## TOIT\n**État initial :** [texte]\n\n**Améliorations possibles :** [texte]\n\n## MURS\n...\n```\n\n' +
                'Inclure TOUTES les sections : TOIT, MURS, FENÊTRES, SOL, VENTILATION, CHAUFFAGE, EAU CHAUDE, APPAREILS, PHOTOVOLTAÏQUE, COMPORTEMENT, REVALORISATION. ' +
                'Pour COMPORTEMENT, utiliser le texte standard du §3.10. Pour REVALORISATION, utiliser le §3.11.';

            var response = await CecbApi.callClaude({
                system: systemPrompt,
                userMessage: userBlock,
                maxTokens: 6000,
                timeoutMs: 120000
            });

            var sections = parseSections(response);
            if (Object.keys(sections).length === 0) {
                // Fallback : afficher la réponse brute dans la première textarea
                renderSections({ toit: response });
                if (status) status.textContent = 'Réponse reçue (parsing partiel — voir Toit)';
            } else {
                renderSections(sections);
                if (status) status.textContent = 'Généré — ' + Object.keys(sections).length + ' sections';
            }
        } catch (e) {
            console.error('[redaction] generate error:', e);
            if (status) status.textContent = 'Erreur : ' + e.message;
            alert('Erreur lors de la génération : ' + e.message);
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Générer les textes CECB'; }
        }
    }

    /* ═════ Copier ═════ */
    function copySection(sectionId) {
        var ta = document.getElementById('red-ta-' + sectionId);
        if (!ta) return;
        ta.focus();
        ta.select();
        try {
            navigator.clipboard.writeText(ta.value);
        } catch (e) {
            document.execCommand('copy');
        }
        var btn = document.getElementById('red-copy-' + sectionId);
        if (btn) {
            var prev = btn.textContent;
            btn.textContent = '✓ Copié';
            setTimeout(function () { btn.textContent = prev; }, 1500);
        }
    }

    function copyAll() {
        var parts = [];
        SECTIONS.forEach(function (s) {
            var ta = document.getElementById('red-ta-' + s.id);
            if (ta && ta.value.trim()) {
                parts.push('## ' + s.label.toUpperCase() + '\n\n' + ta.value.trim());
            }
        });
        var text = parts.join('\n\n---\n\n');
        try { navigator.clipboard.writeText(text); } catch (e) { /* ignore */ }
        var btn = document.getElementById('btn-redaction-copy-all');
        if (btn) {
            var prev = btn.textContent;
            btn.textContent = '✓ Tout copié';
            setTimeout(function () { btn.textContent = prev; }, 1500);
        }
    }

    /* ═════ Auto-save ═════ */
    function autoSave() {
        clearTimeout(_saveTimer);
        _saveTimer = setTimeout(function () {
            var pid = ProjectStore.getCurrentId();
            if (!pid) return;
            var generatedTexts = {};
            SECTIONS.forEach(function (s) {
                var ta = document.getElementById('red-ta-' + s.id);
                if (ta && ta.value) generatedTexts[s.id] = ta.value;
            });
            ProjectStore.update(pid, 'redaction', {
                formData: collectFormData(),
                generatedTexts: generatedTexts
            });
            if (typeof showSaveIndicator === 'function') showSaveIndicator();
        }, 2000);
    }

    /* ═════ Init ═════ */
    function init() {
        var f = form();
        if (!f) return;

        // Charger les données sauvegardées du projet
        var pid = ProjectStore.getCurrentId();
        if (pid) {
            var project = ProjectStore.get(pid);
            if (project && project.redaction) {
                loadFormData(project.redaction.formData || {});
                var gen = project.redaction.generatedTexts || {};
                SECTIONS.forEach(function (s) {
                    var ta = document.getElementById('red-ta-' + s.id);
                    if (ta && gen[s.id]) ta.value = gen[s.id];
                });
                if (Object.keys(gen).length) {
                    var box = document.getElementById('redaction-output');
                    if (box) box.style.display = 'block';
                }
            }
        }

        // Pré-remplir depuis recueil/address (sans écraser)
        prefillFromProject();

        // Listeners auto-save
        f.querySelectorAll('input, select, textarea').forEach(function (el) {
            el.addEventListener('input', autoSave);
            el.addEventListener('change', autoSave);
        });
        SECTIONS.forEach(function (s) {
            var ta = document.getElementById('red-ta-' + s.id);
            if (ta) ta.addEventListener('input', autoSave);
        });
    }

    return {
        init: init,
        generateAll: generateAll,
        copySection: copySection,
        copyAll: copyAll
    };
})();

function initRedaction() { Redaction.init(); }
