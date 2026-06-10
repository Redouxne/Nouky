import { openCase } from "@/lib/case-token";
import { mistralChat } from "@/lib/mistral";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const { caseToken, diagnosis, messages } = await request.json();
    const proposal = String(diagnosis || "").trim();
    if (!caseToken || !proposal) {
      return Response.json({ error: "Diagnostic manquant" }, { status: 400 });
    }

    const currentCase = openCase(caseToken);
    const exchangeSummary = (Array.isArray(messages) ? messages : [])
      .filter((message) => message.role === "student" || message.role === "patient" || message.role === "exam")
      .slice(-12)
      .map((message) => `${message.role}: ${message.content}`)
      .join("\n");

    const feedback = await mistralChat(
      [
        {
          role: "user",
          content: `Tu es un examinateur medical.
Specialite: ${currentCase.specialty}
Maladie reelle: ${currentCase.disease}
Symptomes initiaux: ${currentCase.symptoms.join(" | ")}
Echanges utiles:
${exchangeSummary || "Aucun echange avant le diagnostic."}

Proposition de l'etudiant:
${proposal}

Evalue en francais, de facon concise:
1. Diagnostic: correct / partiel / incorrect
2. Prise en charge: adaptee / incomplete / dangereuse
3. Points manquants a demander ou verifier

Mentionne explicitement le nom exact de la maladie reelle.`,
        },
      ],
      { temperature: 0.35, topP: 0.85 },
    );

    return Response.json({ feedback: feedback.trim() });
  } catch (error) {
    return Response.json(
      { error: error.message || "Erreur serveur" },
      { status: error.status || 500 },
    );
  }
}
