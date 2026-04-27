/* ═══════════════════════════════════════════════════════
   CECB Plus — Texte CECB Engine
   Génération de texte par section constructive
   ═══════════════════════════════════════════════════════ */

/* ===== CORE UI ===== */

function recueilToast(msg, type) {
    type = type || 'success';
    var t = document.createElement('div');
    t.className = 'toast toast-' + type;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3000);
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
        ap_plancher_combles_beton: "Il est recommandé d'optimiser l'isolation du plancher des combles en remplaçant l'isolation existante par une isolation sur dalle présentant de meilleures performances thermiques.",
        ei_vieillissante: "Installée il y a environ {age} ans, la couverture et la charpente montrent des signes de vieillissement avancé, ce qui justifie une rénovation à court terme.",
        ei_plancher_combles: "Le plancher des combles, constitué de {composition}, sépare l'espace chauffé des combles non chauffés. L'isolation thermique est {isolation_desc}, composée de {materiau}. Les performances thermiques sont inférieures aux exigences actuelles pour les nouvelles constructions.",
        ap_plancher_combles: "Il est recommandé d'améliorer l'isolation du plancher des combles par la pose d'une couche d'isolant performant sur le plancher existant. Pour réduire significativement les déperditions à travers cette paroi, il est nécessaire d'atteindre une valeur U inférieure à 0,25 W/m²K. Ces travaux ne sont pas couverts par les subventions du Programme Bâtiments.",
        ap_pv: "La toiture se prête à l'installation de panneaux photovoltaïques, ce qui est recommandé en complément des travaux d'isolation."
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
        ap_double_paroi: "Compte tenu des hypothèses retenues dans le cadre de cette étude, il est recommandé d'améliorer le pouvoir isolant des façades par l'ajout d'une isolation extérieure crépie. Les travaux peuvent être planifiés à moyen terme. Une valeur U inférieure à 0,20 W/m²K est nécessaire pour réduire significativement les déperditions thermiques.",
        ei_ossature: "Les façades du bâtiment présentent une construction à {type_ossature} avec un revêtement en {revetement}. L'isolation intégrée à l'ossature correspond aux standards de l'époque de construction, mais ne satisfait pas aux exigences actuelles applicables aux bâtiments neufs.",
        ap_sondage: "Nous recommandons de réaliser un sondage de la façade avant d'engager des travaux d'amélioration thermique afin de vérifier l'état et la composition de la paroi existante."
    },
    murs_terre: {
        ei_sans_isolation: "Les murs du sous-sol en contact avec le terrain sont constitués de {composition_desc} et ne disposent pas d'isolation thermique. Les déperditions à travers ces parois contribuent aux pertes énergétiques du bâtiment.",
        ei_isole_interieur: "Les murs du sous-sol en contact avec le terrain sont constitués de {composition_desc}. Des travaux d'amélioration thermique ont été réalisés après la construction du bâtiment, comprenant l'ajout d'une couche d'isolation d'environ {cm} cm par l'intérieur. Ces interventions réduisent les déperditions thermiques et améliorent le confort intérieur.",
        ei_isole_perimetrique: "Les murs du sous-sol en contact avec le terrain sont constitués de {composition_desc}. Une isolation périmétrique d'environ {cm} cm a été mise en place par l'extérieur. Cette configuration contribue à la réduction des déperditions thermiques à travers ces parois.",
        ap_isolation: "Il est recommandé d'isoler les murs du sous-sol en contact avec le terrain afin de réduire les déperditions thermiques. Ces travaux ne sont pas éligibles aux subventions du Programme Bâtiments.",
        ap_non_prioritaire: "L'isolation des murs contre terrain ne constitue pas une priorité immédiate, compte tenu de leur état actuel."
    },
    murs_nc: {
        ei_sans_isolation: "Les murs adjacents aux locaux non chauffés sont constitués de {composition_desc} et ne disposent d'aucune isolation thermique.",
        ei_isole: "Les murs adjacents aux locaux non chauffés sont constitués de {composition_desc} et disposent d'une isolation de {cm} cm. Cette configuration offre une protection thermique acceptable.",
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
        ap: "Le remplacement d'appareils obsolètes ou peu performants par des modèles plus récents contribue à améliorer l'efficacité énergétique du bâtiment. Pour des recommandations détaillées, nous vous recommandons de consulter le site www.topten.ch."
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
        if (typeof showSaveIndicator === 'function') showSaveIndicator();
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

/* ===== FIELD VALIDATION + SECTIONS — extrait dans recueil-sections.js ===== */

/* ===== PDF EXPORT — extrait dans recueil-pdf.js ===== */

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
