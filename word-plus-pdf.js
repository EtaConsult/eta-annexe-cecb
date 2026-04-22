/* ════════════════════════════════════════════════════════════
 * word-plus-pdf.js — extraction de données depuis un PDF CECB officiel.
 *
 * wpParsePdf(file) → Promise({
 *   numCecb, classeEnv, classeGlob, classeCo2, annee, sre, affectation,
 *   adresse, commune, egid, dateVisite, dateRapport,
 *   chaufSource, chaufYear,
 *   consoMazout, consoGaz, consoElec,
 *   valeursU:{ toit, mursExt, mursNc, fenetres, solNc },
 *   surfaces:{ toit, murs, fenetres, sol },
 *   pertesKwh:{ toit, murs, fenetres, sol, ventilation, chauffage, ecs, appareils },
 *   _raw
 * })
 * ════════════════════════════════════════════════════════════ */

(function (global) {
    'use strict';

    /* ──── Lecture PDF via pdf.js ──── */
    async function wpExtractPdfText(file) {
        if (!global.pdfjsLib) throw new Error('pdf.js non chargé');
        var buf = await file.arrayBuffer();
        var pdf = await global.pdfjsLib.getDocument({ data: buf }).promise;
        var pages = [];
        for (var i = 1; i <= pdf.numPages; i++) {
            var page = await pdf.getPage(i);
            var content = await page.getTextContent();
            // Conserve les items avec leur position pour pouvoir reconstruire le layout
            pages.push({
                text: content.items.map(function (x) { return x.str; }).join(' '),
                items: content.items
            });
        }
        return pages;
    }

    /* ──── Utilitaires ──── */
    function _cleanNum(s) {
        return String(s || '').trim().replace(/[\u2019\u2018'\s]/g, '');
    }
    function _cleanStr(s) {
        return String(s || '').trim().replace(/\s+/g, ' ');
    }

    /* Patterns regex sur le texte complet */
    var WP_PDF_PATTERNS = {
        numCecb:     /\b(VD-\d{5,8}\.\d{2}|GE-\d{5,8}\.\d{2}|FR-\d{5,8}\.\d{2}|NE-\d{5,8}\.\d{2}|VS-\d{5,8}\.\d{2}|JU-\d{5,8}\.\d{2}|BE-\d{5,8}\.\d{2})\b/,
        annee:       /[Aa]nn[ée]e\s+de\s+construction\s+(\d{4})/,
        egid:        /EGID[_\s\-]*EDID\s+(\d+_?\d*)/i,
        dateVisite:  /Date\s+de\s+la\s+visite\s+(\d{2}\.\d{2}\.\d{4})/,
        dateRapport: /Date[^\n]{0,40}signature\s+(\d{2}\.\d{2}\.\d{4})/,
        affectation: /Affectation\s+du\s+b[aâ]timent\s+([A-Za-zÀ-ÿ].{2,60}?\(Cat\.\s*[IVX]+\))/,
        commune:     /Commune\s*:\s*([A-Za-zÀ-ÿ\-\s]{2,40})/,
        sre:         /Surface\s+de\s+r[ée]f[ée]rence\s+[ée]nerg[ée]tique[^\d]*(\d+)/i,
        indiceEnv:   /[Ee]fficacit[ée]\s+de\s+l'enveloppe[^\d]*(\d+)\s+kWh\/\(m.?a\)/,
        indiceGlob:  /[Ee]fficacit[ée]\s+[ée]nerg[ée]tique\s+globale[^\d]*(\d+)\s+kWh\/\(m.?a\)/,
        indiceCo2:   /[ÉE]missions\s+directes\s+de\s+CO[2\u2082]?[^\d]*(\d+)\s+kg\/\(m.?a\)/
    };

    /* Les classes A-G sont indiquées en marge du texte d'évaluation, souvent isolées.
     * Stratégie robuste : on cherche la classe UNE SEULE lettre en majuscule qui APPARAÎT
     * sur une ligne contenant le libellé "Efficacité de l'enveloppe", etc. */
    function _extractClasses(pages) {
        var page1 = pages[0] || { text: '' };
        var text = page1.text;
        var out = { classeEnv: '', classeGlob: '', classeCo2: '' };

        // Pattern : la lettre de classe (A-G) apparaît souvent juste avant le libellé ou dans un bloc voisin
        // On cherche dans les 300 caractères qui précèdent chaque libellé
        function findClassBefore(label) {
            var idx = text.indexOf(label);
            if (idx < 0) return '';
            var before = text.substring(Math.max(0, idx - 400), idx);
            // Cherche la dernière lettre A-G isolée (entourée d'espaces ou en début)
            var matches = before.match(/(?:^|\s)([A-G])(?:\s|$)/g);
            if (matches && matches.length > 0) {
                return matches[matches.length - 1].trim();
            }
            return '';
        }
        out.classeEnv = findClassBefore('Efficacité de l\'enveloppe du bâtiment');
        if (!out.classeEnv) out.classeEnv = findClassBefore('Efficacit');
        out.classeGlob = findClassBefore('Efficacité énergétique globale');
        if (!out.classeGlob) {
            var m = text.match(/[Ee]fficacit[eé]\s+[eé]nerg[eé]tique\s+globale[\s\S]{0,300}?\b([A-G])\b/);
            if (m) out.classeGlob = m[1];
        }
        out.classeCo2 = findClassBefore('Émissions directes');
        if (!out.classeCo2) {
            var c = text.match(/[ÉE]missions\s+directes\s+de\s+CO[\s\S]{0,300}?\b([A-G])\b/);
            if (c) out.classeCo2 = c[1];
        }
        return out;
    }

    /* Adresse : "Route de Bénex 33" + "1197 Prangins" */
    function _extractAdresse(text) {
        var m = text.match(/Adresse[\s\S]{0,100}?([A-Za-zÀ-ÿ][\w\-\s]{2,50}\s+\d{1,4}[a-z]?)[\s\S]{0,50}?(\d{4}\s+[A-Za-zÀ-ÿ\-\s]{2,40})/);
        if (m) return _cleanStr(m[1]) + ', ' + _cleanStr(m[2]);
        return '';
    }

    /* Valeurs U — le tableau est en page 6. Structure approximative :
     *   Toit          0.53           -
     *   Murs          0.63           1.7
     *   Fenêtres..    1.3            -
     *   Sol             -            1.3
     */
    function _extractValeursU(text) {
        var out = { toit: '', mursExt: '', mursNc: '', mursTerre: '', fenetres: '', solExt: '', solNc: '' };
        // Toit
        var t = text.match(/Toit\s+(\d[.,]\d{1,2})\s+([-\u2013]|\d[.,]\d{1,2})/);
        if (t) { out.toit = t[1].replace(',', '.'); if (t[2] && t[2] !== '-' && t[2] !== '\u2013') out.toit = t[1].replace(',', '.'); }
        // Murs (2 colonnes : extérieur / non chauffé)
        var m = text.match(/Murs\s+(\d[.,]\d{1,2})\s+([-\u2013]|\d[.,]\d{1,2})/);
        if (m) {
            out.mursExt = m[1].replace(',', '.');
            if (m[2] && m[2] !== '-' && m[2] !== '\u2013') out.mursNc = m[2].replace(',', '.');
        }
        // Fenêtres
        var f = text.match(/Fen[êe]tres(?:\s+et\s+portes)?\s+(\d[.,]\d{1,2})/);
        if (f) out.fenetres = f[1].replace(',', '.');
        // Sol
        var s = text.match(/Sol\s+([-\u2013]|\d[.,]\d{1,2})\s+([-\u2013]|\d[.,]\d{1,2})/);
        if (s) {
            if (s[1] && s[1] !== '-' && s[1] !== '\u2013') out.solExt = s[1].replace(',', '.');
            if (s[2] && s[2] !== '-' && s[2] !== '\u2013') out.solNc = s[2].replace(',', '.');
        }
        return out;
    }

    /* Pertes kWh par élément (page 1, bloc Évaluation) */
    function _extractPertes(text) {
        var out = { toit: '', murs: '', fenetres: '', sol: '', ventilation: '', chauffage: '', ecs: '', appareils: '' };
        function findKwh(label) {
            var re = new RegExp(label + '\\s+(\\d{1,3}(?:[\u2019\u2018\'\\s]?\\d{3})*)\\s*kWh', 'i');
            var m = text.match(re);
            return m ? _cleanNum(m[1]) : '';
        }
        out.toit = findKwh('Toit');
        out.murs = findKwh('Murs');
        out.fenetres = findKwh('Fen[êe]tres');
        out.sol = findKwh('Sol');
        out.ventilation = findKwh('Ventilation');
        out.chauffage = findKwh('Chauffage');
        out.ecs = findKwh('Eau\\s+[Cc]haude');
        out.appareils = findKwh('Appareils\\s+et\\s+[ée]clairage');
        return out;
    }

    /* Consommation mesurée (page 7, bloc Énergie) */
    function _extractConso(text) {
        var out = { mazout: '', gaz: '', elec: '' };
        // "Mazout 41'610" avec apostrophe typographique
        var m = text.match(/Mazout[^\d]*(\d{1,3}(?:[\u2019\u2018'\s]?\d{3})*)/);
        if (m) out.mazout = _cleanNum(m[1]);
        var g = text.match(/[Gg]az\s+naturel[^\d]*(\d{1,3}(?:[\u2019\u2018'\s]?\d{3})*)/);
        if (g) out.gaz = _cleanNum(g[1]);
        var e = text.match(/[ÉE]lectricit[ée][^\d]*(\d{1,3}(?:[\u2019\u2018'\s]?\d{3})*)/);
        if (e) out.elec = _cleanNum(e[1]);
        return out;
    }

    /* Source de chauffage */
    function _extractChauffage(text) {
        var out = { chaufSource: '', chaufYear: '' };
        // Priorités : Mazout condensation > Gaz condensation > PAC > CAD > électrique
        if (/[Cc]haudi[èe]re\s+[àa]\s+mazout\s+[àa]\s+condensation/.test(text)) out.chaufSource = 'mazout';
        else if (/[Cc]haudi[èe]re\s+[àa]\s+gaz/.test(text)) out.chaufSource = 'gaz';
        else if (/[Pp]ompe\s+[àa]\s+chaleur\s+(?:air|eau|sol)/.test(text)) out.chaufSource = 'pac_air';
        else if (/[Cc]hauffage\s+[àa]\s+distance|CAD/.test(text)) out.chaufSource = 'cad';
        else if (/[Cc]haudi[èe]re\s+[àa]\s+pellets?/.test(text)) out.chaufSource = 'bois_pellets';
        else if (/[Cc]hauffage\s+[ée]lectrique/.test(text)) out.chaufSource = 'elec_central';
        // Année installation : proche du type de chauffage
        var m = text.match(/install[ée]e?\s+en\s+(\d{4})/);
        if (m) out.chaufYear = m[1];
        return out;
    }

    /* ──── Fonction principale ──── */
    async function wpParsePdf(file) {
        var pages = await wpExtractPdfText(file);
        var text = pages.map(function (p) { return p.text; }).join('\n');

        var out = { _raw: text };

        // Patterns simples
        Object.keys(WP_PDF_PATTERNS).forEach(function (k) {
            var m = text.match(WP_PDF_PATTERNS[k]);
            out[k] = m ? _cleanStr(m[1]) : '';
        });

        // Classes A-G (page 1)
        var classes = _extractClasses(pages);
        out.classeEnv = classes.classeEnv;
        out.classeGlob = classes.classeGlob;
        out.classeCo2 = classes.classeCo2;

        // Adresse complète
        out.adresse = _extractAdresse(text);

        // Valeurs U, surfaces, pertes, conso, chauffage
        out.valeursU = _extractValeursU(text);
        out.surfaces = { toit: '', murs: '', fenetres: '', sol: '' }; // non extractibles actuellement
        out.pertesKwh = _extractPertes(text);
        var conso = _extractConso(text);
        out.consoMazout = conso.mazout;
        out.consoGaz = conso.gaz;
        out.consoElec = conso.elec;
        var chauf = _extractChauffage(text);
        out.chaufSource = chauf.chaufSource;
        out.chaufYear = chauf.chaufYear;

        return out;
    }

    /* ──── Fallback Claude (optionnel — appelé depuis word-plus.js si regex échouent) ──── */
    async function wpClaudeExtract(rawText) {
        if (typeof CecbApi === 'undefined') throw new Error('API non disponible');
        var prompt = 'Extrais les champs suivants du texte CECB ci-dessous et renvoie UNIQUEMENT un JSON valide :\n'
            + '{\n'
            + '  "numCecb": "VD-XXXXXXXX.XX",\n'
            + '  "classeEnv": "A-G", "classeGlob": "A-G", "classeCo2": "A-G",\n'
            + '  "annee": "YYYY", "sre": "XXX",\n'
            + '  "consoMazout": "XXXXX", "consoGaz": "XXXXX", "consoElec": "XXXXX",\n'
            + '  "chaufSource": "mazout|gaz|pac_air|cad|elec_central|bois_pellets",\n'
            + '  "chaufYear": "YYYY",\n'
            + '  "valeursU": { "toit":"0.XX", "mursExt":"0.XX", "fenetres":"0.XX", "solNc":"0.XX" }\n'
            + '}\n\nTEXTE :\n' + rawText.substring(0, 8000);
        var resp = await CecbApi.callClaude({
            system: 'Tu extrais des données structurées de rapports CECB suisses. Réponds uniquement avec un JSON valide, sans markdown.',
            userMessage: prompt,
            maxTokens: 1024
        });
        try {
            var cleaned = String(resp).replace(/```json\s*|\s*```/g, '').trim();
            return JSON.parse(cleaned);
        } catch (e) {
            throw new Error('Réponse Claude non parsable : ' + e.message);
        }
    }

    /* ──── Exports ──── */
    global.wpParsePdf = wpParsePdf;
    global.wpExtractPdfText = wpExtractPdfText;
    global.wpClaudeExtract = wpClaudeExtract;

})(typeof window !== 'undefined' ? window : this);
