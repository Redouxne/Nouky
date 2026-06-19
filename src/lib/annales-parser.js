import { inflateSync } from "zlib";
import { safeArray } from "@/lib/ai/json";

const OPTION_IDS = ["A", "B", "C", "D", "E"];

export async function parseAnnale(annale) {
  if (annale.type === "qcm") return parseQcmAnnale(annale);
  return parsePdfAnnale(annale);
}

async function parseQcmAnnale(annale) {
  const html = await fetchText(annale.url);
  const text = htmlToText(html);
  const answers = parseAnswerGrid(text);
  const questionBlocks = text
    .split(/(?=Question\s+n[°º]\s*\d+\s*-\s*Réponse\s+(?:simple|multiple))/gi)
    .filter((block) => /^Question\s+n[°º]\s*\d+/i.test(block));

  const questions = questionBlocks.map((block) => parseQcmQuestion(block, answers, annale)).filter(Boolean);
  if (!questions.length) throw new Error("Impossible de parser les QCM de cette annale");

  return {
    title: annale.label,
    subject: `Annales - ${annale.typeLabel}`,
    difficulty: "annale",
    hiddenDiagnosis: "",
    statement: `Annale ${annale.sessionLabel} - ${annale.typeLabel}. Source : MedShake.`,
    biologicalData: [],
    questions,
  };
}

function parseQcmQuestion(block, answers, annale) {
  const header = block.match(/^Question\s+n[°º]\s*(\d+)\s*-\s*Réponse\s+(simple|multiple)/i);
  if (!header) return null;
  const questionNumber = Number(header[1]);
  const type = header[2].toLowerCase() === "simple" ? "qcm_simple" : "qcm_multiple";
  const options = [];
  const optionRegex = /(?:^|\n)\s*(?:[1-5]\.\s*)?([A-E])\s*-\s*([\s\S]*?)(?=\n\s*(?:[1-5]\.\s*)?[A-E]\s*-|\n\s*Question\s+n[°º]|\n\s*\d+\s*:|$)/gi;
  let optionMatch;
  while ((optionMatch = optionRegex.exec(block))) {
    const id = optionMatch[1].toUpperCase();
    if (!OPTION_IDS.includes(id) || options.some((option) => option.id === id)) continue;
    options.push({ id, text: cleanText(optionMatch[2]) });
  }
  const firstOptionIndex = block.search(/(?:^|\n)\s*(?:[1-5]\.\s*)?A\s*-/i);
  const rawText = firstOptionIndex === -1 ? block.replace(header[0], "") : block.slice(header[0].length, firstOptionIndex);
  const correctOptionIds = answers.get(questionNumber) || [];

  return {
    id: `q${questionNumber}`,
    type,
    text: cleanText(rawText),
    options,
    correctOptionIds,
    expectedAnswer: correctOptionIds.length ? correctOptionIds.join(", ") : "Question neutralisée",
    explanation: correctOptionIds.length
      ? `Grille officielle : ${correctOptionIds.join(", ")}.`
      : "Question neutralisée dans la grille officielle.",
    keywords: [],
    grading: [{ item: "Réponse exacte", points: 1 }],
    commonMistakes: [],
    relatedLeitnerSkills: [annaleQuestionSkill(annale, questionNumber)],
  };
}

function parseAnswerGrid(text) {
  const answers = new Map();
  const gridStart = Math.max(text.lastIndexOf("1 :"), text.lastIndexOf("1:"));
  const grid = gridStart >= 0 ? text.slice(gridStart) : text;
  const regex = /(\d{1,2})\s*:\s*([A-E](?:\s+[A-E])*|-)/g;
  let match;
  while ((match = regex.exec(grid))) {
    const number = Number(match[1]);
    const value = match[2].trim();
    answers.set(number, value === "-" ? [] : value.split(/\s+/).filter((id) => OPTION_IDS.includes(id)));
  }
  return answers;
}

async function parsePdfAnnale(annale) {
  const pdfBuffer = Buffer.from(await fetchArrayBuffer(annale.url));
  const text = extractPdfText(pdfBuffer);
  const questions = parseStructuredPdfQuestions(text, annale);
  if (!questions.length) throw new Error("Impossible de parser les questions du PDF");

  return {
    title: annale.label,
    subject: `Annales - ${annale.typeLabel}`,
    difficulty: "annale",
    hiddenDiagnosis: "",
    statement: buildPdfStatement(text, annale),
    biologicalData: [],
    questions,
  };
}

function parseStructuredPdfQuestions(text, annale) {
  const normalized = cleanText(text).replace(/\s*QUESTION\s+N[°º]\s*/gi, "\nQUESTION N° ");
  const questionRegex =
    /QUESTION\s+N[°º]\s*(\d+)\s*:?\s*([\s\S]*?)(?:Proposition\s+de\s+réponse\s*([\s\S]*?))(?=\nQUESTION\s+N[°º]\s*\d+\s*:|\nDossier\s+N[°º]\s*\d+|\nExercice\s+N[°º]\s*\d+|$)/gi;
  const questions = [];
  let match;
  while ((match = questionRegex.exec(normalized))) {
    const number = questions.length + 1;
    const officialNumber = Number(match[1]) || number;
    const text = cleanText(match[2]);
    const expectedAnswer = cleanText(match[3]);
    if (!text || !expectedAnswer) continue;
    questions.push({
      id: `q${number}`,
      type: "annale_free_text",
      text,
      expectedAnswer,
      keywords: extractKeywords(expectedAnswer),
      grading: [{ item: "Réponse attendue", points: 6 }],
      commonMistakes: [],
      relatedLeitnerSkills: [annaleQuestionSkill(annale, number, officialNumber)],
    });
  }
  return questions;
}

function buildPdfStatement(text, annale) {
  const firstQuestion = text.search(/QUESTION\s+N[°º]\s*\d+/i);
  const statement = firstQuestion > 0 ? text.slice(0, firstQuestion) : text.slice(0, 2500);
  return cleanText(`${annale.label}\n\n${statement}`).slice(0, 5000);
}

function extractPdfText(buffer) {
  const source = buffer.toString("latin1");
  const streamRegex = /<<(.*?)>>\s*stream\r?\n?([\s\S]*?)\r?\n?endstream/g;
  const parts = [];
  let match;
  while ((match = streamRegex.exec(source))) {
    const dictionary = match[1];
    const raw = Buffer.from(match[2], "latin1");
    let data = raw;
    if (/FlateDecode/.test(dictionary)) {
      try {
        data = inflateSync(raw);
      } catch {
        continue;
      }
    }
    const text = extractPdfStrings(data.toString("latin1"));
    if (text) parts.push(text);
  }
  return cleanText(parts.join("\n"));
}

function extractPdfStrings(stream) {
  const strings = [];
  const literalRegex = /\((?:\\.|[^\\)])*\)\s*Tj|\[(.*?)\]\s*TJ/gs;
  let match;
  while ((match = literalRegex.exec(stream))) {
    if (match[1]) {
      const innerMatches = match[1].match(/\((?:\\.|[^\\)])*\)/g) || [];
      strings.push(innerMatches.map(decodePdfLiteral).join(""));
    } else {
      strings.push(decodePdfLiteral(match[0].replace(/\s*Tj$/, "")));
    }
  }
  return strings.join(" ");
}

function decodePdfLiteral(value) {
  return String(value || "")
    .replace(/^\(/, "")
    .replace(/\)$/, "")
    .replace(/\\([nrtbf()\\])/g, (_, char) => {
      const map = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" };
      return map[char] || char;
    })
    .replace(/\\(\d{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)));
}

async function fetchText(url) {
  const response = await fetchAnnaleResource(url);
  if (!response.ok) throw new Error(`Impossible de charger l'annale (${response.status})`);
  return response.text();
}

async function fetchArrayBuffer(url) {
  const response = await fetchAnnaleResource(url);
  if (!response.ok) throw new Error(`Impossible de charger le PDF (${response.status})`);
  return response.arrayBuffer();
}

async function fetchAnnaleResource(url) {
  try {
    return await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "Nouky/1.0",
      },
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error("MedShake est inaccessible depuis le serveur pour le moment. Réessaie dans quelques secondes.");
  }
}

function htmlToText(html) {
  return cleanText(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<(br|p|div|li|tr|h[1-6])\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&eacute;/g, "é")
      .replace(/&egrave;/g, "è")
      .replace(/&ecirc;/g, "ê")
      .replace(/&agrave;/g, "à")
      .replace(/&ccedil;/g, "ç")
      .replace(/&ocirc;/g, "ô")
      .replace(/&ugrave;/g, "ù")
      .replace(/&rsquo;|&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&"),
  );
}

function cleanText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractKeywords(value) {
  return safeArray(
    cleanText(value)
      .split(/[.;:\n]/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 5)
      .slice(0, 8),
  );
}

function annaleQuestionSkill(annale, questionNumber, officialNumber = questionNumber) {
  return [
    "annales",
    String(annale.type || "sujet"),
    String(annale.year || "session"),
    `q${questionNumber}`,
    `officielle_${officialNumber}`,
  ].join(".");
}
