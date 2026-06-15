import { extractJsonObject, clampScore, safeArray } from "@/lib/ai/json";
import { caseGeneratorMessages, correctionMessages, leitnerCardMessages } from "@/lib/ai/prompts";
import { getProgramSubject } from "@/lib/internat-program";
import { mistralChat } from "@/lib/mistral";

const LEITNER_INTERVALS = {
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: 30,
};

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function nextLeitnerState(card, rating) {
  const now = new Date();
  const failed = rating === "failure" || rating === "difficult";
  const jump = rating === "mastered" ? 2 : 1;
  const box = failed ? 1 : Math.min(5, Number(card.box || 1) + jump);
  return {
    box,
    dueAt: addDays(now, LEITNER_INTERVALS[box] || 1),
    lastReviewedAt: now,
    successCount: failed ? Number(card.successCount || 0) : Number(card.successCount || 0) + 1,
    failureCount: failed ? Number(card.failureCount || 0) + 1 : Number(card.failureCount || 0),
  };
}

export function publicCasePayload(caseSession) {
  const questions = JSON.parse(caseSession.questionsJson);
  return {
    id: caseSession.id,
    title: caseSession.title,
    subject: caseSession.subject,
    difficulty: caseSession.difficulty,
    statement: caseSession.statement,
    biologicalData: JSON.parse(caseSession.biologicalJson || "[]"),
    questions: questions.map((question) => ({
      id: question.id,
      text: question.text,
      maxScore: totalPoints(question.grading),
    })),
    createdAt: caseSession.createdAt,
  };
}

export function totalPoints(grading = []) {
  return safeArray(grading).reduce((sum, item) => sum + Number(item.points || 0), 0);
}

export async function generateCaseContent({ subjectId, difficulty = "intermédiaire" }) {
  const subject = getProgramSubject(subjectId);
  const skills = Object.entries(subject.skills)
    .map(([id, label]) => `${subjectId}.${id}: ${label}`)
    .join("\n");

  try {
    const raw = await mistralChat(caseGeneratorMessages({ subject, difficulty, skills }), {
      temperature: 0.55,
      topP: 0.9,
    });
    return normalizeCase(extractJsonObject(raw), { subject, subjectId, difficulty });
  } catch (error) {
    return fallbackCase({ subject, subjectId, difficulty });
  }
}

export async function correctAnswer({ caseSession, question, userAnswer }) {
  const biologicalData = JSON.parse(caseSession.biologicalJson || "[]");
  const maxScore = totalPoints(question.grading);

  try {
    const raw = await mistralChat(
      correctionMessages({
        statement: caseSession.statement,
        biologicalData,
        question,
        userAnswer,
      }),
      { temperature: 0.2, topP: 0.8 },
    );
    return normalizeCorrection(extractJsonObject(raw), question, userAnswer, maxScore);
  } catch (error) {
    return fallbackCorrection(question, userAnswer, maxScore);
  }
}

export async function generateLeitnerCards({ caseSession, question, correction }) {
  try {
    const raw = await mistralChat(
      leitnerCardMessages({
        title: caseSession.title,
        question,
        correction,
      }),
      { temperature: 0.25, topP: 0.85 },
    );
    const parsed = extractJsonObject(raw);
    const cards = safeArray(parsed?.cards).map(normalizeCard).filter(Boolean);
    if (cards.length > 0) return cards;
  } catch {
    // Fallback below keeps correction functional even when AI card generation fails.
  }

  return safeArray(correction.leitnerUpdates)
    .filter((update) => update.result === "failed")
    .slice(0, 3)
    .map((update) => ({
      skillId: update.skillId,
      subject: caseSession.subject,
      front: `À retenir : ${question.text}`,
      back: correction.expectedAnswer || question.expectedAnswer,
    }));
}

function normalizeCase(parsed, { subject, subjectId, difficulty }) {
  if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length < 3) {
    return fallbackCase({ subject, subjectId, difficulty });
  }

  const questions = parsed.questions.slice(0, 6).map((question, index) => {
    const grading = safeArray(question.grading).length
      ? question.grading.map((item) => ({
          item: String(item.item || "Élément attendu"),
          points: Number(item.points || 1),
        }))
      : [{ item: "Réponse structurée", points: 4 }];

    return {
      id: String(question.id || `q${index + 1}`),
      text: String(question.text || `Question ${index + 1}`),
      expectedAnswer: String(question.expectedAnswer || ""),
      keywords: safeArray(question.keywords).map(String),
      grading,
      commonMistakes: safeArray(question.commonMistakes).map(String),
      relatedLeitnerSkills: safeArray(question.relatedLeitnerSkills).map(String),
    };
  });

  return {
    title: String(parsed.title || `Dossier de ${subject.label}`),
    subject: String(parsed.subject || subject.label),
    difficulty: String(parsed.difficulty || difficulty),
    hiddenDiagnosis: String(parsed.hiddenDiagnosis || ""),
    statement: String(parsed.statement || ""),
    biologicalData: safeArray(parsed.biologicalData).map((item) => ({
      label: String(item.label || ""),
      value: String(item.value || ""),
      interpretation: String(item.interpretation || ""),
    })),
    questions,
  };
}

function normalizeCorrection(parsed, question, userAnswer, maxScore) {
  if (!parsed) return fallbackCorrection(question, userAnswer, maxScore);
  const score = clampScore(parsed.score, parsed.maxScore || maxScore);
  const normalizedMax = Number(parsed.maxScore || maxScore);
  const computedStatus = score >= normalizedMax * 0.8 ? "correct" : score > 0 ? "partiel" : "incorrect";
  const status = ["incorrect", "partiel", "correct"].includes(parsed.status) ? parsed.status : computedStatus;
  return {
    score,
    maxScore: normalizedMax,
    status,
    expectedAnswer: String(parsed.expectedAnswer || question.expectedAnswer || ""),
    matchedKeywords: safeArray(parsed.matchedKeywords).map(String),
    missingKeywords: safeArray(parsed.missingKeywords).map(String),
    majorErrors: safeArray(parsed.majorErrors).map(String),
    feedback: String(parsed.feedback || "Correction insuffisamment détaillée."),
    examStyleCorrection: String(parsed.examStyleCorrection || parsed.expectedAnswer || question.expectedAnswer || ""),
    leitnerUpdates: safeArray(parsed.leitnerUpdates).map((update) => ({
      skillId: String(update.skillId || question.relatedLeitnerSkills?.[0] || "general.revision"),
      result: update.result === "passed" ? "passed" : "failed",
    })),
  };
}

function fallbackCorrection(question, userAnswer, maxScore) {
  const answer = userAnswer.toLowerCase();
  const keywords = safeArray(question.keywords);
  const matchedKeywords = keywords.filter((keyword) => answer.includes(String(keyword).toLowerCase()));
  const missingKeywords = keywords.filter((keyword) => !matchedKeywords.includes(keyword));
  const keywordScore = keywords.length ? (matchedKeywords.length / keywords.length) * maxScore : 0;
  const score = Math.round(keywordScore * 2) / 2;

  return {
    score,
    maxScore,
    status: score >= maxScore * 0.8 ? "correct" : score > 0 ? "partiel" : "incorrect",
    expectedAnswer: question.expectedAnswer,
    matchedKeywords,
    missingKeywords,
    majorErrors: [],
    feedback:
      score >= maxScore * 0.8
        ? "Réponse correcte mais à structurer selon le barème du concours."
        : "Réponse incomplète : plusieurs éléments attendus du barème ne sont pas cités.",
    examStyleCorrection: question.expectedAnswer,
    leitnerUpdates: safeArray(question.relatedLeitnerSkills).map((skillId) => ({
      skillId,
      result: missingKeywords.length ? "failed" : "passed",
    })),
  };
}

function normalizeCard(card) {
  if (!card?.front || !card?.back) return null;
  return {
    skillId: String(card.skillId || "general.revision"),
    subject: String(card.subject || "Internat pharmacie"),
    front: String(card.front),
    back: String(card.back),
  };
}

function fallbackCase({ subject, subjectId, difficulty }) {
  const baseSkill = `${subjectId}.${Object.keys(subject.skills)[0] || "competence"}`;

  if (subjectId === "nephrologie") {
    return {
      title: "Dossier de néphrologie - Insuffisance rénale chronique",
      subject: subject.label,
      difficulty,
      hiddenDiagnosis: "Insuffisance rénale chronique compliquée",
      statement:
        "Un homme de 68 ans, diabétique de type 2 et hypertendu, consulte pour asthénie progressive, prurit et œdèmes des membres inférieurs. Son traitement comporte metformine, ramipril et hydrochlorothiazide. Le bilan biologique objective une altération chronique de la fonction rénale.",
      biologicalData: [
        { label: "Créatinine", value: "245 µmol/L", interpretation: "Insuffisance rénale" },
        { label: "DFG CKD-EPI", value: "24 mL/min/1,73 m²", interpretation: "IRC stade 4" },
        { label: "Kaliémie", value: "5,8 mmol/L", interpretation: "Hyperkaliémie" },
        { label: "Hémoglobine", value: "9,8 g/dL", interpretation: "Anémie" },
        { label: "Phosphate", value: "1,85 mmol/L", interpretation: "Hyperphosphatémie" },
        { label: "Calcémie corrigée", value: "2,02 mmol/L", interpretation: "Hypocalcémie" },
        { label: "PTH", value: "215 pg/mL", interpretation: "Hyperparathyroïdie secondaire" },
      ],
      questions: [
        question("q1", "Caractériser l'insuffisance rénale et son stade.", "IRC stade 4 selon DFG CKD-EPI à 24 mL/min/1,73 m², à confirmer sur la chronicité et le contexte.", ["IRC", "stade 4", "DFG", "chronicité"], baseSkill),
        question("q2", "Interpréter les anomalies ioniques et phosphocalciques.", "Hyperkaliémie, hypocalcémie, hyperphosphatémie et hyperparathyroïdie secondaire de l'IRC.", ["hyperkaliémie", "hypocalcémie", "hyperphosphatémie", "PTH"], `${subjectId}.troubles_phosphocalciques`),
        question("q3", "Caractériser l'anémie et proposer son mécanisme principal.", "Anémie normocytaire arégénérative probable par déficit relatif en érythropoïétine, après élimination des carences.", ["anémie", "normocytaire", "érythropoïétine", "carences"], `${subjectId}.anemie_irc`),
        question("q4", "Quelles adaptations thérapeutiques sont nécessaires ?", "Arrêt ou réévaluation de metformine selon DFG, gestion hyperkaliémie, adaptation des médicaments néphrotoxiques et surveillance rapprochée.", ["metformine", "DFG", "hyperkaliémie", "surveillance"], "pharmacocinetique.adaptation_posologique"),
        question("q5", "Quelle prise en charge des troubles phosphocalciques proposer ?", "Restriction phosphorée, chélateurs du phosphate si besoin, correction vitamine D/calcium selon bilan et surveillance Ca/P/PTH.", ["chélateurs", "phosphate", "vitamine D", "surveillance"], `${subjectId}.troubles_phosphocalciques`),
      ],
    };
  }

  return {
    title: `Dossier de ${subject.label} - Polyarthrite rhumatoïde`,
    subject: subject.label,
    difficulty,
    hiddenDiagnosis: "Polyarthrite rhumatoïde",
    statement:
      "Une femme de 45 ans est adressée pour douleurs articulaires symétriques des mains et poignets depuis quatre mois, avec dérouillage matinal supérieur à une heure. L'examen retrouve une tuméfaction douloureuse des MCP et IPP. Un bilan immunologique et inflammatoire est réalisé.",
    biologicalData: [
      { label: "CRP", value: "28 mg/L", interpretation: "Syndrome inflammatoire" },
      { label: "VS", value: "52 mm", interpretation: "Inflammation" },
      { label: "Facteur rhumatoïde", value: "Positif 86 UI/mL", interpretation: "Auto-anticorps compatible" },
      { label: "Anti-CCP", value: "Positif > 200 UI/mL", interpretation: "Très spécifique de PR" },
      { label: "Hémoglobine", value: "11,2 g/dL", interpretation: "Anémie inflammatoire possible" },
    ],
    questions: [
      question("q1", "Quel est le diagnostic le plus probable ? Justifier.", "Polyarthrite rhumatoïde débutante devant arthrites symétriques des mains, dérouillage matinal, syndrome inflammatoire, facteur rhumatoïde et anti-CCP positifs.", ["polyarthrite rhumatoïde", "symétrique", "CRP", "anti-CCP", "facteur rhumatoïde"], `${subjectId}.polyarthrite_rhumatoide_diagnostic`),
      question("q2", "Quel est l'intérêt diagnostique des anticorps anti-CCP ?", "Les anti-CCP ont une forte spécificité diagnostique et une valeur pronostique dans la polyarthrite rhumatoïde.", ["anti-CCP", "spécificité", "diagnostique", "pronostique"], `${subjectId}.anti_ccp`),
      question("q3", "Quel traitement de fond proposer en première intention et selon quelles modalités ?", "Méthotrexate en première intention, administration hebdomadaire, supplémentation en acide folique, surveillance NFS, transaminases et fonction rénale.", ["méthotrexate", "hebdomadaire", "acide folique", "NFS", "transaminases"], `${subjectId}.methotrexate`),
      question("q4", "Une cytopénie apparaît sous traitement. Quelle cause probable et quelle prévention ?", "Toxicité hématologique du méthotrexate favorisée par absence d'acide folique, surdosage ou insuffisance rénale ; prévention par folates et surveillance biologique.", ["cytopénie", "méthotrexate", "acide folique", "surveillance"], `${subjectId}.methotrexate`),
      question("q5", "Avant adalimumab, quelle infection bactérienne rechercher et par quel test ?", "Rechercher une tuberculose latente avant anti-TNF, par interrogatoire, radiographie thoracique et test IGRA type Quantiferon.", ["adalimumab", "anti-TNF", "tuberculose", "IGRA", "Quantiferon"], `${subjectId}.anti_tnf`),
    ],
  };
}

function question(id, text, expectedAnswer, keywords, skillId) {
  return {
    id,
    text,
    expectedAnswer,
    keywords,
    grading: [
      { item: "Réponse principale", points: 2 },
      { item: "Arguments biologiques ou pharmacologiques", points: 2 },
      { item: "Justification et conduite à tenir", points: 2 },
    ],
    commonMistakes: ["Réponse trop vague", "Absence de justification", "Oubli de la surveillance"],
    relatedLeitnerSkills: [skillId],
  };
}
