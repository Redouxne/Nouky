import { prisma } from "@/lib/db";
import { getSkillLabel, INTERNAT_PROGRAM } from "@/lib/internat-program";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Non authentifié" }, { status: 401 });

  const [answers, cards] = await Promise.all([
    prisma.answer.findMany({
      where: { userId: session.id },
      include: { caseSession: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.leitnerCard.findMany({ where: { userId: session.id } }),
  ]);

  const totalScore = answers.reduce((sum, item) => sum + item.score, 0);
  const totalMax = answers.reduce((sum, item) => sum + item.maxScore, 0);
  const averageScore = totalMax ? Math.round((totalScore / totalMax) * 100) : 0;

  const bySubject = new Map();
  for (const answer of answers) {
    const subject = answer.caseSession.subject;
    const current = bySubject.get(subject) || { subject, score: 0, maxScore: 0, answers: 0 };
    current.score += answer.score;
    current.maxScore += answer.maxScore;
    current.answers += 1;
    bySubject.set(subject, current);
  }

  const weakSubjects = [...bySubject.values()]
    .map((item) => ({
      ...item,
      rate: item.maxScore ? Math.round((item.score / item.maxScore) * 100) : 0,
    }))
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 5);

  const weakSkills = cards
    .filter((card) => card.failureCount > 0)
    .sort((a, b) => b.failureCount - a.failureCount)
    .slice(0, 8)
    .map((card) => ({
      skillId: card.skillId,
      skillLabel: getSkillLabel(card.skillId),
      subject: card.subject,
      failureCount: card.failureCount,
      box: card.box,
      front: card.front,
    }));

  const masteryBySubject = buildMasteryBySubject({ answers, cards });
  const speedStats = buildSpeedStats(answers);

  return Response.json({
    answerCount: answers.length,
    averageScore,
    weakSubjects,
    weakSkills,
    masteryBySubject,
    speedStats,
  });
}

function buildSpeedStats(answers) {
  const timedAnswers = answers
    .map((answer) => {
      const correction = parseCorrection(answer.correctionJson);
      const durationSeconds = normalizeDurationSeconds(correction.durationSeconds);
      if (!durationSeconds) return null;
      const mode = speedModeFromSession(answer.caseSession.mode);
      return {
        id: answer.id,
        mode,
        subject: answer.caseSession.subject,
        durationSeconds,
        scoreRate: answer.maxScore ? Math.round((answer.score / answer.maxScore) * 100) : 0,
        createdAt: answer.createdAt,
      };
    })
    .filter(Boolean);

  return {
    qcm: summarizeSpeed(timedAnswers.filter((answer) => answer.mode === "qcm")),
    dossier: summarizeSpeed(timedAnswers.filter((answer) => answer.mode === "dossier" || answer.mode === "dossiers")),
    exercices: summarizeSpeed(timedAnswers.filter((answer) => answer.mode === "exercices")),
    recent: timedAnswers.slice(0, 12).map((answer) => ({
      mode: answer.mode,
      subject: answer.subject,
      durationSeconds: answer.durationSeconds,
      scoreRate: answer.scoreRate,
      createdAt: answer.createdAt,
    })),
  };
}

function speedModeFromSession(mode) {
  if (mode === "qcm" || mode === "annale-qcm") return "qcm";
  if (mode === "annale-exercices") return "exercices";
  if (mode === "annale-dossiers") return "dossiers";
  return "dossier";
}

function summarizeSpeed(items) {
  if (!items.length) {
    return {
      count: 0,
      averageSeconds: 0,
      recentAverageSeconds: 0,
      previousAverageSeconds: 0,
      deltaSeconds: 0,
    };
  }

  const recent = items.slice(0, Math.min(10, items.length));
  const previous = items.slice(recent.length, recent.length * 2);
  const averageSeconds = average(items.map((item) => item.durationSeconds));
  const recentAverageSeconds = average(recent.map((item) => item.durationSeconds));
  const previousAverageSeconds = previous.length ? average(previous.map((item) => item.durationSeconds)) : 0;

  return {
    count: items.length,
    averageSeconds,
    recentAverageSeconds,
    previousAverageSeconds,
    deltaSeconds: previousAverageSeconds ? recentAverageSeconds - previousAverageSeconds : 0,
  };
}

function average(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildMasteryBySubject({ answers, cards }) {
  const answerSignals = collectAnswerSignals(answers);
  const cardSignals = collectCardSignals(cards);

  return Object.entries(INTERNAT_PROGRAM).map(([subjectId, subject]) => {
    const items = Object.entries(subject.skills).map(([skillKey, skillLabel]) => {
      const skillId = `${subjectId}.${skillKey}`;
      const answerSignal = answerSignals.get(skillId) || { attempts: 0, passed: 0, failed: 0 };
      const cardSignal = cardSignals.get(skillId);
      const status = getMasteryStatus(answerSignal, cardSignal);
      return {
        skillId,
        label: skillLabel,
        status,
        attempts: answerSignal.attempts,
        box: cardSignal?.box || null,
        dueAt: cardSignal?.dueAt || null,
      };
    });
    const counts = {
      tres_bien_maitrise: 0,
      maitrise: 0,
      a_revoir: 0,
      jamais_vu: 0,
    };
    for (const item of items) counts[item.status] += 1;

    return {
      subjectId,
      label: subject.label,
      section: subject.section,
      total: items.length,
      counts,
      items,
    };
  });
}

function collectAnswerSignals(answers) {
  const signals = new Map();
  for (const answer of answers) {
    const correction = parseCorrection(answer.correctionJson);
    for (const update of correction.leitnerUpdates || []) {
      const skillId = normalizeKnownSkillId(update.skillId);
      if (!skillId) continue;
      const current = signals.get(skillId) || { attempts: 0, passed: 0, failed: 0 };
      current.attempts += 1;
      if (update.result === "passed") current.passed += 1;
      else current.failed += 1;
      signals.set(skillId, current);
    }
  }
  return signals;
}

function collectCardSignals(cards) {
  const signals = new Map();
  for (const card of cards) {
    const skillId = normalizeKnownSkillId(card.skillId);
    if (!skillId) continue;
    const current = signals.get(skillId);
    if (!current || card.box < current.box || card.failureCount > current.failureCount) {
      signals.set(skillId, {
        box: card.box,
        failureCount: card.failureCount,
        successCount: card.successCount,
        dueAt: card.dueAt,
      });
    }
  }
  return signals;
}

function getMasteryStatus(answerSignal, cardSignal) {
  if (!answerSignal.attempts && !cardSignal) return "jamais_vu";
  if (cardSignal) {
    if (cardSignal.box >= 8 && cardSignal.successCount >= cardSignal.failureCount) return "tres_bien_maitrise";
    if (cardSignal.box >= 5 && cardSignal.successCount >= Math.max(1, cardSignal.failureCount)) return "maitrise";
    return "a_revoir";
  }

  const rate = answerSignal.passed / Math.max(1, answerSignal.attempts);
  if (answerSignal.attempts >= 3 && rate >= 0.85) return "tres_bien_maitrise";
  if (rate >= 0.6) return "maitrise";
  return "a_revoir";
}

function parseCorrection(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

function normalizeDurationSeconds(value) {
  const seconds = Math.round(Number(value || 0));
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.min(seconds, 4 * 60 * 60);
}

function normalizeKnownSkillId(value) {
  const skillId = String(value || "");
  if (!skillId.includes(".")) return null;
  const [subjectId, ...skillParts] = skillId.split(".");
  const skillKey = skillParts.join("_");
  if (INTERNAT_PROGRAM[subjectId]?.skills?.[skillKey]) return `${subjectId}.${skillKey}`;
  return null;
}
