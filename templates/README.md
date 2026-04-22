# Template CECB Plus — préparation

Ce dossier contient le template `.docx` utilisé par l'onglet **CECB Plus Word**.

## Fichier attendu

- `cecb_plus_template.docx` — modèle **préparé à la main** une seule fois à partir du Word vierge officiel CECB Plus (celui imprimé puis modifié manuellement avant cet outil).

## Procédure (une seule fois)

### 1. Obtenir le Word vierge officiel

Générer un rapport CECB Plus vierge depuis l'outil officiel CECB en ligne (n'importe quel projet suffit). Le `.docx` téléchargé sert de base.

Exemple de référence : `Rapport_de_conseil_Route_de_Benex_33_Prangins.docx` (dans Downloads).

### 2. Dupliquer et renommer

Copier le fichier dans ce dossier sous le nom exact : `cecb_plus_template.docx`.

### 3. Remplacer les textes par des tags

Ouvrir `cecb_plus_template.docx` dans **Microsoft Word**. Activer **Afficher les caractères non imprimables** (Ctrl+Shift+8).

Faire les remplacements suivants avec **Ctrl+H** (Remplacer) :

#### Tags simples (Phase 1)

| À remplacer dans le Word vierge | Par |
|---|---|
| Le nom du mandataire sur la page de garde (ex : « Madame Lionel Christen ») | `{{civilite}} {{mandNom}}` |
| Adresse mandataire (ex : « Route de Bénex 33a, 1197 Prangins ») | `{{mandAdr}}` |
| Email mandataire | `{{mandMail}}` |
| Téléphone mandataire | `{{mandTel}}` |
| Date d'établissement (ex : « 21.04.2026 16:41 ») | `{{dateRapportFr}}` |
| Date de visite (ex : « 17.02.2026 ») | `{{dateVisiteFr}}` |
| N° CECB (toutes occurrences, ~5 dans le document) | `{{numCecb}}` |

> ⚠️ Pour les occurrences multiples du n° CECB, utiliser **Remplacer tout** après avoir vérifié qu'aucune autre chaîne ne correspond.

#### Tags de blocs conditionnels (Phase 2)

Insérer ces blocs aux emplacements indiqués (vérifier que les délimiteurs `{#hasX}` / `{/hasX}` sont bien sur des lignes dédiées, en-dehors de tout tableau).

| Emplacement | Bloc à insérer |
|---|---|
| Entre la fin de la Table des matières et le titre « Résumé » | ```{#hasIntroduction}{{introduction}}{/hasIntroduction}``` |
| Dans la section « Résumé », après le paragraphe standard | ```{#hasResume}{{resume}}{/hasResume}``` |
| Après le paragraphe d'intro de la section « État initial – Classe actuelle » (efficacité enveloppe) | `{{commentEnv}}` |
| Après le paragraphe d'intro de la section « Efficacité énergétique globale » | `{{commentEff}}` |
| Après le paragraphe d'intro de la section « Émissions directes de CO₂ » | `{{commentCo2}}` |
| Paragraphe de recommandation (4. Recommandation) | `{{recoTexte}}` |
| Section « Remarques générales » | ```{#hasRemarques}{{remarques}}{/hasRemarques}``` |

#### Tableau récapitulatif des variantes (Phase 3)

Juste avant le paragraphe « Les variantes suivantes ont été élaborées et analysées dans le cadre de ce rapport de conseil », insérer un paragraphe contenant uniquement :

```
{@tableauVariantes}
```

Le tag rawxml (`@`) injecte directement une `<w:tbl>` construite par `wpBuildVariantesXml()` avec les 16 lignes d'intervention (toits, murs, façades, fenêtres, sols, ponts, chauffage, ECS, ventilation, PV…) et les ✓ pour les 3 variantes.

#### Tableau Bases Documents (Phase 3)

Dans la section « Bases — Documents », supprimer les lignes vides du tableau existant et remplacer par **une seule ligne modèle** :

| {{label}} | {{statut}} |
|---|---|

Entourer cette ligne avec les délimiteurs de boucle :

```
{#basesRows}
| {{label}} | {{statut}} |
{/basesRows}
```

> Remarque : la boucle ne fonctionne correctement que si elle est placée **dans** le tableau existant, sur une ligne dédiée. En cas de problème, utiliser la syntaxe `{#basesRows}…{/basesRows}` sur la cellule de la ligne (tag sur une ligne seule dans une cellule fusionnée sur toutes les colonnes).

### 4. Sauvegarder

Fichier → Enregistrer sous → format **.docx** (Word 2007 ou plus récent). Vérifier que le nom reste `cecb_plus_template.docx`.

### 5. Tester

Dans l'outil CECB Assistant, onglet **CECB Plus Word** :
1. Cliquer **Tester template** — doit afficher `Template trouvé (XX KB)`.
2. Compléter mandataire + n° CECB + date rapport.
3. Cliquer **Générer le rapport .docx**.
4. Vérifier que le fichier téléchargé contient bien les valeurs saisies.

## En cas d'erreur

- **Erreur template : tag manquant `xxx`** : le tag `{{xxx}}` a été inséré dans le template mais la donnée correspondante n'est pas fournie par `wpCollectFormData()`. Ne pas utiliser de tag non prévu.
- **Erreur template : paragraph loop error** : le bloc `{#hasX}` a été fractionné sur plusieurs paragraphes. L'entourer d'une structure de paragraphe simple (pas dans un tableau).
- **Le fichier généré est vide** : vérifier que `cecb_plus_template.docx` est bien valide (l'ouvrir manuellement dans Word).

## Mises à jour du template officiel CECB

Si l'outil CECB officiel modifie la structure de son `.docx` vierge, reprendre la procédure à zéro avec le nouveau modèle. Documenter la version dans le commit Git.
