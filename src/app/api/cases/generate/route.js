import { publicCasePayload, generateCaseContent } from "@/lib/exam-engine";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const { subjectId = "rhumatologie", difficulty = "intermédiaire", mode = "case" } = await request.json();
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
        mode,
      },
    });

    return Response.json({ caseSession: publicCasePayload(caseSession) });
  } catch (error) {
    return Response.json({ error: error.message || "Erreur génération dossier" }, { status: 500 });
  }
}
