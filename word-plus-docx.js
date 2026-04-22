/* ════════════════════════════════════════════════════════════
 * word-plus-docx.js
 * Modifie directement le .docx vierge CECB Plus uploadé par l'utilisateur,
 * sans template pré-préparé. Approche : décompression via PizZip, parsing
 * XML du document.xml, insertion/remplacement de paragraphes, ré-zippage,
 * téléchargement via FileSaver.
 *
 * wpRenderDocx(data) — point d'entrée appelé par le bouton Générer.
 *   data doit contenir `_docxBuffer` (ArrayBuffer du vierge uploadé).
 * ════════════════════════════════════════════════════════════ */

(function (global) {
    'use strict';

    var W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

    /* ──── Labels du tableau Bases Documents ──── */
    var WP_BASES_LABELS = {
        plan:        'Plan',
        facade:      'Vue de la façade',
        coupe:       'Coupe',
        consoElec:   'Consommation d\u2019électricité',
        consoChauff: 'Consommation de chauffage',
        autres:      'Autres'
    };
    var WP_BASES_ORDER = ['plan', 'facade', 'coupe', 'consoElec', 'consoChauff', 'autres'];

    /* ──── Utilitaires XML ──── */

    function _parseDocXml(xmlString) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(xmlString, 'application/xml');
        if (doc.getElementsByTagName('parsererror').length) {
            throw new Error('XML document.xml invalide');
        }
        return doc;
    }

    function _serializeXml(doc) {
        // Garde la déclaration XML originale
        var serializer = new XMLSerializer();
        var xml = serializer.serializeToString(doc);
        if (xml.indexOf('<?xml') !== 0) {
            xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + xml;
        }
        return xml;
    }

    /* Récupère tout le texte d'un paragraphe <w:p> (concat des <w:t>) */
    function _paraText(para) {
        var texts = para.getElementsByTagNameNS(W_NS, 't');
        var out = '';
        for (var i = 0; i < texts.length; i++) out += texts[i].textContent;
        return out;
    }

    /* Trouve le premier <w:p> dont le texte matche (substring, case-insensitive) */
    function _findParaByText(doc, needle, fromIndex) {
        var paras = doc.getElementsByTagNameNS(W_NS, 'p');
        var n = String(needle || '').toLowerCase();
        var start = fromIndex || 0;
        for (var i = start; i < paras.length; i++) {
            if (_paraText(paras[i]).toLowerCase().indexOf(n) !== -1) return { para: paras[i], index: i };
        }
        return null;
    }

    /* Trouve tous les <w:p> matchant */
    function _findAllParasByText(doc, needle) {
        var paras = doc.getElementsByTagNameNS(W_NS, 'p');
        var n = String(needle || '').toLowerCase();
        var out = [];
        for (var i = 0; i < paras.length; i++) {
            if (_paraText(paras[i]).toLowerCase().indexOf(n) !== -1) out.push({ para: paras[i], index: i });
        }
        return out;
    }

    /* Crée un paragraphe simple texte (un seul run, style Normal) */
    function _makeTextPara(doc, text, opts) {
        opts = opts || {};
        var p = doc.createElementNS(W_NS, 'w:p');
        if (opts.styleId) {
            var pPr = doc.createElementNS(W_NS, 'w:pPr');
            var pStyle = doc.createElementNS(W_NS, 'w:pStyle');
            pStyle.setAttributeNS(W_NS, 'w:val', opts.styleId);
            pPr.appendChild(pStyle);
            p.appendChild(pPr);
        }
        // Gère les retours à la ligne : chaque \n = <w:br/>
        var lines = String(text == null ? '' : text).split(/\r?\n/);
        var r = doc.createElementNS(W_NS, 'w:r');
        if (opts.bold || opts.italic) {
            var rPr = doc.createElementNS(W_NS, 'w:rPr');
            if (opts.bold) rPr.appendChild(doc.createElementNS(W_NS, 'w:b'));
            if (opts.italic) rPr.appendChild(doc.createElementNS(W_NS, 'w:i'));
            r.appendChild(rPr);
        }
        lines.forEach(function (line, i) {
            if (i > 0) r.appendChild(doc.createElementNS(W_NS, 'w:br'));
            var t = doc.createElementNS(W_NS, 'w:t');
            t.setAttribute('xml:space', 'preserve');
            t.textContent = line;
            r.appendChild(t);
        });
        p.appendChild(r);
        return p;
    }

    /* Crée un paragraphe heading (style Heading1/Heading2) */
    function _makeHeadingPara(doc, text, level) {
        var p = _makeTextPara(doc, text, { styleId: 'Heading' + (level || 2), bold: true });
        return p;
    }

    /* Insère un ou plusieurs paragraphes après un paragraphe donné */
    function _insertAfter(parent, newNode, refNode) {
        if (refNode.nextSibling) parent.insertBefore(newNode, refNode.nextSibling);
        else parent.appendChild(newNode);
    }

    /* Convertit un texte multi-lignes en plusieurs paragraphes (découpe sur double-\n) */
    function _textToParas(doc, text, opts) {
        var paragraphs = String(text || '').split(/\n\s*\n/);
        return paragraphs.map(function (p) { return _makeTextPara(doc, p.trim(), opts || {}); });
    }

    /* ──── Opérations de haut niveau ──── */

    /* Remplacement texte dans tous les <w:t> (pour civilité, numCecb, dates, etc.) */
    function _replaceInDoc(doc, searchValue, replaceValue) {
        if (!searchValue) return 0;
        var count = 0;
        var texts = doc.getElementsByTagNameNS(W_NS, 't');
        for (var i = 0; i < texts.length; i++) {
            var orig = texts[i].textContent;
            if (orig.indexOf(searchValue) !== -1) {
                texts[i].textContent = orig.split(searchValue).join(replaceValue);
                count++;
            }
        }
        return count;
    }

    /* Insère un bloc "Introduction" après le paragraphe "Table des matières"
       ou après le dernier paragraphe du TOC. Si anchor introuvable, insertion
       avant le paragraphe contenant "Résumé". */
    function _insertIntroduction(doc, text) {
        if (!text || !text.trim()) return;
        // Cherche ancre : "Table des matières" d'abord, sinon avant "Résumé"
        var tocMatch = _findParaByText(doc, 'Table des matières');
        var anchor;
        if (tocMatch) {
            // Trouve le dernier paragraphe avant la prochaine section "Résumé"
            var resumeMatch = _findParaByText(doc, 'Résumé', tocMatch.index + 1);
            if (resumeMatch) {
                anchor = resumeMatch.para;
                // Insère AVANT le paragraphe Résumé (= nouvelle section Introduction)
                var parent = anchor.parentNode;
                var heading = _makeHeadingPara(doc, 'Introduction', 1);
                parent.insertBefore(heading, anchor);
                _textToParas(doc, text).forEach(function (p) { parent.insertBefore(p, anchor); });
                return;
            }
        }
        // Fallback : insère en tête de body
        var body = doc.getElementsByTagNameNS(W_NS, 'body')[0];
        if (body && body.firstChild) {
            var heading2 = _makeHeadingPara(doc, 'Introduction', 1);
            body.insertBefore(heading2, body.firstChild);
            _textToParas(doc, text).forEach(function (p) { body.insertBefore(p, body.firstChild.nextSibling); });
        }
    }

    /* Insère le résumé enrichi après le premier paragraphe de la section "Résumé" */
    function _insertResume(doc, text) {
        if (!text || !text.trim()) return;
        // On cherche le paragraphe contenant "destiné en premier lieu au propriétaire"
        // qui est la phrase standard du résumé
        var match = _findParaByText(doc, 'destiné en premier lieu au propriétaire');
        if (!match) match = _findParaByText(doc, 'privilégiez le chapitre');
        if (!match) return;
        var anchor = match.para;
        var parent = anchor.parentNode;
        var paras = _textToParas(doc, text);
        // Insère après l'ancre
        var inserted = 0;
        paras.forEach(function (p, i) {
            if (i === 0) _insertAfter(parent, p, anchor);
            else _insertAfter(parent, p, paras[i - 1]);
            inserted++;
        });
    }

    /* Insère un commentaire après le paragraphe "Classe actuelle" d'une section spécifique */
    function _insertCommentAfterClasseActuelle(doc, text, sectionKeyword) {
        if (!text || !text.trim()) return;
        // Stratégie : trouver d'abord une ancre de section (ex "Efficacité de l'enveloppe")
        // puis à partir de là, le prochain "Classe actuelle".
        var sectionMatch = _findParaByText(doc, sectionKeyword);
        if (!sectionMatch) return;
        var classeMatch = _findParaByText(doc, 'Classe actuelle', sectionMatch.index);
        if (!classeMatch) return;
        // Insère APRÈS le paragraphe "Classe actuelle"
        var parent = classeMatch.para.parentNode;
        var paras = _textToParas(doc, text);
        paras.forEach(function (p, i) {
            var ref = (i === 0) ? classeMatch.para : paras[i - 1];
            _insertAfter(parent, p, ref);
        });
    }

    /* Remplace le paragraphe type "L'expert·e CECB peut ajouter..." par le texte de recommandation */
    function _replaceRecommendation(doc, text) {
        if (!text || !text.trim()) return;
        var matches = _findAllParasByText(doc, 'expert·e CECB peut ajouter');
        if (!matches.length) return;
        // Première occurrence = recommandation principale
        var match = matches[0];
        var anchor = match.para;
        var parent = anchor.parentNode;
        // Retire l'ancien paragraphe
        var prev = anchor.previousSibling;
        parent.removeChild(anchor);
        // Insère les nouveaux
        var paras = _textToParas(doc, text);
        paras.forEach(function (p, i) {
            if (i === 0) {
                if (prev && prev.nextSibling) parent.insertBefore(p, prev.nextSibling);
                else parent.appendChild(p);
            } else {
                _insertAfter(parent, p, paras[i - 1]);
            }
        });
    }

    /* Insère les remarques générales après le paragraphe "Remarques générales" heading */
    function _insertRemarques(doc, text) {
        if (!text || !text.trim()) return;
        var match = _findParaByText(doc, 'Remarques générales');
        if (!match) return;
        var parent = match.para.parentNode;
        var paras = _textToParas(doc, text);
        paras.forEach(function (p, i) {
            var ref = (i === 0) ? match.para : paras[i - 1];
            _insertAfter(parent, p, ref);
        });
    }

    /* Insère un tableau récapitulatif des variantes juste avant "Les variantes suivantes ont été élaborées" */
    function _insertTableauVariantes(doc, checks, variantNames) {
        if (!checks || !Object.keys(checks).length) return;
        var match = _findParaByText(doc, 'variantes suivantes ont été élaborées');
        if (!match) match = _findParaByText(doc, 'Comparaison des variantes');
        if (!match) return;
        var tbl = _buildVariantesTable(doc, checks, variantNames);
        var parent = match.para.parentNode;
        parent.insertBefore(tbl, match.para);
    }

    function _buildVariantesTable(doc, checks, names) {
        names = names || ['Variante 1', 'Variante 2', 'Variante 3'];
        var rows = (typeof WP_VAR_MAPPING !== 'undefined') ? WP_VAR_MAPPING : [];

        var tbl = doc.createElementNS(W_NS, 'w:tbl');
        // tblPr
        var tblPr = doc.createElementNS(W_NS, 'w:tblPr');
        var tblW = doc.createElementNS(W_NS, 'w:tblW');
        tblW.setAttributeNS(W_NS, 'w:w', '5000');
        tblW.setAttributeNS(W_NS, 'w:type', 'pct');
        tblPr.appendChild(tblW);
        var tblBorders = doc.createElementNS(W_NS, 'w:tblBorders');
        ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].forEach(function (b) {
            var el = doc.createElementNS(W_NS, 'w:' + b);
            el.setAttributeNS(W_NS, 'w:val', 'single');
            el.setAttributeNS(W_NS, 'w:sz', '4');
            el.setAttributeNS(W_NS, 'w:color', 'auto');
            tblBorders.appendChild(el);
        });
        tblPr.appendChild(tblBorders);
        tbl.appendChild(tblPr);

        // Header
        var headerRow = doc.createElementNS(W_NS, 'w:tr');
        [_tableCell(doc, 'Intervention', { header: true, align: 'start' }),
         _tableCell(doc, names[0] || 'V1', { header: true, align: 'center' }),
         _tableCell(doc, names[1] || 'V2', { header: true, align: 'center' }),
         _tableCell(doc, names[2] || 'V3', { header: true, align: 'center' })
        ].forEach(function (c) { headerRow.appendChild(c); });
        tbl.appendChild(headerRow);

        // Rows groupées
        var currentGroup = null;
        var groupLabels = { enveloppe: 'Enveloppe du bâtiment', technique: 'Technique du bâtiment', electricite: 'Électricité' };
        rows.forEach(function (r) {
            if (r.group !== currentGroup) {
                currentGroup = r.group;
                var groupRow = doc.createElementNS(W_NS, 'w:tr');
                groupRow.appendChild(_tableCell(doc, groupLabels[r.group] || r.group, { bold: true, span: 4, shading: 'E5E7EB' }));
                tbl.appendChild(groupRow);
            }
            var ck = checks[r.wpKey] || [false, false, false];
            var row = doc.createElementNS(W_NS, 'w:tr');
            row.appendChild(_tableCell(doc, r.label, { align: 'start' }));
            row.appendChild(_tableCell(doc, ck[0] ? '\u2713' : '', { align: 'center' }));
            row.appendChild(_tableCell(doc, ck[1] ? '\u2713' : '', { align: 'center' }));
            row.appendChild(_tableCell(doc, ck[2] ? '\u2713' : '', { align: 'center' }));
            tbl.appendChild(row);
        });
        return tbl;
    }

    function _tableCell(doc, text, opts) {
        opts = opts || {};
        var tc = doc.createElementNS(W_NS, 'w:tc');
        var tcPr = doc.createElementNS(W_NS, 'w:tcPr');
        if (opts.span) {
            var gs = doc.createElementNS(W_NS, 'w:gridSpan');
            gs.setAttributeNS(W_NS, 'w:val', String(opts.span));
            tcPr.appendChild(gs);
        }
        if (opts.shading) {
            var shd = doc.createElementNS(W_NS, 'w:shd');
            shd.setAttributeNS(W_NS, 'w:val', 'clear');
            shd.setAttributeNS(W_NS, 'w:color', 'auto');
            shd.setAttributeNS(W_NS, 'w:fill', opts.shading);
            tcPr.appendChild(shd);
        }
        tc.appendChild(tcPr);
        var p = doc.createElementNS(W_NS, 'w:p');
        var pPr = doc.createElementNS(W_NS, 'w:pPr');
        if (opts.align) {
            var jc = doc.createElementNS(W_NS, 'w:jc');
            jc.setAttributeNS(W_NS, 'w:val', opts.align);
            pPr.appendChild(jc);
        }
        p.appendChild(pPr);
        var r = doc.createElementNS(W_NS, 'w:r');
        if (opts.bold || opts.header) {
            var rPr = doc.createElementNS(W_NS, 'w:rPr');
            rPr.appendChild(doc.createElementNS(W_NS, 'w:b'));
            r.appendChild(rPr);
        }
        var t = doc.createElementNS(W_NS, 'w:t');
        t.setAttribute('xml:space', 'preserve');
        t.textContent = text || '';
        r.appendChild(t);
        p.appendChild(r);
        tc.appendChild(p);
        return tc;
    }

    /* Remplit le tableau "Bases → Documents" (cellules statut) */
    function _fillBasesDocuments(doc, bases) {
        if (!bases) return;
        // On cherche chaque libellé dans le document et on trouve la cellule sœur
        // C'est une heuristique : dans le vierge, les libellés sont dans un tableau 2 colonnes.
        var tables = doc.getElementsByTagNameNS(W_NS, 'tbl');
        WP_BASES_ORDER.forEach(function (key) {
            var statut = bases[key];
            if (!statut) return;
            var label = WP_BASES_LABELS[key];
            // Cherche une cellule avec ce label dans un tableau
            for (var ti = 0; ti < tables.length; ti++) {
                var rows = tables[ti].getElementsByTagNameNS(W_NS, 'tr');
                for (var ri = 0; ri < rows.length; ri++) {
                    var cells = rows[ri].getElementsByTagNameNS(W_NS, 'tc');
                    if (cells.length < 2) continue;
                    var firstCellText = '';
                    var firstCellParas = cells[0].getElementsByTagNameNS(W_NS, 't');
                    for (var pi = 0; pi < firstCellParas.length; pi++) firstCellText += firstCellParas[pi].textContent;
                    if (firstCellText.trim().toLowerCase() === label.toLowerCase()) {
                        // Remplit la 2e cellule : on écrase tous les w:t existants par un seul
                        var secondCell = cells[1];
                        var secondParas = secondCell.getElementsByTagNameNS(W_NS, 'p');
                        if (secondParas.length > 0) {
                            var firstP = secondParas[0];
                            // Retire tous les enfants sauf pPr
                            Array.prototype.slice.call(firstP.childNodes).forEach(function (n) {
                                if (n.nodeType === 1 && n.localName !== 'pPr') firstP.removeChild(n);
                            });
                            // Ajoute un run avec le statut
                            var r = doc.createElementNS(W_NS, 'w:r');
                            var t = doc.createElementNS(W_NS, 'w:t');
                            t.setAttribute('xml:space', 'preserve');
                            t.textContent = statut;
                            r.appendChild(t);
                            firstP.appendChild(r);
                            // Supprime les autres paragraphes
                            for (var pj = 1; pj < secondParas.length; pj++) {
                                if (secondParas[pj].parentNode) secondParas[pj].parentNode.removeChild(secondParas[pj]);
                            }
                        }
                        return;
                    }
                }
            }
        });
    }

    /* ──── Formateur date FR ──── */
    function wpFormatDateFr(iso) {
        if (!iso) return '';
        var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return iso;
        return m[3] + '.' + m[2] + '.' + m[1];
    }

    /* ──── Construction XML tableau variantes (garde export pour compat) ──── */
    function wpBuildVariantesXml(checks, names) {
        // Retourne un string XML au cas où on en a besoin ailleurs.
        // Ici on l'implémente via DOM pour cohérence, puis sérialise.
        var parser = new DOMParser();
        var tmpDoc = parser.parseFromString('<w:root xmlns:w="' + W_NS + '"/>', 'application/xml');
        var tbl = _buildVariantesTable(tmpDoc, checks, names);
        return new XMLSerializer().serializeToString(tbl);
    }

    function wpBuildBasesRows(basesObj) {
        basesObj = basesObj || {};
        return WP_BASES_ORDER.map(function (key) {
            return { key: key, label: WP_BASES_LABELS[key], statut: basesObj[key] || '' };
        });
    }

    /* ──── Point d'entrée : rendu du .docx modifié ──── */
    async function wpRenderDocx(data) {
        if (typeof PizZip === 'undefined') throw new Error('PizZip non chargé');
        if (typeof saveAs === 'undefined') throw new Error('FileSaver non chargé');
        if (!data || !data._docxBuffer) {
            throw new Error('Aucun .docx vierge n\'a été chargé. Glissez d\'abord le Word généré par l\'outil CECB.');
        }

        // 1. Unzip
        var zip;
        try { zip = new PizZip(data._docxBuffer); }
        catch (e) { throw new Error('Fichier .docx invalide : ' + e.message); }

        var docXmlEntry = zip.file('word/document.xml');
        if (!docXmlEntry) throw new Error('word/document.xml introuvable dans le .docx');
        var docXml = docXmlEntry.asText();

        // 2. Parse XML
        var doc = _parseDocXml(docXml);

        // 3. Appliquer les modifications
        // — Corrections simples (remplacements de chaînes dans les <w:t>)

        // Civilité + mandataire : couvre "Madame X" / "Monsieur X" ET le nom seul (apparaît plusieurs fois).
        // Stratégie : on détecte d'abord le nom présent dans le vierge, puis on remplace tout.
        if (data.mandNom && data.civilite) {
            var targetFull = data.civilite + ' ' + data.mandNom;
            // Détecte la forme existante : "Madame|Monsieur <Nom>" puis aussi le nom seul
            var civPattern = /(Madame|Monsieur)\s+([A-ZÀ-Ü][\p{L}\-']+(?:\s+[A-ZÀ-Ü][\p{L}\-']+){1,3})/u;
            var detectedName = '';
            var allT = doc.getElementsByTagNameNS(W_NS, 't');
            for (var ti = 0; ti < allT.length && !detectedName; ti++) {
                var m = allT[ti].textContent.match(civPattern);
                if (m) detectedName = m[2];
            }
            // Remplace les formes "Madame|Monsieur <DetectedName>"
            if (detectedName) {
                _replaceInDoc(doc, 'Madame ' + detectedName, targetFull);
                _replaceInDoc(doc, 'Monsieur ' + detectedName, targetFull);
                // Remplace aussi le nom seul (sans civilité) — contextes comme "Mandataire : Lionel Christen"
                _replaceInDoc(doc, detectedName, data.mandNom);
            }
        }

        // Adresse mandataire
        if (data.mandAdr) {
            // On ne peut pas détecter de façon fiable l'ancienne adresse sans ancre.
            // Pattern : "Route|Chemin|Rue|Avenue <X>" présent avant un NPA à 4 chiffres.
            // Pour sûreté, on ne remplace pas automatiquement l'adresse — elle est à corriger manuellement.
            // TODO: offrir un champ "adresse mandataire à remplacer" à l'utilisateur.
        }

        // Email / téléphone mandataire
        if (data.mandMail) {
            _replaceInDoc(doc, 'lionel@christen-archi.ch', data.mandMail); // fallback exemple
            // Remplace tout email non etaconsult.ch dans les contextes de mandataire
            var emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
            var etaMail = 'info@etaconsult.ch';
            var allTm = doc.getElementsByTagNameNS(W_NS, 't');
            for (var em = 0; em < allTm.length; em++) {
                var txt = allTm[em].textContent;
                var hits = txt.match(emailPattern);
                if (!hits) continue;
                hits.forEach(function (h) {
                    if (h !== etaMail && h !== data.mandMail) {
                        allTm[em].textContent = allTm[em].textContent.split(h).join(data.mandMail);
                    }
                });
            }
        }
        if (data.mandTel) {
            // Remplace les numéros CH type "+41 xx xxx xx xx" ou "0xx xxx xx xx" si différents du tél expert
            var telExpert = '078 303 81 01';
            var telPattern = /(\+41\s?\d{2}\s?\d{3}\s?\d{2}\s?\d{2}|0\d{2}\s?\d{3}\s?\d{2}\s?\d{2})/g;
            var allTt = doc.getElementsByTagNameNS(W_NS, 't');
            for (var tm = 0; tm < allTt.length; tm++) {
                var tel = allTt[tm].textContent;
                var th = tel.match(telPattern);
                if (!th) continue;
                th.forEach(function (h) {
                    if (h !== telExpert && h !== data.mandTel) {
                        allTt[tm].textContent = allTt[tm].textContent.split(h).join(data.mandTel);
                    }
                });
            }
        }

        // Numéro CECB — remplace toutes les occurrences (VD-XXXXX.XX, GE-, etc.)
        if (data.numCecb) {
            var cecbRegex = /([A-Z]{2}-\d{5,8}\.\d{2})/g;
            var textsN = doc.getElementsByTagNameNS(W_NS, 't');
            for (var i = 0; i < textsN.length; i++) {
                textsN[i].textContent = textsN[i].textContent.replace(cecbRegex, data.numCecb);
            }
        }

        // Date rapport — remplace la date qui suit "Date d'établissement"
        // Date visite — remplace la date qui suit "Date de la visite"
        // Remplacement contextuel : on cherche le paragraphe contenant le libellé,
        // puis on remplace la date dans ce paragraphe (ou suivant).
        function replaceDateByAnchor(anchorText, newDateFr) {
            if (!newDateFr) return;
            var match = _findParaByText(doc, anchorText);
            if (!match) return;
            // Remplace la date dans ce paragraphe ET les 2 suivants (labels sont souvent dans un paragraphe précédent, date dans le suivant)
            var parent = match.para.parentNode;
            var paras = Array.prototype.slice.call(parent.childNodes).filter(function (n) { return n.nodeType === 1 && n.localName === 'p'; });
            var startIdx = paras.indexOf(match.para);
            if (startIdx < 0) return;
            var dateRegex = /(\b\d{2}\.\d{2}\.\d{4}(?:\s+\d{2}:\d{2})?\b)/;
            for (var p = startIdx; p < Math.min(startIdx + 3, paras.length); p++) {
                var ts = paras[p].getElementsByTagNameNS(W_NS, 't');
                for (var t = 0; t < ts.length; t++) {
                    if (dateRegex.test(ts[t].textContent)) {
                        ts[t].textContent = ts[t].textContent.replace(dateRegex, newDateFr);
                        return; // on s'arrête à la première date remplacée
                    }
                }
            }
        }
        replaceDateByAnchor('Date d\u2019établissement', wpFormatDateFr(data.dateRapport));
        replaceDateByAnchor('Date d\'établissement', wpFormatDateFr(data.dateRapport));
        replaceDateByAnchor('Date, signature', wpFormatDateFr(data.dateRapport));
        replaceDateByAnchor('Date de la visite', wpFormatDateFr(data.dateVisite));
        replaceDateByAnchor('Visite des lieux', wpFormatDateFr(data.dateVisite));

        // — Ajouts de sections
        _insertIntroduction(doc, data.introduction);
        _insertResume(doc, data.resume);

        // Commentaires état initial — 3 sections distinctes
        _insertCommentAfterClasseActuelle(doc, data.commentEnv, 'Efficacité de l\'enveloppe');
        _insertCommentAfterClasseActuelle(doc, data.commentEff, 'Efficacité énergétique globale');
        _insertCommentAfterClasseActuelle(doc, data.commentCo2, 'Émissions directes de CO');

        // Tableau variantes
        _insertTableauVariantes(doc, data.variantsCheck, data.variantNames);

        // Recommandation personnalisée
        _replaceRecommendation(doc, data.recoTexte);

        // Remarques générales
        _insertRemarques(doc, data.remarques);

        // Tableau Bases Documents
        _fillBasesDocuments(doc, data.bases);

        // 4. Sérialise et re-zippe
        var newXml = _serializeXml(doc);
        zip.file('word/document.xml', newXml);

        var blob = zip.generate({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            compression: 'DEFLATE'
        });

        var numPart = (data.numCecb || 'rapport').replace(/[^\w.-]/g, '_');
        var datePart = (data.dateRapport || '').replace(/-/g, '');
        var filename = 'CECB_Plus_' + numPart + (datePart ? '_' + datePart : '') + '_modifie.docx';
        saveAs(blob, filename);
        return { filename: filename, size: blob.size };
    }

    /* ──── Exports ──── */
    global.wpRenderDocx = wpRenderDocx;
    global.wpBuildVariantesXml = wpBuildVariantesXml;
    global.wpBuildBasesRows = wpBuildBasesRows;
    global.wpFormatDateFr = wpFormatDateFr;
    global.WP_BASES_LABELS = WP_BASES_LABELS;
    global.WP_BASES_ORDER = WP_BASES_ORDER;

})(typeof window !== 'undefined' ? window : this);
