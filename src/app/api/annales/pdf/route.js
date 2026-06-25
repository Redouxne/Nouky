import { getAnnaleById } from "@/lib/annales";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Non authentifie" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const annaleId = searchParams.get("annaleId");
  const annale = getAnnaleById(annaleId);

  if (!annale || annale.format !== "PDF") {
    return Response.json({ error: "PDF introuvable" }, { status: 404 });
  }

  try {
    const upstream = await fetch(annale.url, {
      cache: "no-store",
      headers: {
        "User-Agent": "Nouky/1.0",
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!upstream.ok) {
      return Response.json({ error: `PDF indisponible (${upstream.status})` }, { status: 502 });
    }

    const body = await upstream.arrayBuffer();
    return new Response(body, {
      headers: {
        "Cache-Control": "private, max-age=1800",
        "Content-Disposition": `inline; filename="${annale.id}.pdf"`,
        "Content-Type": "application/pdf",
      },
    });
  } catch {
    return Response.json({ error: "MedShake est inaccessible pour ce PDF" }, { status: 502 });
  }
}
