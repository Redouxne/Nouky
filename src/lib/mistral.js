const PROVIDERS = {
  mistral: { baseUrl: "https://api.mistral.ai/v1", key: "MISTRAL_API_KEY", model: "mistral-small-latest" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", key: "GROQ_API_KEY", model: "openai/gpt-oss-120b" },
  deepseek: { baseUrl: "https://api.deepseek.com", key: "DEEPSEEK_API_KEY", model: "deepseek-flash" },
};

export async function mistralChat(messages, options = {}) {
  const providerName = process.env.AI_PROVIDER || (process.env.GROQ_API_KEY ? "groq" : process.env.MISTRAL_API_KEY ? "mistral" : process.env.DEEPSEEK_API_KEY ? "deepseek" : "groq");
  const provider = PROVIDERS[providerName];
  if (!provider) throw new Error(`Fournisseur IA inconnu : ${providerName}`);
  const apiKey = process.env[provider.key];
  if (!apiKey) {
    throw new Error(`${provider.key} manquante`);
  }

  const model = process.env.AI_MODEL || (providerName === "mistral" ? process.env.MISTRAL_MODEL : "") || provider.model;
  const supportsStrictSchema = providerName === "groq" && ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"].includes(model);

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "Nouky/1.0",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.5,
      top_p: options.topP ?? 0.9,
      ...(providerName === "groq" ? {
        max_completion_tokens: options.maxCompletionTokens ?? 8192,
        reasoning_effort: "low",
        response_format: supportsStrictSchema && options.responseSchema
          ? { type: "json_schema", json_schema: options.responseSchema }
          : { type: "json_object" },
      } : {}),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(45000),
  });

  if (!response.ok) {
    const details = await response.text();
    let providerMessage = details;
    try {
      const parsed = JSON.parse(details);
      providerMessage = parsed?.error?.message || parsed?.message || details;
    } catch {
      providerMessage = details;
    }
    providerMessage = String(providerMessage).slice(0, 300);

    const error = new Error(
      response.status === 429
        ? `Limite ${providerName} atteinte. Réessaie dans un instant.`
        : `${providerName} ${response.status}: ${providerMessage}`,
    );
    error.status = response.status;
    throw error;
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`${providerName} n'a retourné aucun message`);
  }

  return content.trim();
}
