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
  let text = "";
  let extractionSource = "pdf";

  try {
    const pdfBuffer = Buffer.from(await fetchArrayBuffer(annale.url));
    text = extractPdfText(pdfBuffer);
  } catch {
    text = "";
  }

  let parsed = parseStructuredPdfQuestions(text, annale);
  if (!parsed.questions.length) {
    extractionSource = "ocr";
    text = await fetchMistralOcrText(annale.url);
    parsed = parseStructuredPdfQuestions(text, annale);
  }

  if (!parsed.questions.length) {
    throw new Error("Impossible de parser les questions du PDF, même après OCR Mistral");
  }
  const normalizedText = normalizeAnnalePdfText(text);

  return {
    title: annale.label,
    subject: `Annales - ${annale.typeLabel}`,
    difficulty: "annale",
    hiddenDiagnosis: "",
    statement: buildPdfStatement(normalizedText, annale, extractionSource, parsed.sections),
    biologicalData: [],
    questions: parsed.questions,
  };
}

function parseStructuredPdfQuestions(text, annale) {
  const normalized = normalizeAnnalePdfText(text);
  const sectionBuckets = collectSectionBuckets(normalized, annale);
  const questions = [];
  const sections = [];

  for (const bucket of sectionBuckets.values()) {
    const subjectText = cleanText(bucket.subjectChunks.join("\n\n"));
    const correctionText = cleanText(bucket.correctionChunks.join("\n\n"));
    const sectionStatement = extractSectionStatement(subjectText, bucket);
    const subjectQuestions = extractQuestionBlocks(subjectText);
    const correctionQuestions = extractCorrectionBlocks(correctionText);
    if (!subjectQuestions.length) continue;

    sections.push({
      id: bucket.id,
      title: bucket.title,
      statement: sectionStatement,
      questionCount: subjectQuestions.length,
    });

    for (const question of subjectQuestions) {
      const expectedAnswer = correctionQuestions.get(question.number) || "";
      questions.push({
        id: `${bucket.id}_q${question.number}`,
        type: "annale_free_text",
        text: question.text,
        sectionId: bucket.id,
        sectionTitle: bucket.title,
        sectionStatement,
        expectedAnswer,
        correctionSource: expectedAnswer ? "official_proposed_answer" : "missing",
        keywords: extractKeywords(expectedAnswer),
        grading: [{ item: "Réponse attendue", points: 6 }],
        commonMistakes: [],
        relatedLeitnerSkills: [annaleQuestionSkill(annale, questions.length + 1, question.number)],
      });
    }
  }

  if (questions.length) return { questions, sections };
  return { questions: parseInlineCorrectionQuestions(normalized, annale), sections: [] };
}

function collectSectionBuckets(text, annale) {
  const fallbackKind = annale.type === "dossiers" ? "DOSSIER" : "EXERCICE";
  const sectionRegex = /(?:^|\n)((?:DOSSIER|EXERCICE)\s+N[°º]\s*\d+(?:[^\n]*)?)/gi;
  const matches = [...text.matchAll(sectionRegex)];
  const chunks = [];

  if (!matches.length) {
    chunks.push({
      header: `${fallbackKind} N° 1`,
      body: text,
    });
  } else {
    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];
      const start = match.index ?? 0;
      const end = matches[index + 1]?.index ?? text.length;
      chunks.push({
        header: cleanText(match[1]),
        body: text.slice(start, end),
      });
    }
  }

  const buckets = new Map();
  for (const chunk of chunks) {
    const header = chunk.header.match(/(DOSSIER|EXERCICE)\s+N[°º]\s*(\d+)/i);
    const kind = (header?.[1] || fallbackKind).toUpperCase();
    const number = Number(header?.[2] || 1);
    const id = `${kind.toLowerCase()}_${number}`;
    const bucket = buckets.get(id) || {
      id,
      kind,
      number,
      title: `${kind === "DOSSIER" ? "Dossier" : "Exercice"} ${number}`,
      subjectChunks: [],
      correctionChunks: [],
    };
    const cleanedBody = stripRepeatingPageNoise(chunk.body);
    const looksLikeCorrection =
      /PROPOSITION\s+DE\s+RÉPONSE/i.test(cleanedBody) ||
      (bucket.correctionChunks.length > 0 && !/(^|\n)Énoncé\s*($|\n)|(^|\n)Questions?\s*($|\n)/i.test(cleanedBody));
    if (looksLikeCorrection) bucket.correctionChunks.push(cleanedBody);
    else bucket.subjectChunks.push(cleanedBody);
    buckets.set(id, bucket);
  }

  return buckets;
}

function extractSectionStatement(text, bucket) {
  const beforeQuestions = splitBeforeFirstQuestion(text);
  const withoutHeader = beforeQuestions
    .replace(new RegExp(`${bucket.kind}\\s+N[°º]\\s*${bucket.number}[^\\n]*`, "gi"), "")
    .replace(/ÉPREUVE\s+D['’]\s*(?:EXERCICE|EXERCICES|DOSSIERS)[^\n]*/gi, "")
    .replace(/\bCE\d+\b/gi, "")
    .replace(/^PAGE OCR \d+$/gim, "")
    .replace(/^#+\s*Énoncé\s*$/gim, "")
    .replace(/^Énoncé\s*$/gim, "")
    .replace(/^Questions?\s*$/gim, "");
  return cleanText(withoutHeader);
}

function splitBeforeFirstQuestion(text) {
  const firstQuestion = text.search(/\nQUESTION\s+N[°º]\s*\d+/i);
  if (firstQuestion === -1) return text;
  return text.slice(0, firstQuestion);
}

function extractQuestionBlocks(text) {
  const withoutCorrections = text.replace(/\nPROPOSITION\s+DE\s+RÉPONSE[\s\S]*$/i, "");
  const questionRegex = /\nQUESTION\s+N[°º]\s*(\d+)\s*:?\s*([\s\S]*?)(?=\nQUESTION\s+N[°º]\s*\d+\s*:|\n(?:DOSSIER|EXERCICE)\s+N[°º]\s*\d+|$)/gi;
  const questions = [];
  let match;
  while ((match = questionRegex.exec(withoutCorrections))) {
    const number = Number(match[1]);
    const questionText = cleanQuestionText(match[2]);
    if (number && questionText) questions.push({ number, text: questionText });
  }
  return questions;
}

function extractCorrectionBlocks(text) {
  const corrections = new Map();
  const questionRegex = /\nQUESTION\s+N[°º]\s*(\d+)\s*:?\s*([\s\S]*?)(?=\nQUESTION\s+N[°º]\s*\d+\s*:|\n(?:DOSSIER|EXERCICE)\s+N[°º]\s*\d+|$)/gi;
  let match;
  while ((match = questionRegex.exec(text))) {
    const number = Number(match[1]);
    const body = match[2] || "";
    const answerStart = body.search(/\nPROPOSITION\s+DE\s+RÉPONSE/i);
    if (!number || answerStart === -1) continue;
    const expectedAnswer = cleanQuestionText(body.slice(answerStart).replace(/\nPROPOSITION\s+DE\s+RÉPONSE\s*:?\s*/i, ""));
    if (expectedAnswer) corrections.set(number, expectedAnswer);
  }
  return corrections;
}

function parseInlineCorrectionQuestions(text, annale) {
  const questionRegex =
    /\nQUESTION\s+N[°º]\s*(\d+)\s*:?\s*([\s\S]*?)\nPROPOSITION\s+DE\s+RÉPONSE\s*:?\s*([\s\S]*?)(?=\nQUESTION\s+N[°º]\s*\d+\s*:|\nDOSSIER\s+N[°º]\s*\d+|\nEXERCICE\s+N[°º]\s*\d+|$)/gi;
  const questions = [];
  let match;
  while ((match = questionRegex.exec(text))) {
    const number = questions.length + 1;
    const officialNumber = Number(match[1]) || number;
    const questionText = cleanQuestionText(match[2]);
    const expectedAnswer = cleanQuestionText(match[3]);
    if (!questionText || !expectedAnswer) continue;
    questions.push({
      id: `q${number}`,
      type: "annale_free_text",
      text: questionText,
      expectedAnswer,
      correctionSource: "official_proposed_answer",
      keywords: extractKeywords(expectedAnswer),
      grading: [{ item: "Réponse attendue", points: 6 }],
      commonMistakes: [],
      relatedLeitnerSkills: [annaleQuestionSkill(annale, number, officialNumber)],
    });
  }
  return questions;
}

function normalizeAnnalePdfText(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/(^|\n)\s*#+\s*/g, "\n")
    .replace(/\s*(Dossier)\s*(?:N[°ºo]\s*)?(\d+)/gi, "\nDOSSIER N° $2")
    .replace(/\s*(Exercice)\s*(?:N[°ºo]\s*)?(\d+)/gi, "\nEXERCICE N° $2")
    .replace(/\s*(Question)\s*(?:N[°ºo]\s*)?(\d+)/gi, "\nQUESTION N° $2")
    .replace(/\s*(?:Proposition\s+de\s+r[ée]ponse[s]?|Corrig[ée]|Correction)\s*:?\s*/gi, "\nPROPOSITION DE RÉPONSE\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildPdfStatement(text, annale, extractionSource, sections) {
  const sourceLabel = extractionSource === "ocr" ? "Extraction OCR Mistral" : "Extraction PDF";
  const sectionSummary = sections?.length
    ? sections.map((section) => `${section.title} - ${section.questionCount} question(s)`).join("\n")
    : splitBeforeFirstQuestion(text).slice(0, 2500);
  return cleanText(`${annale.label}\n${sourceLabel}\n\n${sectionSummary}`).slice(0, 5000);
}

function stripRepeatingPageNoise(text) {
  return cleanText(text)
    .replace(/^PAGE OCR \d+$/gim, "")
    .replace(/\bPage\s+\d+\s*\/\s*\d+\b/gi, "")
    .replace(/^\s*\d{1,6}\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanQuestionText(value) {
  return cleanText(value)
    .replace(/^PAGE OCR \d+$/gim, "")
    .replace(/^Questions?\s*$/gim, "")
    .replace(/^Énoncé\s*$/gim, "")
    .replace(/\bPage\s+\d+\s*\/\s*\d+\b/gi, "")
    .trim();
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

async function fetchMistralOcrText(url) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error("OCR Mistral indisponible : MISTRAL_API_KEY manquante");
  }

  let response;
  try {
    response = await fetch("https://api.mistral.ai/v1/ocr", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-ocr-latest",
        include_image_base64: true,
        table_format: "markdown",
        document: {
          type: "document_url",
          document_url: url,
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
    });
  } catch {
    throw new Error("OCR Mistral inaccessible depuis le serveur pour le moment");
  }

  if (!response.ok) {
    const details = await response.text();
    let providerMessage = details;
    try {
      providerMessage = JSON.parse(details)?.message || details;
    } catch {
      providerMessage = details;
    }
    throw new Error(`OCR Mistral ${response.status}: ${providerMessage}`);
  }

  const payload = await response.json();
  const pages = safeArray(payload?.pages)
    .map((page, index) => cleanText(`PAGE OCR ${index + 1}\n\n${embedOcrImages(page)}`))
    .filter(Boolean);
  if (!pages.length) throw new Error("OCR Mistral n'a retourné aucun texte exploitable");
  return pages.join("\n\n");
}

function embedOcrImages(page) {
  let markdown = String(page?.markdown || "");
  for (const image of safeArray(page?.images)) {
    const id = String(image?.id || image?.image_id || "");
    const base64 = String(image?.image_base64 || "");
    if (!id || !base64) continue;
    const dataUrl = base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`;
    markdown = markdown.replaceAll(`](${id})`, `](${dataUrl})`);
  }
  return markdown;
}

async function fetchAnnaleResource(url) {
  try {
    return await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "Nouky/1.0",
      },
      signal: AbortSignal.timeout(12000),
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
