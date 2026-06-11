import { sealCase } from "@/lib/case-token";
import { mistralChat } from "@/lib/mistral";
import { parseSymptoms, SPECIALTIES } from "@/lib/text";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const { specialty } = await request.json();
    if (!SPECIALTIES.includes(specialty)) {
      return Response.json({ error: "Specialite invalide" }, { status: 400 });
    }

    const disease = await mistralChat(
      [
        {
          role: "user",
          content: `Choisis une maladie pertinente en ${specialty}, idéalement cette maladie est difficle à diagnostiquer. Reponds uniquement avec le nom de la maladie, sans ponctuation, sans explication.`,
        },
      ],
      { temperature: 0.95, topP: 0.9 },
    );

    const cleanedDisease = disease.split("\n").at(-1).replace(/^[-•*\d.)\s]+/, "").trim();
    const symptomPrompt = `Tu prepares le debut d'une consultation en ${specialty}.
Maladie cachee: ${cleanedDisease}.

Retourne uniquement un objet JSON valide au format:
{"symptoms":["phrase patient 1","phrase patient 2","phrase patient 3"]}

Contraintes:
- chaque entree doit etre une phrase qu'un patient dirait vraiment a la premiere personne
- aucun titre, aucune explication, aucun diagnostic
- ne mentionne jamais le nom de la maladie
- francais naturel, simple, concis`;

    let symptomResponse = await mistralChat(
      [
        {
          role: "user",
          content: symptomPrompt,
        },
      ],
      { temperature: 0.75, topP: 0.9 },
    );

    let symptoms = parseSymptoms(symptomResponse);
    if (symptoms.length === 0) {
      symptomResponse = await mistralChat(
        [
          {
            role: "user",
            content: `${symptomPrompt}\n\nTa precedente reponse n'etait pas du JSON valide. Reponds cette fois uniquement avec le JSON, sans bloc markdown.`,
          },
        ],
        { temperature: 0.45, topP: 0.8 },
      );
      symptoms = parseSymptoms(symptomResponse);
    }

    if (symptoms.length === 0) {
      throw new Error("Impossible de generer les symptomes du patient");
    }

    const caseToken = sealCase({
      disease: cleanedDisease,
      specialty,
      symptoms,
      createdAt: Date.now(),
    });

    return Response.json({ caseToken, specialty, symptoms });
  } catch (error) {
    return Response.json(
      { error: error.message || "Erreur serveur" },
      { status: error.status || 500 },
    );
  }
}
