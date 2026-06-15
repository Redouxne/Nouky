import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Non authentifié" }, { status: 401 });

  const cards = await prisma.leitnerCard.findMany({
    where: {
      userId: session.id,
      dueAt: { lte: new Date() },
    },
    orderBy: [{ dueAt: "asc" }, { failureCount: "desc" }],
    take: 50,
  });

  return Response.json({ cards });
}
