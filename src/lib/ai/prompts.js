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

export function correctionMessages({ statement, biologicalData, question, userAnswer }) {
  const maxScore = question.grading.reduce((sum, item) => sum + Number(item.points || 0), 0);
  return [
    {
      role: "system",
      content: `Tu es correcteur strict du concours de l'internat de pharmacie.

Tu sanctions les réponses vagues, les diagnostics non justifiés, l'absence de valeurs biologiques, mécanismes pharmacologiques, durées, surveillance et erreurs dangereuses.

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

Réponse attendue :
${question.expectedAnswer}

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
