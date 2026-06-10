import { openCase } from "@/lib/case-token";
import { mistralChat } from "@/lib/mistral";
import { cleanPatientReply, isExamRequest } from "@/lib/text";

export const runtime = "nodejs";

function apiHistory(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((message) => message.role === "student" || message.role === "patient")
    .slice(-10)
    .map((message) => ({
      role: message.role === "student" ? "user" : "assistant",
      content: String(message.content || ""),
    }));
}

export async function POST(request) {
  try {
    const { caseToken, messages, question } = await request.json();
    const currentQuestion = String(question || "").trim();
    if (!caseToken || !currentQuestion) {
      return Response.json({ error: "Requete incomplete" }, { status: 400 });
    }

    const currentCase = openCase(caseToken);

    if (isExamRequest(currentQuestion)) {
      const reply = await mistralChat(
        [
          {
            role: "system",
            content: `Tu fournis des resultats d'examens coherents avec un cas clinique.
Specialite: ${currentCase.specialty}
Maladie cachee: ${currentCase.disease}
Symptomes initiaux: ${currentCase.symptoms.join(" | ")}

Ne donne aucun diagnostic et ne nomme jamais la maladie cachee. Donne uniquement les resultats demandes, avec valeurs si pertinent.`,
          },
          { role: "user", content: currentQuestion },
        ],
        { temperature: 0.35, topP: 0.85 },
      );

      return Response.json({ role: "exam", content: reply.trim() });
    }

    const reply = await mistralChat(
      [
        {
          role: "system",
          content: `Tu es un patient en consultation de ${currentCase.specialty}.
Maladie cachee que tu ne connais pas: ${currentCase.disease}
Symptomes de depart: ${currentCase.symptoms.join(" | ")}

Regles absolues de sortie:
- Reponds uniquement avec les paroles exactes du patient.
- Ecris a la premiere personne.
- Aucun titre, aucun preambule, aucune balise, aucun guillemet.
- Ne dis jamais "en tant que patient", "le patient dit", "reponse", ou une formule similaire.
- Ne donne pas d'analyse medicale, de diagnostic, de raisonnement clinique ou de conseil.
- Ne revele jamais le nom exact de la maladie.
- Reponds seulement a la question posee, en 1 a 3 phrases courtes.
- Si l'etudiant demande directement le diagnostic, reponds que tu ne sais pas.`,
        },
        ...apiHistory(messages),
        { role: "user", content: currentQuestion },
      ],
      { temperature: 0.45, topP: 0.85 },
    );

    return Response.json({ role: "patient", content: cleanPatientReply(reply) });
  } catch (error) {
    return Response.json(
      { error: error.message || "Erreur serveur" },
      { status: error.status || 500 },
    );
  }
}
