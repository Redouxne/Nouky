import { publicCasePayload, generateCaseContent } from "@/lib/exam-engine";
import { getProgramsByExamType } from "@/lib/internat-program";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
const CLINICAL_SUBJECT_IDS = new Set(getProgramsByExamType("dossier_clinique").map((item) => item.id));

export async function POST(request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const { subjectId = "sciences_medicament_pharmacologie_generale", difficulty = "intermédiaire", mode = "case" } =
      await request.json();
    if (!CLINICAL_SUBJECT_IDS.has(subjectId)) {
      return Response.json({ error: "Cette matière n'est pas éligible aux dossiers cliniques" }, { status: 400 });
    }

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
