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

function toggleTranscriptPanel() {
    var panel = document.getElementById('transcript-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
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
    var section = document.getElementById('regbl-housing-section');
    if (typeVal === '1020' || typeVal === '1025') {
        section.style.display = 'block';
        fetchRegblHousing();
    } else {
        section.style.display = 'none';
    }
}

async function fetchRegblHousing() {
    var coordE = rv('meta-coord-e');
    var coordN = rv('meta-coord-n');
    var container = document.getElementById('regbl-housing-content');
    if (!coordE || !coordN) {
        container.innerHTML = '<p style="color:#888">Coordonnées non disponibles — impossible de charger les données RegBL.</p>';
        return;
    }
    container.innerHTML = '<p style="color:#888">Chargement des données RegBL...</p>';
    try {
        var resp = await fetch('https://api3.geo.admin.ch/rest/services/api/MapServer/identify?geometryType=esriGeometryPoint&geometry=' + coordE + ',' + coordN + '&layers=all:ch.bfs.gebaeude_wohnungs_register&mapExtent=0,0,100,100&imageDisplay=100,100,100&tolerance=10&returnGeometry=true');
        var data = await resp.json();
        if (!data.results || data.results.length === 0) {
            container.innerHTML = '<p style="color:#888">Aucune donnée RegBL trouvée pour ces coordonnées.</p>';
            return;
        }
        var b = data.results[0].attributes || {};
        var totalWhg = b.ganzwhg || 0;
        var html = '<table style="width:100%;border-collapse:collapse;font-size:.9em">';
        html += '<tr><td style="padding:6px;font-weight:600">Total logements (ganzwhg)</td><td style="padding:6px">' + totalWhg + '</td></tr>';
        var rooms = [
            { key: 'wazim1', label: '1 pièce' },
            { key: 'wazim2', label: '2 pièces' },
            { key: 'wazim3', label: '3 pièces' },
            { key: 'wazim4', label: '4 pièces' },
            { key: 'wazim5', label: '5 pièces' },
            { key: 'wazim6', label: '6+ pièces' }
        ];
        rooms.forEach(function (r) {
            var val = b[r.key] || 0;
            if (val > 0) {
                html += '<tr><td style="padding:6px;border-top:1px solid #eee">' + r.label + '</td><td style="padding:6px;border-top:1px solid #eee">' + val + '</td></tr>';
            }
        });
        html += '</table>';
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<p style="color:var(--r-danger)">Erreur lors du chargement: ' + e.message + '</p>';
    }
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
        ei_inclinee: "Le bâtiment est couvert d'une toiture traditionnelle inclinée, installée lors de sa construction en {year}. Cette toiture présente une isolation thermique {isolation_desc}{isolation_detail}. Elle est à l'origine de déperditions thermiques supérieures aux standards actuels pour les nouvelles constructions.",
        ei_plate_renovee: "Le bâtiment est couvert par une toiture plate. Une intervention de rénovation thermique a été réalisée en {year} par l'ajout d'une couche d'isolation thermique que nous estimons à {cm} cm d'XPS. Cette dernière dispose d'une bonne capacité isolante, équivalente aux exigences pour les nouvelles constructions.",
        ei_vieillissante: "La toiture, datant de la construction du bâtiment en {year}, montre des signes de vieillissement après {age} ans d'utilisation. Sa fin de vie théorique approche et des travaux d'entretien ou de remplacement sont à planifier.",
        ei_plancher_combles: "Le plancher des combles sépare l'espace chauffé des combles non chauffés. Il est constitué de {composition} et est {isolation_desc} avec {materiau}.",
        ei_plafond_nc: "Les plafonds contre local non chauffés présentent une isolation thermique {isolation_desc}.",
        ap_renovation: "En cas de travaux importants sur la couverture ou dans le cadre de son entretien, il est recommandé d'envisager simultanément l'amélioration de l'isolation thermique de la toiture. Pour bénéficier des subventions du Programme Bâtiments (mesure M-01), il est nécessaire d'atteindre une valeur U inférieure à 0,20 W/m²K, ce qui permettra de réduire considérablement les déperditions thermiques.",
        ap_non_prioritaire: "Bien que l'amélioration de l'isolation de la toiture ne constitue pas une priorité immédiate, elle reste une intervention pertinente, à planifier lors des prochains travaux de rénovation lourds.",
        ap_plancher_combles: "Il est recommandé d'optimiser l'isolation du plancher des combles en renforçant l'isolation existante. Pour bénéficier des subventions du Programme Bâtiments (mesure M-01, rubrique Toit), une valeur U inférieure à 0,20 W/m²K est requise.",
        ap_plafond_nc: "Des mesures d'isolation thermique des plafonds contre local non chauffés doivent être examinées lors des prochains travaux d'entretien. Ces travaux ne sont pas éligibles aux subventions du Programme Bâtiments de manière indépendante.",
        ap_pv: "Avant d'envisager l'installation de panneaux photovoltaïques, il est conseillé de faire vérifier la capacité portante de la charpente par un ingénieur civil."
    },
    murs: {
        ei_sans_isolation: "Depuis l'année {year}, aucune intervention thermique significative n'a été réalisée en vue d'améliorer l'isolation thermique des façades. {composition_desc}. Elles offrent une isolation thermique très limitée en comparaison à un bâtiment neuf, mais toutefois conforme aux standards de l'époque de la construction du bâtiment. Cette situation engendre des pertes énergétiques conséquentes.",
        ei_double_paroi: "Les façades du bâtiment présentent essentiellement une maçonnerie à double paroi avec une isolation intermédiaire évaluée à {cm} cm d'EPS. Dans cette configuration, l'isolation correspond aux standards en vigueur lors de la construction, mais ne satisfait pas aux exigences actuelles applicables aux bâtiments neufs.",
        ei_ite: "Les façades du bâtiment sont constituées de maçonnerie homogène avec une isolation par l'extérieur. En tenant compte de l'année de construction, une épaisseur d'isolation de {cm} cm a été retenue pour cette étude.",
        ei_ossature: "Les façades présentent une ossature en {type_ossature} avec un revêtement en {revetement}. Cette configuration offre une isolation thermique limitée. La complexité de la structure rend l'installation d'une ITE plus délicate que pour une façade en maçonnerie traditionnelle.",
        ei_moellons: "Les façades sont constituées de maçonnerie de moellons, caractéristique de l'époque de construction du bâtiment. Cette composition offre une inertie thermique intéressante mais une isolation insuffisante au regard des standards actuels.",
        ei_mitoyen: "Le bâtiment est contigu sur {cotes} côté(s). Les façades contiguës ne nécessitent pas de travaux d'amélioration thermique.",
        ap_ite: "L'installation d'une isolation thermique par l'extérieur (ITE) représente une option intéressante lors d'une rénovation des façades. Pour bénéficier des subventions du Programme Bâtiments (mesure M-01), une valeur U inférieure à 0,20 W/m²K est nécessaire.",
        ap_sondage: "Nous recommandons de réaliser un sondage de la façade avant d'engager des travaux d'amélioration thermique."
    },
    murs_terre: {
        ei_sans_isolation: "Les murs contre terrain ne présentent pas d'isolation thermique. Ils sont constitués de {composition_desc} et sont à l'origine de déperditions thermiques significatives.",
        ei_isole_interieur: "Des travaux d'amélioration thermique ont été réalisés sur les murs en contact avec le terrain. Une couche d'isolation d'environ {cm} cm d'EPS a été ajoutée par l'intérieur.",
        ei_isole_perimetrique: "Les murs contre terrain disposent d'une isolation périmétrique d'environ {cm} cm, posée côté extérieur. Cette configuration offre une protection thermique satisfaisante.",
        ap_isolation: "Des mesures d'isolation thermique des murs contre terrain devraient être planifiées. Pour les murs enterrés de plus de 2 mètres, une valeur U inférieure à 0,25 W/m²K permet de bénéficier des subventions du Programme Bâtiments (mesure M-01).",
        ap_non_prioritaire: "L'isolation des murs contre terrain ne constitue pas une priorité immédiate, compte tenu de leur état actuel."
    },
    murs_nc: {
        ei_sans_isolation: "Les murs adjacents à des locaux non chauffés sont homogènes, réalisés en {composition_desc} et dépourvus d'isolation.",
        ei_isole: "Les murs adjacents aux locaux non chauffés disposent d'une isolation de {cm} cm. Cette configuration offre une protection thermique acceptable.",
        ap_isolation: "Nous préconisons, à court terme et au titre de travaux correctifs, l'isolation des parois adjacentes aux locaux non chauffés. Ces travaux ne sont pas couverts par les subventions du Programme Bâtiments de manière indépendante. Une valeur U inférieure à 0,25 W/m²K est requise.",
        ap_non_prioritaire: "L'isolation des murs c/ non chauffé ne constitue pas une priorité immédiate, les performances actuelles étant jugées acceptables."
    },
    fenetres: {
        ei_insuffisante: "Le bâtiment est équipé principalement de fenêtres à cadre {cadre} et à {vitrage}, séparés par un intercalaire en aluminium. Le pouvoir isolant de ces fenêtres est {niveau} inférieur aux recommandations pour les nouvelles constructions.",
        ei_recentes: "Les fenêtres ont été remplacées en {year} par des modèles à {vitrage}. Elles présentent une isolation thermique conforme aux standards recommandés pour les constructions neuves.",
        ei_cadres_renov: "Les fenêtres ont été remplacées en {year} par des modèles à {vitrage} avec des cadres de rénovation permettant d'anticiper la pose future d'une ITE sans nécessiter un nouveau remplacement des fenêtres.",
        ei_porte: "L'ensemble menuisé d'accès au bâtiment est à l'origine de déperditions critiques dans le hall chauffé du bâtiment.",
        ap_remplacement: "Nous recommandons le remplacement des fenêtres par des modèles à triple vitrage. Le remplacement de fenêtres n'est pas éligible aux subventions du Programme Bâtiments de manière indépendante. Une valeur Uw inférieure à 1,00 W/m²K est nécessaire pour réduire significativement les déperditions thermiques.",
        ap_remplacement_cadre_renov: "Nous recommandons le remplacement des fenêtres par des modèles à triple vitrage avec cadres de rénovation, permettant d'anticiper la pose future d'une ITE sans nécessiter un nouveau remplacement des fenêtres. Le remplacement de fenêtres n'est pas éligible aux subventions du Programme Bâtiments de manière indépendante. Une valeur Uw inférieure à 1,00 W/m²K est nécessaire pour réduire significativement les déperditions thermiques.",
        ap_non_prioritaire: "À ce stade, aucune intervention n'est recommandée concernant les fenêtres, étant donné leurs performances satisfaisantes."
    },
    sols_terre: {
        ei_radier: "En l'absence de plans d'exécution ou de sondage, il est difficile de définir le détail constructif du radier contre terre. Ce dernier, constitué de maçonnerie, ne présente vraisemblablement pas ou peu d'isolation.",
        ei_terre_plein: "Les planchers du bâtiment sont en contact direct avec le terrain. Au regard de l'époque de construction, la présence d'une couche d'isolation thermique est considérée comme peu probable.",
        ei_isole: "Le sol contre terre dispose d'une isolation de {cm} cm. Cette configuration offre une performance thermique acceptable.",
        ap_radier: "L'isolation du plancher du sous-sol représente une option efficace. Toutefois, cette intervention implique généralement des travaux dont le coût peut s'avérer élevé. Pour bénéficier des subventions du Programme Bâtiments (mesure M-01), une valeur U inférieure à 0,25 W/m²K est nécessaire.",
        ap_terre_plein: "L'isolation du plancher constitue une option envisageable à long terme. Toutefois, le coût peut s'avérer disproportionné par rapport au gain énergétique attendu.",
        ap_non_prioritaire: "L'isolation du sol contre terre ne constitue pas une priorité, les performances actuelles étant jugées satisfaisantes."
    },
    sols_nc: {
        ei_dalle: "Le plancher du rez-de-chaussée assure la séparation thermique entre les espaces non chauffés du sous-sol et le volume chauffé. Il est constitué d'une dalle en maçonnerie homogène et ne dispose d'aucune isolation thermique en sous-face.",
        ei_hourdis: "Le plancher du rez-de-chaussée est constitué de hourdis et assure la séparation thermique entre les espaces non chauffés et le volume chauffé. Il ne dispose d'aucune isolation thermique en sous-face.",
        ei_isole: "Le plancher c/ non chauffé dispose d'une isolation en sous-face de {cm} cm. Cette configuration offre une performance thermique acceptable.",
        ap_dalle: "Nous recommandons d'isoler la dalle du rez-de-chaussée en ajoutant une isolation en sous-face, tout en préservant l'accès aux installations techniques du plafond. Une valeur U inférieure à 0,25 W/m²K est requise. Ces travaux ne sont pas éligibles aux subventions du Programme Bâtiments de manière indépendante.",
        ap_non_prioritaire: "L'isolation de la dalle c/ non chauffé ne constitue pas une priorité, les performances actuelles étant jugées satisfaisantes."
    },
    ponts_thermiques: {
        ei_standard: "Lors de l'évaluation thermique initiale, lorsque l'isolation existante est insuffisante ou négligeable, les ponts thermiques linéaires ne sont pas inclus dans le calcul du bilan thermique.",
        ei_avec_fenetres: "Lors d'une évaluation thermique initiale, lorsque l'isolation existante est insuffisante ou négligeable, les ponts thermiques linéaires ne sont pas inclus dans le calcul du bilan thermique. Les fenêtres présentent des ponts thermiques courants au niveau des embrasures, des linteaux et des appuis de fenêtre.",
        ap_standard: "Il est recommandé de prêter une attention particulière aux ponts thermiques lors de la planification de travaux d'isolation de façade. Une conception soignée et des détails constructifs adaptés permettront d'assurer la continuité de l'isolation et d'améliorer la performance énergétique de l'enveloppe du bâtiment.",
        ap_avec_fenetres: "Il est important de bien planifier les travaux d'isolation de façade afin de réduire efficacement les ponts thermiques. Une conception soignée et des détails constructifs adaptés permettent d'assurer la continuité de l'isolation et d'améliorer la performance énergétique de l'enveloppe du bâtiment."
    },
    ventilation: {
        ei_standard: "Le bâtiment ne dispose pas de système de ventilation mécanique. Le renouvellement de l'air est effectué par l'ouverture manuelle des fenêtres. Les locaux humides sont équipés de ventilateurs avec temporisation pour l'extraction de l'air vicié.",
        ap_standard: "L'intégration d'une ventilation mécanique contrôlée (VMC) simple flux avec récupération de chaleur peut être réalisée efficacement lors de travaux de rénovation. Ce système permet de limiter les déperditions thermiques en récupérant la chaleur de l'air extrait pour préchauffer l'air neuf entrant. L'air frais pénètre dans les pièces de vie par des réglettes hygroréglables installées dans les cadres de fenêtres, tandis que l'air vicié est extrait par le réseau existant des WC et salles de bains. Cette solution optimise l'efficacité énergétique du bâtiment tout en assurant une qualité d'air appropriée. Les réglettes hygroréglables ajustent automatiquement le débit d'air selon le taux d'humidité intérieure. L'installation d'une VMC double flux bénéficie d'une subvention du Programme Bâtiments (mesure M-09) de CHF 2'400 par unité d'habitation, à condition que le bâtiment atteigne une classe CECB enveloppe A à C."
    },
    chauffage: {
        ei_fossile: "Le bâtiment dispose d'une chaudière à {source} à condensation d'une puissance de {puissance} kW, mise en service en {year}. Celle-ci ne satisfait plus entièrement aux standards techniques actuels ni aux recommandations relatives à l'utilisation des énergies renouvelables. Le système fonctionne de manière satisfaisante. Le recours aux énergies fossiles génère des émissions de CO2 importantes. La distribution de chaleur s'effectue au moyen de {distribution}.",
        ei_elec: "Le bâtiment est équipé d'un système de chauffage par radiateurs électriques qui ne répond plus aux normes techniques actuelles. L'utilisation de l'électricité pour la production de chaleur s'avère coûteuse et devrait être évitée.",
        ei_pac: "Le bâtiment est équipé d'une pompe à chaleur {type_pac}, offrant une puissance de {puissance} kW. Cette installation est conforme aux standards techniques actuels et aux recommandations concernant l'utilisation des énergies renouvelables.",
        ei_cad: "Le bâtiment est raccordé au chauffage à distance (CAD) de la commune de {commune}. Ce réseau représente une solution efficace, valorisant majoritairement des énergies renouvelables locales.",
        ei_conso_oui: "Les données de consommation de chauffage ont été transmises par le mandant sur une période de {years} années.",
        ei_conso_non: "Les données de consommation n'ont pas été fournies par le mandant, ce qui limite la vérification de la plausibilité du modèle énergétique.",
        ei_appoint: "Une cheminée à {type_appoint} complète l'installation de chauffage.",
        ap_fossile: "Nous recommandons de remplacer, à terme, la chaudière existante par un système exploitant les énergies renouvelables. Le remplacement peut bénéficier de subventions du Programme Bâtiments (mesures M-02 à M-08), à condition qu'il soit remplacé par un système renouvelable. {condition_pb}",
        ap_elec_central_vd: "Il est recommandé de procéder au remplacement du système de production de chaleur par un système exploitant les énergies renouvelables. Depuis le 1er janvier 2025, le décret vaudois sur l'assainissement des chauffages et chauffe-eau électriques (DACCE, BLV 730.051) est en vigueur. Ce décret interdit l'utilisation de ces installations et impose leur remplacement d'ici le 1er janvier 2033.",
        ap_elec_decentral_vd: "Il est recommandé de remplacer l'ensemble des radiateurs électriques par un système centralisé renouvelable. Le DACCE impose le remplacement d'ici 2033. La création d'un réseau hydraulique bénéficie d'un soutien du Programme Bâtiments (mesure IP-19).",
        ap_elec_ge: "Il est recommandé de procéder au remplacement du système par une pompe à chaleur ou un autre système renouvelable.",
        ap_pac: "Aucune amélioration du système de production de chaleur n'est recommandée. Toutefois, il est vivement conseillé d'améliorer l'isolation de l'enveloppe thermique afin d'optimiser le coefficient de performance de la pompe à chaleur.",
        ap_cad: "Aucune recommandation n'est préconisée concernant le système de production de chaleur."
    },
    ecs: {
        ei_fossile: "La production d'eau chaude sanitaire est assurée par la chaudière existante. Ce système est lié au remplacement du système de chauffage.",
        ei_ce_elec: "La production d'eau chaude sanitaire est assurée par {nb} chauffe-eau électrique{pl}. Le recours à l'électricité directe pour la production d'ECS est coûteux et n'est pas recommandé.",
        ei_thermo: "La production d'eau chaude sanitaire est assurée par un chauffe-eau thermodynamique de {volume} L utilisant une pompe à chaleur air-eau.",
        ei_pac: "La production d'eau chaude sanitaire est assurée par la pompe à chaleur. Ce système est conforme aux standards actuels.",
        ei_cad: "La production de chaleur du bâtiment, y compris l'eau chaude sanitaire, est assurée par le réseau CAD.",
        ap_enr: "Il est recommandé de remplacer le système d'ECS actuel. La production pourra être assurée par le nouveau système de chauffage renouvelable. L'isolation des conduites devrait être améliorée.",
        ap_dacce_central_vd: "Le décret vaudois DACCE (BLV 730.051) impose le remplacement des chauffe-eau électriques d'ici au 1er janvier 2033.",
        ap_dacce_decentral_vd: "Le DACCE impose le remplacement des chauffe-eau électriques d'ici 2033. Une alternative est prévue pour les chauffe-eau décentralisés.",
        ap_cad_pac: "Aucune recommandation n'est préconisée concernant le système de production d'ECS."
    },
    appareils: {
        ei: "Les appareils électriques installés présentent différentes classes d'efficacité énergétique et sont globalement conformes aux normes en vigueur. {conso_mention}",
        ap: "Le remplacement d'appareils obsolètes par des modèles plus récents contribue à améliorer l'efficacité énergétique. Recommandation : consulter www.topten.ch."
    },
    pv: {
        ei_non: "Aucune installation photovoltaïque n'a été constatée lors de la visite.",
        ei_oui: "Le bâtiment est équipé d'une installation de panneaux photovoltaïques totalisant {puissance} kWc. L'installation permet de réduire la consommation électrique courante.",
        ap_installation: "Il est recommandé d'envisager l'installation de panneaux solaires photovoltaïques. L'autoproduction d'électricité présente des avantages économiques et contribue à la réduction des émissions de gaz à effet de serre. Les travaux bénéficient de subventions de Pronovo.",
        ap_pac: "Le couplage de la pompe à chaleur avec une installation photovoltaïque est pertinent."
    },
    comportement: "Le CECB donne une évaluation de la performance énergétique du bâtiment dans des conditions d'utilisation et d'occupation standard. C'est pourquoi la consommation effective d'énergie, qui dépend beaucoup du comportement de l'occupant, peut être très différente des données chiffrées du CECB. Les recommandations du document CECB ne concernent donc que l'enveloppe du bâtiment et ses installations techniques. Pourtant, l'exploitation économe en énergie est l'une des mesures les plus efficaces et les plus rentables que l'on puisse prendre.",
    revalorisation: "Conseils et recommandation : une rénovation énergétique est une occasion unique d'améliorer à long terme le confort et de maintenir la valeur d'un bâtiment. On peut créer des surfaces habitables supplémentaires par des surélévations ou des extensions. Il est pertinent d'optimiser le confort et le maintien de la valeur à long terme. Une rénovation Minergie est à envisager."
};

/* ===== FORM FIELD HELPERS ===== */

var RECUEIL_FIELDS = [
    'meta-address', 'meta-canton', 'meta-commune', 'meta-egid', 'meta-year', 'meta-type', 'meta-sre', 'meta-altitude', 'meta-floors', 'meta-apartments',
    'meta-coord-e', 'meta-coord-n',
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
    data.transcript = (document.getElementById('transcript-input') || {}).value || '';
    return data;
}

function recueilLoadFormData(data) {
    if (!data) return;
    Object.entries(data).forEach(function (entry) {
        var k = entry[0], val = entry[1];
        if (k === 'transcript') {
            var ta = document.getElementById('transcript-input');
            if (ta && val) ta.value = val;
            return;
        }
        var el = document.getElementById(k);
        if (el && val) el.value = val;
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
        ProjectStore.update(pid, 'recueil', { formData: formData, generatedTexts: generatedTexts, transcript: formData.transcript || '' });
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
        "Pour les bâtiments construits avant 2000, une classe CECB de l'enveloppe comprise entre A et C doit être justifiée." :
        "Pour les bâtiments construits avant 2000, une classe CECB de l'enveloppe comprise entre A et E doit être justifiée.";
    var chaufSrc = rv('chauf-source');
    var chaufYear = rv('chauf-year');
    var chaufPuiss = rv('chauf-puissance');
    var distribLabels = { radiateurs: 'radiateurs', plancher: 'plancher chauffant', convecteurs: 'convecteurs', radiateurs_elec: 'radiateurs électriques' };
    var pacTypes = { pac_air: 'air-eau', pac_sol: 'sol-eau', pac_eau: 'eau-eau' };
    var ei = '', ap = '';

    if (chaufSrc === 'mazout' || chaufSrc === 'gaz') {
        ei = fillTemplate(BLOCS.chauffage.ei_fossile, { source: chaufSrc === 'mazout' ? 'mazout' : 'gaz', puissance: chaufPuiss, year: chaufYear, distribution: distribLabels[rv('chauf-distrib')] || 'radiateurs' });
        ap = fillTemplate(BLOCS.chauffage.ap_fossile, { condition_pb: conditionPB });
    } else if (chaufSrc === 'elec_central') {
        ei = BLOCS.chauffage.ei_elec;
        ap = canton === 'VD' ? BLOCS.chauffage.ap_elec_central_vd : BLOCS.chauffage.ap_elec_ge;
    } else if (chaufSrc === 'elec_decentral') {
        ei = BLOCS.chauffage.ei_elec;
        ap = canton === 'VD' ? BLOCS.chauffage.ap_elec_decentral_vd : BLOCS.chauffage.ap_elec_ge;
    } else if (chaufSrc && chaufSrc.startsWith('pac_')) {
        ei = fillTemplate(BLOCS.chauffage.ei_pac, { type_pac: pacTypes[chaufSrc], puissance: chaufPuiss });
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
    if (rv('chauf-appoint') === 'insert') ei += ' ' + fillTemplate(BLOCS.chauffage.ei_appoint, { type_appoint: 'insert' });
    else if (rv('chauf-appoint') === 'foyer_ouvert') ei += ' ' + fillTemplate(BLOCS.chauffage.ei_appoint, { type_appoint: 'foyer ouvert' });
    return { ei: ei, ap: ap };
}

function generateEcsText() {
    var canton = rv('meta-canton');
    var ecsType = rv('ecs-type');
    var ei = '', ap = '';
    if (ecsType === 'chaudiere') { ei = BLOCS.ecs.ei_fossile; ap = BLOCS.ecs.ap_enr; }
    else if (ecsType === 'ce_elec_central') { ei = fillTemplate(BLOCS.ecs.ei_ce_elec, { nb: 'un', pl: '' }); ap = canton === 'VD' ? BLOCS.ecs.ap_dacce_central_vd : BLOCS.ecs.ap_enr; }
    else if (ecsType === 'ce_elec_decentral') { ei = fillTemplate(BLOCS.ecs.ei_ce_elec, { nb: 'plusieurs', pl: 's' }); ap = canton === 'VD' ? BLOCS.ecs.ap_dacce_decentral_vd : BLOCS.ecs.ap_enr; }
    else if (ecsType === 'thermodynamique') { ei = fillTemplate(BLOCS.ecs.ei_thermo, { volume: rv('ecs-volume') || '[X]' }); ap = BLOCS.ecs.ap_cad_pac; }
    else if (ecsType === 'pac') { ei = BLOCS.ecs.ei_pac; ap = BLOCS.ecs.ap_cad_pac; }
    else if (ecsType === 'cad') { ei = BLOCS.ecs.ei_cad; ap = BLOCS.ecs.ap_cad_pac; }
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
    calculateSubsidies();
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

/* ===== SUBSIDIES CALCULATOR ===== */

function calculateSubsidies() {
    var canton = rv('meta-canton');
    var year = rvi('meta-year');
    var altitude = rvi('meta-altitude');
    var sre = rvi('meta-sre');
    var chaufSrc = rv('chauf-source');
    var ecsType = rv('ecs-type');
    var toitIsol = rv('toit-isolation');
    var mursIsol = rv('murs-isolation');

    var items = [];
    if (year > 0 && year < 2000) {
        if (toitIsol !== 'conforme' && rv('toit-config')) items.push({ label: 'M-01 Isolation toiture — CHF 40 à 100/m²', note: 'U ≤ 0.20 → 40/m² | U ≤ 0.15 → 70/m² | +PV → 100/m²' });
        if (mursIsol !== 'ite' && rv('murs-composition')) items.push({ label: 'M-01 Isolation façades — CHF 40 à 70/m²', note: 'U ≤ 0.20 → 40/m² | U ≤ 0.15 → 70/m²' });
        var solsTerreConfig = rv('sols-terre-config');
        if (solsTerreConfig === 'radier' || solsTerreConfig === 'terre_plein') {
            var solsTerreIsol = rv('sols-terre-isolation');
            if (solsTerreIsol !== 'oui') items.push({ label: 'M-01 Isolation sol contre terre — CHF 40 à 70/m²', note: 'U ≤ 0.20 → 40/m² | U ≤ 0.15 → 70/m²' });
        }
    }
    if (chaufSrc === 'mazout' || chaufSrc === 'gaz' || (chaufSrc && chaufSrc.includes('elec'))) {
        var classeReq = altitude > 1000 ? 'A à C' : 'A à E';
        if (chaufSrc === 'mazout' || chaufSrc === 'gaz') {
            items.push({ label: 'M-05 PAC air-eau', note: 'Classe env. ' + classeReq });
            items.push({ label: 'M-06 PAC sol-eau', note: 'Classe env. ' + classeReq });
        }
        if (chaufSrc === 'elec_decentral' && canton === 'VD') {
            items.push({ label: 'IP-19 Remplacement chauffages élec.', note: sre < 250 ? 'CHF 15\'000' : 'CHF 60/m² SRE' });
        }
    }
    if (rv('vent-vmc') === 'non') {
        var nb = rvi('meta-apartments') || 1;
        items.push({ label: 'M-09 Ventilation double flux', note: 'CHF 2\'400 × ' + nb + ' (si env. A-C)' });
    }
    if (canton === 'VD' && ((chaufSrc && chaufSrc.includes('elec')) || (ecsType && ecsType.includes('elec')))) {
        items.push({ label: 'DACCE (BLV 730.051)', note: 'Remplacement obligatoire avant 01.01.2033' });
    }

    var container = document.getElementById('recueil-subsidies-container');
    if (items.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#888;padding:30px">Aucune subvention identifiée pour cette configuration.</p>';
    } else {
        var html = '<div class="subsidy-panel"><h4>Récapitulatif des subventions PB 2026</h4>';
        items.forEach(function (it) { html += '<div class="subsidy-row"><span><strong>' + it.label + '</strong></span><span style="font-size:.85em;color:#888">' + it.note + '</span></div>'; });
        html += '<p style="margin-top:12px;font-size:.8em;color:#e67e22">Estimation indicative — à vérifier avec le Programme Bâtiments</p></div>';
        container.innerHTML = html;
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

    var systemPrompt = "Tu es un correcteur pour des rapports techniques CECB. Ton rôle est UNIQUEMENT de corriger la grammaire, l'orthographe et d'améliorer légèrement la fluidité de lecture. Règles STRICTES : ne reformule PAS les phrases, ne rajoute AUCUN mot ou expression (interdit : 'nous constatons', 'nous observons', 'nous notons', 'il est à noter', 'il convient de'). Conserve la structure, le vocabulaire et toutes les données techniques. Supprime les passages entre crochets [...] marqués 'à compléter'. Retourne UNIQUEMENT le texte corrigé.";
    var userMsg = 'Corrige uniquement la grammaire, l\'orthographe et la ponctuation du texte ci-dessous. Améliore légèrement la fluidité si nécessaire, mais ne reformule pas et n\'ajoute aucun mot ou expression. Le texte doit rester le plus proche possible de l\'original. Envoie uniquement le texte corrigé.\n\n' + ta.value;

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

    var systemPrompt = "Tu es un correcteur pour des rapports techniques CECB. Ton rôle est UNIQUEMENT de corriger la grammaire, l'orthographe et d'améliorer légèrement la fluidité de lecture. Règles STRICTES : ne reformule PAS les phrases, ne rajoute AUCUN mot ou expression (interdit : 'nous constatons', 'nous observons', 'nous notons', 'il est à noter', 'il convient de'). Conserve la structure, le vocabulaire et toutes les données techniques. Supprime les passages entre crochets [...] marqués 'à compléter'. Retourne UNIQUEMENT le texte corrigé.";
    var userMsg = instruction.trim() ? 'Consigne : ' + instruction + '\n\nTexte :\n\n' + ta.value : 'Corrige uniquement la grammaire, l\'orthographe et la ponctuation du texte ci-dessous. Améliore légèrement la fluidité si nécessaire, mais ne reformule pas et n\'ajoute aucun mot ou expression. Envoie uniquement le texte corrigé.\n\n' + ta.value;

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

async function analyzeTranscript() {
    var apiKey = localStorage.getItem('cecb_api_key');
    if (!apiKey) { recueilToast('Configurez votre clé API', 'error'); return; }

    var transcript = (document.getElementById('transcript-input') || {}).value || '';
    if (!transcript.trim()) { recueilToast('Collez un transcript', 'error'); return; }

    var status = document.getElementById('transcript-status');
    status.innerHTML = 'Analyse en cours...';
    var model = localStorage.getItem('cecb_api_model') || 'claude-sonnet-4-20250514';

    var extractPrompt = 'Analyse cette transcription de visite CECB et extrais les informations structurées au format JSON.\n\nRetourne UNIQUEMENT un objet JSON valide avec cette structure :\n{"meta":{"canton":"","commune":"","adresse":"","annee_construction":null,"type":"","sre":null},"toit":{"config":"","type":"","annee":null,"isolation":"","isolation_cm":null,"materiau":"","etat":"","pv":"","combles_comp":""},"murs":{"composition":"","revetement":"","isolation":"","isolation_cm":null,"mitoyen":"non"},"murs_terre":{"composition":"","isolation":"","isol_cm":null,"etat":""},"murs_nc":{"composition":"","isolation":"","isol_cm":null,"etat":""},"fenetres":{"cadre":"","vitrage":"","annee":null,"cadres_renov":"","porte":""},"sols_terre":{"config":"","isolation":"","isol_cm":null},"sols_nc":{"config":"","isolation":"","isol_cm":null,"soussol":"","usage":""},"ventilation":{"vmc":"","extraction":""},"chauffage":{"source":"","puissance":null,"annee":null,"distribution":"","conso":"","conso_years":null,"appoint":""},"ecs":{"type":"","annee":null,"volume":null},"appareils":{"conso":""},"pv":{"existant":"","puissance":null,"batterie":"non"}}\n\nTranscription :\n' + transcript;

    try {
        var resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
            body: JSON.stringify({ model: model, max_tokens: 2048, messages: [{ role: 'user', content: extractPrompt }] })
        });
        if (!resp.ok) { status.textContent = 'Erreur API: ' + resp.status; return; }
        var data = await resp.json();
        var text = ((data.content || [])[0] || {}).text || '';
        var json;
        try { var match = text.match(/\{[\s\S]*\}/); json = JSON.parse(match ? match[0] : text); }
        catch (e) { status.textContent = 'Erreur: réponse non JSON'; return; }
        fillFromJSON(json);
        status.textContent = 'Analyse terminée — vérifiez les champs';
        recueilToast('Transcript analysé !');
        recueilAutoSave();
    } catch (e) { status.textContent = 'Erreur: ' + e.message; }
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
}
