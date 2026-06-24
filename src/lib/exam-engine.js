import { extractJsonObject, clampScore, safeArray } from "@/lib/ai/json";
import { caseGeneratorMessages, correctionMessages, leitnerCardMessages, qcmGeneratorMessages } from "@/lib/ai/prompts";
import { getProgramSubject, getSkillLabel } from "@/lib/internat-program";
import { mistralChat } from "@/lib/mistral";

const LEITNER_MAX_BOX = 10;
const LEITNER_MAX_INTERVAL_DAYS = 60;
const LEITNER_BASE_INTERVAL_DAYS = 3;
const LEITNER_GROWTH = 1.45;

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function leitnerIntervalDays(box) {
  const normalizedBox = Math.min(Math.max(Number(box) || 1, 1), LEITNER_MAX_BOX);
  return Math.min(
    LEITNER_MAX_INTERVAL_DAYS,
    Math.round(LEITNER_BASE_INTERVAL_DAYS * LEITNER_GROWTH ** (normalizedBox - 1)),
  );
}

export function scoreToLeitnerBox(score, maxScore) {
  const ratio = maxScore ? Number(score || 0) / Number(maxScore || 1) : 0;
  if (ratio < 0.5) return 1;
  if (ratio < 0.6) return 2;
  if (ratio < 0.7) return 3;
  if (ratio < 0.8) return 4;
  if (ratio < 0.85) return 5;
  if (ratio < 0.9) return 6;
  if (ratio < 0.95) return 7;
  if (ratio < 0.98) return 8;
  if (ratio < 1) return 9;
  return LEITNER_MAX_BOX;
}

export function nextLeitnerState(card, rating) {
  const now = new Date();
  const failed = rating === "failure" || rating === "difficult";
  const jump = rating === "mastered" ? 2 : 1;
  const box = failed ? 1 : Math.min(LEITNER_MAX_BOX, Number(card.box || 1) + jump);
  return {
    box,
    dueAt: addDays(now, leitnerIntervalDays(box)),
    lastReviewedAt: now,
    successCount: failed ? Number(card.successCount || 0) : Number(card.successCount || 0) + 1,
    failureCount: failed ? Number(card.failureCount || 0) + 1 : Number(card.failureCount || 0),
  };
}

export function leitnerStateFromScore({ score, maxScore, result }) {
  const now = new Date();
  const failed = result === "failed" || Number(score || 0) < Number(maxScore || 0) * 0.5;
  const box = failed ? 1 : scoreToLeitnerBox(score, maxScore);
  return {
    box,
    dueAt: addDays(now, leitnerIntervalDays(box)),
    lastReviewedAt: now,
    successCount: failed ? 0 : 1,
    failureCount: failed ? 1 : 0,
    result: failed ? "failed" : "passed",
  };
}

export function publicCasePayload(caseSession) {
  const questions = JSON.parse(caseSession.questionsJson);
  return {
    id: caseSession.id,
    title: caseSession.title,
    subject: caseSession.subject,
    difficulty: caseSession.difficulty,
    mode: caseSession.mode,
    statement: caseSession.statement,
    biologicalData: JSON.parse(caseSession.biologicalJson || "[]"),
    questions: questions.map((question) => ({
      id: question.id,
      type: question.type || "case",
      text: question.text,
      sectionId: question.sectionId || "",
      sectionTitle: question.sectionTitle || "",
      sectionStatement: question.sectionStatement || "",
      correctionSource: question.correctionSource || "",
      options: safeArray(question.options).map((option) => ({
        id: String(option.id),
        text: String(option.text),
      })),
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

export async function generateQcmContent({ subjectId, count = 10 }) {
  const subject = getProgramSubject(subjectId);
  const difficulty = "concours";
  const normalizedCount = Math.min(Math.max(Number(count) || 10, 5), 20);
  const skills = Object.entries(subject.skills)
    .map(([id, label]) => `${subjectId}.${id}: ${label}`)
    .join("\n");

  try {
    const raw = await mistralChat(qcmGeneratorMessages({ subject, skills, count: normalizedCount }), {
      temperature: 0.45,
      topP: 0.88,
    });
    return normalizeQcmSet(extractJsonObject(raw), { subject, subjectId, difficulty, count: normalizedCount });
  } catch (error) {
    return fallbackQcmSet({ subject, subjectId, difficulty, count: normalizedCount });
  }
}

export async function correctAnswer({ caseSession, question, userAnswer }) {
  const biologicalData = JSON.parse(caseSession.biologicalJson || "[]");
  const maxScore = totalPoints(question.grading);
  const sectionStatement = sanitizeStatementForCorrection(question.sectionStatement);
  const statement = question.sectionStatement
    ? `${caseSession.statement}\n\n${question.sectionTitle || "Énoncé"}\n${sectionStatement}`
    : caseSession.statement;

  try {
    const raw = await mistralChat(
      correctionMessages({
        statement,
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

function sanitizeStatementForCorrection(value) {
  return String(value || "")
    .replace(/!\[([^\]]*)\]\(data:image\/[^)]*\)/g, (_, alt) => `[Figure OCR : ${alt || "image du sujet"}]`)
    .slice(0, 12000);
}

export function correctQcmAnswer({ question, selectedOptionIds }) {
  const selected = uniqueOptionIds(selectedOptionIds);
  const correctIds = uniqueOptionIds(question.correctOptionIds);
  const maxScore = totalPoints(question.grading) || 1;
  const selectedSet = new Set(selected);
  const correctSet = new Set(correctIds);
  const exact = selected.length === correctIds.length && selected.every((id) => correctSet.has(id));
  const correctSelected = selected.filter((id) => correctSet.has(id));
  const wrongSelected = selected.filter((id) => !correctSet.has(id));
  const missed = correctIds.filter((id) => !selectedSet.has(id));
  const partialRatio = correctIds.length ? correctSelected.length / correctIds.length : 0;
  const penalty = wrongSelected.length * 0.35 + missed.length * 0.2;
  const partialScore = Math.max(0, Math.min(0.75, partialRatio - penalty)) * maxScore;
  const score = exact ? maxScore : Math.round(partialScore * 2) / 2;
  const status = exact ? "correct" : score > 0 ? "partiel" : "incorrect";
  const optionsById = new Map(safeArray(question.options).map((option) => [String(option.id), String(option.text)]));

  return {
    score,
    maxScore,
    status,
    expectedAnswer: String(question.expectedAnswer || correctIds.join(", ")),
    selectedOptionIds: selected,
    correctOptionIds: correctIds,
    matchedKeywords: correctSelected,
    missingKeywords: missed,
    majorErrors: wrongSelected.map((id) => `${id}. ${optionsById.get(id) || "Proposition fausse sélectionnée"}`),
    feedback: exact
      ? "Réponse exacte."
      : "Réponse incomplète ou proposition fausse sélectionnée : l'item doit être revu.",
    examStyleCorrection: String(question.explanation || question.expectedAnswer || ""),
    leitnerUpdates: safeArray(question.relatedLeitnerSkills).map((skillId) => ({
      skillId: String(skillId),
      result: exact ? "passed" : "failed",
    })),
  };
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

export function generateCaseItemLeitnerCards({ caseSession, question, correction }) {
  const updates = mergeLeitnerUpdates(question, correction);
  const maxScore = Number(correction.maxScore || totalPoints(question.grading) || 0);
  const score = Number(correction.score || 0);

  return updates.map((update) => {
    const state = leitnerStateFromScore({ score, maxScore, result: update.result });
    const skillLabel = getSkillLabel(update.skillId);
    return {
      skillId: update.skillId,
      subject: caseSession.subject,
      front: `Item : ${skillLabel}`,
      back: buildCaseItemBack({ question, correction, skillLabel }),
      box: state.box,
      dueAt: state.dueAt,
      result: state.result,
    };
  });
}

export function generateQcmLeitnerCards({ caseSession, question, correction }) {
  if (correction.status === "correct") return [];
  const correctIds = uniqueOptionIds(question.correctOptionIds);
  const correctText = correctIds
    .map((id) => `${id}. ${safeArray(question.options).find((option) => String(option.id) === id)?.text || ""}`)
    .join("\n");
  const back = [
    `Réponse attendue : ${correction.expectedAnswer}`,
    correctText,
    correction.examStyleCorrection,
  ]
    .filter(Boolean)
    .join("\n\n");

  return safeArray(question.relatedLeitnerSkills)
    .slice(0, 3)
    .map((skillId) => ({
      skillId: String(skillId),
      subject: caseSession.subject,
      front: `QCM à revoir : ${question.text}`,
      back,
      box: 1,
      dueAt: addDays(new Date(), leitnerIntervalDays(1)),
      result: "failed",
    }));
}

function mergeLeitnerUpdates(question, correction) {
  const maxScore = Number(correction.maxScore || totalPoints(question.grading) || 0);
  const score = Number(correction.score || 0);
  const defaultResult = score >= maxScore * 0.5 ? "passed" : "failed";
  const merged = new Map();

  for (const skillId of safeArray(question.relatedLeitnerSkills)) {
    if (skillId) merged.set(String(skillId), defaultResult);
  }

  for (const update of safeArray(correction.leitnerUpdates)) {
    const skillId = String(update.skillId || "");
    if (!skillId) continue;
    merged.set(skillId, update.result === "passed" ? "passed" : "failed");
  }

  return [...merged.entries()].map(([skillId, result]) => ({ skillId, result }));
}

function buildCaseItemBack({ question, correction, skillLabel }) {
  return [
    `Item : ${skillLabel}`,
    `Question : ${question.text}`,
    `Réponse attendue : ${correction.expectedAnswer || question.expectedAnswer}`,
    correction.examStyleCorrection ? `Correction : ${correction.examStyleCorrection}` : "",
    correction.missingKeywords?.length ? `À revoir : ${correction.missingKeywords.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
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

function normalizeQcmSet(parsed, { subject, subjectId, difficulty, count }) {
  if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length < 1) {
    return fallbackQcmSet({ subject, subjectId, difficulty, count });
  }

  const skillIds = Object.keys(subject.skills);
  const questions = parsed.questions.slice(0, count).map((question, index) =>
    normalizeQcmQuestion(question, { subjectId, skillIds, index }),
  );

  if (questions.length < count) {
    const fallback = fallbackQcmSet({ subject, subjectId, difficulty, count });
    questions.push(...fallback.questions.slice(questions.length, count));
  }

  return {
    title: String(parsed.title || `QCM - ${subject.label}`),
    subject: String(parsed.subject || subject.label),
    difficulty: String(parsed.difficulty || difficulty),
    hiddenDiagnosis: "",
    statement: `Série de ${count} QCM de ${subject.label}.`,
    biologicalData: [],
    questions,
  };
}

function normalizeQcmQuestion(question, { subjectId, skillIds, index }) {
  const optionIds = ["A", "B", "C", "D", "E"];
  const options = optionIds.map((id, optionIndex) => {
    const source = safeArray(question?.options).find((item) => String(item?.id || "").toUpperCase() === id);
    return {
      id,
      text: String(source?.text || `Proposition ${id}`),
    };
  });
  const validIds = new Set(optionIds);
  const correctOptionIds = uniqueOptionIds(question?.correctOptionIds).filter((id) => validIds.has(id));
  const skillId = normalizeRelatedSkill(question?.relatedLeitnerSkills?.[0], subjectId, skillIds, index);
  const finalCorrectIds = correctOptionIds.length ? correctOptionIds : ["A"];

  return {
    id: String(question?.id || `q${index + 1}`),
    type: "qcm",
    text: String(
      question?.text ||
        `Parmi les propositions suivantes concernant ${skillIds[index % Math.max(skillIds.length, 1)] || "cet item"}, laquelle/lesquelles est/sont exacte(s) ?`,
    ),
    options,
    correctOptionIds: finalCorrectIds,
    expectedAnswer: String(question?.expectedAnswer || finalCorrectIds.join(", ")),
    explanation: String(question?.explanation || "Correction à revoir dans le référentiel de cours."),
    keywords: safeArray(question?.keywords).map(String),
    grading: [{ item: "Réponse exacte", points: 1 }],
    commonMistakes: safeArray(question?.commonMistakes).map(String),
    relatedLeitnerSkills: [skillId],
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

function fallbackQcmSet({ subject, subjectId, difficulty, count }) {
  const skillEntries = Object.entries(subject.skills);
  const usableSkills = skillEntries.length ? skillEntries : [["revision", subject.label]];
  const questions = Array.from({ length: count }, (_, index) => {
    const [skillKey, skillLabel] = usableSkills[index % usableSkills.length];
    const relatedSkill = `${subjectId}.${skillKey}`;
    return {
      id: `q${index + 1}`,
      type: "qcm",
      text: `Parmi les propositions suivantes concernant ${skillLabel}, laquelle/lesquelles est/sont exacte(s) ?`,
      options: [
        { id: "A", text: `${skillLabel} fait partie du programme officiel de cette matière.` },
        { id: "B", text: "Une réponse non justifiée biologiquement doit toujours être considérée comme suffisante." },
        { id: "C", text: "Les pièges de surveillance, contre-indication ou interprétation biologique doivent être recherchés." },
        { id: "D", text: "La formulation du concours privilégie uniquement les définitions isolées." },
        { id: "E", text: "L'item doit être révisé avec ses applications cliniques, biologiques ou pharmacologiques." },
      ],
      correctOptionIds: ["A", "C", "E"],
      expectedAnswer: "A, C, E",
      explanation:
        "Le concours teste l'application exacte du programme, avec surveillance, interprétation et pièges plausibles. Les réponses vagues ou uniquement définitionnelles sont insuffisantes.",
      keywords: [skillLabel],
      grading: [{ item: "Réponse exacte", points: 1 }],
      commonMistakes: ["Sélectionner une proposition vague", "Oublier la surveillance ou l'interprétation biologique"],
      relatedLeitnerSkills: [relatedSkill],
    };
  });

  return {
    title: `QCM - ${subject.label}`,
    subject: subject.label,
    difficulty,
    hiddenDiagnosis: "",
    statement: `Série de ${count} QCM de ${subject.label}.`,
    biologicalData: [],
    questions,
  };
}

function fallbackCase({ subject, subjectId, difficulty }) {
  const skillEntries = Object.entries(subject.skills);
  const selectedSkills = skillEntries.length ? skillEntries.slice(0, 5) : [["revision", subject.label]];

  return {
    title: `Dossier de ${subject.label} - Synthèse d'entraînement`,
    subject: subject.label,
    difficulty,
    hiddenDiagnosis: "Synthèse transversale d'internat",
    statement:
      `Un étudiant traite un dossier transversal de ${subject.label}. Les données doivent être interprétées de façon structurée, avec justification biologique, pharmacologique ou méthodologique selon les items concernés.`,
    biologicalData: [
      { label: "Paramètre principal", value: "Anormal", interpretation: "À relier à l'item demandé" },
      { label: "Contrôle qualité", value: "Conforme", interpretation: "Résultat interprétable" },
      { label: "Contexte clinique", value: "Compatible", interpretation: "Orientation diagnostique ou thérapeutique à discuter" },
      { label: "Surveillance", value: "Nécessaire", interpretation: "Suivi biologique ou clinique attendu" },
      { label: "Risque", value: "Présent", interpretation: "Piège de concours à identifier" },
    ],
    questions: selectedSkills.map(([skillKey, skillLabel], index) =>
      question(
        `q${index + 1}`,
        `Présenter les points indispensables à connaître concernant : ${skillLabel}.`,
        `${skillLabel} doit être traité avec définition précise, mécanisme, intérêt biologique ou thérapeutique, pièges de concours et surveillance quand elle est pertinente.`,
        [skillLabel, "mécanisme", "surveillance", "piège"],
        `${subjectId}.${skillKey}`,
      ),
    ),
  };
}

function uniqueOptionIds(value) {
  return [...new Set(safeArray(value).map((id) => String(id).trim().toUpperCase()).filter(Boolean))];
}

function normalizeRelatedSkill(skillId, subjectId, skillIds, index) {
  const fallbackSkill = skillIds[index % Math.max(skillIds.length, 1)] || "revision";
  const candidate = String(skillId || "");
  if (candidate.startsWith(`${subjectId}.`)) return candidate;
  if (skillIds.includes(candidate)) return `${subjectId}.${candidate}`;
  return `${subjectId}.${fallbackSkill}`;
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
