import { getAnnaleById } from "@/lib/annales";
import { parseAnnale } from "@/lib/annales-parser";
import { publicCasePayload } from "@/lib/exam-engine";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const { annaleId } = await request.json();
    const annale = getAnnaleById(annaleId);
    if (!annale) return Response.json({ error: "Annale introuvable" }, { status: 404 });

    const parsed = await parseAnnale(annale);
    const caseSession = await prisma.caseSession.create({
      data: {
        userId: session.id,
        title: parsed.title,
        subject: parsed.subject,
        difficulty: parsed.difficulty,
        hiddenDiagnosis: parsed.hiddenDiagnosis,
        statement: parsed.statement,
        biologicalJson: JSON.stringify(parsed.biologicalData),
        questionsJson: JSON.stringify(parsed.questions),
        mode: `annale-${annale.type}`,
      },
    });

    return Response.json({
      annale,
      annaleSession: publicCasePayload(caseSession),
    });
  } catch (error) {
    return Response.json({ error: error.message || "Erreur chargement annale" }, { status: 500 });
  }
}
