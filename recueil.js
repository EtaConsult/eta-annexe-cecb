/* ═══════════════════════════════════════════════════════
   CECB Plus — Texte CECB Engine
   Génération de texte par section constructive
   ═══════════════════════════════════════════════════════ */

/* ===== CORE UI ===== */

function switchRecueilTab(tab) {
    document.querySelectorAll('#recueil-tabs .tab').forEach(function (t) {
        t.classList.toggle('active', t.dataset.tab === tab);
    });
    document.querySelectorAll('.recueil-tab-content').forEach(function (c) { c.classList.remove('active'); });
    document.getElementById('recueil-tab-' + tab).classList.add('active');
}

function toggleSection(header) {
    var body = header.nextElementSibling;
    var toggle = header.querySelector('.toggle');
    body.classList.toggle('collapsed');
    if (toggle) toggle.classList.toggle('collapsed');
}

var AUDIO_EXTENSIONS = ['.mp3','.m4a','.wav','.webm','.ogg','.mpeg','.mpga','.oga','.mp4','.flac'];

function handleTranscriptFile(input) {
    if (!input.files || !input.files[0]) return;
    var file = input.files[0];
    var ext = file.name.toLowerCase().replace(/.*(\.[^.]+)$/, '$1');
    var isPdf = ext === '.pdf' || file.type === 'application/pdf';
    var isAudio = AUDIO_EXTENSIONS.indexOf(ext) !== -1 || (file.type && file.type.startsWith('audio/'));

    if (isAudio) {
        processAudioFile(file);
    } else if (isPdf) {
        if (typeof pdfjsLib === 'undefined') {
            recueilToast('Librairie PDF non chargée', 'error');
            input.value = '';
            return;
        }
        var reader = new FileReader();
        reader.onload = async function(e) {
            try {
                var typedArray = new Uint8Array(e.target.result);
                var pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
                var allText = [];
                for (var i = 1; i <= pdf.numPages; i++) {
                    var page = await pdf.getPage(i);
                    var content = await page.getTextContent();
                    var pageText = content.items.map(function(item) { return item.str; }).join(' ');
                    if (pageText.trim()) allText.push(pageText);
                }
                var text = allText.join('\n');
                if (!text.trim()) { recueilToast('PDF vide ou non lisible', 'error'); return; }
                analyzeTranscript(text);
            } catch (err) {
                console.error('PDF read error:', err);
                recueilToast('Erreur lecture PDF: ' + err.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    } else {
        var reader = new FileReader();
        reader.onload = function(e) {
            var text = e.target.result;
            if (!text || !text.trim()) { recueilToast('Fichier vide', 'error'); return; }
            analyzeTranscript(text);
        };
        reader.readAsText(file);
    }
    input.value = '';
}

function recueilToast(msg, type) {
    type = type || 'success';
    var t = document.createElement('div');
    t.className = 'toast toast-' + type;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3000);
}

/* ===== CONDITIONAL FIELD VISIBILITY ===== */

function updateToitFields() {
    var val = document.getElementById('toit-config').value;
    document.getElementById('toit-combles-group').style.display = val === 'plancher_combles' ? 'flex' : 'none';
}

function updateChauffageFields() {
    var conso = document.getElementById('chauf-conso').value;
    document.getElementById('chauf-conso-years-group').style.display = conso === 'oui' ? 'flex' : 'none';
}

function updatePVFields() {
    var val = document.getElementById('pv-existant').value;
    document.getElementById('pv-puissance-group').style.display = val === 'oui' ? 'flex' : 'none';
    document.getElementById('pv-batterie-group').style.display = val === 'oui' ? 'flex' : 'none';
}

/* ===== BUILDING TYPE CHANGE (RegBL Housing) ===== */

function onBuildingTypeChange() {
    var typeVal = rv('meta-type');
    if (typeVal === '1020' || typeVal === '1025') {
        fetchRegblHousing();
    }
}

async function fetchRegblHousing() {
    var egid = rv('meta-egid');
    if (!egid) return;
    try {
        var resp = await fetch('https://api3.geo.admin.ch/rest/services/api/MapServer/find?layer=ch.bfs.gebaeude_wohnungs_register&searchField=egid&searchText=' + egid + '&returnGeometry=false');
        var data = await resp.json();
        if (!data.results || data.results.length === 0) return;
        var b = data.results[0].attributes || {};
        var totalWhg = b.ganzwhg || 0;
        // wazim is an array of room counts per dwelling
        var wazimArr = Array.isArray(b.wazim) ? b.wazim : [];
        // Count dwellings by room size
        var counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, '7+': 0 };
        wazimArr.forEach(function(n) {
            if (n === null || n === undefined) return;
            n = parseInt(n);
            if (n <= 0) return;
            if (n === 1) counts[1]++;
            else if (n === 2) counts[2]++;
            else if (n === 3) counts[3]++;
            else if (n === 4) counts[4]++;
            else if (n === 5) counts[5]++;
            else if (n === 6) counts[6]++;
            else counts['7+']++;
        });
        // Fill form fields
        sv('meta-apartments', totalWhg);
        sv('meta-studios', counts[1]);
        sv('meta-2p', counts[2]);
        sv('meta-3p', counts[3]);
        sv('meta-4p', counts[4]);
        sv('meta-5p', counts[5]);
        sv('meta-6p', counts[6]);
        sv('meta-6p-plus', counts['7+']);
        if (typeof recueilAutoSave === 'function') recueilAutoSave();
    } catch (e) { /* silent */ }
}

/* ===== UW ESTIMATION ===== */

function estimateUw() {
    var cadre = document.getElementById('fen-cadre').value;
    var vitrage = document.getElementById('fen-vitrage').value;
    if (!cadre || !vitrage) return;

    var table = {
        simple: { bois: 5.0, pvc: 5.0, alu: 5.5, mixte: 5.0 },
        double_ancien: { bois: 2.5, pvc: 2.6, alu: 2.8, mixte: 2.5 },
        double_isolant: { bois: 1.9, pvc: 2.0, alu: 2.2, mixte: 1.9 },
        double_selectif: { bois: 1.5, pvc: 1.8, alu: 2.0, mixte: 1.6 },
        triple: { bois: 0.9, pvc: 0.8, alu: 1.0, mixte: 0.9 }
    };

    var uw = table[vitrage] && table[vitrage][cadre];
    if (uw !== undefined) {
        document.getElementById('fen-uw').value = uw;
        var hint = document.getElementById('uw-hint');
        if (uw <= 1.0) { hint.textContent = 'Conforme aux standards actuels'; hint.style.color = 'var(--success, #27ae60)'; }
        else if (uw <= 1.3) { hint.textContent = 'Légèrement inférieur aux recommandations'; hint.style.color = 'var(--warning, #e67e22)'; }
        else { hint.textContent = 'Remplacement recommandé'; hint.style.color = 'var(--danger, #c0392b)'; }
    }
}

/* ===== LIFE INDICATORS ===== */

function updateLifeIndicator(component, lifespan) {
    var yearField = document.getElementById(
        component === 'fenetres' ? 'fen-year' :
            component === 'chauffage' ? 'chauf-year' :
                component === 'ecs' ? 'ecs-year' :
                    component + '-year');
    var year = parseInt(yearField && yearField.value) || 0;
    if (!year) return;

    var currentYear = new Date().getFullYear();
    var age = currentYear - year;
    var remaining = lifespan - age;
    var pct = remaining / lifespan;

    var el = document.getElementById('life-' + component);
    if (!el) return;

    if (pct > 0.5) {
        el.innerHTML = '<span class="life-indicator life-ok">' + remaining + ' ans restants</span>';
    } else if (pct > 0) {
        el.innerHTML = '<span class="life-indicator life-warn">' + remaining + ' ans restants</span>';
    } else {
        el.innerHTML = '<span class="life-indicator life-expired">Fin de vie dépassée (' + Math.abs(remaining) + ' ans)</span>';
    }
}

/* ===== TEXT BLOCKS DATABASE ===== */

var BLOCS = {
    toit: {
        ei_inclinee: "Le bâtiment est couvert d'une toiture traditionnelle inclinée, installée lors de sa construction en {year}. Cette toiture présente une isolation thermique {isolation_desc}{isolation_detail}, conforme aux standards de l'époque de construction. Elle est à l'origine de déperditions thermiques supérieures aux standards actuels pour les nouvelles constructions. Elle abrite un espace chauffé.",
        ei_froide: "Le bâtiment est équipé d'une toiture traditionnelle inclinée de type \"froid\", recouverte de tuiles. Celle-ci ne dispose d'aucune isolation thermique et abrite un espace non chauffé.",
        ei_construction_travaux: "Le bâtiment est équipé d'une toiture traditionnelle datant probablement de sa construction initiale, avec une isolation thermique située vraisemblablement au-dessus des chevrons, conforme aux standards de l'époque. Des travaux d'amélioration thermique ont été réalisés ultérieurement, comprenant l'ajout d'une couche de laine minérale entre les chevrons. L'isolation thermique actuelle de la toiture présente de bonnes performances. La toiture protège un espace chauffé.",
        ei_plate_renovee: "Le bâtiment est couvert par une toiture plate. Une intervention de rénovation thermique a été réalisée en {year} par l'ajout d'une couche d'isolation thermique que nous estimons à {cm} cm d'XPS. Cette dernière dispose d'une bonne capacité isolante, équivalente aux exigences pour les nouvelles constructions.",
        ei_plancher_combles_bois: "Le plancher des combles sépare l'espace chauffé des combles non chauffés. Il est constitué d'un plancher traditionnel en bois. Il ne présente pas d'isolation thermique.",
        ei_plancher_combles_beton: "Le plancher des combles sépare l'espace chauffé des combles non chauffés. Il est constitué d'une dalle en béton recouverte d'une chape ciment. Il est faiblement isolé et présente des performances thermiques inférieures aux exigences pour les nouvelles constructions.",
        ap_renovation: "En cas de travaux importants sur la couverture ou dans le cadre de son entretien régulier, il est recommandé d'envisager simultanément l'amélioration de l'isolation thermique de la toiture. Cela peut être réalisé par l'ajout d'une isolation entre les chevrons et au-dessus de ceux-ci. Pour bénéficier des subventions du Programme Bâtiments, il est nécessaire d'atteindre une valeur U inférieure à 0,20 W/m²K, ce qui permettra de réduire considérablement les déperditions thermiques. Avant toute installation de panneaux photovoltaïques, il convient de faire vérifier la capacité portante de la charpente par un ingénieur civil.",
        ap_non_prioritaire: "Bien que l'amélioration de l'isolation de la toiture ne constitue pas une priorité immédiate, elle reste une intervention pertinente, à planifier lors des prochains travaux de rénovation lourds, liés à son besoin d'entretien ou quand celle-ci aura atteint sa fin de vie théorique. Pour bénéficier des subventions du Programme Bâtiments, il est nécessaire d'atteindre une valeur U inférieure à 0,20 W/m²K afin de réduire significativement les déperditions thermiques. Avant d'envisager l'installation de panneaux photovoltaïques, il est conseillé de faire vérifier la capacité portante de la charpente par un ingénieur civil.",
        ap_froide: "En vue d'une éventuelle exploitation future des combles en espace habitable, il est recommandé de planifier l'amélioration de la performance isolante de la toiture en coordination avec les échéances d'entretien. Dans cette perspective, une surélévation du bâtiment pourrait s'avérer pertinente, sous réserve des dispositions du règlement communal. Avant toute installation de panneaux photovoltaïques, il convient de faire vérifier la capacité portante de la charpente par un ingénieur civil. À noter que la toiture couvrant un espace de combles non chauffé, les travaux d'isolation en toiture ne bénéficient pas des subventions du Programme Bâtiments.",
        ap_plancher_combles_bois: "Il est recommandé d'envisager l'isolation du plancher des combles. Ces travaux devraient être planifiés à court terme dans le cadre des mesures correctives.",
        ap_plancher_combles_beton: "Il est recommandé d'optimiser l'isolation du plancher des combles en remplaçant l'isolation existante par une isolation sur dalle présentant de meilleures performances thermiques."
    },
    murs: {
        ei_sans_isolation: "Les façades du bâtiment sont composées de maçonnerie en {composition_desc} et n'ont bénéficié d'aucune amélioration thermique depuis leur construction initiale.",
        ei_double_paroi: "Les façades du bâtiment présentent une maçonnerie à double paroi avec, selon toute probabilité, une isolation intermédiaire compte tenu de l'année de construction. Dans cette configuration, l'isolation correspond aux standards en vigueur lors de la construction, mais ne satisfait pas aux exigences actuelles applicables aux bâtiments neufs. Aucune amélioration thermique des façades n'a été réalisée depuis l'achèvement du bâtiment.",
        ei_ite: "Les façades du bâtiment sont constituées de maçonnerie homogène avec une isolation par l'extérieur. En tenant compte de l'année de construction, une épaisseur d'isolation de {cm} cm a été retenue pour cette étude. Cette configuration contribue à l'isolation thermique de l'enveloppe du bâtiment, bien que les performances restent en deçà des exigences applicables aux nouvelles constructions. Nous recommandons de réaliser un sondage de la façade avant d'engager des travaux d'amélioration thermique de l'enveloppe du bâtiment.",
        ei_moellons: "Les façades du bâtiment sont constituées de maçonnerie en moellons sans isolation thermique. Certaines façades sont en contact avec des espaces non chauffés, ce qui réduit les déperditions thermiques par rapport à des façades exposées directement aux conditions extérieures et contribue ainsi à améliorer l'efficacité énergétique globale du bâtiment.",
        ei_moellons_protege: "Les façades du bâtiment sont composées de maçonnerie en moellons et n'ont bénéficié d'aucune amélioration thermique depuis leur construction initiale.",
        ei_mitoyen: "Le bâtiment est contigu sur {cotes} côté(s). Les façades contiguës ne nécessitent pas de travaux d'amélioration thermique.",
        ap_ite: "L'installation d'une isolation thermique par l'extérieur (ITE) représente une option intéressante lors d'une rénovation des façades, sans toutefois constituer une priorité immédiate. Ces travaux peuvent être programmés à moyen terme. Pour obtenir une réduction substantielle des pertes thermiques et bénéficier des subventions du Programme Bâtiments, une valeur U inférieure à 0,20 W/m²K est nécessaire.",
        ap_ite_sondage: "Sur la base des hypothèses retenues dans cette étude, nous recommandons d'améliorer l'isolation des façades par l'ajout d'une isolation extérieure crépie. Cette intervention peut être planifiée à moyen ou long terme. Pour réduire efficacement les déperditions thermiques et pouvoir bénéficier des subventions du Programme Bâtiments, une valeur U inférieure à 0,20 W/m²K est requise.",
        ap_moellons_protege: "Le bâtiment faisant partie d'un ensemble architectural protégé, toute isolation extérieure périphérique requiert l'accord préalable de la commune. Nous suggérons donc d'étudier la mise en œuvre d'un enduit isolant sur les façades extérieures. L'isolation par l'intérieur constitue une alternative envisageable, à condition de réaliser au préalable des analyses hygrothermiques détaillées pour maîtriser les risques de migration d'humidité dans la paroi. Pour obtenir une réduction notable des pertes thermiques, une valeur U inférieure à 0,20 W/m²K est nécessaire.",
        ap_moellons: "Il est recommandé d'améliorer la performance thermique des façades en installant une isolation extérieure crépie. Ces travaux peuvent être envisagés à moyen terme. Une isolation par l'intérieur constitue également une option possible, sous réserve d'études approfondies en physique du bâtiment pour prévenir les risques de migration d'humidité dans le complexe constructif. Pour réduire efficacement les déperditions thermiques, il convient de viser une valeur U inférieure à 0,20 W/m²K.",
        ap_double_paroi: "Compte tenu des hypothèses retenues dans le cadre de cette étude, il est recommandé d'améliorer le pouvoir isolant des façades par l'ajout d'une isolation extérieure crépie. Les travaux peuvent être planifiés à moyen terme. Une valeur U inférieure à 0,20 W/m²K est nécessaire pour réduire significativement les déperditions thermiques."
    },
    murs_terre: {
        ei_sans_isolation: "Les murs du sous-sol adjacents à des locaux non chauffés ne disposent pas d'isolation.",
        ei_isole_interieur: "Des travaux d'amélioration thermique ont été réalisés après la construction du bâtiment sur les murs du sous-sol en contact avec le terrain. Une couche d'isolation d'environ {cm} cm d'EPS a été ajoutée par l'intérieur. Ces interventions réduisent les déperditions thermiques et améliorent le confort intérieur.",
        ap_isolation: "Il est recommandé d'isoler les murs du sous-sol en contact avec les locaux non chauffés afin de réduire les déperditions thermiques.",
        ap_non_prioritaire: "L'isolation des murs contre terrain ne constitue pas une priorité immédiate, compte tenu de leur état actuel."
    },
    murs_nc: {
        ei_beton: "Les murs du sous-sol adjacents à des locaux non chauffés sont constitués de béton armé et ne disposent d'aucune isolation.",
        ei_maconnerie: "Les murs du sous-sol adjacents à des locaux non chauffés sont constitués de maçonnerie creuse et ne disposent d'aucune isolation.",
        ei_isole: "Les murs adjacents aux locaux non chauffés disposent d'une isolation de {cm} cm. Cette configuration offre une protection thermique acceptable.",
        ap_isolation: "Nous préconisons l'isolation des parois adjacentes aux locaux non chauffés du sous-sol. L'ajout d'isolation entraînera une diminution de la température au sous-sol, ce qui pourrait nécessiter une aération régulière en cas d'humidité élevée. Ces travaux ne sont pas éligibles aux subventions du Programme Bâtiments. Pour réduire de manière significative les déperditions thermiques à travers ces parois, une valeur U inférieure à 0,25 W/m²K est recommandée.",
        ap_non_prioritaire: "L'isolation des murs c/ non chauffé ne constitue pas une priorité immédiate, les performances actuelles étant jugées acceptables."
    },
    fenetres: {
        ei_bois_1iv: "Le bâtiment est équipé principalement de fenêtres à cadre bois et à simple vitrage, dont la performance isolante se situe nettement en deçà des normes actuelles pour les constructions neuves. Ces fenêtres génèrent des déperditions de chaleur importantes.",
        ei_bois_2iv: "Les logements du bâtiment sont équipés, pour l'essentiel, de fenêtres à cadre bois et à double vitrage, dont la performance isolante se situe légèrement en dessous des standards recommandés pour les nouvelles constructions. Les vitrages d'origine ont été remplacés par des doubles vitrages isolants, dans le respect du parti architectural du bâtiment. Ces fenêtres génèrent des déperditions thermiques légèrement supérieures aux recommandations actuelles pour les nouvelles constructions.",
        ei_insuffisante: "Le bâtiment est équipé principalement de fenêtres à cadre {cadre} et à {vitrage}, séparés par un intercalaire en aluminium. Le pouvoir isolant de ces fenêtres est {niveau} inférieur aux recommandations pour les nouvelles constructions.",
        ei_recentes: "Les fenêtres ont été remplacées en {year} par des modèles à {vitrage}. Elles présentent une isolation thermique conforme aux standards recommandés pour les constructions neuves.",
        ei_cadres_renov: "Les fenêtres ont été remplacées en {year} par des modèles à {vitrage} avec des cadres de rénovation permettant d'anticiper la pose future d'une ITE sans nécessiter un nouveau remplacement des fenêtres.",
        ei_porte: "L'ensemble menuisé d'accès au bâtiment est à l'origine de déperditions critiques dans le hall chauffé du bâtiment.",
        ap_remplacement: "Le remplacement des fenêtres actuelles par des modèles à triple vitrage est une option pertinente. Les travaux peuvent être planifiés à court terme comme travaux correctifs. Le remplacement de fenêtres n'est pas subventionné par le Programme Bâtiments. Une valeur Uw inférieure à 1,00 W/m²K est nécessaire pour réduire significativement les déperditions thermiques.",
        ap_remplacement_cadre_renov: "Nous recommandons le remplacement des fenêtres par des modèles à triple vitrage avec cadres de rénovation, permettant d'anticiper la pose future d'une ITE sans nécessiter un nouveau remplacement des fenêtres. Le remplacement de fenêtres n'est pas éligible aux subventions du Programme Bâtiments de manière indépendante. Une valeur Uw inférieure à 1,00 W/m²K est nécessaire pour réduire significativement les déperditions thermiques.",
        ap_non_prioritaire: "À ce stade, aucune intervention n'est recommandée concernant les fenêtres, étant donné leurs performances satisfaisantes. Les travaux pourront être planifiés en fonction des besoins de remplacement ou coordonnés avec d'éventuels travaux de rénovation de façade. Le remplacement de fenêtres n'est pas éligible aux subventions du Programme Bâtiments. Pour réduire de manière significative les déperditions thermiques, une valeur Uw inférieure à 1,00 W/m²K serait nécessaire.",
        ap_bois_2iv: "Le remplacement des fenêtres actuelles par des modèles à triple vitrage constitue une option à considérer, sous réserve de validation par les autorités compétentes. Cette intervention ne figure toutefois pas parmi les priorités immédiates. Les travaux peuvent être programmés en fonction des besoins de remplacement ou coordonnés avec d'éventuels travaux de rénovation de façade. Le remplacement des fenêtres n'est pas éligible aux subventions du Programme Bâtiments. Pour réduire de manière significative les déperditions thermiques, une valeur Uw inférieure à 1,00 W/m²K est nécessaire."
    },
    sols_terre: {
        ei_radier: "En l'absence de plans d'exécution ou de sondage, il est difficile de définir le détail constructif du radier contre terre. Ce dernier, constitué de maçonnerie, ne présente vraisemblablement pas ou peu d'isolation.",
        ei_terre_plein: "Les planchers du bâtiment sont en contact direct avec le terrain. En l'absence de plans d'exécution, il n'est pas possible de confirmer avec certitude leur composition. Toutefois, au regard de l'époque de construction, la présence d'une couche d'isolation thermique est considérée comme peu probable.",
        ei_isole: "Le sol contre terre dispose d'une isolation de {cm} cm. Cette configuration offre une performance thermique acceptable.",
        ap_radier: "Pour améliorer la performance thermique de l'enveloppe, l'isolation du plancher du sous-sol constitue une mesure efficace. Il s'agit toutefois d'une intervention généralement lourde, dont le coût peut être élevé. Afin de réduire de manière significative les déperditions thermiques et de pouvoir bénéficier des subventions du Programme Bâtiments, une valeur U inférieure à 0,25 W/m²K est requise.",
        ap_terre_plein: "L'isolation du plancher constitue une option envisageable à long terme. Toutefois, le coût peut s'avérer disproportionné par rapport au gain énergétique attendu.",
        ap_non_prioritaire: "L'isolation du sol contre terre ne constitue pas une priorité, les performances actuelles étant jugées satisfaisantes."
    },
    sols_nc: {
        ei_dalle: "Le plancher du rez-de-chaussée assure la séparation thermique entre les espaces non chauffés du sous-sol et le volume chauffé. Il est constitué d'une dalle en maçonnerie homogène et ne dispose d'aucune isolation thermique en sous-face.",
        ei_hourdis: "Le plancher du rez-de-chaussée est constitué de hourdis et assure la séparation thermique entre les espaces non chauffés et le volume chauffé. Il ne dispose d'aucune isolation thermique en sous-face.",
        ei_isole: "Le plancher c/ non chauffé dispose d'une isolation en sous-face de {cm} cm. Cette configuration offre une performance thermique acceptable.",
        ap_dalle: "Nous recommandons d'isoler la dalle du rez-de-chaussée en ajoutant une isolation en sous-face, tout en préservant l'accès aux installations techniques du plafond. Ces travaux peuvent être réalisés à court terme. Pour réduire efficacement les déperditions thermiques, une valeur U inférieure à 0,25 W/m²K est requise. Ces travaux ne sont pas éligibles aux subventions du Programme Bâtiments.",
        ap_non_prioritaire: "L'isolation de la dalle c/ non chauffé ne constitue pas une priorité, les performances actuelles étant jugées satisfaisantes."
    },
    ponts_thermiques: {
        ei_inclus: "Les ponts thermiques linéaires ont été pris en compte dans le bilan thermique de l'état initial. Les ponts thermiques identifiés se situent au niveau du socle du bâtiment entre la cave et le rez-de-chaussée, ainsi qu'au niveau des raccords entre les murs et la toiture. Les fenêtres présentent des ponts thermiques usuels au niveau des embrasures et des appuis de fenêtre.",
        ei_standard: "Lors de l'évaluation thermique initiale, lorsque l'isolation existante est insuffisante ou négligeable, les ponts thermiques linéaires ne sont pas inclus dans le calcul du bilan thermique.",
        ei_avec_fenetres: "Lors d'une évaluation thermique initiale, lorsque l'isolation existante est insuffisante ou négligeable, les ponts thermiques linéaires ne sont pas inclus dans le calcul du bilan thermique. Les fenêtres présentent des ponts thermiques courants au niveau des embrasures, des linteaux et des appuis de fenêtre.",
        ap_standard: "Il est recommandé de prêter une attention particulière aux ponts thermiques lors de la planification de travaux d'isolation de façade. Une conception soignée et des détails constructifs adaptés permettront d'assurer la continuité de l'isolation et d'améliorer la performance énergétique de l'enveloppe du bâtiment.",
        ap_avec_fenetres: "Il est important de bien planifier les travaux d'isolation de façade afin de réduire efficacement les ponts thermiques. Une conception soignée et des détails constructifs adaptés permettent d'assurer la continuité de l'isolation et d'améliorer la performance énergétique de l'enveloppe du bâtiment."
    },
    ventilation: {
        ei_standard: "Le bâtiment ne dispose pas de système de ventilation mécanique. Le renouvellement de l'air est effectué par l'ouverture manuelle des fenêtres. Les locaux humides sont équipés de ventilateurs avec temporisation pour l'extraction de l'air vicié.",
        ap_standard: "L'intégration d'une ventilation mécanique contrôlée (VMC) simple flux avec récupération de chaleur peut être réalisée lors de travaux de rénovation. Ce système permet de limiter les déperditions thermiques. L'air frais pénètre dans les pièces de vie par des réglettes hygroréglables installées dans les cadres de fenêtres, tandis que l'air vicié est extrait par le réseau existant des WC et salles de bains. Cette solution optimise l'efficacité énergétique du bâtiment tout en assurant une qualité d'air appropriée. Les réglettes hygroréglables ajustent automatiquement le débit d'air selon le taux d'humidité intérieure : elles s'ouvrent davantage en présence d'humidité élevée et se ferment lorsque l'air est sec, permettant ainsi un fonctionnement à débit variable et une meilleure performance énergétique."
    },
    chauffage: {
        ei_fossile: "Le bâtiment est équipé d'une chaudière à {source} à condensation installée en {year}, avec une puissance de {puissance} kW, qui ne répond plus entièrement aux standards techniques actuels ni aux recommandations en matière d'énergies renouvelables. Le système de chauffage fonctionne de manière satisfaisante et ne présente pas de défaillance notable. Cependant, ce système utilise une énergie fossile dont les émissions de CO₂ ont un impact environnemental défavorable et compromettent l'atteinte des objectifs climatiques cantonaux et fédéraux. La distribution de chaleur s'effectue via {distribution}.",
        ei_elec: "Le bâtiment est équipé d'un système de chauffage électrique qui ne répond plus aux normes techniques actuelles ni aux recommandations en matière d'utilisation des énergies renouvelables. L'ensemble du système fonctionne normalement et ne présente pas de dysfonctionnement notable. L'utilisation de l'électricité pour la production de chaleur s'avère coûteuse et devrait être évitée. Ce système repose sur un chauffage électrique direct qui n'émet pas de CO₂ sur site, mais dont la performance énergétique reste limitée. La chaleur est distribuée par {distribution}.",
        ei_pac: "Le bâtiment est équipé d'une pompe à chaleur {type_pac}, installée en {year}, offrant une puissance de chauffage de {puissance} kW. Cette installation est conforme aux standards techniques actuels et aux recommandations concernant l'utilisation des énergies renouvelables. Le système de chauffage fonctionne correctement et engendre peu de frais de maintenance. La distribution de la chaleur s'effectue via {distribution}.",
        ei_cad: "Le bâtiment est raccordé au chauffage à distance (CAD) de la commune de {commune}. Ce réseau représente une solution efficace, valorisant majoritairement des énergies renouvelables locales.",
        ei_conso_oui: "Les données de consommation de chauffage sur les {years} dernières années ont été transmises par le mandant.",
        ei_conso_non: "Les données de consommation n'ont pas été fournies par le mandant, ce qui limite la vérification de la plausibilité du modèle énergétique.",
        ei_appoint_insert: "Une cheminée décorative à foyer fermé complète l'installation de chauffage.",
        ei_appoint_foyer: "Une cheminée à foyer ouvert vient compléter l'installation de chauffage. Son usage étant principalement orienté vers le confort, la consommation de bois qui en découle n'a pas d'impact significatif sur la consommation globale de chauffage du bâtiment.",
        ap_fossile: "Le remplacement du système de production de chaleur est à anticiper avant d'atteindre sa fin de vie théorique. Il est recommandé de remplacer la chaudière existante par une solution recourant aux énergies renouvelables. La mise en place d'un suivi des consommations de chauffage, accompagnée de mesures correctives, serait bénéfique tant sur le plan économique qu'écologique. Par ailleurs, l'isolation des conduites de distribution mérite d'être améliorée. Ces interventions sont à planifier à moyen terme, dans un horizon d'environ 5 ans. Le remplacement d'un système principal fonctionnant au mazout, au gaz ou à l'électricité directe peut bénéficier d'une subvention du Programme Bâtiments, pour autant qu'il soit remplacé par un système utilisant les énergies renouvelables ou par un raccordement à un chauffage à distance. {condition_pb}",
        ap_elec_central_vd: "Il est recommandé de procéder au remplacement du système de production de chaleur actuel par une pompe à chaleur air-eau. La création initiale d'un réseau de distribution hydraulique bénéficie d'un soutien financier dans le cadre du Programme Bâtiments. Le remplacement d'un système principal fonctionnant au mazout, au gaz ou à l'électricité directe est également subventionné par le Programme Bâtiments, à condition qu'il soit remplacé par un système utilisant des énergies renouvelables ou par un raccordement à un réseau de chauffage à distance. {condition_pb} Depuis le 1er janvier 2025, le décret vaudois sur l'assainissement des chauffages et chauffe-eau électriques (DACCE, BLV 730.051) est en vigueur. Ce décret interdit l'utilisation de ces installations et impose leur remplacement d'ici le 1er janvier 2033.",
        ap_elec_decentral_vd: "Il est recommandé de remplacer l'ensemble des radiateurs électriques par un système centralisé renouvelable. Le DACCE impose le remplacement d'ici 2033. La création d'un réseau hydraulique bénéficie d'un soutien du Programme Bâtiments.",
        ap_elec_ge: "Il est recommandé de procéder au remplacement du système par une pompe à chaleur ou un autre système renouvelable.",
        ap_pac: "Aucune amélioration technique du système de production de chaleur n'est recommandée à ce stade. Toutefois, il est conseillé d'améliorer l'isolation de l'enveloppe thermique du bâtiment afin d'optimiser l'efficacité énergétique de la pompe à chaleur et d'améliorer son coefficient de performance.",
        ap_cad: "Aucune recommandation n'est préconisée concernant le système de production de chaleur."
    },
    ecs: {
        ei_chaudiere: "La production d'eau chaude sanitaire est actuellement assurée par la chaudière existante, datant de {year}. Ce système n'est plus conforme aux standards techniques actuels et ne répond pas aux exigences de performance énergétique modernes.",
        ei_ce_elec_central: "La production d'eau chaude sanitaire est actuellement assurée par un chauffe-eau électrique centralisé. Le recours à l'électricité directe pour la production d'ECS est coûteux et n'est pas recommandé. L'installation est par ailleurs considérée comme obsolète au regard des standards techniques actuels.",
        ei_ce_elec_decentral: "La production d'eau chaude sanitaire est assurée par plusieurs chauffe-eau électriques. Le recours à l'électricité directe pour la production d'ECS est coûteux et n'est pas recommandé.",
        ei_boiler_elec: "La production d'eau chaude sanitaire est actuellement assurée par un chauffe-eau électrique datant de {year}. L'utilisation d'électricité pour la production d'ECS représente une solution coûteuse qui devra être remplacée dans les prochaines années, compte tenu de la fin de vie prévisible de l'installation.",
        ei_thermo: "La production d'eau chaude sanitaire est assurée par un chauffe-eau thermodynamique de {volume} L utilisant une pompe à chaleur air-eau.",
        ei_pac: "La production d'eau chaude sanitaire est assurée par la pompe à chaleur. Ce système est conforme aux standards actuels.",
        ei_cad: "La production de chaleur du bâtiment, y compris l'eau chaude sanitaire, est assurée par le réseau CAD.",
        ei_solaire_pac: "La production d'eau chaude sanitaire est principalement assurée par une installation solaire thermique de {surface} m² située en toiture. Celle-ci couvre une partie des besoins en eau chaude du bâtiment, avec une production variable selon les saisons. Lorsque l'installation solaire ne suffit pas, la pompe à chaleur complète l'apport.",
        ap_chaudiere: "Il est recommandé de remplacer le système de production d'eau chaude sanitaire actuel. La production d'ECS pourra être assurée par le nouveau système de chauffage basé sur les énergies renouvelables. L'isolation des conduites de distribution devrait également être améliorée.",
        ap_boiler_renouvelable: "La production d'ECS peut être intégrée au nouveau système de chauffage en recourant à des énergies renouvelables. Il convient également d'améliorer l'isolation des conduites de distribution. La mise en place d'un réseau de distribution hydraulique est éligible aux subventions du Programme Bâtiments.",
        ap_dacce_vd: "Le système de production d'eau chaude sanitaire doit être remplacé. L'isolation des conduites de distribution est à améliorer. Depuis le 1er janvier 2025, le décret vaudois sur l'assainissement des chauffages et chauffe-eau électriques (DACCE, BLV 730.051) est entré en vigueur. Il interdit l'utilisation de ces installations et impose leur remplacement au plus tard d'ici au 1er janvier 2033. Ce décret concerne les chauffages électriques fixes à résistance, qu'ils soient centralisés ou décentralisés, ainsi que les chauffe-eau électriques. Afin d'accompagner cette transition, le canton de Vaud renforce les subventions destinées au remplacement de ces systèmes par des solutions recourant aux énergies renouvelables, telles que les pompes à chaleur, les chaudières à bois ou le raccordement à un réseau de chauffage à distance.",
        ap_cad_pac: "Aucune recommandation n'est préconisée concernant le système de production d'ECS."
    },
    appareils: {
        ei: "Les appareils électriques installés présentent différentes classes d'efficacité énergétique et sont globalement conformes aux normes en vigueur. {conso_mention}",
        ap: "Le remplacement d'appareils obsolètes ou peu performants par des modèles plus récents contribue à améliorer l'efficacité énergétique du bâtiment. Pour des recommandations détaillées, nous vous recommandons de consulter le site www.top-ten.ch."
    },
    pv: {
        ei_non: "Aucune installation photovoltaïque n'a été constatée lors de la visite. Le bâtiment ne dispose actuellement pas d'autoproduction d'électricité.",
        ei_oui: "Le bâtiment est équipé d'une installation solaire photovoltaïque d'environ {puissance} kWc mise en service en {year_pv}.",
        ei_oui_batterie: "Le bâtiment est équipé d'une installation solaire photovoltaïque d'environ {puissance} kWc mise en service en {year_pv}. Une batterie permet d'optimiser l'autoconsommation de l'énergie produite sur place.",
        ei_oui_sans_batterie: "Le bâtiment dispose actuellement d'une installation solaire photovoltaïque de {puissance} kWc mise en service en {year_pv}. L'absence de système de stockage par batterie réduit les possibilités d'autoconsommation de l'énergie produite.",
        ap_installation: "Il est recommandé d'envisager l'installation d'un système de panneaux solaires photovoltaïques sur une toiture préalablement rénovée. L'autoproduction d'électricité présente généralement des avantages économiques et contribue à la réduction des émissions de gaz à effet de serre. Les travaux d'installation d'un système photovoltaïque bénéficient de subventions de Pronovo, dont le montant dépend de la taille de l'installation et de l'option retenue (rétribution unique ou rétribution à l'injection).",
        ap_installation_max: "Il convient d'envisager l'installation d'un système de panneaux solaires photovoltaïques. L'autoproduction d'électricité s'avère généralement rentable et contribue à la réduction des émissions de gaz à effet de serre. Nous préconisons d'exploiter le potentiel maximal de la toiture en y installant un système solaire photovoltaïque. Nous suggérons par ailleurs l'intégration d'un système de stockage d'électricité pour optimiser l'autoconsommation et valoriser l'énergie solaire produite localement. Une étude d'ensoleillement devra être réalisée pour confirmer la faisabilité technique, en tenant compte de l'ombrage potentiel et de l'orientation de la toiture. Les travaux bénéficient de subventions Pronovo.",
        ap_extension: "Il est recommandé d'exploiter pleinement le potentiel de la toiture en installant un système solaire photovoltaïque. Cette production permettrait de réduire les besoins électriques et de diminuer significativement les émissions de gaz à effet de serre. L'intégration d'un système de stockage d'électricité est également conseillée pour optimiser l'autoconsommation et valoriser l'énergie solaire produite localement. Une étude d'ensoleillement devra être réalisée pour confirmer la faisabilité technique.",
        ap_non_prioritaire: "Nous ne recommandons pas d'améliorations concernant la production photovoltaïque à ce stade."
    },
    comportement: "Le CECB évalue la performance énergétique du bâtiment selon des conditions d'utilisation et d'occupation normalisées. La consommation énergétique effective dépend en grande partie du comportement des occupants et peut ainsi s'écarter significativement des valeurs indiquées par le CECB. Les recommandations du document CECB se concentrent exclusivement sur l'enveloppe du bâtiment et ses installations techniques. Néanmoins, une utilisation rationnelle de l'énergie demeure l'une des mesures les plus performantes et économiquement avantageuses. Des réductions importantes de la consommation peuvent être obtenues par une aération appropriée et par l'ajustement à la baisse de la température ambiante durant la période hivernale.",
    revalorisation: "La rénovation énergétique offre une opportunité intéressante pour améliorer durablement le confort et préserver la valeur d'un bâtiment. Elle permet de créer des surfaces habitables supplémentaires grâce à des surélévations ou des extensions, de repenser l'agencement des espaces intérieurs ou d'agrandir les balcons existants. L'amélioration du confort et le maintien de la valeur à long terme représentent des objectifs importants de cette approche.",
    sondes_geo: "La parcelle est située dans une zone où l'utilisation de sondes géothermiques est en principe admissible selon les données cadastrales disponibles. Toutefois, une vérification auprès des autorités compétentes reste nécessaire avant tout engagement, notamment pour l'obtention du permis de forage.",
    bornes_recharge: "Une borne de recharge pour véhicules électriques complète l'installation technique du bâtiment. Le CECB se concentre exclusivement sur l'énergie directement liée au bâtiment, notamment le chauffage, l'eau chaude sanitaire, l'éclairage et les installations techniques. La consommation électrique des véhicules électriques n'entre pas dans le bilan énergétique du bâtiment."
};

/* ===== FORM FIELD HELPERS ===== */

var RECUEIL_FIELDS = [
    'meta-address', 'meta-canton', 'meta-commune', 'meta-egid', 'meta-year', 'meta-type', 'meta-sre', 'meta-altitude', 'meta-floors', 'meta-apartments',
    'meta-coord-e', 'meta-coord-n',
    'meta-habitants', 'meta-studios', 'meta-2p', 'meta-3p', 'meta-4p', 'meta-5p', 'meta-6p', 'meta-6p-plus',
    'meta-temp', 'meta-suppl-reg',
    'toit-config', 'toit-type', 'toit-year', 'toit-isolation', 'toit-isol-cm', 'toit-isol-mat', 'toit-etat', 'toit-combles-comp', 'toit-pv',
    'murs-composition', 'murs-revetement', 'murs-year', 'murs-isolation', 'murs-isol-cm', 'murs-mitoyen',
    'murs-terre-composition', 'murs-terre-isolation', 'murs-terre-isol-cm', 'murs-terre-etat',
    'murs-nc-composition', 'murs-nc-isolation', 'murs-nc-isol-cm', 'murs-nc-etat',
    'fen-cadre', 'fen-vitrage', 'fen-year', 'fen-uw', 'fen-renov', 'fen-porte',
    'sols-terre-config', 'sols-terre-isolation', 'sols-terre-isol-cm',
    'sols-nc-config', 'sols-nc-isolation', 'sols-nc-isol-cm', 'sol-soussol', 'sol-usage',
    'pt-fenetres',
    'vent-vmc', 'vent-extraction',
    'chauf-source', 'chauf-puissance', 'chauf-year', 'chauf-distrib', 'chauf-conso', 'chauf-conso-years', 'chauf-appoint',
    'ecs-type', 'ecs-year', 'ecs-volume',
    'app-conso',
    'pv-existant', 'pv-puissance', 'pv-batterie'
];

function rv(id) { return (document.getElementById(id) || {}).value || ''; }
function sv(id, val) { var el = document.getElementById(id); if (el) el.value = val; }
function rvi(id) { return parseInt(rv(id)) || 0; }
function rvf(id) { return parseFloat(rv(id)) || 0; }

function fillTemplate(tpl, vars) {
    var t = tpl;
    for (var k in vars) {
        t = t.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k] || '[À COMPLÉTER]');
    }
    return t;
}

function recueilCollectFormData() {
    var data = {};
    RECUEIL_FIELDS.forEach(function (f) { data[f] = rv(f); });
    // transcript field removed — now uses file import
    return data;
}

function recueilLoadFormData(data) {
    if (!data) return;
    Object.entries(data).forEach(function (entry) {
        var k = entry[0], val = entry[1];
        if (k === 'transcript') return; // legacy field, skip
        var el = document.getElementById(k);
        if (el && val !== undefined && val !== null && val !== '') el.value = val;
    });
    updateToitFields();
    updateChauffageFields();
    updatePVFields();
    estimateUw();
    ['toit', 'fenetres', 'chauffage', 'ecs'].forEach(function (c) {
        var lifespans = { toit: 40, fenetres: 30, chauffage: 20, ecs: 20 };
        updateLifeIndicator(c, lifespans[c]);
    });
}

/* ===== AUTO-SAVE TO PROJECT STORE ===== */

var _recueilSaveTimeout = null;
function recueilAutoSave() {
    clearTimeout(_recueilSaveTimeout);
    _recueilSaveTimeout = setTimeout(function () {
        var pid = ProjectStore.getCurrentId();
        if (!pid) return;
        var formData = recueilCollectFormData();
        var generatedTexts = {};
        // Collect inline generated texts from .gen-textarea
        document.querySelectorAll('.gen-textarea').forEach(function (ta) {
            if (ta.id && ta.value) generatedTexts[ta.id] = ta.value;
        });
        ProjectStore.update(pid, 'recueil', { formData: formData, generatedTexts: generatedTexts });
    }, 2000);
}

/* ===== INLINE OUTPUT HELPERS ===== */

function renderSectionOutput(section, result) {
    var outputDiv = document.getElementById('output-' + section);
    if (!outputDiv) return;
    var eiTa = document.getElementById('gen-' + section + '-ei');
    var apTa = document.getElementById('gen-' + section + '-ap');
    if (eiTa) eiTa.value = result.ei || '';
    if (apTa) apTa.value = result.ap || '';
    outputDiv.style.display = 'block';
    updateCharCounter(section, 'ei');
    updateCharCounter(section, 'ap');
    // Remove undo-enhance buttons (text was regenerated)
    outputDiv.querySelectorAll('.btn-undo-enhance').forEach(function(b) { b.remove(); });
    delete _enhanceOriginals['gen-' + section + '-ei'];
    delete _enhanceOriginals['gen-' + section + '-ap'];
}

function onGenTextChange(textarea) {
    if (!textarea || !textarea.id) return;
    // Extract section and suffix from id like "gen-toit-ei"
    var parts = textarea.id.replace('gen-', '').split('-');
    var suffix = parts.pop(); // ei or ap
    var section = parts.join('-');
    updateCharCounter(section, suffix);
    recueilAutoSave();
}

function updateCharCounter(section, suffix) {
    var ta = document.getElementById('gen-' + section + '-' + suffix);
    var cc = document.getElementById('cc-' + section + '-' + suffix);
    if (ta && cc) {
        cc.textContent = ta.value.length + ' car.';
    }
}

/* ===== PER-SECTION TEXT GENERATION ===== */

function generateSection(section) {
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
    var toitMat = rv('toit-isol-mat');
    var toitAge = new Date().getFullYear() - (parseInt(toitYear) || new Date().getFullYear());
    var ei = '', ap = '';

    // Build isolation detail string (e.g. ", estimée à 12 cm de laine de verre")
    var isolDetail = '';
    if (toitCm && toitMat) isolDetail = ', estimée à ' + toitCm + ' cm de ' + toitMat;
    else if (toitCm) isolDetail = ', estimée à ' + toitCm + ' cm';
    else if (toitMat) isolDetail = ', constituée de ' + toitMat;

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
        ei = fillTemplate(BLOCS.toit.ei_plancher_combles, { composition: comp, isolation_desc: toitIsol === 'conforme' ? 'convenablement isolé' : 'faiblement isolé', materiau: rv('toit-isol-mat') || 'laine minérale' });
        ap = toitIsol === 'conforme' ? BLOCS.toit.ap_non_prioritaire : BLOCS.toit.ap_plancher_combles;
    } else if (toitConfig === 'plafond_non_chauffe') {
        ei = fillTemplate(BLOCS.toit.ei_plafond_nc, { isolation_desc: toitIsol === 'conforme' ? 'moyenne' : 'insuffisante' });
        ap = BLOCS.toit.ap_plafond_nc;
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
    if (isol === 'interieur') {
        ei = fillTemplate(BLOCS.murs_terre.ei_isole_interieur, { cm: cm || '[X]' });
        ap = BLOCS.murs_terre.ap_non_prioritaire;
    } else if (isol === 'perimetrique') {
        ei = fillTemplate(BLOCS.murs_terre.ei_isole_perimetrique, { cm: cm || '[X]' });
        ap = BLOCS.murs_terre.ap_non_prioritaire;
    } else {
        ei = fillTemplate(BLOCS.murs_terre.ei_sans_isolation, { composition_desc: compLabels[comp] || comp });
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
    if (isol === 'oui' || isol === 'interieur') {
        ei = fillTemplate(BLOCS.murs_nc.ei_isole, { cm: cm || '[X]' });
        ap = BLOCS.murs_nc.ap_non_prioritaire;
    } else {
        ei = fillTemplate(BLOCS.murs_nc.ei_sans_isolation, { composition_desc: compLabels[comp] || comp });
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
    var ei = '', ap = '';
    if (rv('pv-existant') === 'oui') {
        ei = fillTemplate(BLOCS.pv.ei_oui, { puissance: rv('pv-puissance') || '[X]' });
        ap = "L'extension de l'installation existante peut être envisagée pour augmenter la couverture des besoins électriques.";
    } else { ei = BLOCS.pv.ei_non; ap = BLOCS.pv.ap_installation; }
    if (chaufSrc && chaufSrc.startsWith('pac_')) ap += ' ' + BLOCS.pv.ap_pac;
    return { ei: ei, ap: ap };
}

/* ===== LEGACY generateText() — generates all sections at once ===== */

function generateText() {
    var allSections = ['toit', 'murs-ext', 'murs-terre', 'murs-nc', 'fenetres', 'sols-terre', 'sols-nc', 'ventilation', 'chauffage', 'ecs', 'appareils', 'pv'];
    allSections.forEach(function (s) { generateSection(s); });
    recueilToast('Tous les textes générés');
}

/* ===== COPY ALL ===== */

function recueilCopyField(id) {
    var el = document.getElementById(id);
    if (el) { navigator.clipboard.writeText(el.value); recueilToast('Copié !'); }
}

function recueilCopyAll() {
    var textareas = document.querySelectorAll('.gen-textarea');
    var all = '';
    var sectionLabels = {
        'toit': 'Toit', 'murs-ext': 'Murs contre extérieur', 'murs-terre': 'Murs contre terre',
        'murs-nc': 'Murs c/ non chauffé', 'fenetres': 'Fenêtres et portes',
        'sols-terre': 'Sols c/ terre', 'sols-nc': 'Sols c/ non chauffé',
        'ponts-thermiques': 'Ponts thermiques',
        'ventilation': 'Ventilation', 'chauffage': 'Chauffage', 'ecs': 'Eau chaude sanitaire',
        'appareils': 'Appareils et éclairage', 'pv': 'Photovoltaïque'
    };
    textareas.forEach(function (ta) {
        if (!ta.value.trim()) return;
        var parts = ta.id.replace('gen-', '').split('-');
        var suffix = parts.pop();
        var section = parts.join('-');
        var label = sectionLabels[section] || section;
        var suffixLabel = suffix === 'ei' ? 'État initial' : 'Améliorations';
        all += label + ' — ' + suffixLabel + '\n' + ta.value + '\n\n';
    });
    if (all) {
        navigator.clipboard.writeText(all);
        recueilToast('Tout le texte copié !');
    } else {
        recueilToast('Aucun texte à copier', 'error');
    }
}

/* ===== CLAUDE API — ENHANCE (simplified wrapper) ===== */

// Store original texts before enhance (keyed by fieldId)
var _enhanceOriginals = {};

async function enhanceField(fieldId, fieldLabel) {
    var apiKey = localStorage.getItem('cecb_api_key');
    if (!apiKey) { recueilToast('Configurez votre clé API dans les paramètres (page d\'accueil)', 'error'); return; }

    var ta = document.getElementById(fieldId);
    if (!ta || !ta.value.trim()) { recueilToast('Aucun texte à enrichir', 'error'); return; }

    // Save original text before enhancing
    _enhanceOriginals[fieldId] = ta.value;

    var model = localStorage.getItem('cecb_api_model') || 'claude-sonnet-4-20250514';
    var outputField = ta.closest('.output-field');
    var btn = outputField.querySelector('.btn-warning');
    var btnOrig = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = 'En cours...'; btn.disabled = true; }

    var systemPrompt = "Tu es un rédacteur technique pour des rapports CECB/CECB Plus. Améliore le texte en corrigeant la grammaire et l'orthographe, et en reformulant légèrement pour une meilleure fluidité et clarté. Règles : conserve le sens exact et toutes les données techniques (valeurs, années, mesures). Ne rajoute aucune information ni aucune phrase nouvelle. N'utilise jamais 'nous constatons', 'nous observons', 'nous notons', 'il est à noter', 'il convient de'. Supprime les passages entre crochets [...] marqués 'à compléter'. Retourne UNIQUEMENT le texte amélioré.";
    var userMsg = 'Améliore le texte ci-dessous : corrige la grammaire et l\'orthographe, reformule légèrement les phrases pour plus de fluidité et de clarté. Ne change pas le sens, ne rajoute aucune information nouvelle. Conserve toutes les données techniques. Envoie uniquement le texte amélioré.\n\n' + ta.value;

    try {
        var resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
            body: JSON.stringify({ model: model, max_tokens: 2048, system: systemPrompt, messages: [{ role: 'user', content: userMsg }] })
        });
        if (!resp.ok) { recueilToast('Erreur API: ' + resp.status, 'error'); return; }
        var data = await resp.json();
        var enriched = ((data.content || [])[0] || {}).text || '';
        // Remove any remaining [... à compléter] markers
        enriched = enriched.replace(/\s*\[[^\]]*(?:compléter|manquant)[^\]]*\]\s*/gi, ' ').replace(/\s{2,}/g, ' ');
        if (enriched.trim()) {
            ta.value = enriched.trim();
            onGenTextChange(ta);
            showUndoEnhance(fieldId, fieldLabel, outputField);
            recueilToast(fieldLabel + ' amélioré');
        }
    } catch (e) { recueilToast('Erreur: ' + e.message, 'error'); }
    finally { if (btn) { btn.innerHTML = btnOrig; btn.disabled = false; } }
}

function showUndoEnhance(fieldId, fieldLabel, outputField) {
    // Remove existing undo button if any
    var existing = outputField.querySelector('.btn-undo-enhance');
    if (existing) existing.remove();
    // Add undo button
    var btnsDiv = outputField.querySelector('.output-field-btns');
    if (!btnsDiv) return;
    var undoBtn = document.createElement('button');
    undoBtn.className = 'btn btn-sm btn-undo-enhance';
    undoBtn.textContent = 'Annuler';
    undoBtn.style.cssText = 'background:#64748B;color:#fff;';
    undoBtn.onclick = function () {
        var ta = document.getElementById(fieldId);
        if (ta && _enhanceOriginals[fieldId]) {
            ta.value = _enhanceOriginals[fieldId];
            onGenTextChange(ta);
            delete _enhanceOriginals[fieldId];
            recueilToast(fieldLabel + ' — texte initial restauré');
        }
        undoBtn.remove();
    };
    btnsDiv.appendChild(undoBtn);
}

/* Keep enrichField for backward compatibility */
async function enrichField(fieldId, fieldLabel) {
    var apiKey = localStorage.getItem('cecb_api_key');
    if (!apiKey) { recueilToast('Configurez votre clé API dans les paramètres (page d\'accueil)', 'error'); return; }

    var ta = document.getElementById(fieldId);
    if (!ta || !ta.value.trim()) { recueilToast('Aucun texte à enrichir', 'error'); return; }

    var preview = ta.value.length > 120 ? ta.value.substring(0, 120) + '...' : ta.value;
    var instruction = prompt('Enrichir avec Claude :\n\n' + fieldLabel + '\n« ' + preview + ' »\n\nInstruction (vide = amélioration stylistique) :');
    if (instruction === null) return;

    var model = localStorage.getItem('cecb_api_model') || 'claude-sonnet-4-20250514';
    var btn = ta.parentElement.querySelector('.btn-warning');
    var btnOrig = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = 'En cours...'; btn.disabled = true; }

    var systemPrompt = "Tu es un rédacteur technique pour des rapports CECB/CECB Plus. Améliore le texte en corrigeant la grammaire et l'orthographe, et en reformulant légèrement pour une meilleure fluidité et clarté. Règles : conserve le sens exact et toutes les données techniques (valeurs, années, mesures). Ne rajoute aucune information ni aucune phrase nouvelle. N'utilise jamais 'nous constatons', 'nous observons', 'nous notons', 'il est à noter', 'il convient de'. Supprime les passages entre crochets [...] marqués 'à compléter'. Retourne UNIQUEMENT le texte amélioré.";
    var userMsg = instruction.trim() ? 'Consigne : ' + instruction + '\n\nTexte :\n\n' + ta.value : 'Améliore le texte ci-dessous : corrige la grammaire et l\'orthographe, reformule légèrement les phrases pour plus de fluidité et de clarté. Ne change pas le sens, ne rajoute aucune information nouvelle. Envoie uniquement le texte amélioré.\n\n' + ta.value;

    try {
        var resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
            body: JSON.stringify({ model: model, max_tokens: 2048, system: systemPrompt, messages: [{ role: 'user', content: userMsg }] })
        });
        if (!resp.ok) { recueilToast('Erreur API: ' + resp.status, 'error'); return; }
        var data = await resp.json();
        var enriched = ((data.content || [])[0] || {}).text || '';
        if (enriched.trim()) { ta.value = enriched.trim(); recueilToast(fieldLabel + ' enrichi'); recueilAutoSave(); }
    } catch (e) { recueilToast('Erreur: ' + e.message, 'error'); }
    finally { if (btn) { btn.innerHTML = btnOrig; btn.disabled = false; } }
}

/* ===== TRANSCRIPT ANALYSIS ===== */

async function analyzeTranscript(transcriptText) {
    var apiKey = localStorage.getItem('cecb_api_key');
    if (!apiKey) { recueilToast('Configurez votre clé API', 'error'); return; }

    if (!transcriptText || !transcriptText.trim()) { recueilToast('Transcript vide', 'error'); return; }

    var status = document.getElementById('transcript-status');
    var btn = document.getElementById('btnImportTranscript');
    if (status) status.innerHTML = 'Étape 1/2 — Extraction des données...';
    if (btn) { btn.disabled = true; btn.textContent = 'Analyse...'; }
    var model = localStorage.getItem('cecb_api_model') || 'claude-sonnet-4-20250514';
    var headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };

    try {
        // STEP 1: Extract structured fields
        var fieldsPrompt = 'Analyse cette transcription de visite CECB et extrais les informations structurées au format JSON.\n\nRetourne UNIQUEMENT un objet JSON valide avec cette structure :\n{"meta":{"canton":"","commune":"","adresse":"","annee_construction":null,"type":"","sre":null},"toit":{"config":"","type":"","annee":null,"isolation":"","isolation_cm":null,"materiau":"","etat":"","pv":"","combles_comp":""},"murs":{"composition":"","revetement":"","isolation":"","isolation_cm":null,"mitoyen":"non"},"murs_terre":{"composition":"","isolation":"","isol_cm":null,"etat":""},"murs_nc":{"composition":"","isolation":"","isol_cm":null,"etat":""},"fenetres":{"cadre":"","vitrage":"","annee":null,"cadres_renov":"","porte":""},"sols_terre":{"config":"","isolation":"","isol_cm":null},"sols_nc":{"config":"","isolation":"","isol_cm":null,"soussol":"","usage":""},"ventilation":{"vmc":"","extraction":""},"chauffage":{"source":"","puissance":null,"annee":null,"distribution":"","conso":"","conso_years":null,"appoint":""},"ecs":{"type":"","annee":null,"volume":null},"appareils":{"conso":""},"pv":{"existant":"","puissance":null,"batterie":"non"}}\n\nTranscription :\n' + transcriptText;

        var resp1 = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST', headers: headers,
            body: JSON.stringify({ model: model, max_tokens: 2048, messages: [{ role: 'user', content: fieldsPrompt }] })
        });
        if (resp1.ok) {
            var data1 = await resp1.json();
            var text1 = ((data1.content || [])[0] || {}).text || '';
            try {
                var match1 = text1.match(/\{[\s\S]*\}/);
                var json1 = JSON.parse(match1 ? match1[0] : text1);
                fillFromJSON(json1);
            } catch (e) { console.warn('Transcript fields parse error:', e); }
        }

        // STEP 2: Extract raw transcript passages per section
        if (status) status.innerHTML = 'Étape 2/2 — Extraction des passages...';
        var passagesPrompt = 'À partir de cette transcription de visite CECB, extrais les passages pertinents pour chaque section du rapport.\n\nRetourne UNIQUEMENT un objet JSON avec cette structure :\n{"toit":"","murs-ext":"","murs-terre":"","murs-nc":"","fenetres":"","sols-terre":"","sols-nc":"","ventilation":"","chauffage":"","ecs":"","appareils":"","pv":""}\n\nRègles :\n- Pour chaque section, copie les passages bruts du transcript qui concernent cet élément constructif\n- Regroupe les passages pertinents même s\'ils sont dispersés dans le transcript\n- Garde le texte tel quel, sans réécrire ni reformuler\n- Si une section n\'est pas mentionnée dans le transcript, laisse la valeur vide ""\n- Sections : toit (toiture, isolation entre/sur chevrons, tuiles, combles), murs-ext (murs contre extérieur, composition, isolation), murs-terre (murs contre terre, sous-sol enterré), murs-nc (murs contre non-chauffé), fenetres (fenêtres, vitrages, cadres, portes), sols-terre (radier, terre-plein, dalle sur sol), sols-nc (dalle contre non-chauffé, plancher), ventilation (VMC, aération), chauffage (chaudière, PAC, distribution, consommations), ecs (eau chaude sanitaire, boiler), appareils (appareils électriques, éclairage), pv (panneaux solaires, photovoltaïque)\n\nTranscription :\n' + transcriptText;

        var resp2 = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST', headers: headers,
            body: JSON.stringify({ model: model, max_tokens: 4096, messages: [{ role: 'user', content: passagesPrompt }] })
        });
        if (resp2.ok) {
            var data2 = await resp2.json();
            var text2 = ((data2.content || [])[0] || {}).text || '';
            console.log('Transcript passages response:', text2.substring(0, 200));
            try {
                var match2 = text2.match(/\{[\s\S]*\}/);
                var json2 = JSON.parse(match2 ? match2[0] : text2);
                fillTranscriptPassages(json2);
                // Save passages for recall
                var pid = ProjectStore.getCurrentId();
                if (pid) ProjectStore.update(pid, 'recueil', { transcriptPassages: json2 });
            } catch (e) { console.warn('Transcript passages parse error:', e, text2.substring(0, 300)); }
        } else {
            console.warn('Transcript passages API error:', resp2.status);
        }

        if (status) status.textContent = '';
        recueilToast('Fichier importé');
        recueilAutoSave();
    } catch (e) { if (status) status.textContent = 'Erreur: ' + e.message; }
    finally { if (btn) { btn.disabled = false; btn.textContent = 'Importer Transcript'; } }
}

function fillTranscriptPassages(passages) {
    var sections = ['toit','murs-ext','murs-terre','murs-nc','fenetres','sols-terre','sols-nc','ventilation','chauffage','ecs','appareils','pv'];
    sections.forEach(function(section) {
        var text = passages[section];
        if (!text) return;
        var eiTa = document.getElementById('gen-' + section + '-ei');
        if (eiTa) eiTa.value = text;
        var outputDiv = document.getElementById('output-' + section);
        if (outputDiv) outputDiv.style.display = 'block';
        updateCharCounter(section, 'ei');
    });
}

function recallTranscriptPassages() {
    var pid = ProjectStore.getCurrentId();
    if (!pid) { recueilToast('Aucun projet ouvert', 'error'); return; }
    var project = ProjectStore.get(pid);
    var passages = project && project.recueil && project.recueil.transcriptPassages;
    if (!passages) { recueilToast('Aucun transcript importé', 'error'); return; }
    fillTranscriptPassages(passages);
    recueilToast('Textes du transcript restaurés');
    recueilAutoSave();
}

/* ===== AUDIO TRANSCRIPTION + CECB v3 GENERATION ===== */

var CECB_V3_PROMPT = 'Tu es Gérard Merminod, expert CECB, directeur d\'Êta Consult Sàrl à Rolle (VD). Tu rédiges les textes du rapport CECB depuis la transcription audio d\'une visite. Tu écris à la 1re personne du pluriel. Cantons couverts : VD, GE.\n\n'
+ '=== RÈGLES D\'ÉCRITURE ===\n'
+ 'PROSE NARRATIVE OBLIGATOIRE. Pas de puces, tirets, listes. Pas d\'abréviations non développées. Pas de plages de valeurs. Pas de références SIA dans le texte. Pas de points-virgules. Phrases complètes, transitions fluides, contexte narratif. Vocabulaire : "déperditions thermiques", "performances thermiques", "ITE", "Programme Bâtiments", "énergies renouvelables". Hypothèses marquées : "selon toute probabilité", "vraisemblablement", "nous estimons".\n\n'
+ '=== PROCESSUS ===\n'
+ 'Extraire les faits du transcript puis générer les textes en utilisant les arbres de décision et blocs textuels suivants.\n\n'
+ '=== ARBRES DE DÉCISION ===\n'
+ '--- TOIT ---\n'
+ 'Cas A (toiture isolée) : SI conforme → "non prioritaire" | SI insuffisante → "rénovation lors entretien" | SI aucune → "recommandée". PV → "vérifier charpente"\n'
+ 'Cas B (plancher combles = barrière thermique) : combles non chauffés, décrire composition + isolation. PB M-01 : U≤0.20\n'
+ 'Cas C (plafonds vs non-chauffé) : NON subventionné PB seul\n'
+ '--- MURS ---\n'
+ 'Façades : sans isolation→ITE | double paroi époque→ITE | ITE existante→vérifier | ossature bois→complexité | moellons. Mitoyen→pas de travaux. Sondage si ITE. PB M-01 : U≤0.20→40/m², U≤0.15→70/m²\n'
+ 'Sous-sol var.1 (vs non-chauffé) : NON subventionné PB, U<0.25\n'
+ 'Sous-sol var.2 (vs terrain) : PB M-01 si enterré >2m, U≤0.25→40/m²\n'
+ '--- FENÊTRES ---\n'
+ 'Estimer Uw. Uw≤1.0→"non prioritaire" | 1.0-1.3→"légèrement inférieur" | >1.3→"remplacement". NON subventionné PB seul. Cadres rénovation→mentionner ITE.\n'
+ '--- SOL ---\n'
+ 'Cas A (dalle vs non-chauffé) : isolation sous-face, U<0.25. NON subventionné PB seul\n'
+ 'Cas B (radier contre terre) : coût potentiellement disproportionné. PB M-01 : U≤0.20\n'
+ 'Cas C (terre-plein) : coût disproportionné\n'
+ '--- VENTILATION ---\n'
+ 'Sans VMC → texte standard + recommander VMC simple flux. PB M-09 : 2400/logement (CECB env. A-C)\n'
+ '--- CHAUFFAGE ---\n'
+ 'Fossile → remplacement EnR + PB M-02 à M-08 + condition classe A-E (A-C si >1000m) si avant 2000\n'
+ 'Élec. centralisé VD → DACCE (remplacement avant 2033, assouplissements : A-C dispense, D-E→2038, F-G→2033) + PB M-02 à M-07\n'
+ 'Élec. décentralisé VD → DACCE + alternatives (enveloppe A-C ou PV 25%) + IP-19 si 1er réseau hydraulique\n'
+ 'Élec. GE → remplacement recommandé (pas de DACCE)\n'
+ 'PAC → améliorer enveloppe | CAD → aucune recommandation\n'
+ '--- ECS ---\n'
+ 'Fossile → remplacement avec chauffage\n'
+ 'CE élec. centralisé VD → DACCE complet\n'
+ 'CE élec. décentralisé VD → DACCE + alternative PV 60% ECS + exemption si chauffage déjà renouvelable\n'
+ 'Thermodynamique/PAC/CAD → aucune recommandation\n'
+ '--- PV ---\n'
+ 'Pas de PV → installation recommandée + Pronovo. PAC existante → "couplage pertinent". PV existant → extension.\n\n'
+ '=== BLOCS TEXTUELS (exemples à adapter) ===\n'
+ '--- TOIT ---\n'
+ 'EI toiture inclinée : "Le bâtiment est couvert d\'une toiture traditionnelle inclinée, installée lors de sa construction en [année]. Cette toiture présente une isolation thermique [description], conforme aux standards de l\'époque de construction."\n'
+ 'EI toiture plate rénovée : "Le bâtiment est couvert par une toiture plate. Une intervention de rénovation thermique a été réalisée en [année] par l\'ajout d\'une couche d\'isolation thermique que nous estimons à [X] cm d\'XPS."\n'
+ 'EI plancher combles : "Le plancher des combles sépare l\'espace chauffé des combles non chauffés. Il est constitué de [ossature bois / dalle béton] et est [convenablement isolé / faiblement isolé] avec [matériau]."\n'
+ 'AP rénovation recommandée : "En cas de travaux importants sur la couverture ou dans le cadre de son entretien, il est recommandé d\'envisager simultanément l\'amélioration de l\'isolation thermique de la toiture. Pour bénéficier des subventions du Programme Bâtiments (mesure M-01), il est nécessaire d\'atteindre une valeur U inférieure à 0,20 W/m²K."\n'
+ 'AP non prioritaire : "Bien que l\'amélioration de l\'isolation de la toiture ne constitue pas une priorité immédiate, elle reste une intervention pertinente, à planifier lors des prochains travaux de rénovation lourds."\n'
+ '--- MURS ---\n'
+ 'EI sans isolation : "Depuis l\'année [année], aucune intervention thermique significative n\'a été réalisée en vue d\'améliorer l\'isolation thermique des façades. [Description composition]. Elles offrent une isolation thermique très limitée en comparaison à un bâtiment neuf."\n'
+ 'EI double paroi : "Les façades du bâtiment présentent essentiellement une maçonnerie à double paroi avec une isolation intermédiaire évaluée à [X] cm d\'EPS."\n'
+ 'EI avec ITE : "Les façades du bâtiment sont constituées de maçonnerie homogène avec une isolation par l\'extérieur. En tenant compte de l\'année de construction, une épaisseur d\'isolation de [X] cm a été retenue."\n'
+ 'EI moellons : "Les façades sont constituées de maçonnerie de moellons, caractéristique de l\'époque de construction du bâtiment."\n'
+ 'AP ITE : "L\'installation d\'une isolation thermique par l\'extérieur (ITE) représente une option intéressante lors d\'une rénovation des façades. Pour bénéficier des subventions du Programme Bâtiments (mesure M-01), une valeur U inférieure à 0,20 W/m²K est nécessaire."\n'
+ '--- FENÊTRES ---\n'
+ 'EI insuffisante : "Le bâtiment est équipé principalement de fenêtres à cadre [type] et à double vitrage, séparés par un intercalaire en aluminium. Le pouvoir isolant de ces fenêtres est [légèrement] inférieur aux recommandations pour les nouvelles constructions."\n'
+ 'AP remplacement : "Nous recommandons le remplacement des fenêtres par des modèles à triple vitrage. Le remplacement de fenêtres n\'est pas éligible aux subventions du Programme Bâtiments de manière isolée."\n'
+ '--- SOL ---\n'
+ 'EI dalle vs non-chauffé : "Le plancher du rez-de-chaussée assure la séparation thermique entre les espaces non chauffés du sous-sol et le volume chauffé. Il est constitué d\'une dalle en maçonnerie homogène et ne dispose d\'aucune isolation thermique en sous-face."\n'
+ 'EI radier : "En l\'absence de plans d\'exécution ou de sondage, il est difficile de définir le détail constructif du radier contre terre. Ce dernier ne présente vraisemblablement pas ou peu d\'isolation."\n'
+ 'AP dalle : "Nous recommandons d\'isoler la dalle du rez-de-chaussée en ajoutant une isolation en sous-face. Une valeur U inférieure à 0,25 W/m²K est requise. Ces travaux ne sont pas éligibles aux subventions du Programme Bâtiments de manière isolée."\n'
+ '--- VENTILATION ---\n'
+ 'EI standard : "Le bâtiment ne dispose pas de système de ventilation mécanique. Le renouvellement de l\'air est effectué par l\'ouverture manuelle des fenêtres. Les locaux humides sont équipés de ventilateurs avec temporisation."\n'
+ 'AP standard : "L\'intégration d\'une ventilation mécanique contrôlée (VMC) simple flux avec récupération de chaleur peut être réalisée efficacement lors de travaux de rénovation. L\'installation d\'une VMC double flux bénéficie d\'une subvention du Programme Bâtiments (mesure M-09) de CHF 2\'400 par unité d\'habitation, à condition que le bâtiment atteigne une classe CECB enveloppe A à C."\n'
+ '--- CHAUFFAGE ---\n'
+ 'EI fossile : "Le bâtiment dispose d\'une chaudière à [gaz/mazout] à condensation d\'une puissance de [X] kW, mise en service en [année]. Celle-ci ne satisfait plus entièrement aux standards techniques actuels."\n'
+ 'AP fossile : "Nous recommandons de remplacer, à terme, la chaudière existante par un système exploitant les énergies renouvelables. Le remplacement peut bénéficier de subventions du Programme Bâtiments (mesures M-02 à M-08). Pour les bâtiments construits avant 2000, une classe CECB de l\'enveloppe comprise entre A et E doit être justifiée."\n'
+ 'AP élec. centralisé VD (DACCE) : "Depuis le 1er janvier 2025, le décret vaudois sur l\'assainissement des chauffages et chauffe-eau électriques (DACCE, BLV 730.051) est en vigueur. Ce décret interdit l\'utilisation de ces installations et impose leur remplacement d\'ici le 1er janvier 2033. Les propriétaires sont tenus de déclarer leurs installations. Des assouplissements sont prévus : les bâtiments de classes CECB A à C bénéficient d\'une dispense provisoire, les classes D à E d\'une prolongation au 1er janvier 2038, les classes F à G doivent respecter le délai du 1er janvier 2033."\n'
+ '--- ECS ---\n'
+ 'EI fossile : "La production d\'eau chaude sanitaire est assurée par la chaudière existante, datant de [année]."\n'
+ 'EI CE électrique : "La production d\'eau chaude sanitaire est assurée par [un/plusieurs] chauffe-eau électrique[s]. Le recours à l\'électricité directe pour la production d\'ECS est coûteux et n\'est pas recommandé."\n'
+ 'AP remplacement EnR : "Il est recommandé de remplacer le système d\'ECS actuel. La production pourra être assurée par le nouveau système de chauffage renouvelable."\n'
+ '--- APPAREILS ---\n'
+ 'EI : "Les appareils électriques installés présentent différentes classes d\'efficacité énergétique et sont globalement conformes aux normes en vigueur."\n'
+ 'AP : "Le remplacement d\'appareils obsolètes par des modèles plus récents contribue à améliorer l\'efficacité énergétique. Recommandation : consulter www.topten.ch."\n'
+ '--- PHOTOVOLTAÏQUE ---\n'
+ 'EI pas de PV : "Aucune installation photovoltaïque n\'a été constatée lors de la visite."\n'
+ 'AP installation : "Il est recommandé d\'envisager l\'installation de panneaux solaires photovoltaïques. Les travaux bénéficient de subventions de Pronovo."\n'
+ 'AP si PAC : "Le couplage de la pompe à chaleur avec une installation photovoltaïque est pertinent."\n'
+ '--- COMPORTEMENT UTILISATEUR ---\n'
+ '"Le CECB donne une évaluation de la performance énergétique du bâtiment dans des conditions d\'utilisation et d\'occupation standard. C\'est pourquoi la consommation effective d\'énergie, qui dépend beaucoup du comportement de l\'occupant, peut être très différente des données chiffrées du CECB."\n'
+ '--- REVALORISATION ---\n'
+ '"Conseils et recommandation : une rénovation énergétique est une occasion unique d\'améliorer à long terme le confort et de maintenir la valeur d\'un bâtiment. Une rénovation Minergie est à envisager."\n\n'
+ '=== DONNÉES TECHNIQUES ===\n'
+ 'Durées de vie : Fenêtres 30 ans, Murs/sols/plafonds 50 ans, Toiture 40 ans, Ventilation 20 ans, Chauffage/ECS 20 ans, PV 25 ans, Appareils 15 ans.\n'
+ 'Uw fenêtres : Avant 1960 simple ~5.0 | 1960-80 double ancien bois 2.5, PVC 2.6 | 1980-90 double isolant bois 1.9-2.0, PVC 2.0-2.2 | Après 1990 double sélectif bois 1.5-1.7, PVC 1.8-2.0 | Après 2010 triple bois 0.9-1.0, PVC 0.8-0.9\n'
+ 'PB 2026 M-01 : U≤0.20→40/m², U≤0.15→70/m², U≤0.15+PV→100/m². Murs/sols enterrés >2m : U≤0.25→40/m². Condition permis avant 2000.\n'
+ 'M-05 PAC air/eau : CHF 5000 (ind.) ou 400/kW. M-06 PAC sol/eau : CHF 20000 (ind.) ou 4000+800/kW. M-07 CAD : CHF 6000 (ind.) ou 4800+60/kW. M-09 VMC : 2400/logement.\n\n'
+ '=== STRUCTURE DE SORTIE ===\n'
+ 'Retourne UNIQUEMENT un objet JSON avec cette structure :\n'
+ '{"toit":{"ei":"...","ap":"..."},"murs-ext":{"ei":"...","ap":"..."},"murs-terre":{"ei":"...","ap":"..."},"murs-nc":{"ei":"...","ap":"..."},"fenetres":{"ei":"...","ap":"..."},"sols-terre":{"ei":"...","ap":"..."},"sols-nc":{"ei":"...","ap":"..."},"ventilation":{"ei":"...","ap":"..."},"chauffage":{"ei":"...","ap":"..."},"ecs":{"ei":"...","ap":"..."},"appareils":{"ei":"...","ap":"..."},"pv":{"ei":"...","ap":"..."},"comportement":"...","revalorisation":"..."}\n'
+ 'Chaque "ei" = état initial, "ap" = améliorations possibles. Si section non évoquée → laisser vide "".\n'
+ 'Ne JAMAIS inventer de données non présentes dans le transcript. Marquer les hypothèses.';

async function processAudioFile(file) {
    var groqKey = localStorage.getItem('cecb_groq_key');
    if (!groqKey) { recueilToast('Configurez votre clé API Groq dans Paramètres', 'error'); return; }
    var apiKey = localStorage.getItem('cecb_api_key');
    if (!apiKey) { recueilToast('Configurez votre clé API Claude dans Paramètres', 'error'); return; }

    var status = document.getElementById('transcript-status');
    var btn = document.getElementById('btnImportTranscript');
    if (btn) { btn.disabled = true; btn.textContent = 'Transcription...'; }

    try {
        // STEP 1: Transcribe audio via Groq Whisper
        if (status) status.innerHTML = 'Étape 1/3 — Transcription audio (Whisper)...';
        var formData = new FormData();
        formData.append('file', file);
        formData.append('model', 'whisper-large-v3');
        formData.append('language', 'fr');
        formData.append('response_format', 'text');

        var whisperResp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + groqKey },
            body: formData
        });

        if (!whisperResp.ok) {
            var errText = await whisperResp.text();
            throw new Error('Whisper: ' + whisperResp.status + ' — ' + errText.substring(0, 200));
        }

        var transcriptText = await whisperResp.text();
        console.log('Whisper transcription (' + transcriptText.length + ' chars):', transcriptText.substring(0, 300));
        if (!transcriptText.trim()) { recueilToast('Transcription vide', 'error'); return; }

        // Save raw transcript
        var pid = ProjectStore.getCurrentId();
        if (pid) ProjectStore.update(pid, 'recueil', { rawTranscript: transcriptText });

        // STEP 2: Extract structured fields
        if (status) status.innerHTML = 'Étape 2/3 — Extraction des données...';
        var model = localStorage.getItem('cecb_api_model') || 'claude-sonnet-4-20250514';
        var clHeaders = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };

        var fieldsPrompt = 'Analyse cette transcription de visite CECB et extrais les informations structurées au format JSON.\n\nRetourne UNIQUEMENT un objet JSON valide avec cette structure :\n{"meta":{"canton":"","commune":"","adresse":"","annee_construction":null,"type":"","sre":null},"toit":{"config":"","type":"","annee":null,"isolation":"","isolation_cm":null,"materiau":"","etat":"","pv":"","combles_comp":""},"murs":{"composition":"","revetement":"","isolation":"","isolation_cm":null,"mitoyen":"non"},"murs_terre":{"composition":"","isolation":"","isol_cm":null,"etat":""},"murs_nc":{"composition":"","isolation":"","isol_cm":null,"etat":""},"fenetres":{"cadre":"","vitrage":"","annee":null,"cadres_renov":"","porte":""},"sols_terre":{"config":"","isolation":"","isol_cm":null},"sols_nc":{"config":"","isolation":"","isol_cm":null,"soussol":"","usage":""},"ventilation":{"vmc":"","extraction":""},"chauffage":{"source":"","puissance":null,"annee":null,"distribution":"","conso":"","conso_years":null,"appoint":""},"ecs":{"type":"","annee":null,"volume":null},"appareils":{"conso":""},"pv":{"existant":"","puissance":null,"batterie":"non"}}\n\nTranscription :\n' + transcriptText;

        var resp1 = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST', headers: clHeaders,
            body: JSON.stringify({ model: model, max_tokens: 2048, messages: [{ role: 'user', content: fieldsPrompt }] })
        });
        if (resp1.ok) {
            var data1 = await resp1.json();
            var text1 = ((data1.content || [])[0] || {}).text || '';
            try {
                var match1 = text1.match(/\{[\s\S]*\}/);
                var json1 = JSON.parse(match1 ? match1[0] : text1);
                fillFromJSON(json1);
            } catch (e) { console.warn('Audio fields parse error:', e); }
        }

        // STEP 3: Generate CECB texts with full CECB v3 prompt
        if (status) status.innerHTML = 'Étape 3/3 — Rédaction des textes CECB...';
        if (btn) btn.textContent = 'Rédaction...';
        var cecbPrompt = CECB_V3_PROMPT + '\n\n=== TRANSCRIPTION DE LA VISITE ===\n' + transcriptText;

        var resp2 = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST', headers: clHeaders,
            body: JSON.stringify({ model: model, max_tokens: 8192, messages: [{ role: 'user', content: cecbPrompt }] })
        });
        if (resp2.ok) {
            var data2 = await resp2.json();
            var fullText = ((data2.content || [])[0] || {}).text || '';
            console.log('CECB v3 response (' + fullText.length + ' chars)');
            try {
                var match2 = fullText.match(/\{[\s\S]*\}/);
                var json2 = JSON.parse(match2 ? match2[0] : fullText);
                fillCecbV3Texts(json2);
            } catch (e) {
                console.warn('CECB v3 JSON parse error, trying text parse:', e);
                parseCecbV3FreeText(fullText);
            }
        } else {
            console.warn('CECB v3 API error:', resp2.status);
        }

        if (status) status.textContent = '';
        recueilToast('Audio importé et textes générés');
        recueilAutoSave();
    } catch (e) {
        console.error('Audio processing error:', e);
        if (status) status.textContent = '';
        recueilToast('Erreur: ' + e.message, 'error');
    }
    finally { if (btn) { btn.disabled = false; btn.textContent = 'Importer Transcript'; } }
}

function fillCecbV3Texts(json) {
    var sections = ['toit','murs-ext','murs-terre','murs-nc','fenetres','sols-terre','sols-nc','ventilation','chauffage','ecs','appareils','pv'];
    sections.forEach(function(section) {
        var t = json[section];
        if (!t) return;
        if (typeof t === 'string') {
            // Simple string → put in EI
            var eiTa = document.getElementById('gen-' + section + '-ei');
            if (eiTa && t) eiTa.value = t;
        } else {
            if (t.ei) { var eiTa = document.getElementById('gen-' + section + '-ei'); if (eiTa) eiTa.value = t.ei; }
            if (t.ap) { var apTa = document.getElementById('gen-' + section + '-ap'); if (apTa) apTa.value = t.ap; }
        }
        var outputDiv = document.getElementById('output-' + section);
        if (outputDiv) {
            outputDiv.style.display = 'block';
            updateCharCounter(section, 'ei');
            updateCharCounter(section, 'ap');
        }
    });
    // Complement sections
    if (json.comportement) { var ta = document.getElementById('gen-comportement'); if (ta) ta.value = json.comportement; }
    if (json.revalorisation) { var ta = document.getElementById('gen-revalorisation'); if (ta) ta.value = json.revalorisation; }
}

function parseCecbV3FreeText(text) {
    // Fallback: parse free-text response if JSON parsing fails
    var sectionPatterns = [
        { key: 'toit', re: /(?:^|\n)\s*(?:1[\.\)]\s*)?(?:Toit|TOIT|Toits? et plafonds)/i },
        { key: 'murs-ext', re: /(?:^|\n)\s*(?:2[\.\)]\s*)?(?:Murs|MURS|Façades)/i },
        { key: 'fenetres', re: /(?:^|\n)\s*(?:3[\.\)]\s*)?(?:Fen[eê]tres|FENÊTRES|Portes et fen[eê]tres)/i },
        { key: 'sols-terre', re: /(?:^|\n)\s*(?:4[\.\)]\s*)?(?:Sol|SOL|Sol et sous-sol)/i },
        { key: 'ventilation', re: /(?:^|\n)\s*(?:5[\.\)]\s*)?(?:Ventilation|VENTILATION)/i },
        { key: 'chauffage', re: /(?:^|\n)\s*(?:6[\.\)]\s*)?(?:Chauffage|CHAUFFAGE)/i },
        { key: 'ecs', re: /(?:^|\n)\s*(?:7[\.\)]\s*)?(?:Eau chaude|ECS|EAU CHAUDE)/i },
        { key: 'appareils', re: /(?:^|\n)\s*(?:8[\.\)]\s*)?(?:Appareils|APPAREILS)/i },
        { key: 'pv', re: /(?:^|\n)\s*(?:9[\.\)]\s*)?(?:Photovolta[iï]que|PV|PHOTOVOLTAÏQUE)/i },
        { key: 'comportement', re: /(?:^|\n)\s*(?:10[\.\)]\s*)?(?:Comportement|COMPORTEMENT)/i, comp: true },
        { key: 'revalorisation', re: /(?:^|\n)\s*(?:11[\.\)]\s*)?(?:Revalorisation|REVALORISATION)/i, comp: true }
    ];
    var eiRe = /(?:[ÉE]tat initial|EI)\s*[:—\-]?\s*/i;
    var apRe = /(?:Am[eé]liorations? possibles?|Am[eé]liorations? propos[eé]es?|AP)\s*[:—\-]?\s*/i;

    var positions = [];
    sectionPatterns.forEach(function(p) {
        var m = text.match(p.re);
        if (m) positions.push({ key: p.key, comp: !!p.comp, index: m.index });
    });
    positions.sort(function(a, b) { return a.index - b.index; });

    for (var i = 0; i < positions.length; i++) {
        var start = positions[i].index;
        var end = (i + 1 < positions.length) ? positions[i + 1].index : text.length;
        var sText = text.substring(start, end).trim();
        var key = positions[i].key;

        if (positions[i].comp) {
            var compTa = document.getElementById('gen-' + key);
            if (compTa) compTa.value = sText.replace(/^[^\n]*\n/, '').trim();
            continue;
        }

        var eiM = sText.match(eiRe);
        var apM = sText.match(apRe);
        var eiText = '', apText = '';
        if (eiM && apM) {
            eiText = sText.substring(eiM.index + eiM[0].length, apM.index).trim();
            apText = sText.substring(apM.index + apM[0].length).trim();
        } else if (eiM) {
            eiText = sText.substring(eiM.index + eiM[0].length).trim();
        } else {
            eiText = sText.replace(/^[^\n]*\n/, '').trim();
        }

        var eiTa = document.getElementById('gen-' + key + '-ei');
        var apTa = document.getElementById('gen-' + key + '-ap');
        if (eiTa && eiText) eiTa.value = eiText;
        if (apTa && apText) apTa.value = apText;
        var outputDiv = document.getElementById('output-' + key);
        if (outputDiv && (eiText || apText)) {
            outputDiv.style.display = 'block';
            if (eiText) updateCharCounter(key, 'ei');
            if (apText) updateCharCounter(key, 'ap');
        }
    }
}

function fillFromJSON(json) {
    function setV(id, val) { if (val !== null && val !== undefined && val !== '') { var el = document.getElementById(id); if (el) el.value = val; } }
    if (json.meta) { setV('meta-canton', json.meta.canton); setV('meta-commune', json.meta.commune); setV('meta-address', json.meta.adresse); setV('meta-year', json.meta.annee_construction); setV('meta-type', json.meta.type); setV('meta-sre', json.meta.sre); }
    if (json.toit) { setV('toit-config', json.toit.config); updateToitFields(); setV('toit-type', json.toit.type); setV('toit-year', json.toit.annee); setV('toit-isolation', json.toit.isolation); setV('toit-isol-cm', json.toit.isolation_cm); setV('toit-isol-mat', json.toit.materiau); setV('toit-etat', json.toit.etat); setV('toit-pv', json.toit.pv); setV('toit-combles-comp', json.toit.combles_comp); }
    if (json.murs) { setV('murs-composition', json.murs.composition); setV('murs-revetement', json.murs.revetement); setV('murs-isolation', json.murs.isolation); setV('murs-isol-cm', json.murs.isolation_cm); setV('murs-mitoyen', json.murs.mitoyen); }
    if (json.murs_terre) { setV('murs-terre-composition', json.murs_terre.composition); setV('murs-terre-isolation', json.murs_terre.isolation); setV('murs-terre-isol-cm', json.murs_terre.isol_cm); setV('murs-terre-etat', json.murs_terre.etat); }
    if (json.murs_nc) { setV('murs-nc-composition', json.murs_nc.composition); setV('murs-nc-isolation', json.murs_nc.isolation); setV('murs-nc-isol-cm', json.murs_nc.isol_cm); setV('murs-nc-etat', json.murs_nc.etat); }
    if (json.fenetres) { setV('fen-cadre', json.fenetres.cadre); setV('fen-vitrage', json.fenetres.vitrage); setV('fen-year', json.fenetres.annee); setV('fen-renov', json.fenetres.cadres_renov); setV('fen-porte', json.fenetres.porte); estimateUw(); }
    if (json.sols_terre) { setV('sols-terre-config', json.sols_terre.config); setV('sols-terre-isolation', json.sols_terre.isolation); setV('sols-terre-isol-cm', json.sols_terre.isol_cm); }
    if (json.sols_nc) { setV('sols-nc-config', json.sols_nc.config); setV('sols-nc-isolation', json.sols_nc.isolation); setV('sols-nc-isol-cm', json.sols_nc.isol_cm); setV('sol-soussol', json.sols_nc.soussol); setV('sol-usage', json.sols_nc.usage); }
    // Backward compat: old "sol" format
    if (json.sol && !json.sols_terre && !json.sols_nc) {
        if (json.sol.config === 'dalle_nc') { setV('sols-nc-config', 'dalle_beton'); setV('sols-nc-isolation', json.sol.isolation || 'aucune'); }
        else if (json.sol.config === 'radier' || json.sol.config === 'terre_plein') { setV('sols-terre-config', json.sol.config); setV('sols-terre-isolation', json.sol.isolation || 'aucune'); }
        if (json.sol.soussol) setV('sol-soussol', json.sol.soussol);
        if (json.sol.usage) setV('sol-usage', json.sol.usage);
    }
    if (json.ventilation) { setV('vent-vmc', json.ventilation.vmc); setV('vent-extraction', json.ventilation.extraction); }
    if (json.chauffage) { setV('chauf-source', json.chauffage.source); updateChauffageFields(); setV('chauf-puissance', json.chauffage.puissance); setV('chauf-year', json.chauffage.annee); setV('chauf-distrib', json.chauffage.distribution); setV('chauf-conso', json.chauffage.conso); setV('chauf-conso-years', json.chauffage.conso_years); setV('chauf-appoint', json.chauffage.appoint); }
    if (json.ecs) { setV('ecs-type', json.ecs.type); setV('ecs-year', json.ecs.annee); setV('ecs-volume', json.ecs.volume); }
    if (json.appareils) { setV('app-conso', json.appareils.conso); }
    if (json.pv) { setV('pv-existant', json.pv.existant); updatePVFields(); setV('pv-puissance', json.pv.puissance); setV('pv-batterie', json.pv.batterie); }
    if (json.toit && json.toit.annee) updateLifeIndicator('toit', 40);
    if (json.fenetres && json.fenetres.annee) updateLifeIndicator('fenetres', 30);
    if (json.chauffage && json.chauffage.annee) updateLifeIndicator('chauffage', 20);
    if (json.ecs && json.ecs.annee) updateLifeIndicator('ecs', 20);
}

/* ===== PDF EXPORT ===== */

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

/* ===== INIT RECUEIL ===== */

function initRecueil() {
    var pid = ProjectStore.getCurrentId();
    if (!pid) return;
    var project = ProjectStore.get(pid);
    if (!project) return;

    // Pre-fill address fields from project.address
    var addr = project.address || {};
    if (addr.label) document.getElementById('meta-address').value = addr.label;
    if (addr.canton) document.getElementById('meta-canton').value = addr.canton;
    if (addr.commune) document.getElementById('meta-commune').value = addr.commune;
    if (addr.egid) document.getElementById('meta-egid').value = addr.egid;
    if (addr.year) document.getElementById('meta-year').value = addr.year;
    if (addr.altitude) document.getElementById('meta-altitude').value = addr.altitude;
    if (addr.type) document.getElementById('meta-type').value = addr.type;
    if (addr.floors) document.getElementById('meta-floors').value = addr.floors;
    if (addr.dwellings) document.getElementById('meta-apartments').value = addr.dwellings;

    // Pre-fill coordinates E/N
    if (addr.coords) {
        if (addr.coords.easting) document.getElementById('meta-coord-e').value = Math.round(addr.coords.easting);
        if (addr.coords.northing) document.getElementById('meta-coord-n').value = Math.round(addr.coords.northing);
    }

    // Load saved recueil form data
    if (project.recueil && project.recueil.formData) {
        recueilLoadFormData(project.recueil.formData);
    }

    // Load saved generated texts into inline textareas
    if (project.recueil && project.recueil.generatedTexts) {
        var gt = project.recueil.generatedTexts;
        Object.keys(gt).forEach(function (key) {
            var ta = document.getElementById(key);
            if (ta && gt[key]) {
                ta.value = gt[key];
                // Show the output section
                var outputDiv = ta.closest('.section-output');
                if (outputDiv) outputDiv.style.display = 'block';
                // Update char counter
                var parts = key.replace('gen-', '').split('-');
                var suffix = parts.pop();
                var section = parts.join('-');
                updateCharCounter(section, suffix);
            }
        });
    }

    // Setup auto-save on form changes
    document.querySelectorAll('#tab-recueil select, #tab-recueil input, #tab-recueil textarea').forEach(function (el) {
        el.addEventListener('change', recueilAutoSave);
        el.addEventListener('input', recueilAutoSave);
    });

    // Conso years visibility
    var chaufConso = document.getElementById('chauf-conso');
    if (chaufConso) {
        chaufConso.addEventListener('change', function () {
            document.getElementById('chauf-conso-years-group').style.display = this.value === 'oui' ? 'flex' : 'none';
        });
    }

    // Building type change handler (show/hide RegBL housing)
    onBuildingTypeChange();

    // Enable/disable RegBL button based on EGID availability
    var btnRegbl = document.getElementById('btnRegbl');
    if (btnRegbl) {
        btnRegbl.disabled = !rv('meta-egid');
        btnRegbl.style.opacity = rv('meta-egid') ? '1' : '0.4';
        btnRegbl.style.cursor = rv('meta-egid') ? 'pointer' : 'not-allowed';
    }
}

/** Default texts for Complément sub-tab */
var COMPLEMENT_DEFAULTS = {
    revalorisation: "La rénovation énergétique offre une opportunité intéressante pour améliorer durablement le confort et préserver la valeur d'un bâtiment. Elle permet de créer des surfaces habitables supplémentaires grâce à des surélévations ou des extensions, de repenser l'agencement des espaces intérieurs ou d'agrandir les balcons existants. L'amélioration du confort et le maintien de la valeur à long terme représentent des objectifs importants de cette approche. Une rénovation énergétique est une occasion unique d'améliorer à long terme le confort et de maintenir la valeur d'un bâtiment. On peut créer des surfaces habitables supplémentaires par des surélévations ou des extensions ; on peut aussi revoir l'agencement des pièces ou agrandir des balcons. Il est pertinent d'optimiser le confort et le maintien de la valeur à long terme.",
    comportement: "Le CECB évalue la performance énergétique du bâtiment selon des conditions d'utilisation et d'occupation normalisées. La consommation énergétique effective dépend en grande partie du comportement des occupant·e·s et peut ainsi s'écarter significativement des valeurs indiquées par le CECB. Les recommandations du document CECB se concentrent exclusivement sur l'enveloppe du bâtiment et ses installations techniques. Néanmoins, une utilisation rationnelle de l'énergie demeure l'une des mesures les plus performantes et économiquement avantageuses. Des réductions importantes de la consommation peuvent être obtenues par une aération appropriée et par l'ajustement à la baisse de la température ambiante durant la période hivernale."
};

/** Reset a complement textarea to its original default text */
function resetComplementField(field) {
    var ta = document.getElementById('gen-' + field);
    if (ta && COMPLEMENT_DEFAULTS[field]) {
        ta.value = COMPLEMENT_DEFAULTS[field];
        recueilAutoSave();
    }
}

/** Open the RegBL extended info page for the current project's EGID */
function ouvrirRegbl() {
    var egid = rv('meta-egid');
    if (egid) {
        window.open('https://api3.geo.admin.ch/rest/services/ech/MapServer/ch.bfs.gebaeude_wohnungs_register/' + egid + '_0/extendedHtmlPopup?lang=fr', '_blank');
    }
}
