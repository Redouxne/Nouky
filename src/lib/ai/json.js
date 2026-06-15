export function extractJsonObject(value) {
  const raw = String(value || "").trim();
  const unfenced = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(unfenced);
  } catch {
    const match = unfenced.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function clampScore(score, maxScore) {
  const numericMax = Number(maxScore) || 0;
  const numericScore = Number(score) || 0;
  return Math.max(0, Math.min(numericScore, numericMax));
}
