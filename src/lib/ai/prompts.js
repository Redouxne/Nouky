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

Tu ne félicites pas. Tu formules une correction sobre, universitaire et utile.
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
