/* ════════════════════════════════════════════════════════════
 * recueil-transcript.js
 * Import et analyse de transcripts (audio Whisper, PDF, texte) pour
 * pré-remplir les champs CECB et générer les textes EI/AP via Claude.
 * Extrait de recueil.js — Phase 4 (split god-file).
 *
 * Dépendances runtime (globales déjà chargées via projet.html) :
 *   - recueilToast, recueilAutoSave, updateCharCounter (recueil.js)
 *   - updateToitFields, updateChauffageFields, updatePVFields, estimateUw, updateLifeIndicator (recueil.js)
 *   - ProjectStore (project-store.js)
 *   - CecbApi (api-handler.js)
 *   - pdfjsLib (CDN)
 *
 * API publique :
 *   - handleTranscriptFile(input)
 *   - analyzeTranscript(text), processAudioFile(file)
 *   - fillTranscriptPassages(passages), recallSectionPassage(section, suffix)
 *   - fillCecbV3Texts(json), parseCecbV3FreeText(text), fillFromJSON(json)
 * ════════════════════════════════════════════════════════════ */

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

/* ===== TRANSCRIPT ANALYSIS ===== */

async function analyzeTranscript(transcriptText) {
    if (!CecbApi.useProxy() && !CecbApi.getApiKey()) { recueilToast('Configurez votre clé API ou l\'URL proxy', 'error'); return; }
    if (!transcriptText || !transcriptText.trim()) { recueilToast('Transcript vide', 'error'); return; }

    var status = document.getElementById('transcript-status');
    var btn = document.getElementById('btnImportTranscript');
    if (status) status.innerHTML = 'Étape 1/2 — Extraction des données...';
    if (btn) { btn.disabled = true; btn.textContent = 'Analyse...'; }

    try {
        // STEP 1: Extract structured fields
        var fieldsPrompt = 'Analyse cette transcription de visite CECB et extrais les informations structurées au format JSON.\n\nRetourne UNIQUEMENT un objet JSON valide avec cette structure :\n{"meta":{"canton":"","commune":"","adresse":"","annee_construction":null,"type":"","sre":null},"toit":{"config":"","type":"","annee":null,"isolation":"","isolation_cm":null,"materiau":"","etat":"","pv":"","combles_comp":""},"murs":{"composition":"","revetement":"","isolation":"","isolation_cm":null,"mitoyen":"non"},"murs_terre":{"composition":"","isolation":"","isol_cm":null,"etat":""},"murs_nc":{"composition":"","isolation":"","isol_cm":null,"etat":""},"fenetres":{"cadre":"","vitrage":"","annee":null,"cadres_renov":"","porte":""},"sols_terre":{"config":"","isolation":"","isol_cm":null},"sols_nc":{"config":"","isolation":"","isol_cm":null,"soussol":"","usage":""},"ventilation":{"vmc":"","extraction":""},"chauffage":{"source":"","puissance":null,"annee":null,"distribution":"","conso":"","conso_years":null,"appoint":""},"ecs":{"type":"","annee":null,"volume":null},"appareils":{"conso":""},"pv":{"existant":"","puissance":null,"batterie":"non"}}\n\nTranscription :\n' + transcriptText;

        try {
            var text1 = await CecbApi.callClaude({ userMessage: fieldsPrompt, maxTokens: 2048 });
            var json1 = CecbApi.parseJsonResponse(text1);
            fillFromJSON(json1);
        } catch (e) { recueilToast('Extraction des champs partielle', 'error'); console.warn('Transcript fields error:', e); }

        // STEP 2: Extract raw transcript passages per section
        if (status) status.innerHTML = 'Étape 2/2 — Extraction des passages...';
        var passagesPrompt = 'À partir de cette transcription de visite CECB, extrais les passages pertinents pour chaque section du rapport.\n\nRetourne UNIQUEMENT un objet JSON avec cette structure :\n{"toit":"","murs-ext":"","murs-terre":"","murs-nc":"","fenetres":"","sols-terre":"","sols-nc":"","ventilation":"","chauffage":"","ecs":"","appareils":"","pv":""}\n\nRègles :\n- Pour chaque section, copie les passages bruts du transcript qui concernent cet élément constructif\n- Regroupe les passages pertinents même s\'ils sont dispersés dans le transcript\n- Garde le texte tel quel, sans réécrire ni reformuler\n- Si une section n\'est pas mentionnée dans le transcript, laisse la valeur vide ""\n- Sections : toit (toiture, isolation entre/sur chevrons, tuiles, combles), murs-ext (murs contre extérieur, composition, isolation), murs-terre (murs contre terre, sous-sol enterré), murs-nc (murs contre non-chauffé), fenetres (fenêtres, vitrages, cadres, portes), sols-terre (radier, terre-plein, dalle sur sol), sols-nc (dalle contre non-chauffé, plancher), ventilation (VMC, aération), chauffage (chaudière, PAC, distribution, consommations), ecs (eau chaude sanitaire, boiler), appareils (appareils électriques, éclairage), pv (panneaux solaires, photovoltaïque)\n\nTranscription :\n' + transcriptText;

        try {
            var text2 = await CecbApi.callClaude({ userMessage: passagesPrompt, maxTokens: 4096 });
            var json2 = CecbApi.parseJsonResponse(text2);
            fillTranscriptPassages(json2);
            var pid = ProjectStore.getCurrentId();
            if (pid) ProjectStore.update(pid, 'recueil', { transcriptPassages: json2 });
        } catch (e) { recueilToast('Extraction des passages partielle', 'error'); console.warn('Transcript passages error:', e); }

        if (status) status.textContent = '';
        recueilToast('Fichier importé');
        recueilAutoSave();
    } catch (e) {
        if (status) status.textContent = '';
        recueilToast('Erreur: ' + e.message, 'error');
    }
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

function recallSectionPassage(section, suffix) {
    var pid = ProjectStore.getCurrentId();
    if (!pid) { recueilToast('Aucun projet ouvert', 'error'); return; }
    var project = ProjectStore.get(pid);
    var passages = project && project.recueil && project.recueil.transcriptPassages;
    if (!passages || !passages[section]) { recueilToast('Pas de transcript pour cette section', 'error'); return; }

    var data = passages[section];
    var text = '';
    if (typeof data === 'string') {
        // From txt/pdf import: flat string → only EI
        if (suffix === 'ei') text = data;
    } else if (typeof data === 'object') {
        // From audio import: {ei, ap}
        text = data[suffix] || '';
    }
    if (!text) { recueilToast('Pas de texte ' + suffix.toUpperCase() + ' pour cette section', 'error'); return; }

    var ta = document.getElementById('gen-' + section + '-' + suffix);
    if (ta) {
        ta.value = text;
        updateCharCounter(section, suffix);
        var outputDiv = document.getElementById('output-' + section);
        if (outputDiv) outputDiv.style.display = 'block';
        recueilToast('Texte rappelé');
        recueilAutoSave();
    }
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
    if (!CecbApi.useProxy() && !CecbApi.getGroqKey()) { recueilToast('Configurez votre clé API Groq ou l\'URL proxy dans Paramètres', 'error'); return; }
    if (!CecbApi.useProxy() && !CecbApi.getApiKey()) { recueilToast('Configurez votre clé API Claude ou l\'URL proxy dans Paramètres', 'error'); return; }

    var status = document.getElementById('transcript-status');
    var btn = document.getElementById('btnImportTranscript');
    if (btn) { btn.disabled = true; btn.textContent = 'Transcription...'; }

    try {
        // STEP 1: Transcribe audio via Groq Whisper
        if (status) status.innerHTML = 'Étape 1/3 — Transcription audio (Whisper)...';
        var transcriptText = await CecbApi.callWhisper(file);
        if (!transcriptText.trim()) { recueilToast('Transcription vide', 'error'); return; }

        // Save raw transcript
        var pid = ProjectStore.getCurrentId();
        if (pid) ProjectStore.update(pid, 'recueil', { rawTranscript: transcriptText });

        // STEP 2: Extract structured fields
        if (status) status.innerHTML = 'Étape 2/3 — Extraction des données...';
        var fieldsPrompt = 'Analyse cette transcription de visite CECB et extrais les informations structurées au format JSON.\n\nRetourne UNIQUEMENT un objet JSON valide avec cette structure :\n{"meta":{"canton":"","commune":"","adresse":"","annee_construction":null,"type":"","sre":null},"toit":{"config":"","type":"","annee":null,"isolation":"","isolation_cm":null,"materiau":"","etat":"","pv":"","combles_comp":""},"murs":{"composition":"","revetement":"","isolation":"","isolation_cm":null,"mitoyen":"non"},"murs_terre":{"composition":"","isolation":"","isol_cm":null,"etat":""},"murs_nc":{"composition":"","isolation":"","isol_cm":null,"etat":""},"fenetres":{"cadre":"","vitrage":"","annee":null,"cadres_renov":"","porte":""},"sols_terre":{"config":"","isolation":"","isol_cm":null},"sols_nc":{"config":"","isolation":"","isol_cm":null,"soussol":"","usage":""},"ventilation":{"vmc":"","extraction":""},"chauffage":{"source":"","puissance":null,"annee":null,"distribution":"","conso":"","conso_years":null,"appoint":""},"ecs":{"type":"","annee":null,"volume":null},"appareils":{"conso":""},"pv":{"existant":"","puissance":null,"batterie":"non"}}\n\nTranscription :\n' + transcriptText;

        try {
            var text1 = await CecbApi.callClaude({ userMessage: fieldsPrompt, maxTokens: 2048 });
            var json1 = CecbApi.parseJsonResponse(text1);
            fillFromJSON(json1);
        } catch (e) { recueilToast('Extraction des champs partielle', 'error'); console.warn('Audio fields error:', e); }

        // STEP 3: Generate CECB texts with full CECB v3 prompt
        if (status) status.innerHTML = 'Étape 3/3 — Rédaction des textes CECB...';
        if (btn) btn.textContent = 'Rédaction...';

        try {
            var cecbPrompt = CECB_V3_PROMPT + '\n\n=== TRANSCRIPTION DE LA VISITE ===\n' + transcriptText;
            var fullText = await CecbApi.callClaude({ userMessage: cecbPrompt, maxTokens: 8192, timeoutMs: 120000 });
            try {
                var json2 = CecbApi.parseJsonResponse(fullText);
                fillCecbV3Texts(json2);
            } catch (e) {
                console.warn('CECB v3 JSON parse error, trying text parse:', e);
                parseCecbV3FreeText(fullText);
            }
        } catch (e) { recueilToast('Erreur génération textes: ' + e.message, 'error'); console.warn('CECB v3 error:', e); }

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
    var passagesForRecall = {};
    sections.forEach(function(section) {
        var t = json[section];
        if (!t) return;
        if (typeof t === 'string') {
            var eiTa = document.getElementById('gen-' + section + '-ei');
            if (eiTa && t) eiTa.value = t;
            passagesForRecall[section] = { ei: t, ap: '' };
        } else {
            if (t.ei) { var eiTa = document.getElementById('gen-' + section + '-ei'); if (eiTa) eiTa.value = t.ei; }
            if (t.ap) { var apTa = document.getElementById('gen-' + section + '-ap'); if (apTa) apTa.value = t.ap; }
            passagesForRecall[section] = { ei: t.ei || '', ap: t.ap || '' };
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
    // Save for per-section recall
    var pid = ProjectStore.getCurrentId();
    if (pid) ProjectStore.update(pid, 'recueil', { transcriptPassages: passagesForRecall });
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
