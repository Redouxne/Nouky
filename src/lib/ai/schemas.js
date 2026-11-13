const stringArray = { type: "array", items: { type: "string" } };

const option = {
  type: "object",
  properties: {
    id: { type: "string", enum: ["A", "B", "C", "D", "E"] },
    text: { type: "string" },
  },
  required: ["id", "text"],
  additionalProperties: false,
};

const question = {
  type: "object",
  properties: {
    id: { type: "string" },
    text: { type: "string" },
    options: { type: "array", items: option },
    correctOptionIds: stringArray,
    expectedAnswer: { type: "string" },
    explanation: { type: "string" },
    keywords: stringArray,
    commonMistakes: stringArray,
    relatedLeitnerSkills: stringArray,
  },
  required: ["id", "text", "options", "correctOptionIds", "expectedAnswer", "explanation", "keywords", "commonMistakes", "relatedLeitnerSkills"],
  additionalProperties: false,
};

export const qcmResponseSchema = {
  name: "internat_qcm_set",
  strict: true,
  schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      subject: { type: "string" },
      difficulty: { type: "string" },
      questions: { type: "array", items: question },
    },
    required: ["title", "subject", "difficulty", "questions"],
    additionalProperties: false,
  },
};
