import { correctQcmAnswer, generateQcmLeitnerCards, publicCasePayload } from "@/lib/exam-engine";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const { caseSessionId, questionId, selectedOptionIds = [], durationSeconds } = await request.json();
    if (!caseSessionId || !questionId) {
      return Response.json({ error: "QCM incomplet" }, { status: 400 });
    }

    const caseSession = await prisma.caseSession.findFirst({
      where: { id: caseSessionId, userId: session.id, mode: "qcm" },
    });
    if (!caseSession) return Response.json({ error: "Session QCM introuvable" }, { status: 404 });

    const questions = JSON.parse(caseSession.questionsJson);
    const question = questions.find((item) => item.id === questionId);
    if (!question) return Response.json({ error: "Question introuvable" }, { status: 404 });

    const correction = correctQcmAnswer({ question, selectedOptionIds });
    const timedCorrection = {
      ...correction,
      durationSeconds: normalizeDurationSeconds(durationSeconds),
    };
    const savedAnswer = await prisma.answer.create({
      data: {
        userId: session.id,
        caseSessionId: caseSession.id,
        questionId,
        userAnswer: JSON.stringify(timedCorrection.selectedOptionIds),
        correctionJson: JSON.stringify(timedCorrection),
        score: timedCorrection.score,
        maxScore: timedCorrection.maxScore,
      },
    });

    const cards = generateQcmLeitnerCards({ caseSession, question, correction: timedCorrection });
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
      qcmSession: publicCasePayload(caseSession),
    });
  } catch (error) {
    return Response.json({ error: error.message || "Erreur correction QCM" }, { status: 500 });
  }
}

function normalizeDurationSeconds(value) {
  const seconds = Math.round(Number(value || 0));
  if (!Number.isFinite(seconds)) return 0;
  return Math.min(Math.max(seconds, 0), 4 * 60 * 60);
}
