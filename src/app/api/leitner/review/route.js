import { nextLeitnerState } from "@/lib/exam-engine";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const { cardId, rating } = await request.json();
    if (!cardId || !["failure", "difficult", "correct", "mastered"].includes(rating)) {
      return Response.json({ error: "Révision invalide" }, { status: 400 });
    }

    const card = await prisma.leitnerCard.findFirst({
      where: { id: cardId, userId: session.id },
    });
    if (!card) return Response.json({ error: "Carte introuvable" }, { status: 404 });

    const updated = await prisma.leitnerCard.update({
      where: { id: card.id },
      data: nextLeitnerState(card, rating),
    });

    return Response.json({ card: updated });
  } catch (error) {
    return Response.json({ error: error.message || "Erreur révision" }, { status: 500 });
  }
}
