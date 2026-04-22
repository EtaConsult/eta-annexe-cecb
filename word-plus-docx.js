/* ════════════════════════════════════════════════════════════
 * word-plus-docx.js
 * Rendu du .docx via docxtemplater (PizZip + docxtemplater 3.x) et téléchargement.
 * - wpRenderDocx(data) : charge le template, applique les données, déclenche le download
 * - wpBuildVariantesXml(checks, names) : fragment <w:tbl> injecté via tag {@tableauVariantes}
 * - wpBuildBasesRows(basesObj)          : rows pour la boucle {#basesRows}…{/basesRows}
 * ════════════════════════════════════════════════════════════ */

(function (global) {
    'use strict';

    var TEMPLATE_PATH = 'templates/cecb_plus_template.docx';

    /* ──── Libellés et ordre des lignes du tableau Bases Documents ──── */
    var WP_BASES_LABELS = {
        plan:        'Plan',
        facade:      'Vue de la façade',
        coupe:       'Coupe',
        consoElec:   'Consommation d\u2019électricité',
        consoChauff: 'Consommation de chauffage',
        autres:      'Autres'
    };

    var WP_BASES_ORDER = ['plan', 'facade', 'coupe', 'consoElec', 'consoChauff', 'autres'];

    /* ──── Libellés et ordre des lignes du tableau variantes ──── */
    // Utilise WP_VAR_MAPPING de word-plus-project.js (disponible globalement).
    function _wpVarRows() {
        return (typeof WP_VAR_MAPPING !== 'undefined') ? WP_VAR_MAPPING : [];
    }

    /* ──── Fragment XML OOXML pour le tableau variantes ──── */
    // Construit une <w:tbl> autonome avec 4 colonnes (Intervention / V1 / V2 / V3).
    // Injecté dans le template via {@tableauVariantes} (tag rawxml docxtemplater 3.x).
    function wpBuildVariantesXml(checks, variantNames) {
        checks = checks || {};
        variantNames = variantNames || ['Variante 1', 'Variante 2', 'Variante 3'];
        var rows = _wpVarRows();
        if (!rows.length) return '';

        var xml = '<w:tbl xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">';
        xml += '<w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>'
            + '<w:top w:val="single" w:sz="4" w:color="auto"/>'
            + '<w:left w:val="single" w:sz="4" w:color="auto"/>'
            + '<w:bottom w:val="single" w:sz="4" w:color="auto"/>'
            + '<w:right w:val="single" w:sz="4" w:color="auto"/>'
            + '<w:insideH w:val="single" w:sz="4" w:color="auto"/>'
            + '<w:insideV w:val="single" w:sz="4" w:color="auto"/>'
            + '</w:tblBorders></w:tblPr>';

        // Ligne d'en-tête
        xml += '<w:tr>'
            + _wpHeaderCell('Intervention', true, 'start')
            + _wpHeaderCell(variantNames[0] || 'Variante 1', true, 'center')
            + _wpHeaderCell(variantNames[1] || 'Variante 2', true, 'center')
            + _wpHeaderCell(variantNames[2] || 'Variante 3', true, 'center')
            + '</w:tr>';

        // Groupement par section
        var currentGroup = null;
        rows.forEach(function (row) {
            if (row.group !== currentGroup) {
                currentGroup = row.group;
                var label = ({ enveloppe: 'Enveloppe du bâtiment', technique: 'Technique du bâtiment', electricite: 'Électricité' }[row.group]) || row.group;
                xml += '<w:tr>'
                    + '<w:tc><w:tcPr><w:gridSpan w:val="4"/><w:shd w:val="clear" w:color="auto" w:fill="E5E7EB"/></w:tcPr>'
                    + '<w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">' + _wpEscapeXml(label) + '</w:t></w:r></w:p>'
                    + '</w:tc></w:tr>';
            }
            var ck = checks[row.wpKey] || [false, false, false];
            xml += '<w:tr>'
                + _wpCell(row.label, 'start')
                + _wpCell(ck[0] ? '\u2713' : '', 'center')
                + _wpCell(ck[1] ? '\u2713' : '', 'center')
                + _wpCell(ck[2] ? '\u2713' : '', 'center')
                + '</w:tr>';
        });

        xml += '</w:tbl>';
        return xml;
    }

    function _wpHeaderCell(text, bold, align) {
        var runProps = bold ? '<w:rPr><w:b/></w:rPr>' : '';
        return '<w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="D1D5DB"/></w:tcPr>'
            + '<w:p><w:pPr><w:jc w:val="' + (align || 'start') + '"/></w:pPr>'
            + '<w:r>' + runProps + '<w:t xml:space="preserve">' + _wpEscapeXml(text || '') + '</w:t></w:r></w:p></w:tc>';
    }

    function _wpCell(text, align) {
        return '<w:tc>'
            + '<w:p><w:pPr><w:jc w:val="' + (align || 'start') + '"/></w:pPr>'
            + '<w:r><w:t xml:space="preserve">' + _wpEscapeXml(text || '') + '</w:t></w:r></w:p></w:tc>';
    }

    function _wpEscapeXml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /* ──── Lignes pour la boucle Bases Documents ──── */
    function wpBuildBasesRows(basesObj) {
        basesObj = basesObj || {};
        return WP_BASES_ORDER.map(function (key) {
            return {
                key: key,
                label: WP_BASES_LABELS[key],
                statut: basesObj[key] || 'Non transmis'
            };
        });
    }

    /* ──── Rendu principal ──── */
    async function wpRenderDocx(data) {
        if (typeof PizZip === 'undefined' || typeof window.docxtemplater === 'undefined') {
            throw new Error('Bibliothèques PizZip/docxtemplater non chargées');
        }
        if (typeof saveAs === 'undefined') {
            throw new Error('FileSaver non chargé');
        }

        // 1. Charge le template
        var resp = await fetch(TEMPLATE_PATH);
        if (!resp.ok) {
            throw new Error('Template introuvable à ' + TEMPLATE_PATH + ' (HTTP ' + resp.status + '). Voir templates/README.md.');
        }
        var buf = await resp.arrayBuffer();

        // 2. Prépare le contexte
        var ctx = Object.assign({}, data);
        ctx.tableauVariantes = wpBuildVariantesXml(ctx.variantsCheck, ctx.variantNames);
        ctx.basesRows = wpBuildBasesRows(ctx.bases);
        ctx.hasIntroduction = !!(ctx.introduction && String(ctx.introduction).trim());
        ctx.hasResume = !!(ctx.resume && String(ctx.resume).trim());
        ctx.hasRemarques = !!(ctx.remarques && String(ctx.remarques).trim());

        // Formate la date en FR pour affichage
        ctx.dateRapportFr = wpFormatDateFr(ctx.dateRapport);
        ctx.dateVisiteFr = wpFormatDateFr(ctx.dateVisite);

        // 3. Render
        var zip, doc;
        try {
            zip = new PizZip(buf);
        } catch (e) {
            throw new Error('Template .docx invalide : ' + e.message);
        }
        try {
            doc = new window.docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
                delimiters: { start: '{{', end: '}}' }
            });
        } catch (e) {
            throw new Error('Initialisation docxtemplater échouée : ' + e.message);
        }

        try {
            doc.render(ctx);
        } catch (e) {
            var errs = (e && e.properties && e.properties.errors) || [];
            var details = errs.length
                ? errs.map(function (x) {
                      return (x.properties && (x.properties.explanation || x.properties.id)) || x.message || String(x);
                  }).join(' · ')
                : (e.message || String(e));
            throw new Error('Erreur template : ' + details);
        }

        // 4. Génère le blob et télécharge
        var blob = doc.getZip().generate({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });
        var numPart = (ctx.numCecb || 'rapport').replace(/[^\w.-]/g, '_');
        var datePart = (ctx.dateRapport || '').replace(/-/g, '');
        var filename = 'CECB_Plus_' + numPart + (datePart ? '_' + datePart : '') + '.docx';
        saveAs(blob, filename);
        return { filename: filename, size: blob.size };
    }

    /* ──── Utilitaires ──── */
    function wpFormatDateFr(iso) {
        if (!iso) return '';
        var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return iso;
        return m[3] + '.' + m[2] + '.' + m[1];
    }

    /* ──── Exports ──── */
    global.wpRenderDocx = wpRenderDocx;
    global.wpBuildVariantesXml = wpBuildVariantesXml;
    global.wpBuildBasesRows = wpBuildBasesRows;
    global.wpFormatDateFr = wpFormatDateFr;
    global.WP_BASES_LABELS = WP_BASES_LABELS;
    global.WP_BASES_ORDER = WP_BASES_ORDER;

})(typeof window !== 'undefined' ? window : this);
