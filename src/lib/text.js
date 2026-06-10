export const SPECIALTIES = [
  "Cardiologie",
  "Pneumologie",
  "Gastro-enterologie",
  "Neurologie",
  "Dermatologie",
  "Endocrinologie",
];

export function cleanPatientReply(value) {
  return String(value || "")
    .trim()
    .replace(/^(patient|le patient|patiente|la patiente|reponse|réponse|nouky)\s*[:\-]\s*/i, "")
    .replace(/^["'“”«»\s]+|["'“”«»\s]+$/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isExamRequest(value) {
  const text = String(value || "").toLowerCase();
  return [
    "test",
    "analyse",
    "analysis",
    "examen",
    "exam",
    "imagerie",
    "imaging",
    "irm",
    "mri",
    "radio",
    "x-ray",
    "scanner",
    "echographie",
    "échographie",
    "ultrasound",
    "ecg",
    "bilan",
    "prise de sang",
    "blood test",
    "panel",
    "scan",
    "echocardiogram",
  ].some((keyword) => text.includes(keyword));
}

export function parseSymptoms(value) {
  const raw = stripCodeFence(String(value || "").trim());
  const json = extractJson(raw);
  const jsonSymptoms = json?.symptoms || json?.symptomes || json?.symptômes;
  if (Array.isArray(jsonSymptoms)) {
    return jsonSymptoms.map(cleanPatientReply).filter(Boolean).slice(0, 3);
  }

  if (raw.includes("{") || raw.includes("}")) {
    return [];
  }

  return raw
    .replace(/^\s*sympt[oô]mes\s*[:\-]\s*/i, "")
    .split(/\n|;/)
    .map((line) => cleanPatientReply(line.replace(/^\s*[-•*\d.)]+\s*/, "")))
    .filter(Boolean)
    .slice(0, 3);
}

function stripCodeFence(value) {
  return value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function extractJson(value) {
  const text = stripCodeFence(String(value || "").trim());
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}
