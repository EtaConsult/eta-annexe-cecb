/* ════════════════════════════════════════════════════════════
 * word-plus.js
 * Contrôleur de l'onglet « CECB Plus Word ».
 * - initWordPlus() : chargement des données projet, rendu du formulaire
 * - wpCollectFormData() : collecte les valeurs du DOM vers un objet
 * - wordPlusAutoSave() : persiste project.wordPlus (debounce 2.5s)
 * - wpUpdateStatusIndicators() : pastilles ✓ vert / ⚠ orange / 🔵 bleu
 * ════════════════════════════════════════════════════════════ */

(function (global) {
    'use strict';

    var _wpState = null;        // Dernier état chargé / collecté
    var _wpSaveTimer = null;    // Timer de debounce autosave
    var _wpDirty = false;       // Flag : l'utilisateur a modifié un champ
    var _wpProjectDefaults = null; // Valeurs initiales (pour distinguer "projet" vs "manuel")
    var _wpTemplates = null;    // Templates chargés depuis bibliotheque/word-plus-templates.json
    var _wpEnhanceOriginals = {}; // Textes avant "Enrichir avec Claude" (pour undo)

    /* ──── Mapping champs UI → clés de l'objet state ──── */
    // Liste des (fieldKey, selector, type) — types : 'text' | 'textarea' | 'select' | 'checkbox' | 'nested'
    var WP_UI_FIELDS = [
        { key: 'adresse',      sel: '#wp-adresse',      type: 'text' },
        { key: 'commune',      sel: '#wp-commune',      type: 'text' },
        { key: 'egid',         sel: '#wp-egid',         type: 'text' },
        { key: 'affectation',  sel: '#wp-affectation',  type: 'text' },
        { key: 'annee',        sel: '#wp-annee',        type: 'text' },
        { key: 'sre',          sel: '#wp-sre',          type: 'text' },
        { key: 'classeEnv',    sel: '#wp-classe-env',   type: 'select' },
        { key: 'classeGlob',   sel: '#wp-classe-glob',  type: 'select' },
        { key: 'classeCo2',    sel: '#wp-classe-co2',   type: 'select' },
        { key: 'civilite',     sel: '#wp-civilite',     type: 'select' },
        { key: 'mandNom',      sel: '#wp-mand-nom',     type: 'text' },
        { key: 'mandAdr',      sel: '#wp-mand-adr',     type: 'text' },
        { key: 'mandMail',     sel: '#wp-mand-mail',    type: 'text' },
        { key: 'mandTel',      sel: '#wp-mand-tel',     type: 'text' },
        { key: 'numCecb',      sel: '#wp-num-cecb',     type: 'text' },
        { key: 'dateRapport',  sel: '#wp-date-rapport', type: 'text' },
        { key: 'dateVisite',   sel: '#wp-date-visite',  type: 'text' },
        { key: 'introduction', sel: '#wp-introduction', type: 'textarea' },
        { key: 'resume',       sel: '#wp-resume',       type: 'textarea' },
        { key: 'commentEnv',   sel: '#wp-comment-env',  type: 'textarea' },
        { key: 'commentEff',   sel: '#wp-comment-eff',  type: 'textarea' },
        { key: 'commentCo2',   sel: '#wp-comment-co2',  type: 'textarea' },
        { key: 'recoVariante', sel: '#wp-reco-variante',type: 'select' },
        { key: 'recoTexte',    sel: '#wp-reco-texte',   type: 'textarea' },
        { key: 'remarques',    sel: '#wp-remarques',    type: 'textarea' }
    ];

    // Les champs obligatoires pour générer le .docx (pour l'indicateur ⚠ orange)
    var WP_REQUIRED_FIELDS = ['adresse', 'annee', 'civilite', 'mandNom', 'mandAdr', 'numCecb', 'dateRapport'];

    // Mapping clé state → template key dans word-plus-templates.json
    var WP_TEMPLATE_KEYS = {
        introduction: 'introduction',
        resume: 'resume',
        commentEnv: 'commentEnv',
        commentEff: 'commentEff',
        commentCo2: 'commentCo2',
        remarques: 'remarques'
    };

    /* ──── Toast local ──── */
    function wpToast(msg, type) {
        if (typeof recueilToast === 'function') return recueilToast(msg, type);
        var el = document.getElementById('notification');
        if (!el) { console.log('[wp]', msg); return; }
        el.textContent = msg;
        el.classList.add('show');
        setTimeout(function () { el.classList.remove('show'); }, 2500);
    }

    /* ──── Initialisation de l'onglet (lazy) ──── */
    function initWordPlus() {
        var pid = (typeof ProjectStore !== 'undefined') ? ProjectStore.getCurrentId() : null;
        if (!pid) {
            wpToast('Aucun projet actif', 'error');
            return;
        }
        // Charge les données projet
        _wpState = wpLoadFromProject(pid);
        _wpProjectDefaults = Object.assign({}, _wpState);

        // Charge les templates, puis applique les textes par défaut si vides
        wpLoadTemplates().then(function () {
            wpApplyDefaultTexts(_wpState);
            wpFillForm(_wpState);
            wpUpdateStatusIndicators();
            wpUpdateProgress();
            wpBindChangeHandlers();
            wpSetupPdfDropzone();
        }).catch(function (err) {
            console.warn('[wp] Templates non chargés :', err);
            // Continue sans templates — les textareas restent vides
            wpFillForm(_wpState);
            wpUpdateStatusIndicators();
            wpUpdateProgress();
            wpBindChangeHandlers();
            wpSetupPdfDropzone();
        });
    }

    /* ──── Chargement des templates de texte ──── */
    function wpLoadTemplates() {
        if (_wpTemplates) return Promise.resolve(_wpTemplates);
        return fetch('bibliotheque/word-plus-templates.json')
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (data) { _wpTemplates = data; return data; });
    }

    /* ──── Remplace {{key}} et {{obj[idx]}} par les valeurs du contexte ──── */
    function wpFillTemplate(tpl, vars) {
        if (!tpl) return '';
        return String(tpl).replace(/\{\{\s*([\w.]+(?:\[\d+\])?)\s*\}\}/g, function (m, path) {
            // Support "variantNames[0]"
            var arr = path.match(/^([\w.]+)\[(\d+)\]$/);
            if (arr) {
                var src = vars[arr[1]];
                var idx = parseInt(arr[2], 10);
                if (src && src[idx] !== undefined) return src[idx];
                return '';
            }
            var val = vars[path];
            return (val === undefined || val === null) ? '' : String(val);
        });
    }

    /* ──── Applique les textes par défaut dans state si champs vides ──── */
    function wpApplyDefaultTexts(state) {
        if (!_wpTemplates) return;
        Object.keys(WP_TEMPLATE_KEYS).forEach(function (stateKey) {
            if (state[stateKey] && String(state[stateKey]).trim()) return; // l'utilisateur a déjà saisi
            var tplKey = WP_TEMPLATE_KEYS[stateKey];
            var tpl = _wpTemplates[tplKey];
            if (tpl && tpl.default_text_fr) {
                state[stateKey] = wpFillTemplate(tpl.default_text_fr, state);
            }
        });
        // Recommandation : dépend de la variante choisie
        if (!state.recoTexte || !String(state.recoTexte).trim()) {
            state.recoTexte = wpDefaultRecoText(state.recoVariante || 'V2', state);
        }
    }

    function wpDefaultRecoText(variante, state) {
        if (!_wpTemplates || !_wpTemplates.recommendation) return '';
        var entry = _wpTemplates.recommendation[variante];
        if (!entry || !entry.default_text_fr) return '';
        return wpFillTemplate(entry.default_text_fr, state);
    }

    /* ──── Remplit le DOM à partir d'un objet state ──── */
    function wpFillForm(data) {
        WP_UI_FIELDS.forEach(function (f) {
            var el = document.querySelector(f.sel);
            if (!el) return;
            var val = data[f.key];
            if (val === undefined || val === null) val = '';
            el.value = val;
        });
        // Variantes : noms + coûts
        (data.variantNames || []).forEach(function (n, i) {
            var el = document.getElementById('wp-vname-' + i);
            if (el) el.value = n || '';
        });
        (data.variantCosts || []).forEach(function (c, i) {
            var el = document.getElementById('wp-vcost-' + i);
            if (el) el.value = c || '';
        });
        // Grille de checkboxes variantes
        wpRenderVariantsGrid(data.variantsCheck || {}, data.variantNames || []);
        // Bases documents
        var bases = data.bases || {};
        ['plan', 'facade', 'coupe', 'consoElec', 'consoChauff', 'autres'].forEach(function (k) {
            var el = document.getElementById('wp-base-' + k);
            if (el) el.value = bases[k] || '';
        });
    }

    /* ──── Rendu de la grille des variantes (16 lignes × 3 colonnes) ──── */
    function wpRenderVariantsGrid(checks, names) {
        var container = document.getElementById('wpVarGrid');
        if (!container) return;
        var rows = (typeof WP_VAR_MAPPING !== 'undefined') ? WP_VAR_MAPPING : [];
        if (!rows.length) { container.innerHTML = ''; return; }
        var v1 = (names[0] || 'Variante 1');
        var v2 = (names[1] || 'Variante 2');
        var v3 = (names[2] || 'Variante 3');
        var html = '<table style="width:100%;border-collapse:collapse;font-size:.9em">'
            + '<thead><tr style="background:#E5E7EB">'
            + '<th style="text-align:left;padding:8px 10px;border:1px solid var(--r-border)">Intervention</th>'
            + '<th style="padding:8px 10px;border:1px solid var(--r-border);text-align:center" id="wpVarHdr0">' + _wpEsc(v1) + '</th>'
            + '<th style="padding:8px 10px;border:1px solid var(--r-border);text-align:center" id="wpVarHdr1">' + _wpEsc(v2) + '</th>'
            + '<th style="padding:8px 10px;border:1px solid var(--r-border);text-align:center" id="wpVarHdr2">' + _wpEsc(v3) + '</th>'
            + '</tr></thead><tbody>';
        var currentGroup = null;
        var groupLabels = { enveloppe: 'Enveloppe du bâtiment', technique: 'Technique du bâtiment', electricite: 'Électricité' };
        rows.forEach(function (row) {
            if (row.group !== currentGroup) {
                currentGroup = row.group;
                html += '<tr style="background:#F3F4F6"><td colspan="4" style="padding:6px 10px;border:1px solid var(--r-border);font-weight:600;color:var(--r-primary)">' + _wpEsc(groupLabels[row.group] || row.group) + '</td></tr>';
            }
            var ck = checks[row.wpKey] || [false, false, false];
            html += '<tr>'
                + '<td style="padding:6px 10px;border:1px solid var(--r-border)">' + _wpEsc(row.label) + '</td>'
                + '<td style="padding:6px 10px;border:1px solid var(--r-border);text-align:center"><input type="checkbox" data-wp-var="' + row.wpKey + '" data-wp-idx="0"' + (ck[0] ? ' checked' : '') + '></td>'
                + '<td style="padding:6px 10px;border:1px solid var(--r-border);text-align:center"><input type="checkbox" data-wp-var="' + row.wpKey + '" data-wp-idx="1"' + (ck[1] ? ' checked' : '') + '></td>'
                + '<td style="padding:6px 10px;border:1px solid var(--r-border);text-align:center"><input type="checkbox" data-wp-var="' + row.wpKey + '" data-wp-idx="2"' + (ck[2] ? ' checked' : '') + '></td>'
                + '</tr>';
        });
        html += '</tbody></table>';
        container.innerHTML = html;
        // Bind listeners
        container.querySelectorAll('input[type="checkbox"][data-wp-var]').forEach(function (cb) {
            cb.addEventListener('change', function () {
                _wpDirty = true;
                _wpState = wpCollectFormData();
                wpUpdateStatusIndicators();
                wordPlusAutoSave();
            });
        });
    }

    function _wpEsc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* ──── Collecte DOM → objet state ──── */
    function wpCollectFormData() {
        var out = Object.assign({}, _wpState || {});
        WP_UI_FIELDS.forEach(function (f) {
            var el = document.querySelector(f.sel);
            if (!el) return;
            out[f.key] = el.value;
        });
        // Variantes : noms + coûts
        out.variantNames = [0, 1, 2].map(function (i) {
            var el = document.getElementById('wp-vname-' + i);
            return el ? el.value : ((out.variantNames || [])[i] || '');
        });
        out.variantCosts = [0, 1, 2].map(function (i) {
            var el = document.getElementById('wp-vcost-' + i);
            return el ? el.value : ((out.variantCosts || [])[i] || '');
        });
        // Variantes : matrice de checkboxes
        var grid = document.getElementById('wpVarGrid');
        if (grid) {
            var checks = Object.assign({}, out.variantsCheck || {});
            grid.querySelectorAll('input[type="checkbox"][data-wp-var]').forEach(function (cb) {
                var k = cb.getAttribute('data-wp-var');
                var i = parseInt(cb.getAttribute('data-wp-idx'), 10);
                if (!checks[k]) checks[k] = [false, false, false];
                checks[k][i] = cb.checked;
            });
            out.variantsCheck = checks;
        }
        // Bases Documents
        var bases = Object.assign({}, out.bases || {});
        ['plan', 'facade', 'coupe', 'consoElec', 'consoChauff', 'autres'].forEach(function (k) {
            var el = document.getElementById('wp-base-' + k);
            if (el) bases[k] = el.value;
        });
        out.bases = bases;
        // Labels dérivés
        out.affectation = out.affectation || wpSiaLabel(out.siaType);
        out.chaufSourceLbl = wpChaufLabel(out.chaufSource);
        out.ecsTypeLbl = wpEcsLabel(out.ecsType);
        out.ventTypeLbl = wpVentLabel(out.ventType);
        return out;
    }

    /* ──── Indicateurs de statut (✓ / ⚠ / 🔵) ──── */
    function wpUpdateStatusIndicators() {
        var data = _wpState || {};
        var defaults = _wpProjectDefaults || {};
        document.querySelectorAll('#tab-wordplus .wp-status').forEach(function (el) {
            var key = el.getAttribute('data-field');
            var curr = data[key];
            el.classList.remove('ok', 'miss', 'manual');
            if (!curr || (typeof curr === 'string' && !curr.trim())) {
                if (WP_REQUIRED_FIELDS.indexOf(key) >= 0) {
                    el.classList.add('miss');
                    el.title = 'Champ à compléter';
                } else {
                    el.title = 'Optionnel';
                }
            } else if (defaults[key] && defaults[key] === curr) {
                el.classList.add('ok');
                el.title = 'Chargé depuis le projet';
            } else {
                el.classList.add('manual');
                el.title = 'Saisie manuelle';
            }
        });

        // Badges de section (résumé : "3/5 complétés")
        wpUpdateSectionBadges(data);
    }

    function wpUpdateSectionBadges(data) {
        var sections = {
            'batiment':   ['adresse', 'commune', 'egid', 'affectation', 'annee', 'sre'],
            'classes':    ['classeEnv', 'classeGlob', 'classeCo2'],
            'mandataire': ['civilite', 'mandNom', 'mandAdr', 'mandMail', 'mandTel'],
            'rapport':    ['numCecb', 'dateRapport', 'dateVisite'],
            'textes':     ['introduction', 'resume', 'commentEnv', 'commentEff', 'commentCo2', 'recoTexte', 'remarques']
        };
        Object.keys(sections).forEach(function (sec) {
            var keys = sections[sec];
            var filled = keys.filter(function (k) { var v = data[k]; return v && String(v).trim(); }).length;
            var el = document.querySelector('#tab-wordplus .wp-badge[data-section="' + sec + '"]');
            if (el) {
                el.textContent = filled + '/' + keys.length + ' complétés';
                el.style.color = filled === keys.length ? '#10B981' : (filled > 0 ? '#F59E0B' : 'var(--r-grey)');
            }
        });
        // Badge Variantes : nombre de checks actives / 3 × 16
        var varBadge = document.querySelector('#tab-wordplus .wp-badge[data-section="variantes"]');
        if (varBadge) {
            var checks = data.variantsCheck || {};
            var total = 0, checked = 0;
            Object.keys(checks).forEach(function (k) {
                (checks[k] || []).forEach(function (b) { total++; if (b) checked++; });
            });
            varBadge.textContent = checked + ' coche' + (checked > 1 ? 's' : '') + ' sur ' + total;
            varBadge.style.color = checked > 0 ? '#10B981' : 'var(--r-grey)';
        }
        // Badge Bases : nombre de selects renseignés / 6
        var basesBadge = document.querySelector('#tab-wordplus .wp-badge[data-section="bases"]');
        if (basesBadge) {
            var bases = data.bases || {};
            var bKeys = ['plan', 'facade', 'coupe', 'consoElec', 'consoChauff', 'autres'];
            var bFilled = bKeys.filter(function (k) { return bases[k] && bases[k].trim(); }).length;
            basesBadge.textContent = bFilled + '/' + bKeys.length + ' renseignés';
            basesBadge.style.color = bFilled === bKeys.length ? '#10B981' : (bFilled > 0 ? '#F59E0B' : 'var(--r-grey)');
        }
    }

    function wpUpdateProgress() {
        var data = _wpState || wpCollectFormData();
        var all = WP_UI_FIELDS.map(function (f) { return f.key; });
        var filled = all.filter(function (k) { var v = data[k]; return v && String(v).trim(); }).length;
        var pct = Math.round(filled / all.length * 100);
        var txt = document.getElementById('wpProgressText');
        var fill = document.getElementById('wpProgressFill');
        if (txt) txt.textContent = filled + '/' + all.length + ' champs complétés (' + pct + '%)';
        if (fill) fill.style.width = pct + '%';
    }

    /* ──── Handlers de changement → autosave + indicateurs ──── */
    function wpBindChangeHandlers() {
        WP_UI_FIELDS.forEach(function (f) {
            var el = document.querySelector(f.sel);
            if (!el) return;
            if (el.__wpBound) return;
            el.__wpBound = true;
            var evt = (f.type === 'select') ? 'change' : 'input';
            el.addEventListener(evt, function () {
                _wpDirty = true;
                _wpState = wpCollectFormData();
                wpUpdateStatusIndicators();
                wpUpdateProgress();
                wordPlusAutoSave();
            });
        });
        // Champs variantes (noms, coûts) + bases
        var extraIds = ['wp-vname-0', 'wp-vname-1', 'wp-vname-2', 'wp-vcost-0', 'wp-vcost-1', 'wp-vcost-2',
                        'wp-base-plan', 'wp-base-facade', 'wp-base-coupe', 'wp-base-consoElec', 'wp-base-consoChauff', 'wp-base-autres'];
        extraIds.forEach(function (id) {
            var el = document.getElementById(id);
            if (!el || el.__wpBound) return;
            el.__wpBound = true;
            var evt = el.tagName === 'SELECT' ? 'change' : 'input';
            el.addEventListener(evt, function () {
                _wpDirty = true;
                _wpState = wpCollectFormData();
                // Si nom de variante modifié → met à jour en-têtes grille
                if (id.indexOf('wp-vname-') === 0) {
                    var idx = parseInt(id.slice(-1), 10);
                    var hdr = document.getElementById('wpVarHdr' + idx);
                    if (hdr) hdr.textContent = el.value || ('Variante ' + (idx + 1));
                }
                wpUpdateStatusIndicators();
                wpUpdateProgress();
                wordPlusAutoSave();
            });
        });
    }

    /* ──── Autosave (debounce 2.5s) ──── */
    function wordPlusAutoSave(force) {
        if (_wpSaveTimer) { clearTimeout(_wpSaveTimer); _wpSaveTimer = null; }
        var doSave = function () {
            if (!_wpDirty && !force) return;
            var pid = (typeof ProjectStore !== 'undefined') ? ProjectStore.getCurrentId() : null;
            if (!pid) return;
            var state = wpCollectFormData();
            state._updated = new Date().toISOString();
            // On ne stocke PAS les buffers PDF/template (trop gros).
            delete state._pdfBuffer;
            delete state._templateBuffer;
            ProjectStore.update(pid, 'wordPlus', state);
            _wpDirty = false;
        };
        if (force) { doSave(); }
        else { _wpSaveTimer = setTimeout(doSave, 2500); }
    }

    /* ──── Bouton « Recharger projet » (écrase les valeurs manuelles) ──── */
    function wpReloadFromProject() {
        var pid = (typeof ProjectStore !== 'undefined') ? ProjectStore.getCurrentId() : null;
        if (!pid) return;
        if (!confirm('Recharger les données depuis le projet ? Les valeurs saisies manuellement dans cet onglet seront conservées uniquement pour les champs mandataire, n° CECB et date rapport.')) return;
        var fresh = wpLoadFromProject(pid);
        // On préserve les données saisies manuellement (mandataire, numCecb, date, textes édités)
        var preserve = ['civilite', 'mandNom', 'mandAdr', 'mandMail', 'mandTel', 'numCecb', 'dateRapport', 'dateVisite',
                        'introduction', 'resume', 'commentEnv', 'commentEff', 'commentCo2', 'recoVariante', 'recoTexte', 'remarques', 'bases'];
        preserve.forEach(function (k) {
            if (_wpState && _wpState[k]) fresh[k] = _wpState[k];
        });
        _wpState = fresh;
        _wpProjectDefaults = Object.assign({}, fresh);
        wpFillForm(_wpState);
        wpUpdateStatusIndicators();
        wpUpdateProgress();
        wpToast('Données rechargées depuis le projet');
    }

    /* ──── Dropzone PDF ──── */
    function wpSetupPdfDropzone() {
        var dz = document.getElementById('wpPdfDropzone');
        var input = document.getElementById('wpPdfFileInput');
        if (!dz || !input || dz.__wpBound) return;
        dz.__wpBound = true;
        dz.addEventListener('click', function () { input.click(); });
        dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('dragover'); });
        dz.addEventListener('dragleave', function () { dz.classList.remove('dragover'); });
        dz.addEventListener('drop', function (e) {
            e.preventDefault();
            dz.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files[0]) wpHandlePdfFile(e.dataTransfer.files[0]);
        });
        input.addEventListener('change', function () {
            if (input.files && input.files[0]) wpHandlePdfFile(input.files[0]);
        });
    }

    function wpHandlePdfFile(file) {
        var status = document.getElementById('wpPdfStatus');
        if (status) status.innerHTML = '<span style="color:var(--r-grey)">Extraction en cours…</span>';
        if (typeof wpParsePdf !== 'function') {
            if (status) status.innerHTML = '<span class="wp-pdf-err">Module PDF non chargé (Phase 3)</span>';
            return;
        }
        wpParsePdf(file).then(function (pdfData) {
            // Fusion : ne remplace que les champs vides
            var merged = wpMergePdfData(_wpState, pdfData);
            _wpState = merged;
            _wpDirty = true;
            wpFillForm(_wpState);
            wpUpdateStatusIndicators();
            wpUpdateProgress();
            wordPlusAutoSave();
            if (status) {
                var extracted = [];
                if (pdfData.numCecb) extracted.push('n° CECB ' + pdfData.numCecb);
                if (pdfData.classeEnv) extracted.push('classes ' + pdfData.classeEnv + '/' + (pdfData.classeGlob || '?') + '/' + (pdfData.classeCo2 || '?'));
                if (pdfData.consoMazout) extracted.push('mazout ' + pdfData.consoMazout + ' kWh/a');
                status.innerHTML = '<span class="wp-pdf-ok">✓ PDF extrait : ' + (extracted.join(' · ') || 'aucune donnée reconnue') + '</span>';
            }
        }).catch(function (err) {
            if (status) status.innerHTML = '<span class="wp-pdf-err">Erreur : ' + (err.message || err) + '</span>';
        });
    }

    /* ──── Test du template (debug) ──── */
    function wpCheckTemplate() {
        fetch('templates/cecb_plus_template.docx').then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.arrayBuffer();
        }).then(function (buf) {
            wpToast('Template trouvé (' + Math.round(buf.byteLength / 1024) + ' KB)');
        }).catch(function (e) {
            wpToast('Template absent : ' + e.message + ' — voir templates/README.md pour la préparation.', 'error');
        });
    }

    /* ──── Bouton Générer (délègue à word-plus-docx.js) ──── */
    function wpGenerate() {
        if (typeof wpRenderDocx !== 'function') {
            wpToast('Module de génération Word non chargé', 'error');
            return;
        }
        // Force l'autosave immédiat pour ne rien perdre
        wordPlusAutoSave(true);
        var data = wpCollectFormData();
        var btn = document.getElementById('wpGenerateBtn');
        var statusEl = document.getElementById('wpGenStatus');
        if (btn) { btn.disabled = true; btn.textContent = 'Génération…'; }
        if (statusEl) statusEl.textContent = 'Chargement du template…';
        wpRenderDocx(data).then(function (result) {
            if (statusEl) statusEl.textContent = '✓ Rapport généré : ' + result.filename;
            wpToast('Rapport Word généré');
        }).catch(function (err) {
            if (statusEl) statusEl.innerHTML = '<span style="color:#c0392b">✗ ' + (err.message || err) + '</span>';
            wpToast('Erreur : ' + (err.message || err), 'error');
        }).then(function () {
            if (btn) { btn.disabled = false; btn.textContent = 'Générer le rapport .docx'; }
        });
    }

    /* ──── Changement de variante → recharge le texte de recommandation par défaut ──── */
    function wpOnRecoVarianteChange() {
        var sel = document.getElementById('wp-reco-variante');
        var ta = document.getElementById('wp-reco-texte');
        if (!sel || !ta) return;
        var v = sel.value;
        if (!_wpState) _wpState = wpCollectFormData();
        _wpState.recoVariante = v;
        // Propose de remplacer le texte si l'utilisateur n'a pas modifié par rapport au template précédent
        if (v !== 'Aucune') {
            var newText = wpDefaultRecoText(v, _wpState);
            if (newText) {
                // Remplace sans demander si champ vide ou si texte actuel correspond à un default de variante
                var curr = ta.value.trim();
                var matchesAnyDefault = ['V1', 'V2', 'V3'].some(function (vv) {
                    return wpDefaultRecoText(vv, _wpState).trim() === curr;
                });
                if (!curr || matchesAnyDefault) {
                    ta.value = newText;
                    _wpState.recoTexte = newText;
                }
            }
        }
        _wpDirty = true;
        wpUpdateStatusIndicators();
        wordPlusAutoSave();
    }

    /* ──── Restaure le texte par défaut d'un champ ──── */
    function wpResetField(stateKey) {
        if (!_wpState) _wpState = wpCollectFormData();
        var tplKey = WP_TEMPLATE_KEYS[stateKey];
        var newText = '';
        if (tplKey && _wpTemplates && _wpTemplates[tplKey]) {
            newText = wpFillTemplate(_wpTemplates[tplKey].default_text_fr || '', _wpState);
        } else if (stateKey === 'recoTexte') {
            newText = wpDefaultRecoText(_wpState.recoVariante || 'V2', _wpState);
        } else {
            wpToast('Aucun template pour ce champ', 'error');
            return;
        }
        var sel = (WP_UI_FIELDS.find(function (f) { return f.key === stateKey; }) || {}).sel;
        if (!sel) return;
        var el = document.querySelector(sel);
        if (el) {
            el.value = newText;
            _wpState[stateKey] = newText;
            _wpDirty = true;
            wpUpdateStatusIndicators();
            wpUpdateProgress();
            wordPlusAutoSave();
            wpToast('Texte par défaut restauré');
        }
    }

    /* ──── Enrichir le champ avec Claude (réutilise ENHANCE_SYSTEM_PROMPT et CecbApi) ──── */
    async function wpEnhance(fieldId, fieldLabel) {
        if (typeof CecbApi === 'undefined' || (!CecbApi.useProxy() && !CecbApi.getApiKey())) {
            wpToast('Configurez votre clé API ou l\'URL proxy (paramètres accueil)', 'error');
            return;
        }
        var ta = document.getElementById(fieldId);
        if (!ta || !ta.value.trim()) { wpToast('Aucun texte à enrichir', 'error'); return; }
        _wpEnhanceOriginals[fieldId] = ta.value;
        var btn = ta.closest('.output-field') && ta.closest('.output-field').querySelector('.btn-warning');
        var btnOrig = btn ? btn.innerHTML : '';
        if (btn) { btn.innerHTML = '<span class="spinner"></span>En cours…'; btn.disabled = true; }
        var systemPrompt = (typeof ENHANCE_SYSTEM_PROMPT !== 'undefined')
            ? ENHANCE_SYSTEM_PROMPT
            : 'Tu es un assistant rédactionnel pour des rapports énergétiques suisses (CECB). Améliore la grammaire, la fluidité et la précision technique sans jamais inventer de donnée. Style professionnel et neutre, français de Suisse.';
        var userMsg = 'Améliore le texte ci-dessous : corrige la grammaire et l\'orthographe, reformule légèrement pour plus de fluidité et de clarté. Ne change pas le sens, ne rajoute aucune information nouvelle. Conserve toutes les données techniques. Envoie uniquement le texte amélioré, sans introduction ni commentaire.\n\n' + ta.value;
        try {
            var enriched = await CecbApi.callClaude({ system: systemPrompt, userMessage: userMsg, maxTokens: 2048 });
            enriched = (enriched || '').replace(/\s*\[[^\]]*(?:compléter|manquant)[^\]]*\]\s*/gi, ' ').replace(/\s{2,}/g, ' ');
            if (enriched.trim()) {
                ta.value = enriched.trim();
                _wpState = wpCollectFormData();
                _wpDirty = true;
                wpShowUndoEnhance(fieldId, fieldLabel, ta);
                wpUpdateStatusIndicators();
                wordPlusAutoSave();
                wpToast(fieldLabel + ' amélioré');
            }
        } catch (e) {
            wpToast('Erreur Claude : ' + (e.message || e), 'error');
        } finally {
            if (btn) { btn.innerHTML = btnOrig; btn.disabled = false; }
        }
    }

    /* ──── Picker Quick Parts (insertion d'un bloc pré-rédigé dans un textarea) ──── */
    function wpOpenQuickPartPicker(stateKey, fieldId) {
        var tplKey = (stateKey === 'recoTexte') ? null : WP_TEMPLATE_KEYS[stateKey];
        var entry = null;
        if (tplKey && _wpTemplates && _wpTemplates[tplKey]) {
            entry = _wpTemplates[tplKey];
        } else if (stateKey === 'recoTexte' && _wpTemplates && _wpTemplates.recommendation) {
            var v = (_wpState && _wpState.recoVariante) || 'V2';
            entry = _wpTemplates.recommendation[v];
        }
        if (!entry || !entry.quickparts || !entry.quickparts.length) {
            wpToast('Aucun Quick Part disponible pour ce champ', 'error');
            return;
        }
        // Construit une liste de choix via prompt rudimentaire
        var ta = document.getElementById(fieldId);
        if (!ta) return;
        // Construit un modal léger
        var existing = document.getElementById('wp-qp-modal');
        if (existing) existing.remove();
        var modal = document.createElement('div');
        modal.id = 'wp-qp-modal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
        var box = document.createElement('div');
        box.style.cssText = 'background:#fff;border-radius:10px;padding:20px;max-width:720px;width:100%;max-height:80vh;overflow-y:auto;box-shadow:0 10px 40px rgba(0,0,0,.3)';
        box.innerHTML = '<h3 style="margin:0 0 12px;color:var(--r-primary)">Quick Parts — ' + (entry.title || stateKey) + '</h3>'
            + '<p style="color:var(--r-grey);font-size:.9em;margin-bottom:14px">Choisissez un bloc pré-rédigé à insérer dans le champ. Vous pourrez ensuite le modifier.</p>';
        entry.quickparts.forEach(function (qp) {
            var preview = wpFillTemplate(qp.text, _wpState || {}).substring(0, 160).replace(/\n/g, ' ');
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn';
            btn.style.cssText = 'display:block;width:100%;text-align:left;margin-bottom:8px;padding:12px;border:1px solid var(--r-border);background:#F8FAFC;color:#1F2937;white-space:normal';
            btn.innerHTML = '<strong>' + qp.label + '</strong><br><span style="font-size:.85em;color:var(--r-grey)">' + preview + '…</span>';
            btn.onclick = function () {
                var text = wpFillTemplate(qp.text, _wpState || {});
                ta.value = text;
                _wpState = wpCollectFormData();
                _wpDirty = true;
                wpUpdateStatusIndicators();
                wpUpdateProgress();
                wordPlusAutoSave();
                modal.remove();
                wpToast('Quick Part « ' + qp.label + ' » inséré');
            };
            box.appendChild(btn);
        });
        var cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'btn';
        cancel.textContent = 'Annuler';
        cancel.style.cssText = 'margin-top:8px;background:#E5E7EB;color:#1F2937';
        cancel.onclick = function () { modal.remove(); };
        box.appendChild(cancel);
        modal.appendChild(box);
        modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);
    }

    function wpShowUndoEnhance(fieldId, fieldLabel, ta) {
        var outputField = ta.closest('.output-field');
        if (!outputField) return;
        var btnsDiv = outputField.querySelector('.output-field-btns');
        if (!btnsDiv) return;
        var existing = btnsDiv.querySelector('.btn-undo-enhance');
        if (existing) existing.remove();
        var undoBtn = document.createElement('button');
        undoBtn.type = 'button';
        undoBtn.className = 'btn btn-sm btn-undo-enhance';
        undoBtn.textContent = '↶ Annuler';
        undoBtn.style.cssText = 'background:#64748B;color:#fff';
        undoBtn.onclick = function () {
            if (_wpEnhanceOriginals[fieldId] !== undefined) {
                ta.value = _wpEnhanceOriginals[fieldId];
                _wpState = wpCollectFormData();
                _wpDirty = true;
                delete _wpEnhanceOriginals[fieldId];
                wpUpdateStatusIndicators();
                wordPlusAutoSave();
                wpToast(fieldLabel + ' — texte initial restauré');
                undoBtn.remove();
            }
        };
        btnsDiv.appendChild(undoBtn);
    }

    /* ──── Exports ──── */
    global.initWordPlus = initWordPlus;
    global.wpCollectFormData = wpCollectFormData;
    global.wordPlusAutoSave = wordPlusAutoSave;
    global.wpReloadFromProject = wpReloadFromProject;
    global.wpGenerate = wpGenerate;
    global.wpCheckTemplate = wpCheckTemplate;
    global.wpUpdateStatusIndicators = wpUpdateStatusIndicators;
    global.wpUpdateProgress = wpUpdateProgress;
    global.wpLoadTemplates = wpLoadTemplates;
    global.wpFillTemplate = wpFillTemplate;
    global.wpApplyDefaultTexts = wpApplyDefaultTexts;
    global.wpOnRecoVarianteChange = wpOnRecoVarianteChange;
    global.wpResetField = wpResetField;
    global.wpEnhance = wpEnhance;
    global.wpOpenQuickPartPicker = wpOpenQuickPartPicker;

})(typeof window !== 'undefined' ? window : this);
