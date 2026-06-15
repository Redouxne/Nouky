import { correctAnswer, generateLeitnerCards, publicCasePayload, totalPoints } from "@/lib/exam-engine";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const { caseSessionId, questionId, answer } = await request.json();
    const userAnswer = String(answer || "").trim();
    if (!caseSessionId || !questionId || !userAnswer) {
      return Response.json({ error: "Réponse incomplète" }, { status: 400 });
    }

    const caseSession = await prisma.caseSession.findFirst({
      where: { id: caseSessionId, userId: session.id },
    });
    if (!caseSession) return Response.json({ error: "Dossier introuvable" }, { status: 404 });

    const questions = JSON.parse(caseSession.questionsJson);
    const question = questions.find((item) => item.id === questionId);
    if (!question) return Response.json({ error: "Question introuvable" }, { status: 404 });

    const correction = await correctAnswer({ caseSession, question, userAnswer });
    const maxScore = correction.maxScore || totalPoints(question.grading);

    const savedAnswer = await prisma.answer.create({
      data: {
        userId: session.id,
        caseSessionId: caseSession.id,
        questionId,
        userAnswer,
        correctionJson: JSON.stringify(correction),
        score: correction.score,
        maxScore,
      },
    });

    const cards = await generateLeitnerCards({ caseSession, question, correction });
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
          box: 1,
          failureCount: 1,
        },
        update: {
          back: card.back,
          subject: card.subject || caseSession.subject,
          box: 1,
          dueAt: new Date(),
          failureCount: { increment: 1 },
        },
      });
    }

    return Response.json({
      answerId: savedAnswer.id,
      correction,
      createdCards: cards.length,
      caseSession: publicCasePayload(caseSession),
    });
  } catch (error) {
    return Response.json({ error: error.message || "Erreur correction" }, { status: 500 });
  }
}
