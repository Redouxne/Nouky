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
    const { caseSessionId, questionId, answer, selectedOptionIds = [], durationSeconds } = await request.json();
    if (!caseSessionId || !questionId) {
      return Response.json({ error: "Réponse incomplète" }, { status: 400 });
    }

    const caseSession = await prisma.caseSession.findFirst({
      where: { id: caseSessionId, userId: session.id },
    });
    if (!caseSession || !caseSession.mode.startsWith("annale-")) {
      return Response.json({ error: "Session annale introuvable" }, { status: 404 });
    }

    const questions = JSON.parse(caseSession.questionsJson);
    const question = questions.find((item) => item.id === questionId);
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
        questionId,
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
