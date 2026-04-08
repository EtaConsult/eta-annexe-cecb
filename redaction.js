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
        { id: 'toit',          label: 'Toit contre extérieur',        keys: ['TOIT CONTRE EXTÉRIEUR', 'TOIT CONTRE EXTERIEUR', 'TOIT EXTÉRIEUR', 'TOIT EXTERIEUR', 'TOIT'] },
        { id: 'toit_lnc',      label: 'Toit contre locaux non chauffés', keys: ['TOIT CONTRE NON CHAUFFÉ', 'TOIT CONTRE NON CHAUFFE', 'TOIT CONTRE LOCAUX NON CHAUFFÉS', 'TOIT CONTRE LOCAUX NON CHAUFFES', 'TOIT LNC', 'PLANCHER DES COMBLES', 'PLAFOND SOUS COMBLES', 'TOIT C N C'] },
        { id: 'murs',          label: 'Murs',                         keys: ['MURS'] },
        { id: 'fenetres',      label: 'Fenêtres et porte',            keys: ['FENÊTRES', 'FENETRES', 'FENÊTRES ET PORTE', 'FENÊTRES ET PORTES'] },
        { id: 'sol',           label: 'Sol',                          keys: ['SOL'] },
        { id: 'ponts',         label: 'Ponts thermiques',             keys: ['PONTS THERMIQUES', 'PONT THERMIQUE', 'PONTS'] },
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

        L.push('**Toit contre extérieur**');
        L.push(line('Type', d.toit_type));
        L.push(line('Combles', d.combles));
        var iso = [d.toit_iso_mat, d.toit_iso_ep ? d.toit_iso_ep + ' cm' : '', d.toit_iso_pos].filter(Boolean).join(', ');
        L.push(line('Isolation (matériau, épaisseur, position)', iso));
        L.push(line('État et année des derniers travaux', [d.toit_etat, d.toit_annee].filter(Boolean).join(' / ')));
        L.push(line('Particularités', d.toit_notes));
        L.push('');

        // Second toit (contre locaux non chauffés) — only include if any field filled
        var hasToit2 = d.toit2_config || d.toit2_iso_mat || d.toit2_iso_ep || d.toit2_annee || d.toit2_notes || d.u_toit2;
        if (hasToit2) {
            L.push('**Toit contre locaux non chauffés** _(plancher combles froids, plafond contre dépendance, etc.)_');
            L.push(line('Configuration', d.toit2_config));
            var iso2 = [d.toit2_iso_mat, d.toit2_iso_ep ? d.toit2_iso_ep + ' cm' : '', d.toit2_iso_pos].filter(Boolean).join(', ');
            L.push(line('Isolation (matériau, épaisseur, position)', iso2));
            L.push(line('État et année des derniers travaux', [d.toit2_etat, d.toit2_annee].filter(Boolean).join(' / ')));
            L.push(line('Particularités', d.toit2_notes));
            L.push('');
        }

        L.push('**Murs**');
        L.push(line('Composition', d.murs_comp));
        L.push(line('Isolation extérieure (type, épaisseur, année)', d.murs_iso_ext));
        L.push(line('Isolation intérieure (type, épaisseur, année)', d.murs_iso_int));
        L.push(line('Murs sous-sol contre terrain', d.murs_ss_terrain));
        L.push(line('Murs sous-sol contre locaux non chauffés', d.murs_ss_lnc));
        L.push(line('Particularités', d.murs_notes));
        L.push('');

        L.push("**Fenêtres et porte d'entrée**");
        L.push(line('Cadre', d.fen_cadre));
        L.push(line('Vitrage', d.fen_vit));
        L.push(line('Année de pose ou remplacement', d.fen_annee));
        L.push(line("Porte d'entrée (matériau, vitrage, état, année)", d.porte));
        L.push(line('Particularités', d.fen_notes));
        L.push('');

        L.push('**Sol**');
        L.push(line('Type plancher rez', d.sol_type));
        L.push(line('Isolation (épaisseur, position, année)', d.sol_iso));
        L.push(line('Distribution chauffage au rez', d.sol_distrib));
        L.push(line('Particularités', d.sol_notes));
        L.push('');

        L.push('**Ponts thermiques**');
        L.push(line('Importance observée', d.pt_niveau));
        L.push(line('Traitement', d.pt_traitement));
        L.push(line('Emplacements identifiés', d.pt_emplacements));
        L.push(line('Particularités', d.pt_notes));
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
        L.push(line('Particularités', d.ch_notes));
        L.push('');

        L.push('**Eau chaude sanitaire**');
        L.push(line('Production', [d.ecs_type, d.ecs_details].filter(Boolean).join(' — ')));
        L.push(line('Année', d.ecs_annee));
        L.push(line('Particularités', d.ecs_notes));
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
        L.push(line('Particularités', d.pv_notes));
        L.push('');

        // ═ Valeurs U observées — appliquer Tab. 43 (existant) ou Tab. 44 (nouveau, ≤ 3 ans)
        var anyU = d.u_toit || d.u_toit2 || d.u_murs_ext || d.u_murs_lnc || d.uw_fen || d.u_sol_ext || d.u_sol_lnc;
        if (anyU) {
            var currentYear = new Date().getFullYear();
            var yearConstr = parseInt(d.annee_constr, 10);
            var table = (!isNaN(yearConstr) && (currentYear - yearConstr) <= 3) ? 'Tab. 44 (nouveau bâtiment)' : 'Tab. 43 (bâtiment existant)';
            L.push('**Valeurs U observées** _(qualifier selon ' + table + ')_');
            if (d.u_toit)      L.push(line('Toit contre extérieur (To)', d.u_toit + ' W/m²K'));
            if (d.u_toit2)     L.push(line('Toit contre locaux non chauffés (c.n-c.)', d.u_toit2 + ' W/m²K'));
            if (d.u_murs_ext)  L.push(line('Mur extérieur (Mu)', d.u_murs_ext + ' W/m²K'));
            if (d.u_murs_lnc)  L.push(line('Mur contre locaux non chauffés (c.n-c.)', d.u_murs_lnc + ' W/m²K'));
            if (d.uw_fen)      L.push(line('Fenêtres (Fe) — Uw', d.uw_fen + ' W/m²K'));
            if (d.u_sol_ext)   L.push(line('Sol contre extérieur / terrain', d.u_sol_ext + ' W/m²K'));
            if (d.u_sol_lnc)   L.push(line('Sol/plafond contre locaux non chauffés (c.n-c.)', d.u_sol_lnc + ' W/m²K'));
            L.push('');
        }

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

    // Split a section body into État initial / Améliorations possibles
    function splitEiAp(body) {
        if (!body) return { ei: '', ap: '' };
        var ei = '', ap = '';
        // Match "**État initial :** ...(until next **Améliorations...)"
        var eiMatch = body.match(/\*\*[ÉE]tat initial[^:]*:\*\*\s*([\s\S]*?)(?=\n\s*\*\*Am[ée]liorations|$)/i);
        if (eiMatch) ei = eiMatch[1].trim().replace(/^\s*—\s*\n?/, '');
        // Match "**Améliorations possibles :** ..."
        var apMatch = body.match(/\*\*Am[ée]liorations possibles[^:]*:\*\*\s*([\s\S]*)$/i);
        if (apMatch) ap = apMatch[1].trim().replace(/^\s*—\s*\n?/, '');
        // Also handle "*Conseils et recommandation :*" (used in §3.11)
        if (!ap) {
            var conseils = body.match(/\*+Conseils et recommandation[^:]*:\*+\s*([\s\S]*)$/i);
            if (conseils) ap = conseils[1].trim();
        }
        // Fallback : no markers → everything in ei
        if (!ei && !ap) ei = body.trim();
        return { ei: ei, ap: ap };
    }

    function parseSections(text) {
        var result = {};
        if (!text) return result;
        // Pre-compute all (sectionId, normalizedKey) pairs sorted by key length DESC
        // so more specific keys (e.g. "TOIT CONTRE EXTÉRIEUR") match before generic ones ("TOIT")
        var allKeys = [];
        SECTIONS.forEach(function (s) {
            s.keys.forEach(function (k) {
                var nk = normalizeKey(k);
                allKeys.push({ id: s.id, key: nk, len: nk.length });
            });
        });
        allKeys.sort(function (a, b) { return b.len - a.len; });

        var parts = text.split(/\n(?=##\s)/);
        parts.forEach(function (block) {
            var m = block.match(/^##\s+(.+?)\s*\n([\s\S]*)$/);
            if (!m) return;
            var header = normalizeKey(m[1]);
            var body = m[2].trim();
            for (var i = 0; i < allKeys.length; i++) {
                if (header.indexOf(allKeys[i].key) === 0) {
                    result[allKeys[i].id] = splitEiAp(body);
                    return;
                }
            }
        });
        return result;
    }

    /* ═════ Construction dynamique des 22 blocs (init) ═════ */
    function buildOutputBlocks() {
        var container = document.getElementById('redaction-sections');
        if (!container || container.childElementCount > 0) return;
        var html = '';
        SECTIONS.forEach(function (s) {
            html += '<div class="red-section"><h3>' + s.label + '</h3>' +
                '<div class="red-subblock">' +
                '<div class="red-sublabel">État initial <button class="red-copy" onclick="Redaction.copySub(\'' + s.id + '\',\'ei\')">Copier</button></div>' +
                '<textarea id="red-ta-' + s.id + '-ei" data-section="' + s.id + '" data-sub="ei" placeholder="— État initial à générer —"></textarea>' +
                '</div>' +
                '<div class="red-subblock">' +
                '<div class="red-sublabel">Améliorations possibles <button class="red-copy" onclick="Redaction.copySub(\'' + s.id + '\',\'ap\')">Copier</button></div>' +
                '<textarea id="red-ta-' + s.id + '-ap" data-section="' + s.id + '" data-sub="ap" placeholder="— Améliorations à générer —"></textarea>' +
                '</div>' +
                '</div>';
        });
        container.innerHTML = html;
    }

    /* ═════ État visuel (généré / modifié) ═════ */
    function setState(textarea, state) {
        if (!textarea) return;
        textarea.classList.remove('red-state-generated', 'red-state-modified');
        if (state) textarea.classList.add('red-state-' + state);
    }

    function onTextareaInput(ev) {
        var ta = ev.target;
        if (!ta || !ta.dataset || !ta.dataset.section) return;
        // Typed text while in "generated" state → switch to "modified"
        if (ta.classList.contains('red-state-generated')) setState(ta, 'modified');
        else if (!ta.classList.contains('red-state-modified') && ta.value) setState(ta, 'modified');
        else if (!ta.value) setState(ta, '');
        autoSave();
    }

    /* ═════ Rendu des textareas (réponse IA) ═════ */
    function renderSections(map) {
        SECTIONS.forEach(function (s) {
            var pair = map[s.id];
            if (pair === undefined) return;
            var eiTa = document.getElementById('red-ta-' + s.id + '-ei');
            var apTa = document.getElementById('red-ta-' + s.id + '-ap');
            if (eiTa) { eiTa.value = (pair && pair.ei) || ''; setState(eiTa, eiTa.value ? 'generated' : ''); }
            if (apTa) { apTa.value = (pair && pair.ap) || ''; setState(apTa, apTa.value ? 'generated' : ''); }
        });
        var box = document.getElementById('redaction-output');
        if (box) box.style.display = 'block';
        doSave();
    }

    /* ═════ Progress bar ═════ */
    var _progressTimer = null;
    var _progressStart = 0;

    function progressStart() {
        var box = document.getElementById('redaction-progress');
        var bar = box && box.querySelector('.bar');
        if (!box || !bar) return;
        box.style.display = 'block';
        bar.style.width = '0%';
        _progressStart = Date.now();
        clearInterval(_progressTimer);
        // Asymptotic progress : grows toward 95 % over ~60 s, never reaches 100 %
        _progressTimer = setInterval(function () {
            var elapsed = (Date.now() - _progressStart) / 1000; // seconds
            var pct = 95 * (1 - Math.exp(-elapsed / 25)); // ~63% at 25 s, ~86% at 50 s, ~95% at 75 s
            bar.style.width = pct.toFixed(1) + '%';
            var status = document.getElementById('redaction-status');
            if (status) status.textContent = 'Appel de Claude… ' + Math.round(elapsed) + ' s';
        }, 200);
    }

    function progressEnd(success) {
        clearInterval(_progressTimer);
        _progressTimer = null;
        var box = document.getElementById('redaction-progress');
        var bar = box && box.querySelector('.bar');
        if (!box || !bar) return;
        bar.style.width = success ? '100%' : '0%';
        setTimeout(function () {
            box.style.display = 'none';
            bar.style.width = '0%';
        }, success ? 600 : 200);
    }

    /* ═════ Generate ═════ */
    async function generateAll() {
        var btn = document.getElementById('btn-redaction-generate');
        var status = document.getElementById('redaction-status');

        try {
            if (btn) { btn.disabled = true; btn.textContent = 'Génération…'; }
            if (status) status.textContent = 'Chargement du skill…';
            progressStart();

            var skill = await loadSkill();
            var userBlock = buildPromptBlock();

            if (status) status.textContent = 'Appel de Claude (cela peut prendre 30–60 s)…';

            var systemPrompt = skill +
                '\n\n---\n\n**INSTRUCTION IMPORTANTE D\'EXÉCUTION :** ' +
                "L'utilisateur va te fournir le formulaire complété. Ne lui repose pas de questions, ne redemande pas d'informations. " +
                'Passe directement à l\'Étape 3 (Rédaction des sections) en suivant STRICTEMENT les conventions de style et les gabarits fournis ci-dessus. ' +
                'Produis UNIQUEMENT le bloc Markdown final au format exact suivant, sans préambule ni commentaire :\n\n' +
                '```\n## TOIT CONTRE EXTÉRIEUR\n**État initial :** [texte]\n\n**Améliorations possibles :** [texte]\n\n## TOIT CONTRE LOCAUX NON CHAUFFÉS\n**État initial :** [texte]\n\n**Améliorations possibles :** [texte]\n\n## MURS\n...\n```\n\n' +
                'Inclure **TOUTES les 13 sections dans cet ordre exact** : TOIT CONTRE EXTÉRIEUR, TOIT CONTRE LOCAUX NON CHAUFFÉS, MURS, FENÊTRES, SOL, PONTS THERMIQUES, VENTILATION, CHAUFFAGE, EAU CHAUDE, APPAREILS, PHOTOVOLTAÏQUE, COMPORTEMENT, REVALORISATION. ' +
                'Pour CHAQUE section (y compris COMPORTEMENT et REVALORISATION), fournir explicitement les deux sous-sections **État initial :** et **Améliorations possibles :** — jamais une seule. ' +
                'Pour COMPORTEMENT : État initial = texte standard §3.10 adapté en "état des lieux" du comportement énergétique ; Améliorations possibles = recommandations de bonnes pratiques (aération, consigne température hivernale). ' +
                'Pour REVALORISATION : État initial = synthèse courte du potentiel de revalorisation du bâtiment ; Améliorations possibles = texte §3.11 "Conseils et recommandation". ' +
                'Pour TOIT CONTRE LOCAUX NON CHAUFFÉS : si le formulaire ne fournit pas d\'information, indiquer "Sans objet" dans l\'état initial et "Aucune recommandation" dans les améliorations. ' +
                'Pour PONTS THERMIQUES : dans l\'état initial, décrire le niveau observé (ponctuels / modérés / marqués), rappeler qu\'ils sont généralement inhérents à l\'époque de construction (balcons en porte-à-faux, linteaux, dalles intermédiaires, encadrements) et qu\'ils génèrent des déperditions supplémentaires et potentiellement des désordres (condensation, moisissures) ; si le formulaire ne fournit rien, indiquer "Sans observation particulière lors de la visite". Dans les améliorations, recommander leur traitement lors d\'une isolation par l\'extérieur (rupteurs, retours d\'isolation sur encadrements, reprise de jonction toit/mur), préciser que ces travaux ne sont pas éligibles aux subventions Programme Bâtiments s\'ils sont isolés, mais le deviennent s\'ils sont couplés à une isolation complète de l\'enveloppe. ' +
                '**IMPORTANT — valeurs U :** lorsque tu qualifies un élément à partir d\'une valeur U fournie, **ne cite JAMAIS la valeur numérique** (ex. 0,46 W/m²K) dans le texte livré. Utilise uniquement la catégorie (*Très bonne / Bonne / Moyenne / Mauvaise*) intégrée naturellement dans la phrase — par exemple « Le plancher présente une performance d\'isolation moyenne » et **non** « La valeur U de cette dalle, estimée à 0,46 W/m²K, situe cet élément dans la catégorie Moyenne ».';

            var response = await CecbApi.callClaude({
                system: systemPrompt,
                userMessage: userBlock,
                maxTokens: 6000,
                timeoutMs: 120000
            });

            var sections = parseSections(response);
            progressEnd(true);
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
            progressEnd(false);
            if (status) status.textContent = 'Erreur : ' + e.message;
            alert('Erreur lors de la génération : ' + e.message);
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Générer les textes CECB'; }
        }
    }

    /* ═════ Copier ═════ */
    function copySub(sectionId, sub) {
        var ta = document.getElementById('red-ta-' + sectionId + '-' + sub);
        if (!ta) return;
        ta.focus();
        ta.select();
        try { navigator.clipboard.writeText(ta.value); } catch (e) { document.execCommand('copy'); }
        // Visual feedback on the button that triggered it
        var btn = (event && event.target) || null;
        if (btn && btn.tagName === 'BUTTON') {
            var prev = btn.textContent;
            btn.textContent = '✓';
            setTimeout(function () { btn.textContent = prev; }, 1200);
        }
    }

    // Backward-compat alias (used by old HTML if any lingers)
    function copySection(sectionId) { copySub(sectionId, 'ei'); }

    function copyAll() {
        var parts = [];
        SECTIONS.forEach(function (s) {
            var ei = document.getElementById('red-ta-' + s.id + '-ei');
            var ap = document.getElementById('red-ta-' + s.id + '-ap');
            var eiVal = ei && ei.value.trim();
            var apVal = ap && ap.value.trim();
            if (!eiVal && !apVal) return;
            var block = '## ' + s.label.toUpperCase() + '\n\n';
            if (eiVal) block += '**État initial :** ' + eiVal + '\n\n';
            if (apVal) block += '**Améliorations possibles :** ' + apVal;
            parts.push(block.trim());
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

    /* ═════ Save ═════ */
    function doSave() {
        var pid = ProjectStore.getCurrentId();
        if (!pid) return false;
        var generatedTexts = {};
        SECTIONS.forEach(function (s) {
            var ei = document.getElementById('red-ta-' + s.id + '-ei');
            var ap = document.getElementById('red-ta-' + s.id + '-ap');
            var eiVal = ei ? ei.value : '';
            var apVal = ap ? ap.value : '';
            var eiState = ei && ei.classList.contains('red-state-modified') ? 'modified' : (ei && ei.classList.contains('red-state-generated') ? 'generated' : '');
            var apState = ap && ap.classList.contains('red-state-modified') ? 'modified' : (ap && ap.classList.contains('red-state-generated') ? 'generated' : '');
            if (eiVal || apVal) {
                generatedTexts[s.id] = { ei: eiVal, ap: apVal, eiState: eiState, apState: apState };
            }
        });
        ProjectStore.update(pid, 'redaction', {
            formData: collectFormData(),
            generatedTexts: generatedTexts
        });
        if (typeof showSaveIndicator === 'function') showSaveIndicator();
        return true;
    }

    function autoSave() {
        clearTimeout(_saveTimer);
        _saveTimer = setTimeout(doSave, 2000);
    }

    function manualSave() {
        clearTimeout(_saveTimer);
        var ok = doSave();
        var btn = document.getElementById('btn-redaction-save');
        var status = document.getElementById('redaction-status');
        if (btn) {
            var prev = btn.textContent;
            btn.textContent = ok ? '✓ Sauvegardé' : 'Aucun projet';
            setTimeout(function () { btn.textContent = prev; }, 1500);
        }
        if (status && ok) {
            status.textContent = 'Formulaire sauvegardé — il sera rechargé au prochain passage sur l\'onglet.';
            setTimeout(function () { if (status.textContent.indexOf('sauvegardé') !== -1) status.textContent = ''; }, 4000);
        }
    }

    /* ═════ Init ═════ */
    function init() {
        var f = form();
        if (!f) return;

        // Construire les 22 textareas de sortie
        buildOutputBlocks();

        // Charger les données sauvegardées du projet
        var pid = ProjectStore.getCurrentId();
        if (pid) {
            var project = ProjectStore.get(pid);
            if (project && project.redaction) {
                loadFormData(project.redaction.formData || {});
                var gen = project.redaction.generatedTexts || {};
                var hasAny = false;
                SECTIONS.forEach(function (s) {
                    var rec = gen[s.id];
                    if (rec === undefined) return;
                    hasAny = true;
                    var eiTa = document.getElementById('red-ta-' + s.id + '-ei');
                    var apTa = document.getElementById('red-ta-' + s.id + '-ap');
                    // Backward-compat : old format stored as a single string
                    if (typeof rec === 'string') {
                        if (eiTa) { eiTa.value = rec; setState(eiTa, rec ? 'generated' : ''); }
                    } else if (rec && typeof rec === 'object') {
                        if (eiTa) { eiTa.value = rec.ei || ''; setState(eiTa, rec.ei ? (rec.eiState || 'generated') : ''); }
                        if (apTa) { apTa.value = rec.ap || ''; setState(apTa, rec.ap ? (rec.apState || 'generated') : ''); }
                    }
                });
                if (hasAny) {
                    var box = document.getElementById('redaction-output');
                    if (box) box.style.display = 'block';
                }
            }
        }

        // Pré-remplir depuis recueil/address (sans écraser)
        prefillFromProject();

        // Listeners auto-save sur le formulaire
        f.querySelectorAll('input, select, textarea').forEach(function (el) {
            el.addEventListener('input', autoSave);
            el.addEventListener('change', autoSave);
        });
        // Listeners état + auto-save sur les 22 textareas de sortie
        SECTIONS.forEach(function (s) {
            ['ei', 'ap'].forEach(function (sub) {
                var ta = document.getElementById('red-ta-' + s.id + '-' + sub);
                if (ta) ta.addEventListener('input', onTextareaInput);
            });
        });
    }

    /* ═════ Export (copier-coller dans Claude) ═════ */
    function exportBlock() {
        var block = buildPromptBlock();
        var modal = document.getElementById('redaction-export-modal');
        var ta = document.getElementById('redaction-export-text');
        if (!modal || !ta) return;
        ta.value = block;
        modal.style.display = 'flex';
        setTimeout(function () { ta.focus(); ta.select(); }, 50);
    }

    function exportCopy() {
        var ta = document.getElementById('redaction-export-text');
        if (!ta) return;
        ta.focus();
        ta.select();
        try { navigator.clipboard.writeText(ta.value); } catch (e) { document.execCommand('copy'); }
        var btn = document.getElementById('btn-redaction-export-copy');
        if (btn) {
            var prev = btn.textContent;
            btn.textContent = '✓ Copié';
            setTimeout(function () { btn.textContent = prev; }, 1500);
        }
    }

    function exportClose() {
        var modal = document.getElementById('redaction-export-modal');
        if (modal) modal.style.display = 'none';
    }

    return {
        init: init,
        generateAll: generateAll,
        copySection: copySection,
        copyAll: copyAll,
        save: manualSave,
        exportBlock: exportBlock,
        exportCopy: exportCopy,
        exportClose: exportClose
    };
})();

function initRedaction() { Redaction.init(); }
