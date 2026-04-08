---
name: cecb-redaction
description: "Génère les textes des sections d'un rapport CECB (Certificat Énergétique Cantonal des Bâtiments) — état initial et améliorations possibles pour Toit, Murs, Fenêtres, Sol, Ventilation, Chauffage, Eau chaude, Appareils, Photovoltaïque, Comportement utilisateur et Revalorisation. Reproduit le style rédactionnel d'Êta Consult Sàrl en posant des questions ciblées sur les caractéristiques du bâtiment. À utiliser dès que l'utilisateur demande de rédiger un CECB, des recommandations CECB, ou des textes pour un rapport CECB."
---

# CECB — Génération des textes de rapport (style Êta Consult)

Ce skill produit les **textes rédigés** (état initial + améliorations possibles) qui apparaissent dans les sections « Évaluation et remarques » du rapport CECB officiel, en imitant fidèlement le style d'Êta Consult Sàrl observé dans le recueil 2024–2026.

Le skill **NE remplit PAS** l'outil CECB officiel — il génère uniquement les blocs de texte que l'expert recopiera ou adaptera dans la plateforme.

---

## 1. Procédure d'utilisation

Lorsque l'utilisateur demande de rédiger un CECB, suivre cette procédure :

### Étape 1 — Recueil des caractéristiques du bâtiment

**Demander toutes les informations en UN SEUL message texte libre** (PAS via `AskUserQuestion`, qui est trop lent et fragmente inutilement le dialogue). L'expert est un professionnel du CECB et préfère saisir l'ensemble des données d'un coup, dans le format qu'il souhaite (liste, texte courant, copier-coller depuis ses notes…).

Présenter à l'expert le **formulaire ci-dessous** sous forme de bloc Markdown qu'il complétera et retournera. Lui préciser :
- qu'il peut laisser vide tout champ inconnu (le skill choisira la formulation appropriée par défaut)
- qu'il peut répondre en texte libre, en télégraphique, ou en collant ses notes
- qu'il doit donner les **années précises** (construction, rénovation, remplacement chaudière, pose fenêtres, mise en service PV…) — il les connaît généralement, et elles apparaissent telles quelles dans le rapport

Format du formulaire à présenter :

```
## Données du bâtiment à rédiger

**Identité**
- Adresse, commune, canton :
- Année de construction :
- Années de rénovation(s) principale(s) :
- Affectation (Cat. I habitat collectif / Cat. II habitat individuel / autre) :
- Nombre d'étages, d'appartements :

**Toiture**
- Type (inclinée tuiles / plate / mansardée…) :
- Combles (aménagés chauffés / froids / partiels) :
- Isolation (matériau, épaisseur cm, position : entre chevrons / sur chevrons / sous dalle) :
- État (neuf / usé / abîmé / fin de vie) et année des derniers travaux :
- Particularités (Vélux remplacés, ferblanterie HS, sur-toiture…) :

**Murs**
- Composition (maçonnerie homogène / brique creuse / béton / moellon / ossature bois) :
- Isolation extérieure (type, épaisseur cm, année) :
- Isolation intérieure (type, épaisseur cm, année) :
- Murs sous-sol contre terrain (isolés / non, épaisseur) :
- Murs sous-sol contre locaux non chauffés (isolés / non) :

**Fenêtres et porte d'entrée**
- Cadre (PVC / bois / bois-métal / aluminium / métal) :
- Vitrage (simple / double intercalaire alu / double warm-edge / triple) :
- Année de pose ou remplacement :
- Porte d'entrée (matériau, vitrage, état, année) :

**Sol**
- Type plancher rez (dalle béton sur sous-sol non chauffé / sur terrain / sur vide sanitaire / sur sous-sol chauffé) :
- Isolation (épaisseur cm, position, année) :
- Distribution chauffage au rez (sol chauffant / radiateurs) :

**Ventilation**
- Système (naturelle / VMC simple flux / VMC double flux avec récup) :
- Année de pose si VMC :
- Particularités (hotte, extraction WC/SDB temporisée…) :

**Chauffage**
- Producteur (mazout cond. / mazout atmo / gaz / PAC air-eau / PAC géothermique / électrique direct / pellets / bûches / CAD / autre) :
- Marque, modèle, puissance kW :
- Année d'installation :
- État de fonctionnement :
- Distribution (radiateurs vannes thermo / sol hydraulique / convecteurs élec / plinthes) :
- Cheminée ou poêle d'appoint :
- Données de consommation transmises par le mandant (oui période / non) :
- Pour CAD : réseau, opérateur, mix énergétique :

**Eau chaude sanitaire**
- Production (par chauffage / chauffe-eau électrique / chauffe-eau thermodynamique marque modèle volume L / solaire thermique m² + appoint / instantané gaz) :
- Année :

**Appareils, éclairage**
- Particularités (borne recharge VE, induction, bâtiment vide à la visite…) :

**Photovoltaïque**
- Présence (oui / non) :
- Si oui : puissance kWc, nb panneaux × W unitaire, année mise en service :
- Batterie (capacité kWh, marque, modèle) :
- Charpente (capacité portante connue / à vérifier) :

**Contexte général**
- Classe CECB® enveloppe attendue (A–G) :
- Classe CECB® efficacité globale attendue :
- Classe CO₂ direct attendue :
- Bâtiment rénové globalement et exemplairement ? (oui année / non) :
- Notes libres ou particularités à mentionner :
```

**Adapter** le formulaire si l'utilisateur a déjà transmis une partie des informations dans sa demande initiale (pré-remplir et ne demander que ce qui manque). Ne **JAMAIS** utiliser `AskUserQuestion` pour ce skill — sauf cas exceptionnel où une réponse précédente est ambiguë et nécessite un éclaircissement ciblé sur 1 ou 2 points.

### Étape 2 — Vérification des informations réglementaires

**AVANT** de rédiger les recommandations, vérifier les points qui dépendent du canton et de la législation en vigueur :

- **Canton de Vaud** : DGE-DIREN — https://www.vd.ch/themes/environnement/energie
- **Canton de Genève** : OCEN — https://www.ge.ch/dossier/economiser-energie
- **EnDK** (Conférence des directeurs cantonaux de l'énergie) : https://www.endk.ch/fr
- **CECB officiel** : https://www.cecb.ch/fr/
- **Programme Bâtiments** : https://www.leprogrammebatiments.ch/
- **Pronovo** (subventions PV) : https://pronovo.ch/fr/

Vérifier en particulier :
- Conditions actuelles du Programme Bâtiments (valeurs U requises, classes CECB® minimales avant remplacement de chaudière fossile)
- Délais d'assainissement obligatoires propres au canton (ex. VD : remplacement chauffage électrique direct ; GE : aucun délai d'assainissement actuellement mais loi sur l'énergie genevoise applicable)
- Taux et plafonds des subventions cantonales en vigueur

Utiliser `WebFetch` ponctuellement si une information critique a pu changer (ex. valeur U seuil, classe CECB® requise pour le remplacement). Par défaut, retenir les valeurs ci-dessous (à jour 2026) :
- Toiture, murs, sol contre extérieur : **U < 0,20 W/m²K** pour subvention Programme Bâtiments
- Sol et murs contre locaux non chauffés ou contre terrain : **U < 0,25 W/m²K** (non éligible Programme Bâtiments en général)
- Fenêtres : **Uw < 1,00 W/m²K** pour réduction significative (non éligible Programme Bâtiments)
- Bâtiments construits avant 2000 : **classe CECB® enveloppe entre A et E** (mise à jour 2023) requise pour subvention au remplacement d'un chauffage fossile

### Étape 3 — Rédaction des sections

Produire les textes en suivant **strictement** les conventions de style ci-dessous (section 2) et les **gabarits par section** (section 3). Livrer le résultat en bloc Markdown structuré que l'utilisateur pourra recopier dans l'outil CECB.

Format de livraison :

```
## TOIT
**État initial :** [texte]

**Améliorations possibles :** [texte]

## MURS
**État initial :** [texte]

**Améliorations possibles :** [texte]

[…etc pour toutes les sections]
```

### Étape 4 — Validation

Proposer à l'utilisateur de relire et de signaler toute incohérence ou élément à ajuster (vocabulaire, longueur, niveau de détail). Itérer si nécessaire.

---

## 2. Conventions de style Êta Consult

### Ton et registre

- **Français de Suisse romande**, registre technique professionnel, à la 3ᵉ personne ou « nous » de modestie (« Nous recommandons », « Il est recommandé »)
- Phrases longues, denses, sans listes à puces dans le corps des sections (sauf exceptions)
- Vocabulaire technique précis : « déperditions thermiques », « pouvoir isolant », « parti architectural », « sondage de la façade », « vannes thermostatiques », « régulation par pièce », « intercalaire en aluminium »
- Pas d'adverbes superflus, pas d'emphase, pas de smileys ni d'emojis
- Pas de tournures commerciales ou émotionnelles

### Structure obligatoire de chaque section technique

Chaque sous-section (Toit, Murs, Fenêtres, Sol, Ventilation, Chauffage, Eau chaude, Appareils, Photovoltaïque) suit **systématiquement** ce patron :

```
État initial : [Description factuelle de l'existant : composition, matériaux,
épaisseurs, année, état de fonctionnement, performances par rapport aux
standards actuels.]

[Optionnel : second paragraphe pour éléments secondaires — sous-sol, dépendance,
cheminée d'agrément, données de consommation transmises par le mandant…]

Améliorations possibles : [Recommandations concrètes, hiérarchisées,
avec mention du terme (court/moyen/long), valeurs U cibles, éligibilité au
Programme Bâtiments, classe CECB® requise le cas échéant.]
```

### Vocabulaire récurrent à réutiliser tel quel

- « conforme aux standards de l'époque »
- « en deçà des exigences applicables aux nouvelles constructions »
- « légèrement inférieur aux recommandations pour les nouvelles constructions »
- « à l'origine de déperditions thermiques »
- « isolation par l'extérieur crépie »
- « valeur U inférieure à 0,20 W/m²K »
- « valeur Uw inférieure à 1,00 W/m²K »
- « ces travaux peuvent être planifiés à court / moyen / long terme »
- « éligible / non éligible aux subventions du Programme Bâtiments »
- « Pour bénéficier des subventions du Programme Bâtiments, il est nécessaire d'atteindre… »
- « Les bâtiments construits avant l'an 2000 doivent présenter une classe CECB® de l'enveloppe comprise entre A et E (selon mise à jour 2023) »
- « Nous recommandons de réaliser un sondage de la façade avant d'engager des travaux d'amélioration thermique »
- « Le système de chauffage fonctionne de manière satisfaisante, mais requiert un suivi régulier »
- « La chaleur est diffusée par des radiateurs équipés de vannes thermostatiques »
- « Les données de consommation […] ont été transmises par le mandant »
- « Nous ne formulons aucune recommandation d'amélioration technique »
- « Aucune intervention n'est recommandée […] à ce stade »

### Hiérarchisation des termes

| Délai | Usage |
|---|---|
| **court terme** | < 2 ans, urgence ou opportunité immédiate (cheminée non sécurisée, chaudière en fin de vie, ECS électrique) |
| **moyen terme** | 2 à 5 ans, à coordonner avec entretiens ou remplacements naturels |
| **long terme** | > 5 ans, à planifier lors d'une rénovation lourde |

### Règles éditoriales

- Toujours mentionner l'**éligibilité au Programme Bâtiments** quand c'est pertinent (toit, murs extérieurs, fenêtres remplacées par triple vitrage si couplé à isolation, remplacement chauffage fossile)
- Toujours mentionner les **valeurs U cibles** quand on recommande une isolation
- Toujours préciser l'**année** des installations existantes
- Pour les chaudières fossiles : toujours rappeler l'enjeu CO₂ et les **objectifs climatiques cantonaux et fédéraux**
- Pour les PAC : mentionner que l'**amélioration de l'enveloppe** optimise le COP
- Pour le PV : suggérer l'étude d'**ensoleillement**, de l'**ombrage**, et l'**orientation** ; mentionner les subventions **Pronovo** (rétribution unique ou à l'injection)
- Pour le PV sans batterie : recommander le **stockage** pour optimiser l'autoconsommation
- Pour le PV avec batterie : ne pas recommander de stockage
- Pour les bâtiments rénovés exemplairement : sections concernées = « Aucune recommandation d'amélioration thermique n'est préconisée. »

### Critères d'évaluation CECB — qualification des éléments à partir des valeurs U (Tab. 43 / 44)

Lorsque l'utilisateur renseigne une valeur U (ou Uw pour les fenêtres) pour un élément de construction, cette valeur **doit** être qualifiée dans le texte d'état initial selon les critères officiels de la méthodologie CECB (SIA 380/1, Tab. 43 et 44). En l'absence de valeur U fournie, conserver la formulation qualitative par défaut des gabarits (§ 3) sans inventer de chiffre.

**Choix du tableau applicable**

- **Tab. 44 — Nouveaux bâtiments** : année de construction = année actuelle ou jusqu'à trois ans en arrière (exemple : en 2026, bâtiments construits entre 2023 et 2026).
- **Tab. 43 — Bâtiments existants** : tous les autres cas (année de construction plus ancienne).

**Tab. 43 — Bâtiments existants** — valeurs en W/m²K

| Évaluation | Toit (To) | Fenêtres, portes (Fe) | Mur ext. / mur contre terre ≤ 2 m (Mu) | Sol contre ext. / élém. contre terre ≤ 2 m | Plafond, sol, mur contre locaux non chauffés (c.n-c.) |
|---|---|---|---|---|---|
| Très bonne | ≤ 0,15 | ≤ 1,1 | ≤ 0,18 | ≤ 0,21 | ≤ 0,20 |
| Bonne      | > 0,15 ; ≤ 0,25 | > 1,1 ; ≤ 1,6 | > 0,18 ; ≤ 0,25 | > 0,21 ; ≤ 0,35 | > 0,20 ; ≤ 0,35 |
| Moyenne    | > 0,25 ; ≤ 0,5  | > 1,6 ; ≤ 2,1 | > 0,25 ; ≤ 0,5  | > 0,35 ; ≤ 0,5  | > 0,35 ; ≤ 0,5  |
| Mauvaise   | > 0,5 | > 2,1 | > 0,5 | > 0,5 | > 0,5 |

**Tab. 44 — Nouveaux bâtiments** — valeurs en W/m²K

| Évaluation | Toit (To) | Fenêtres, portes (Fe) | Mur ext. / mur contre terre < 2 m (Mu) | Sol contre ext. / élém. contre terre ≤ 2 m | Plafond, sol, mur contre locaux non chauffés (c.n-c.) |
|---|---|---|---|---|---|
| Très bonne\*  | ≤ 0,09 | ≤ 1,00 | ≤ 0,11 | ≤ 0,11 | ≤ 0,15 |
| Bonne\*\*     | > 0,09 ; ≤ 0,20 | > 1,00 ; ≤ 1,30 | > 0,11 ; ≤ 0,20 | > 0,11 ; ≤ 0,20 | > 0,15 ; ≤ 0,25 |
| Moyenne       | > 0,20 | > 1,30 | > 0,20 | > 0,20 | > 0,25 |

\* Jusqu'aux « fenêtres/portes », les valeurs indiquées correspondent aux valeurs cibles selon la SIA 380/1:2009.  
\*\* Jusqu'aux « sols/murs contre locaux non chauffés », les valeurs supérieures correspondent à la valeur limite selon la SIA 380/1:2009.

**Application dans le texte**

- **Intégrer la qualification** dans l'état initial de manière factuelle et en bon français, en traduisant la catégorie (*Très bonne / Bonne / Moyenne / Mauvaise*) par une formulation idiomatique **sans citer la valeur U numérique**. Voici les tournures à privilégier par catégorie :

  - **Très bonne** :
    - « présente une excellente performance thermique »
    - « offre une isolation thermique exemplaire »
    - « dispose d'un très bon pouvoir isolant »
  - **Bonne** :
    - « présente un bon pouvoir isolant »
    - « offre une performance thermique satisfaisante »
    - « dispose d'une isolation conforme aux attentes pour un bâtiment existant »
  - **Moyenne** :
    - « présente une performance thermique moyenne »
    - « dispose d'une isolation partielle, en deçà des standards actuels »
    - « offre un pouvoir isolant modéré, inférieur aux exigences pour les nouvelles constructions »
  - **Mauvaise** :
    - « souffre d'une isolation insuffisante » ou « présente une isolation manifestement insuffisante »
    - « génère des déperditions thermiques importantes » ou « est à l'origine de déperditions thermiques élevées »
    - « dispose d'un pouvoir isolant très limité »
    - ❌ **Ne jamais écrire** « présente une performance d'isolation mauvaise » — cette construction est maladroite et à proscrire.

- Exemples complets :
  - ✅ « Le plancher présente une performance thermique moyenne. »
  - ✅ « Les fenêtres offrent un bon pouvoir isolant. »
  - ✅ « La dalle contre terrain présente une excellente performance thermique. »
  - ✅ « Les murs souffrent d'une isolation insuffisante et génèrent d'importantes déperditions thermiques. »
  - ❌ « La valeur U de cette dalle, estimée à 0,46 W/m²K, situe cet élément dans la catégorie Moyenne. »
  - ❌ « Avec une valeur Uw de 1,4 W/m²K, les fenêtres présentent une performance Bonne. »
  - ❌ « selon la méthodologie CECB » (formule à proscrire)
  - ❌ « présente une performance d'isolation mauvaise » (tournure maladroite — reformuler)

- **Ne jamais citer la valeur U numérique** (ex. « 0,32 W/m²K », « Uw de 1,4 W/m²K ») dans le texte livré. Cette valeur ne sert qu'à déterminer la catégorie en coulisses — elle ne doit pas apparaître dans le rapport.
- **Ne jamais écrire « selon la méthodologie CECB »** ni variante (« d'après la méthodologie CECB », « conformément à la méthodologie CECB ») lorsqu'on qualifie un élément — utiliser la catégorie seule, sans référence à la source méthodologique.
- **Ne jamais juxtaposer « performance » et l'adjectif brut de la catégorie** (« performance mauvaise », « performance bonne », « performance moyenne » sans autre précision). Préférer soit l'adjectif qualifiant un nom concret (« pouvoir isolant », « déperditions thermiques », « isolation »), soit une tournure verbale (« souffre de », « génère », « offre »).
- **Si la qualification est *Mauvaise* ou *Moyenne*** : souligner le gisement d'amélioration dans la section « Améliorations possibles » en rappelant les **valeurs U cibles** (ex. « U inférieure à 0,20 W/m²K ») qui sont, elles, **autorisées** dans les recommandations (objectifs à atteindre). Préciser l'éligibilité au Programme Bâtiments lorsque pertinent.
- **Si la qualification est *Bonne*** : mentionner que l'élément est conforme aux attentes pour un bâtiment existant ; recommander une amélioration uniquement si le contexte le justifie (travaux couplés, fin de vie).
- **Si la qualification est *Très bonne*** : noter la conformité aux standards et conclure qu'aucune intervention n'est recommandée sur cet élément à ce stade.
- Pour les éléments où la valeur U n'a **pas** été fournie, continuer à utiliser la formulation qualitative des gabarits (§ 3) sans citer de chiffre.
- **Ne jamais** reproduire ces tableaux dans le rapport livré : utiliser uniquement le **verdict** de qualification pour l'élément concerné.
- Si plusieurs valeurs U sont fournies pour un même élément (ex. murs extérieurs et murs contre locaux non chauffés), qualifier chacune séparément dans le texte.

---

## 3. Gabarits par section

> Les gabarits ci-dessous sont des **points de départ**. Adapter à chaque cas en variant les tournures et en intégrant les spécificités du bâtiment. Ne JAMAIS livrer un gabarit copié-collé sans le personnaliser avec les données réelles.

### 3.1 Toit

**Variante A — Toit ancien isolation moyenne, fin de vie**

> *État initial :* Le bâtiment est équipé d'une toiture traditionnelle datant de sa construction initiale, avec une isolation thermique située vraisemblablement [au-dessus / entre] chevrons, conforme aux standards de l'époque. L'isolation thermique actuelle de la toiture présente des performances situées en-dessous des standards actuels pour les nouvelles constructions. [Le cas échéant : Bien que des améliorations ponctuelles aient été réalisées (remplacement de Vélux), l'isolation ne répond pas aux standards actuels et représente une source de déperditions de chaleur.]
>
> *Améliorations possibles :* Avec près de [N] ans d'ancienneté, la toiture a atteint sa durée de vie théorique. En cas de travaux importants sur la couverture ou dans le cadre de son entretien, il est recommandé d'envisager simultanément l'amélioration de l'isolation thermique de la toiture. Pour bénéficier des subventions du Programme Bâtiments, il est nécessaire d'atteindre une valeur U inférieure à 0,20 W/m²K, ce qui permettra de réduire considérablement les déperditions thermiques. Ces travaux peuvent être planifiés à court terme dans le cadre d'une maintenance corrective.

**Variante B — Toiture rénovée conforme aux standards**

> *État initial :* Le bâtiment est couvert par une toiture inclinée traditionnelle bien isolée à l'aide d'une laine minérale de [X] cm d'épaisseur, disposée entre chevrons. La performance thermique de la toiture est conforme aux standards actuels. [Le cas échéant : Cette couverture abrite un espace sous combles chauffé, accueillant des chambres / appartements.] La toiture n'a fait l'objet que de travaux d'entretien depuis sa construction / a fait l'objet de travaux de rénovation complète en [année].
>
> *Améliorations possibles :* La toiture présente un niveau d'isolation satisfaisant. L'état actuel de l'enveloppe thermique en toiture ne nécessite pas d'intervention immédiate. Les performances énergétiques observées correspondent aux standards en vigueur.

**Variante C — Toit ancien sans priorité immédiate**

> *État initial :* Le bâtiment est couvert d'une toiture traditionnelle inclinée, installée lors de sa construction en [année]. Cette toiture présente une isolation thermique moyenne (probablement de la laine minérale entre chevrons), conforme aux standards de l'époque de construction. Elle est à l'origine de déperditions thermiques supérieures aux standards actuels pour les nouvelles constructions. Elle abrite un espace [chauffé / non chauffé] accueillant [des appartements / des combles].
>
> *Améliorations possibles :* Bien que l'amélioration de l'isolation de la toiture ne constitue pas une priorité immédiate, elle reste une intervention pertinente, à planifier lors des prochains travaux de rénovation lourds, liés à son besoin d'entretien ou quand celle-ci aura atteint sa fin de vie théorique. Pour bénéficier des subventions du Programme Bâtiments, il est nécessaire d'atteindre une valeur U inférieure à 0,20 W/m²K afin de réduire significativement les déperditions thermiques. Ces travaux peuvent être planifiés à moyen ou long terme, en fonction des besoins d'entretien de la toiture. [Si pertinent : Avant d'envisager l'installation de panneaux photovoltaïques, il est conseillé de faire vérifier la capacité portante de la charpente par un ingénieur civil.]

### 3.2 Murs

**Variante A — Façades isolées extérieurement insuffisantes**

> *État initial :* Les façades du bâtiment sont constituées de maçonnerie homogène avec une isolation par l'extérieur. En tenant compte de l'année de construction, une épaisseur d'isolation de [X] cm d'EPS a été retenue pour cette étude. Cette configuration contribue à l'isolation thermique de l'enveloppe du bâtiment, bien que les performances restent en deçà des exigences applicables aux nouvelles constructions. Nous recommandons de réaliser un sondage de la façade avant d'engager des travaux d'amélioration thermique de l'enveloppe du bâtiment.
>
> [Si applicable : Les murs du sous-sol adjacents à des locaux non chauffés sont constitués de béton armé et ne disposent d'aucune isolation.]
>
> *Améliorations possibles :* Compte tenu des hypothèses retenues dans le cadre de cette étude, il est recommandé d'améliorer le pouvoir isolant des façades par l'ajout d'une isolation extérieure crépie. Les travaux peuvent être planifiés à moyen terme. Une valeur U inférieure à 0,20 W/m²K est nécessaire pour réduire significativement les déperditions thermiques.
>
> [Si applicable : Nous préconisons l'isolation des parois adjacentes aux locaux non chauffés du sous-sol. L'ajout d'isolation entraînera une diminution de la température au sous-sol, ce qui pourrait nécessiter une aération régulière en cas d'humidité élevée. Il est important de noter que ces travaux ne sont pas éligibles aux subventions du Programme Bâtiments. Pour réduire de manière significative les déperditions thermiques à travers ces parois, une valeur U inférieure à 0,25 W/m²K est recommandée.]

**Variante B — Façades neuves ou récemment isolées (conformes)**

> *État initial :* Les façades sont constituées de maçonnerie en [brique creuse / béton] avec isolation thermique par l'extérieur de [X] cm d'épaisseur, conforme aux standards constructifs contemporains. [Si pertinent : Les murs du sous-sol contre-terre sont isolés à l'aide d'une couche d'XPS de [X] cm d'épaisseur.]
>
> *Améliorations possibles :* Les façades présentent des performances thermiques satisfaisantes en l'état actuel. Aucune intervention n'est identifiée comme nécessaire.

**Variante C — Murs anciens en moellon avec isolation intérieure**

> *État initial :* Les murs extérieurs d'origine sont constitués de maçonnerie moellon de [X] cm d'épaisseur. Lors des travaux de rénovation réalisés en [année], ils ont fait l'objet d'une isolation intérieure réalisée à l'aide de laine minérale. Leur performance thermique est conforme aux exigences pour les nouvelles constructions. [Si pertinent : Une partie des parois est en contact avec le terrain (murs contre-terre), ce qui amortit les variations de température.]
>
> *Améliorations possibles :* Aucune recommandation d'amélioration thermique n'est préconisée.

### 3.3 Fenêtres et portes

**Variante A — Double vitrage PVC ancien**

> *État initial :* Le bâtiment est équipé principalement de fenêtres à cadre PVC et à double vitrage, séparés par un intercalaire en aluminium. Le pouvoir isolant de ces fenêtres est légèrement inférieur aux recommandations pour les nouvelles constructions. Les fenêtres génèrent des déperditions de chaleur supérieures aux recommandations pour les nouvelles constructions.
>
> [Si applicable : La porte d'entrée date de la construction du bâtiment, en métal et avec simple vitrage, et ne présente aucune isolation thermique. Elle est à l'origine de déperditions de chaleur significatives affectant le confort intérieur.]
>
> *Améliorations possibles :* À ce stade, aucune intervention n'est recommandée concernant les fenêtres PVC, étant donné leur bon état et leurs performances satisfaisantes. Les travaux pourront être planifiés en fonction des besoins de remplacement ou coordonnés avec d'éventuels travaux de rénovation de façade. Il est à noter que le remplacement de fenêtres n'est pas éligible aux subventions du Programme Bâtiments. Pour réduire de manière significative les déperditions thermiques, une valeur Uw inférieure à 1,00 W/m²K serait nécessaire.
>
> [Si applicable : Nous recommandons le remplacement de la porte d'entrée.]

**Variante B — Triple vitrage récent (conforme)**

> *État initial :* Le bâtiment est équipé principalement de fenêtres à cadre [PVC / bois-métal] avec triple vitrage isolant. Les vitrages sont séparés par un intercalaire et présentent un pouvoir isolant conforme aux recommandations pour les nouvelles constructions.
>
> *Améliorations possibles :* Aucune intervention n'est recommandée sur les fenêtres à ce stade, compte tenu de leur bon état et de leurs performances.

**Variante C — Cadre bois ou aluminium ancien à conserver**

> *État initial :* Les logements du bâtiment sont équipés, pour l'essentiel, de fenêtres à cadre [bois / aluminium] et à double vitrage, dont la performance isolante se situe légèrement en dessous des standards recommandés pour les nouvelles constructions. [Si pertinent : Les vitrages d'origine ont été remplacés par des doubles vitrages isolants, dans le respect du parti architectural du bâtiment.] Ces fenêtres génèrent des déperditions thermiques légèrement supérieures aux recommandations actuelles pour les nouvelles constructions.
>
> *Améliorations possibles :* Le remplacement des fenêtres actuelles par des modèles à triple vitrage pourrait être envisagé, mais ne constitue pas des travaux prioritaires ni pertinents, vu la qualité des menuiseries et leur état de conservation.

### 3.4 Sol

**Variante A — Dalle béton non isolée**

> *État initial :* —
>
> Les sols contre terrain et contre locaux non chauffés sont usés. L'isolation thermique est insuffisante.
>
> *Améliorations possibles :* —
>
> Des mesures d'isolation thermique des sols contre terrain et contre locaux non chauffés devraient être planifiées. Elles servent également à l'entretien des sols contre terrain et contre locaux non chauffés.

**Variante B — Plancher rez sur sous-sol non chauffé**

> *État initial :* —
>
> Le plancher du rez-de-chaussée assure la séparation thermique entre les espaces non chauffés du sous-sol et le volume chauffé. Il [se compose d'une dalle en maçonnerie homogène / est constitué d'une dalle en béton homogène] et ne dispose d'aucune isolation thermique en sous-face.
>
> *Améliorations possibles :* —
>
> Nous recommandons d'isoler la dalle du rez-de-chaussée en ajoutant une isolation en sous-face, tout en préservant l'accès aux installations techniques du plafond. Ces travaux peuvent être réalisés à court terme. Pour réduire efficacement les déperditions thermiques, une valeur U inférieure à 0,25 W/m²K est requise. Veuillez noter que ces travaux ne sont pas éligibles aux subventions du Programme Bâtiments.

**Variante C — Radier isolé chauffage au sol (satisfaisant)**

> *État initial :* —
>
> Le niveau du sous-sol accueille des espaces aménagés et chauffés. Le radier contre terre sert de barrière thermique. Vu le mode de distribution du chauffage par le sol, une isolation de [X] cm d'EPS est disposée sous la chape offrant des performances [conformes / légèrement en dessous des recommandations] pour les nouvelles constructions.
>
> *Améliorations possibles :* —
>
> Nous ne recommandons aucune intervention d'amélioration thermique des performances du radier en contact avec le terrain. Ces travaux sont à l'origine de dépenses souvent disproportionnées.

### 3.5 Ventilation

**Variante A — Ventilation naturelle (cas standard)**

> *État initial :* Le bâtiment ne dispose pas de système de ventilation mécanique. Le renouvellement de l'air est effectué par l'ouverture manuelle des fenêtres. Les locaux humides sont équipés de ventilateurs avec temporisation pour l'extraction de l'air vicié.
>
> *Améliorations possibles :* L'intégration d'une ventilation mécanique contrôlée (VMC) simple flux hygroréglable peut être réalisée efficacement lors de travaux de rénovation. L'air frais pénètre dans les pièces de vie par des réglettes hygroréglables installées dans les cadres de fenêtres, tandis que l'air vicié est extrait par un réseau centralisé depuis les WC et salles de bains. Les réglettes hygroréglables ajustent automatiquement le débit d'air selon le taux d'humidité intérieure : elles s'ouvrent davantage en présence d'humidité élevée et se ferment lorsque l'air est sec, permettant un fonctionnement à débit variable et une meilleure maîtrise des déperditions liées au renouvellement d'air. Ce système n'intègre pas de récupération de chaleur — il reste néanmoins peu invasif à mettre en œuvre sur un bâtiment existant et assure une qualité d'air appropriée. Dans le cadre d'une rénovation plus ambitieuse, une VMC double flux avec échangeur permettrait en complément de récupérer une partie importante de la chaleur de l'air extrait pour préchauffer l'air neuf entrant, au prix d'un réseau de gaines d'amenée plus lourd à intégrer dans le bâti existant.

> ⚠️ **Rappel technique à respecter strictement :** la récupération de chaleur n'est possible **qu'avec une VMC double flux** (deux ventilateurs + échangeur). Une VMC simple flux, par définition, n'a qu'un seul flux mécanisé (l'extraction) et ne peut en aucun cas récupérer de chaleur. Ne jamais écrire « VMC simple flux avec récupération de chaleur » — cette formulation est techniquement incorrecte.

**Variante B — VMC double flux existante**

> *État initial :* Le bâtiment est équipé d'une ventilation mécanique contrôlée double flux avec récupération de chaleur, installée en [année]. Le système assure le renouvellement d'air des pièces de vie et l'extraction des locaux humides, avec préchauffage de l'air neuf par la chaleur de l'air extrait.
>
> *Améliorations possibles :* Aucune recommandation n'est formulée concernant le système de ventilation, sa configuration étant adaptée aux besoins du bâtiment.

### 3.6 Chauffage

**Variante A — Chaudière mazout à condensation**

> *État initial :* Le bâtiment dispose d'une chaudière à mazout à condensation installée en [année], d'une puissance de [X] kW. Cette installation ne répond plus entièrement aux standards techniques actuels ni aux recommandations en vigueur concernant l'utilisation des énergies renouvelables. Le système de chauffage dans son ensemble fonctionne de manière satisfaisante, mais requiert un suivi régulier. Ce système utilise une énergie fossile dont les émissions de CO₂ sont préjudiciables pour l'environnement et compromettent l'atteinte des objectifs climatiques cantonaux et fédéraux. La chaleur est diffusée par des radiateurs équipés de vannes thermostatiques.
>
> [Si applicable : Une cheminée à foyer ouvert vient compléter l'installation de chauffage. Son usage étant principalement orienté vers le confort, la consommation de bois qui en découle n'a pas d'impact significatif sur la consommation globale de chauffage du bâtiment.]
>
> Les données de consommation de mazout (chauffage et ECS) ont été [transmises par le mandant / estimées sur la base de valeurs moyennes].
>
> *Améliorations possibles :* Le système de production de chaleur nécessite un remplacement. Nous recommandons de substituer la chaudière actuelle par un système utilisant des énergies renouvelables. L'installation d'un système de suivi de la consommation de chauffage accompagné de mesures correctives appropriées présenterait des avantages tant économiques qu'écologiques. L'isolation des conduites de distribution doit également être améliorée. Ces travaux devraient être planifiés à moyen terme, soit dans les 5 prochaines années. Le remplacement d'un système principal fonctionnant au mazout, au gaz ou à l'électricité directe peut bénéficier de subventions dans le cadre du Programme Bâtiments, à condition d'être remplacé par un système utilisant les énergies renouvelables ou par un raccordement à un chauffage à distance. Les bâtiments construits avant l'an 2000 doivent présenter une classe CECB® de l'enveloppe comprise entre A et E (selon mise à jour 2023).

**Variante B — PAC air-eau récente (conforme)**

> *État initial :* Le bâtiment est équipé d'une pompe à chaleur air-eau [marque / modèle] datant de [année] et dont l'efficacité est [très bonne / satisfaisante]. L'ensemble du système de chauffage (chauffage, conduites, régulation) est entretenu régulièrement et reste en bon état de fonctionnement. La chaleur est distribuée par [un chauffage au sol hydraulique avec régulation par pièce / des radiateurs équipés de vannes thermostatiques].
>
> *Améliorations possibles :* Nous ne formulons aucune recommandation d'amélioration technique pour la production de chaleur pour le chauffage.

**Variante C — Chauffage électrique direct**

> *État initial :* Le bâtiment est équipé d'un système de chauffage par radiateurs électriques qui ne répond plus aux normes techniques actuelles ni aux recommandations en matière d'utilisation des énergies renouvelables. L'ensemble du système fonctionne normalement et ne présente pas de dysfonctionnement notable. L'utilisation de l'électricité pour la production de chaleur s'avère coûteuse et devrait être évitée. Ce système repose sur un chauffage électrique direct qui n'émet pas de CO₂ sur site, mais dont la performance énergétique reste limitée. La chaleur est distribuée par des convecteurs électriques.
>
> *Améliorations possibles :* Il est recommandé de procéder au remplacement du système de production de chaleur actuel par une pompe à chaleur air-eau. Il convient de noter que la création initiale d'un réseau de distribution hydraulique bénéficie d'un soutien financier dans le cadre du Programme Bâtiments. Ces travaux sont à envisager dans une perspective à long terme. Le remplacement d'un système principal fonctionnant au mazout, au gaz ou à l'électricité directe est également subventionné par le Programme Bâtiments, à condition qu'il soit remplacé par un système utilisant des énergies renouvelables ou par un raccordement à un réseau de chauffage à distance. Pour les bâtiments construits avant l'an 2000, il est requis de justifier d'une classe CECB® de l'enveloppe comprise entre A et E (conformément à la mise à jour 2023).

**Variante D — Chauffage à distance (CAD)**

> *État initial :* Depuis [année], le bâtiment est raccordé au chauffage à distance (CAD) [nom du réseau / opérateur] de la commune de [commune]. Ce réseau représente une solution efficace et performante, valorisant majoritairement des énergies renouvelables locales. Les besoins d'entretien sont en outre réduits. Les consommations de chaleur (chauffage, ECS) ont été transmises par le mandant sur une période de trois années consécutives.
>
> [Si applicable : Une cheminée à insert de confort complète l'installation depuis [année].]
>
> *Améliorations possibles :* Aucune recommandation n'est préconisée concernant le système de production de chaleur du bâtiment.

### 3.7 Eau chaude sanitaire

**Variante A — Production par chaudière fossile existante**

> *État initial :* La production d'eau chaude sanitaire est actuellement assurée par la chaudière existante, datant de [année]. Ce système n'est plus conforme aux standards techniques actuels et ne répond pas aux exigences de performance énergétique modernes.
>
> *Améliorations possibles :* Il est recommandé de remplacer le système de production d'eau chaude sanitaire actuel. La production d'ECS pourra être assurée par le nouveau système de chauffage basé sur les énergies renouvelables. L'isolation des conduites de distribution devrait également être améliorée.

**Variante B — Chauffe-eau thermodynamique récent**

> *État initial :* La production d'eau chaude sanitaire (ECS) est assurée par un chauffe-eau thermodynamique de marque [marque] et de type [modèle], de [X] L. Il utilise une pompe à chaleur air-eau pour récupérer les calories de l'air ambiant ou extrait afin de chauffer l'eau sanitaire, réduisant ainsi les coûts d'eau chaude jusqu'à deux tiers par rapport à un chauffe-eau standard.
>
> *Améliorations possibles :* Le chauffe-eau PAC est adapté aux besoins en ECS du ménage. Nous ne préconisons aucune recommandation d'amélioration technique. La production d'ECS peut également être assurée par la nouvelle pompe à chaleur.

**Variante C — Solaire thermique avec appoint**

> *État initial :* La production d'eau chaude sanitaire est principalement assurée par une installation solaire thermique de [X] m² située en toiture. Celle-ci couvre une partie des besoins en eau chaude du bâtiment, avec une production variable selon les saisons (presque 100 % en été, nettement moins en hiver). Lorsque l'installation solaire ne suffit pas (temps couvert, hiver, demande élevée), [la pompe à chaleur / la chaudière] complète l'apport.
>
> *Améliorations possibles :* Nous ne formulons aucune recommandation d'amélioration technique pour la production de chaleur pour l'ECS.

### 3.8 Appareils et éclairage

**Variante standard**

> *État initial :* Les appareils électriques installés présentent différentes classes d'efficacité énergétique et sont globalement conformes aux normes en vigueur. [Variantes possibles : « Une borne de recharge pour véhicules électriques complète l'installation technique du bâtiment. » / « Au moment de la visite du bâtiment, ce dernier n'est pas habité. »]
>
> *Améliorations possibles :* Le remplacement d'appareils obsolètes ou peu performants par des modèles plus récents contribue à améliorer l'efficacité énergétique du bâtiment. Pour des recommandations détaillées, nous vous recommandons de consulter le site [www.top-ten.ch](http://www.top-ten.ch).
>
> [Si VE : La consommation électrique des véhicules électriques n'entre pas dans le bilan énergétique du bâtiment. Le CECB se concentre exclusivement sur l'énergie directement liée au bâtiment, notamment le chauffage, l'eau chaude sanitaire, l'éclairage et les installations techniques.]

### 3.9 Photovoltaïque

**Variante A — PV existant sans batterie**

> *État initial :* Le bâtiment dispose actuellement d'une installation solaire photovoltaïque de [X] kWc mise en service en [année]. L'absence de système de stockage par batterie réduit les possibilités d'autoconsommation de l'énergie produite.
>
> *Améliorations possibles :* Il est recommandé d'exploiter pleinement le potentiel de la toiture en installant un système solaire photovoltaïque [complémentaire le cas échéant]. Cette production permettrait de réduire les besoins électriques et de diminuer significativement les émissions de gaz à effet de serre. L'intégration d'un système de stockage d'électricité est également conseillée pour optimiser l'autoconsommation et valoriser l'énergie solaire produite localement. Une étude d'ensoleillement devra être réalisée pour confirmer la faisabilité technique, en tenant compte notamment de l'ombrage potentiel et de l'orientation de la toiture.

**Variante B — PV existant avec batterie**

> *État initial :* Le bâtiment est équipé d'une installation solaire photovoltaïque d'environ [X] kWc ([N] panneaux de [P] W) mise en service en [année]. Une batterie de [X] kWh de marque [marque] et de type [modèle] permet d'optimiser l'autoconsommation de l'énergie produite sur place.
>
> *Améliorations possibles :* Nous ne recommandons pas d'améliorations concernant la production photovoltaïque à ce stade.

**Variante C — Pas de PV existant**

> *État initial :* Aucune installation photovoltaïque n'a été constatée lors de la visite. Le bâtiment ne dispose actuellement pas d'autoproduction d'électricité.
>
> *Améliorations possibles :* [Si PAC existante : Le couplage de la pompe à chaleur avec une installation photovoltaïque est pertinent.] Il est recommandé d'envisager l'installation d'un système de panneaux solaires photovoltaïques [sur une toiture préalablement rénovée]. L'autoproduction d'électricité présente généralement des avantages économiques et contribue à la réduction des émissions de gaz à effet de serre. Les travaux d'installation d'un système photovoltaïque bénéficient de subventions de Pronovo, dont le montant dépend de la taille de l'installation et de l'option retenue (rétribution unique ou rétribution à l'injection).

### 3.10 Comportement utilisateur (texte standard, à reproduire tel quel)

> Le CECB évalue la performance énergétique du bâtiment selon des conditions d'utilisation et d'occupation normalisées. La consommation énergétique effective dépend en grande partie du comportement des occupant·e·s et peut ainsi s'écarter significativement des valeurs indiquées par le CECB. Les recommandations du document CECB se concentrent exclusivement sur l'enveloppe du bâtiment et ses installations techniques. Néanmoins, une utilisation rationnelle de l'énergie demeure l'une des mesures les plus performantes et économiquement avantageuses. Des réductions importantes de la consommation peuvent être obtenues par une aération appropriée et par l'ajustement à la baisse de la température ambiante durant la période hivernale.

### 3.11 Revalorisation

**Variante A — Cas standard (à rénover)**

> *Conseils et recommandation :* La rénovation énergétique offre une opportunité intéressante pour améliorer durablement le confort et préserver la valeur d'un bâtiment. Elle permet de créer des surfaces habitables supplémentaires grâce à des surélévations ou des extensions, de repenser l'agencement des espaces intérieurs ou d'agrandir les balcons existants. L'amélioration du confort et le maintien de la valeur à long terme représentent des objectifs importants de cette approche.

**Variante B — Bâtiment déjà rénové exemplairement**

> *Conseils et recommandation :* Le bâtiment a fait l'objet de travaux de rénovation énergétique globaux et exemplaires en [année].

---

## 4. Textes de synthèse par classe CECB® (enveloppe / efficacité / CO₂)

Textes officiels utilisés par Êta Consult pour la page de synthèse des classes CECB®. Reproduire ces textes **mot pour mot** lorsque l'utilisateur fournit la classe attendue (enveloppe, efficacité globale, CO₂ direct).

### 4.1 Classe enveloppe

- **A** — L'enveloppe du bâtiment offre une isolation thermique exemplaire, avec des déperditions inférieures à 50 % des exigences actuelles pour les nouvelles constructions.
- **B** — L'enveloppe du bâtiment offre une excellente isolation thermique, avec des déperditions comprises entre 50 % et 100 % des exigences actuelles des nouvelles constructions.
- **C** — L'enveloppe du bâtiment offre une bonne isolation thermique, avec des déperditions comprises entre 100 % et 150 % des exigences actuelles des nouvelles constructions.
- **D** — L'enveloppe du bâtiment offre une isolation thermique moyenne, avec des déperditions comprises entre 150 % et 200 % des exigences actuelles des nouvelles constructions.
- **E** — L'enveloppe du bâtiment offre une isolation thermique moyenne, avec des déperditions comprises entre 200 % et 250 % des exigences actuelles des nouvelles constructions.
- **F** — L'enveloppe du bâtiment offre une isolation thermique médiocre, avec des déperditions comprises entre 250 % et 300 % des exigences actuelles des nouvelles constructions.
- **G** — L'enveloppe du bâtiment offre une très mauvaise isolation thermique, avec des déperditions supérieures à 300 % des exigences actuelles des nouvelles constructions.

### 4.2 Classe efficacité énergétique globale

- **A** — L'efficacité énergétique globale est remarquable, avec un besoin énergétique pondéré (chauffage, eau chaude, électricité) inférieur à 50 % des exigences actuelles.
- **B** — L'efficacité énergétique globale est très bonne, avec un besoin énergétique pondéré (chauffage, eau chaude, électricité) compris entre 50 % et 100 % des exigences actuelles.
- **C** — L'efficacité énergétique globale est bonne, avec un besoin énergétique pondéré (chauffage, eau chaude, électricité) compris entre 100 % et 150 % des exigences actuelles.
- **D** — L'efficacité énergétique globale est acceptable, avec un besoin énergétique pondéré (chauffage, eau chaude, électricité) compris entre 150 % et 200 % des exigences actuelles.
- **E** — L'efficacité énergétique globale est faible, avec un besoin énergétique pondéré (chauffage, eau chaude, électricité) compris entre 200 % et 250 % des exigences actuelles.
- **F** — L'efficacité énergétique globale est largement déficiente, avec un besoin énergétique pondéré (chauffage, eau chaude, électricité) compris entre 250 % et 300 % des exigences actuelles.
- **G** — L'efficacité énergétique globale est critique, avec un besoin énergétique pondéré (chauffage, eau chaude, électricité) supérieur à 300 % des exigences actuelles.

### 4.3 Émissions de CO₂ directes

- **Énergies fossiles** — Le bâtiment est chauffé par des énergies fossiles et émet beaucoup de CO₂. L'utilisation d'énergies renouvelables et l'amélioration de l'enveloppe du bâtiment sont recommandées.
- **Énergies renouvelables** — Le bâtiment ne génère pas d'émissions directes de CO₂.

> **Usage :** ces textes ne font pas partie des sections techniques (§ 3). Ils sont destinés à la page de synthèse des classes du rapport. Les reproduire uniquement lorsque la classe correspondante est fournie par l'utilisateur.

---

## 5. Sources de référence à consulter et citer si pertinent

| Source | URL | Quand l'utiliser |
|---|---|---|
| Association CECB | https://www.cecb.ch/fr/ | Méthodologie officielle, mise à jour CECB® |
| EnDK | https://www.endk.ch/fr | Législation cantonale harmonisée (MoPEC) |
| DGE-DIREN (VD) | https://www.vd.ch/themes/environnement/energie | Bâtiments dans le canton de Vaud |
| OCEN (GE) | https://www.ge.ch/dossier/economiser-energie | Bâtiments dans le canton de Genève |
| Programme Bâtiments | https://www.leprogrammebatiments.ch/ | Subventions enveloppe + remplacement chauffage |
| Pronovo | https://pronovo.ch/fr/ | Subventions photovoltaïque |
| Top-Ten | https://www.topten.ch/ | Recommandations électroménager |
| SuisseEnergie | https://www.suisseenergie.ch/ | Informations grand public |

**Règle :** Si une donnée réglementaire ou un seuil chiffré est sur le point d'être inscrit dans un rapport et qu'il y a un doute sur sa validité actuelle (changement de législation, nouvelle ordonnance), utiliser `WebFetch` sur la source officielle correspondante avant rédaction.

---

## 6. Checklist de qualité avant livraison

Avant de remettre les textes à l'utilisateur, vérifier que :

- [ ] Chaque section technique a bien le format `État initial / Améliorations possibles`
- [ ] Aucun gabarit n'a été livré sans personnalisation (placeholders `[X]`, `[année]` tous remplacés)
- [ ] Les valeurs U cibles sont mentionnées partout où une isolation est recommandée
- [ ] L'éligibilité (ou non) au Programme Bâtiments est précisée pour chaque mesure
- [ ] Pour les bâtiments d'avant 2000, la classe CECB® enveloppe A–E est rappelée si on recommande un remplacement de chauffage fossile
- [ ] Le canton et ses spécificités législatives sont pris en compte (notamment VD vs GE)
- [ ] Les sections « Comportement utilisateur » et « Revalorisation » sont présentes
- [ ] Le ton est sobre, technique, sans emphase ni adverbes superflus
- [ ] Aucune liste à puces dans le corps des sections (uniquement texte continu)
- [ ] La cohérence est respectée entre les sections (ex. si on remplace le chauffage par une PAC, le PV doit suggérer le couplage)
