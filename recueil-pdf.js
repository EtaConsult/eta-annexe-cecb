/* ════════════════════════════════════════════════════════════
 * recueil-pdf.js
 * Export PDF des textes générés (impression directe + rapport unifié texte+photos).
 * Extrait de recueil.js — Phase 4 (split god-file).
 *
 * Dépendances runtime (globales déjà chargées via projet.html) :
 *   - rv (recueil.js)         — lecture DOM helper
 *   - recueilToast (recueil.js)
 *   - ProjectStore (project-store.js)
 *   - photosState (photos.js)         — optionnel
 *   - compressImageForPDF (photos.js) — optionnel
 *   - loadImageDimensions (photos.js) — optionnel
 *   - jsPDF (CDN)
 *
 * API publique : recueilExportPDF(), exportFullReport()
 * ════════════════════════════════════════════════════════════ */

/* ===== PDF EXPORT (print preview, texte uniquement) ===== */

function recueilExportPDF() {
    var textareas = document.querySelectorAll('.gen-textarea');
    var hasContent = false;
    textareas.forEach(function (ta) { if (ta.value.trim()) hasContent = true; });
    if (!hasContent) { recueilToast('Générez d\'abord les textes par section', 'error'); return; }

    var sectionLabels = {
        'toit': '1. Toit', 'murs-ext': '2. Murs contre extérieur', 'murs-terre': '3. Murs contre terre',
        'murs-nc': '4. Murs c/ non chauffé', 'fenetres': '5. Fenêtres et portes',
        'sols-terre': '6. Sols c/ terre', 'sols-nc': '7. Sols c/ non chauffé',
        'ventilation': '8. Ventilation', 'chauffage': '9. Chauffage', 'ecs': '10. Eau chaude sanitaire',
        'appareils': '11. Appareils et éclairage', 'pv': '12. Photovoltaïque'
    };

    var win = window.open('', '_blank');
    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>CECB — ' + (rv('meta-address') || 'Rapport') + '</title>';
    html += '<style>body{font-family:Georgia,serif;margin:40px;color:#333;line-height:1.6}h1{color:#2c5f2d;font-size:1.4em;border-bottom:2px solid #2c5f2d;padding-bottom:8px}h2{color:#2c5f2d;font-size:1.1em;margin-top:20px}.meta{background:#f5f5f0;padding:12px;border-radius:6px;margin-bottom:20px;font-size:.9em}.section{margin-bottom:15px;page-break-inside:avoid}.label{font-weight:bold;font-size:.85em;color:#2c5f2d;margin-bottom:3px}.text{margin-bottom:10px;text-align:justify}footer{margin-top:30px;font-size:.8em;color:#888;border-top:1px solid #ddd;padding-top:10px}</style></head><body>';
    html += '<h1>Rapport CECB — Textes générés</h1>';
    html += '<div class="meta"><strong>Adresse :</strong> ' + (rv('meta-address') || '[?]') + ' | <strong>EGID :</strong> ' + (rv('meta-egid') || '—') + ' | <strong>Canton :</strong> ' + (rv('meta-canton') || '—') + ' | <strong>Année :</strong> ' + (rv('meta-year') || '—') + '</div>';

    var sections = ['toit', 'murs-ext', 'murs-terre', 'murs-nc', 'fenetres', 'sols-terre', 'sols-nc', 'ventilation', 'chauffage', 'ecs', 'appareils', 'pv'];
    sections.forEach(function (s) {
        var eiTa = document.getElementById('gen-' + s + '-ei');
        var apTa = document.getElementById('gen-' + s + '-ap');
        var ei = eiTa ? eiTa.value.trim() : '';
        var ap = apTa ? apTa.value.trim() : '';
        if (!ei && !ap) return;
        html += '<div class="section"><h2>' + (sectionLabels[s] || s) + '</h2>';
        if (ei) html += '<div class="label">État initial</div><div class="text">' + ei.replace(/\n/g, '<br>') + '</div>';
        if (ap) html += '<div class="label">Améliorations</div><div class="text">' + ap.replace(/\n/g, '<br>') + '</div>';
        html += '</div>';
    });

    html += '<footer>Êta Consult Sàrl — CECB Plus — ' + new Date().toLocaleDateString('fr-CH') + '</footer></body></html>';
    win.document.write(html);
    win.document.close();
    setTimeout(function () { win.print(); }, 500);
}

/* ===== UNIFIED PDF REPORT (text + photos via jsPDF) ===== */

async function exportFullReport() {
    var jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) { recueilToast('jsPDF non chargé', 'error'); return; }

    var pid = ProjectStore.getCurrentId();
    var project = pid ? ProjectStore.get(pid) : null;
    var projectName = project ? project.name : 'Sans titre';
    var address = project && project.address ? project.address.label || '' : '';

    var pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var marginL = 15, marginR = 15, marginT = 20, marginB = 15;
    var contentW = 210 - marginL - marginR;
    var y = marginT;

    // Cover page
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.text('Rapport CECB', marginL, y + 20);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'normal');
    pdf.text(projectName, marginL, y + 32);
    if (address) pdf.text(address, marginL, y + 40);
    pdf.setFontSize(10);
    pdf.text('EGID: ' + (rv('meta-egid') || '—') + '   |   Canton: ' + (rv('meta-canton') || '—') + '   |   Année: ' + (rv('meta-year') || '—'), marginL, y + 52);
    pdf.text('Généré le ' + new Date().toLocaleDateString('fr-CH'), marginL, y + 62);
    pdf.setFontSize(9);
    pdf.text('Êta Consult Sàrl — Assistant CECB Plus', marginL, 280);

    // Text sections
    var sections = ['toit', 'murs-ext', 'murs-terre', 'murs-nc', 'fenetres', 'sols-terre', 'sols-nc', 'ponts-thermiques', 'ventilation', 'chauffage', 'ecs', 'appareils', 'pv'];
    var sectionLabels = {
        'toit': '1. Toit', 'murs-ext': '2. Murs contre extérieur', 'murs-terre': '3. Murs contre terre',
        'murs-nc': '4. Murs c/ non chauffé', 'fenetres': '5. Fenêtres et portes',
        'sols-terre': '6. Sols c/ terre', 'sols-nc': '7. Sols c/ non chauffé',
        'ponts-thermiques': '8. Ponts thermiques',
        'ventilation': '9. Ventilation', 'chauffage': '10. Chauffage', 'ecs': '11. Eau chaude sanitaire',
        'appareils': '12. Appareils et éclairage', 'pv': '13. Photovoltaïque'
    };

    var hasText = false;
    sections.forEach(function (s) {
        var eiTa = document.getElementById('gen-' + s + '-ei');
        var apTa = document.getElementById('gen-' + s + '-ap');
        var ei = eiTa ? eiTa.value.trim() : '';
        var ap = apTa ? apTa.value.trim() : '';
        if (!ei && !ap) return;
        hasText = true;

        pdf.addPage();
        y = marginT;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(13);
        pdf.setTextColor(44, 95, 45);
        pdf.text(sectionLabels[s] || s, marginL, y);
        y += 8;
        pdf.setTextColor(0, 0, 0);

        if (ei) {
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10);
            pdf.text('État initial', marginL, y);
            y += 5;
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(9);
            var eiLines = pdf.splitTextToSize(ei, contentW);
            eiLines.forEach(function (line) {
                if (y > 280) { pdf.addPage(); y = marginT; }
                pdf.text(line, marginL, y);
                y += 4;
            });
            y += 3;
        }
        if (ap) {
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(10);
            pdf.text('Améliorations', marginL, y);
            y += 5;
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(9);
            var apLines = pdf.splitTextToSize(ap, contentW);
            apLines.forEach(function (line) {
                if (y > 280) { pdf.addPage(); y = marginT; }
                pdf.text(line, marginL, y);
                y += 4;
            });
        }
    });

    if (!hasText) { recueilToast('Aucun texte à exporter', 'error'); return; }

    // Photos annex
    if (typeof photosState !== 'undefined' && photosState.length > 0) {
        var cols = 2, rows = 3, photosPerPage = cols * rows;
        var gapX = 5, gapY = 4;
        var cellW = (contentW - gapX) / cols;
        var captionH = 6;
        var totalPhotoPages = Math.ceil(photosState.length / photosPerPage);

        for (var page = 0; page < totalPhotoPages; page++) {
            pdf.addPage();
            y = marginT;
            if (page === 0) {
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(13);
                pdf.setTextColor(44, 95, 45);
                pdf.text('D.1 Annexe Photos', marginL, y);
                y += 10;
                pdf.setTextColor(0, 0, 0);
            }
            var availH = 297 - y - marginB;
            var cellH = (availH - (gapY * (rows - 1))) / rows;
            var photoMaxH = cellH - captionH - 2;
            var startIdx = page * photosPerPage;
            var endIdx = Math.min(startIdx + photosPerPage, photosState.length);

            for (var i = startIdx; i < endIdx; i++) {
                var photo = photosState[i];
                var posOnPage = i - startIdx;
                var col = posOnPage % cols;
                var row = Math.floor(posOnPage / cols);
                var cellX = marginL + col * (cellW + gapX);
                var cellY = y + row * (cellH + gapY);
                try {
                    var compressed = typeof compressImageForPDF === 'function' ? await compressImageForPDF(photo.src) : photo.src;
                    var dims = await loadImageDimensions(photo.src);
                    var imgRatio = dims.width / dims.height;
                    var imgW = cellW, imgH = imgW / imgRatio;
                    if (imgH > photoMaxH) { imgH = photoMaxH; imgW = imgH * imgRatio; }
                    var imgX = cellX + (cellW - imgW) / 2;
                    pdf.addImage(compressed, 'JPEG', imgX, cellY, imgW, imgH);
                    if (photo.caption) {
                        pdf.setFontSize(8);
                        pdf.setFont('helvetica', 'normal');
                        pdf.text(photo.caption, cellX, cellY + imgH + 3, { maxWidth: cellW });
                    }
                } catch (err) { console.error('Photo export error:', err); }
            }
        }
    }

    pdf.save('Rapport_CECB_' + projectName.replace(/[^a-zA-Z0-9\u00e0\u00e2\u00e4\u00e9\u00e8\u00ea\u00eb\u00ef\u00ee\u00f4\u00f9\u00fb\u00fc\u00ff\u00e7]/gi, '_') + '.pdf');
    recueilToast('Rapport complet exporté');
}
