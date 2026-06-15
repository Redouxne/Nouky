import { prisma } from "@/lib/db";
import { getSkillLabel } from "@/lib/internat-program";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Non authentifié" }, { status: 401 });

  const [caseCount, answers, dueCards, totalCards, cards] = await Promise.all([
    prisma.caseSession.count({ where: { userId: session.id } }),
    prisma.answer.findMany({
      where: { userId: session.id },
      include: { caseSession: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.leitnerCard.count({ where: { userId: session.id, dueAt: { lte: new Date() } } }),
    prisma.leitnerCard.count({ where: { userId: session.id } }),
    prisma.leitnerCard.findMany({ where: { userId: session.id } }),
  ]);

  const totalScore = answers.reduce((sum, item) => sum + item.score, 0);
  const totalMax = answers.reduce((sum, item) => sum + item.maxScore, 0);
  const averageScore = totalMax ? Math.round((totalScore / totalMax) * 100) : 0;

  const bySubject = new Map();
  for (const answer of answers) {
    const subject = answer.caseSession.subject;
    const current = bySubject.get(subject) || { subject, score: 0, maxScore: 0, answers: 0 };
    current.score += answer.score;
    current.maxScore += answer.maxScore;
    current.answers += 1;
    bySubject.set(subject, current);
  }

  const weakSubjects = [...bySubject.values()]
    .map((item) => ({
      ...item,
      rate: item.maxScore ? Math.round((item.score / item.maxScore) * 100) : 0,
    }))
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 5);

  const weakSkills = cards
    .filter((card) => card.failureCount > 0)
    .sort((a, b) => b.failureCount - a.failureCount)
    .slice(0, 8)
    .map((card) => ({
      skillId: card.skillId,
      skillLabel: getSkillLabel(card.skillId),
      subject: card.subject,
      failureCount: card.failureCount,
      box: card.box,
      front: card.front,
    }));

  return Response.json({
    caseCount,
    answerCount: answers.length,
    averageScore,
    dueCards,
    totalCards,
    weakSubjects,
    weakSkills,
  });
}
