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
    const {
      subjectIds = [
        "sciences_medicament_pharmacologie_generale",
        "hematologie_hemostase_transfusion",
        "infectiologie_bacteriologie_virologie",
      ],
      difficulty = "intermédiaire",
      count = 3,
    } = await request.json();
    const selected = subjectIds
      .filter((subjectId) => CLINICAL_SUBJECT_IDS.has(subjectId))
      .slice(0, Math.min(Math.max(Number(count) || 3, 3), 5));
    if (!selected.length) {
      return Response.json({ error: "Aucune matière éligible aux dossiers cliniques" }, { status: 400 });
    }

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
