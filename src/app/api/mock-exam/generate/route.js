import { publicCasePayload, generateCaseContent } from "@/lib/exam-engine";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const { subjectIds = ["rhumatologie", "nephrologie", "hepatologie"], difficulty = "intermédiaire", count = 3 } =
      await request.json();
    const selected = subjectIds.slice(0, Math.min(Math.max(Number(count) || 3, 3), 5));
    const sessions = [];

    for (const subjectId of selected) {
      const generated = await generateCaseContent({ subjectId, difficulty });
      const caseSession = await prisma.caseSession.create({
        data: {
          userId: session.id,
          title: generated.title,
          subject: generated.subject,
          difficulty: generated.difficulty,
          hiddenDiagnosis: generated.hiddenDiagnosis,
          statement: generated.statement,
          biologicalJson: JSON.stringify(generated.biologicalData),
          questionsJson: JSON.stringify(generated.questions),
          mode: "mock-exam",
        },
      });
      sessions.push(publicCasePayload(caseSession));
    }

    return Response.json({ cases: sessions });
  } catch (error) {
    return Response.json({ error: error.message || "Erreur concours blanc" }, { status: 500 });
  }
}
