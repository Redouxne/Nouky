import {
  correctAnswer,
  correctQcmAnswer,
  generateCaseItemLeitnerCards,
  generateQcmLeitnerCards,
  publicCasePayload,
  totalPoints,
} from "@/lib/exam-engine";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const { caseSessionId, questionId, sectionId, answer, selectedOptionIds = [], durationSeconds } = await request.json();
    if (!caseSessionId || (!questionId && !sectionId)) {
      return Response.json({ error: "Réponse incomplète" }, { status: 400 });
    }

    const caseSession = await prisma.caseSession.findFirst({
      where: { id: caseSessionId, userId: session.id },
    });
    if (!caseSession || !caseSession.mode.startsWith("annale-")) {
      return Response.json({ error: "Session annale introuvable" }, { status: 404 });
    }

    const questions = JSON.parse(caseSession.questionsJson);
    const question = sectionId
      ? buildSectionQuestion(sectionId, questions)
      : questions.find((item) => item.id === questionId);
    if (!question) return Response.json({ error: "Question introuvable" }, { status: 404 });

    const isQcm = question.options?.length > 0;
    const userAnswer = isQcm ? JSON.stringify(selectedOptionIds) : String(answer || "").trim();
    if (!isQcm && !userAnswer) return Response.json({ error: "Réponse vide" }, { status: 400 });
    if (isQcm && !selectedOptionIds.length) return Response.json({ error: "Aucune proposition sélectionnée" }, { status: 400 });

    const correction = isQcm
      ? correctQcmAnswer({ question, selectedOptionIds })
      : await correctAnswer({ caseSession, question, userAnswer });
    const timedCorrection = {
      ...correction,
      durationSeconds: normalizeDurationSeconds(durationSeconds),
    };
    const maxScore = timedCorrection.maxScore || totalPoints(question.grading);

    const savedAnswer = await prisma.answer.create({
      data: {
        userId: session.id,
        caseSessionId: caseSession.id,
        questionId: sectionId || questionId,
        userAnswer,
        correctionJson: JSON.stringify(timedCorrection),
        score: timedCorrection.score,
        maxScore,
      },
    });

    const cards = isQcm
      ? generateQcmLeitnerCards({ caseSession, question, correction: timedCorrection })
      : generateCaseItemLeitnerCards({ caseSession, question, correction: timedCorrection });
    for (const card of cards) {
      await prisma.leitnerCard.upsert({
        where: {
          userId_skillId_front: {
            userId: session.id,
            skillId: card.skillId,
            front: card.front,
          },
        },
        create: {
          userId: session.id,
          skillId: card.skillId,
          subject: card.subject || caseSession.subject,
          front: card.front,
          back: card.back,
          box: card.box || 1,
          dueAt: card.dueAt || new Date(),
          lastReviewedAt: new Date(),
          successCount: card.result === "passed" ? 1 : 0,
          failureCount: card.result === "failed" ? 1 : 0,
        },
        update: {
          back: card.back,
          subject: card.subject || caseSession.subject,
          box: card.box || 1,
          dueAt: card.dueAt || new Date(),
          lastReviewedAt: new Date(),
          successCount: card.result === "passed" ? { increment: 1 } : undefined,
          failureCount: card.result === "failed" ? { increment: 1 } : undefined,
        },
      });
    }

    return Response.json({
      answerId: savedAnswer.id,
      correction: timedCorrection,
      createdCards: cards.length,
      annaleSession: publicCasePayload(caseSession),
    });
  } catch (error) {
    return Response.json({ error: error.message || "Erreur correction annale" }, { status: 500 });
  }
}

function normalizeDurationSeconds(value) {
  const seconds = Math.round(Number(value || 0));
  if (!Number.isFinite(seconds)) return 0;
  return Math.min(Math.max(seconds, 0), 4 * 60 * 60);
}

function buildSectionQuestion(sectionId, questions) {
  const sectionQuestions = questions.filter((question) => question.sectionId === sectionId);
  if (!sectionQuestions.length) return null;

  const first = sectionQuestions[0];
  const sectionTitle = first.sectionTitle || "Exercice";
  const questionText = sectionQuestions
    .map((question, index) => `${annaleQuestionLabel(question, index)}\n${question.text}`)
    .join("\n\n");
  const expectedAnswer = sectionQuestions
    .map((question, index) => {
      const answer = String(question.expectedAnswer || "").trim();
      return `${annaleQuestionLabel(question, index)}\n${answer || "Correction officielle non détectée."}`;
    })
    .join("\n\n");

  return {
    id: sectionId,
    type: "annale_section_copy",
    text: questionText,
    sectionId,
    sectionTitle,
    sectionStatement: first.sectionStatement || "",
    correctionSource: sectionQuestions.every((question) => question.expectedAnswer)
      ? "official_proposed_answer"
      : "missing",
    expectedAnswer,
    keywords: uniqueStrings(sectionQuestions.flatMap((question) => question.keywords || [])).slice(0, 40),
    grading: sectionQuestions.map((question, index) => ({
      item: `${sectionTitle} - ${annaleQuestionLabel(question, index)}`,
      points: totalPoints(question.grading) || 6,
    })),
    commonMistakes: uniqueStrings(sectionQuestions.flatMap((question) => question.commonMistakes || [])),
    relatedLeitnerSkills: uniqueStrings(sectionQuestions.flatMap((question) => question.relatedLeitnerSkills || [])),
  };
}

function annaleQuestionLabel(question, index) {
  const match = String(question.id || "").match(/_q(\d+)$/);
  return `Q${match?.[1] || index + 1}`;
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}
