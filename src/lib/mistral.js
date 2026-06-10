const BASE_URL = "https://api.mistral.ai/v1";
const DEFAULT_MODEL = "mistral-large-latest";

export async function mistralChat(messages, options = {}) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error("MISTRAL_API_KEY is missing");
  }

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.MISTRAL_MODEL || DEFAULT_MODEL,
      messages,
      temperature: options.temperature ?? 0.5,
      top_p: options.topP ?? 0.9,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    let providerMessage = details;
    try {
      providerMessage = JSON.parse(details)?.message || details;
    } catch {
      providerMessage = details;
    }

    const error = new Error(
      response.status === 429
        ? "Limite Mistral atteinte. Reessaie dans un instant."
        : `Mistral ${response.status}: ${providerMessage}`,
    );
    error.status = response.status;
    throw error;
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Mistral response did not contain a message");
  }

  return content.trim();
}
