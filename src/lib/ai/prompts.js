export function caseGeneratorMessages({ subject, difficulty, skills }) {
  return [
    {
      role: "system",
      content: `Tu es un concepteur de dossiers thérapeutiques et biologiques pour le concours de l'internat de pharmacie en France.

Tu dois produire un dossier progressif sérieux, style annales/concours, centré sur biologie médicale, pharmacologie, et pharmacie clinique. Inspire toi fortement des sujets de la méthodologie des concours précédents.

Contraintes impératives :
- pas de chatbot patient ;
- énoncé complet dès le départ ;
- données biologiques chiffrées et hyper cohérentes ;
- questions progressives ;
- pathologie cachée ;
- correction cachée avec barème ;
- ton universitaire, strict, non conversationnel ;
- retour uniquement en JSON valide, sans markdown.`,
    },
    {
      role: "user",
      content: `Matière : ${subject.label}
Difficulté : ${difficulty}
Compétences disponibles : ${skills}

Retourne strictement ce JSON :
{
  "title": "Dossier de ...",
  "subject": "${subject.label}",
  "difficulty": "${difficulty}",
  "hiddenDiagnosis": "...",
  "statement": "...",
  "biologicalData": [
    { "label": "CRP", "value": "19 mg/L", "interpretation": "..." }
  ],
  "questions": [
    {
      "id": "q1",
      "text": "...",
      "expectedAnswer": "...",
      "keywords": ["..."],
      "grading": [
        { "item": "...", "points": 2 }
      ],
      "commonMistakes": ["..."],
      "relatedLeitnerSkills": ["matiere.competence"]
    }
  ]
}

Exigences :
- 5 à 6 questions ;
- chaque question doit avoir un barème total entre 4 et 8 points ;
- inclure au moins 5 données biologiques quand pertinent ;
- intégrer mécanismes pharmacologiques, surveillance, durée, interactions ou biologie spécialisée quand pertinent.`,
    },
  ];
}

export function qcmGeneratorMessages({ subject, skills, count }) {
  return [
    {
      role: "system",
      content: `Tu es concepteur de QCM pour le concours de l'internat de pharmacie en France.

Tu dois formuler des QCM secs, exigeants, de niveau concours réel, comparables aux annales et aux questions déjà tombées.
Tu peux reprendre les thèmes, pièges, tournures et niveaux de détail récurrents des annales, sans recopier mot pour mot un sujet ni inventer une année de session.
Les questions doivent tester les connaissances discriminantes du programme officiel : pièges de vocabulaire, mécanismes, indications, contre-indications, biologie, toxicologie, interactions, surveillance, épidémiologie ou méthode selon la matière.

Contraintes impératives :
- pas de dossier clinique long ;
- pas de dialogue patient ;
- pas d'explication dans l'énoncé ;
- cinq propositions A à E ;
- une ou plusieurs propositions exactes possibles ;
- distracteurs plausibles, pas absurdes ;
- formulation universitaire concise ;
- retour uniquement en JSON valide, sans markdown.`,
    },
    {
      role: "user",
      content: `Matière : ${subject.label}
Niveau : concours réel, type annales
Nombre de QCM : ${count}
Compétences disponibles : ${skills}

Retourne strictement ce JSON :
{
  "title": "QCM - ...",
  "subject": "${subject.label}",
  "difficulty": "concours",
  "questions": [
    {
      "id": "q1",
      "text": "Parmi les propositions suivantes concernant ..., laquelle/lesquelles est/sont exacte(s) ?",
      "options": [
        { "id": "A", "text": "..." },
        { "id": "B", "text": "..." },
        { "id": "C", "text": "..." },
        { "id": "D", "text": "..." },
        { "id": "E", "text": "..." }
      ],
      "correctOptionIds": ["A", "C"],
      "expectedAnswer": "A, C",
      "explanation": "Correction courte, précise et exploitable.",
      "keywords": ["..."],
      "commonMistakes": ["..."],
      "relatedLeitnerSkills": ["matiere.competence"]
    }
  ]
}

Exigences :
- exactement ${count} QCM ;
- varier les compétences couvertes ;
- privilégier les thèmes et pièges qui ressemblent aux sujets déjà tombés ;
- niveau difficile par défaut, sans question de cours trop simple ;
- ne jamais révéler la réponse dans l'intitulé ;
- ne pas créer de proposition du type "toutes les réponses" ou "aucune réponse" ;
- chaque correction doit expliquer pourquoi les propositions attendues sont exactes et pourquoi les pièges sont faux.`,
    },
  ];
}

export function correctionMessages({ statement, biologicalData, question, userAnswer }) {
  const maxScore = question.grading.reduce((sum, item) => sum + Number(item.points || 0), 0);
  const normalizedUserAnswer = normalizeStudentAnswerForCorrection(userAnswer);
  const isOfficialAnnaleCorrection = question.correctionSource === "official_proposed_answer";
  const referenceLabel = isOfficialAnnaleCorrection
    ? "Correction proposée officielle de l'annale"
    : "Correction proposée officielle de l'annale";
  const referenceInstruction = isOfficialAnnaleCorrection
    ? `Étape obligatoire : vérifie d'abord que la correction proposée officielle de cette question est bien fournie ci-dessous.
Elle est fournie : tu dois corriger exclusivement en comparant la réponse utilisateur à cette correction proposée officielle.
Ne rajoute pas d'exigence qui n'est pas présente dans cette correction proposée, sauf erreur dangereuse manifeste.
Si la réponse utilisateur contient une formulation différente mais équivalente à la correction proposée, accorde les points correspondants.
La correction type que tu rends doit reformuler cette correction proposée, pas inventer un autre corrigé.`
    : `Étape obligatoire : vérifie d'abord si une correction proposée officielle de cette question est fournie ci-dessous.
Elle n'est pas fournie ou elle est inexploitable : corrige alors d'après tes connaissances, mais uniquement si tu es très sûr de toi.
Si plusieurs interprétations sont possibles, adopte une notation prudente, explicite les hypothèses dans "feedback", et ne présente pas une invention comme une correction officielle.
La correction type doit indiquer qu'elle est construite faute de proposition officielle détectée.`;
  return [
    {
      role: "system",
      content: `Tu es correcteur strict du concours de l'internat de pharmacie.

Tu sanctions les réponses vagues, les diagnostics non justifiés, l'absence de valeurs biologiques, mécanismes pharmacologiques,
durées, surveillance et erreurs dangereuses.

${referenceInstruction}

Avant de noter, interprète les notations étudiant avec tolérance raisonnable :
- accepte les variantes typographiques ou fautes évidentes si le sens scientifique est clair ;
- considère par exemple "lamda", "lambda" et "λ" comme équivalents ;
- considère "ln2/T", "ln(2)/T", "ln 2 / T" et "$\\frac{\\ln 2}{T}$" comme équivalents ;
- accepte les écritures équivalentes d'unités et puissances, par exemple "s-1", "s^-1" et "$\\mathrm{s}^{-1}$" ;
- ne retire pas de point pour une notation imparfaite si la grandeur, la relation et le raisonnement sont justes ;
- sanctionne seulement si l'ambiguïté change le sens, l'unité, le résultat numérique ou le raisonnement.

Tu ne félicites pas. Tu formules une correction sobre, universitaire et utile.
Quand une formule, une unité, un isotope ou une équation est nécessaire dans expectedAnswer, feedback ou examStyleCorrection :
- utilise du LaTeX propre ;
- encadre les formules courtes avec $...$ et les équations importantes avec $$...$$ ;
- groupe les isotopes et espèces chimiques dans une seule formule, par exemple \${}^{99m}\\mathrm{TcO_4^-}$ et pas des fragments séparés ;
- écris les unités en romain, par exemple $\\mathrm{s}^{-1}$, $\\mathrm{g.mol}^{-1}$ ou $\\mathrm{mL}$ ;
- n'écris jamais des fragments illisibles du type $^{99m}$TcO$_4^-$.
Même si le JSON garde expectedAnswer et examStyleCorrection pour compatibilité technique, raisonne comme s'il n'y avait qu'un seul bloc de correction :
- expectedAnswer contient la correction unifiée, complète et exploitable ;
- examStyleCorrection ne contient un complément que s'il apporte un raisonnement utile non déjà présent dans expectedAnswer ;
- si examStyleCorrection répète expectedAnswer, mets une chaîne vide.
Retour uniquement en JSON valide, sans markdown.`,
    },
    {
      role: "user",
      content: `Énoncé :
${statement}

Données biologiques :
${JSON.stringify(biologicalData)}

Question :
${question.text}

${referenceLabel} :
${question.expectedAnswer || "Aucune proposition de réponse officielle exploitable détectée pour cette question."}

Mots-clés attendus :
${JSON.stringify(question.keywords)}

Barème :
${JSON.stringify(question.grading)}

Erreurs fréquentes :
${JSON.stringify(question.commonMistakes)}

Réponse utilisateur :
${userAnswer}

Lecture normalisée de la réponse utilisateur, à utiliser uniquement pour reconnaître les équivalences de notation :
${normalizedUserAnswer}

Retourne strictement :
{
  "score": 0,
  "maxScore": ${maxScore},
  "status": "incorrect|partiel|correct",
  "expectedAnswer": "...",
  "matchedKeywords": ["..."],
  "missingKeywords": ["..."],
  "majorErrors": ["..."],
  "feedback": "...",
  "examStyleCorrection": "...",
  "leitnerUpdates": [
    { "skillId": "...", "result": "failed|passed" }
  ]
}`,
    },
  ];
}

function normalizeStudentAnswerForCorrection(answer) {
  return String(answer || "")
    .normalize("NFKC")
    .replace(/\blamda\b/gi, "λ")
    .replace(/\blambda\b/gi, "λ")
    .replace(/\bdelta\b/gi, "Δ")
    .replace(/\bmu\b/gi, "μ")
    .replace(/\bln\s*2\b/gi, "ln(2)")
    .replace(/\bln2\b/gi, "ln(2)")
    .replace(/\bs\s*\^\s*-?\s*1\b/gi, "s^-1")
    .replace(/\bs\s*-\s*1\b/gi, "s^-1")
    .replace(/\s*=\s*/g, " = ")
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s+/g, " ")
    .trim();
}

export function leitnerCardMessages({ title, question, correction }) {
  return [
    {
      role: "system",
      content: "Tu crées des cartes Leitner d'internat de pharmacie. Retour uniquement en JSON valide, sans markdown.",
    },
    {
      role: "user",
      content: `Dossier : ${title}
Question : ${question.text}
Réponse attendue : ${question.expectedAnswer}
Correction : ${JSON.stringify(correction)}

Crée 1 à 3 cartes ciblées sur les erreurs ou oublis.
Format :
{
  "cards": [
    {
      "skillId": "...",
      "subject": "...",
      "front": "...",
      "back": "...",
      "difficulty": "medium|high",
      "source": "..."
    }
  ]
}`,
    },
  ];
}
