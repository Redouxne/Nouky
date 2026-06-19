"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ANNALE_CATALOG, ANNALE_TYPE_OPTIONS, ANNALE_YEAR_OPTIONS } from "@/lib/annales";
import { getProgramsByExamType } from "@/lib/internat-program";

const DIFFICULTIES = ["facile", "intermédiaire", "difficile"];
const QCM_PROGRAM_OPTIONS = getProgramsByExamType("qcm");
const CASE_PROGRAM_OPTIONS = getProgramsByExamType("dossier_clinique");
const DEFAULT_CLINICAL_SUBJECT = "sciences_medicament_pharmacologie_generale";
const DEFAULT_QCM_SUBJECT = QCM_PROGRAM_OPTIONS[0]?.id || DEFAULT_CLINICAL_SUBJECT;
const MASTERY_LABELS = {
  tres_bien_maitrise: "Très bien maîtrisé",
  maitrise: "Maîtrisé",
  a_revoir: "À revoir",
  jamais_vu: "Jamais vu",
};
const TABS = [
  { id: "cases", label: "Dossiers" },
  { id: "qcm", label: "QCM" },
  { id: "annales", label: "Annales" },
  { id: "leitner", label: "Révisions Leitner" },
  { id: "progress", label: "Progression" },
  { id: "mock", label: "Concours blanc" },
];

const ANNALE_STATUS_LABELS = {
  todo: "À faire",
  doing: "En cours",
  done: "Terminé",
};

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Erreur serveur");
  }
  return data;
}

function formatScore(score, maxScore) {
  if (!maxScore) return "0/0";
  return `${Number(score || 0).toFixed(1).replace(".0", "")}/${Number(maxScore || 0).toFixed(1).replace(".0", "")}`;
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(Number(totalSeconds || 0)));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function formatSpeedDelta(deltaSeconds) {
  if (!deltaSeconds) return "stable";
  const prefix = deltaSeconds > 0 ? "+" : "-";
  return `${prefix}${formatDuration(Math.abs(deltaSeconds))}`;
}

function elapsedSeconds(startedAtMs, nowMs = Date.now()) {
  if (!startedAtMs) return 0;
  return Math.max(0, Math.round((nowMs - startedAtMs) / 1000));
}

export default function NoukyApp({ user }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("cases");
  const [caseSubjectId, setCaseSubjectId] = useState(DEFAULT_CLINICAL_SUBJECT);
  const [qcmSubjectId, setQcmSubjectId] = useState(DEFAULT_QCM_SUBJECT);
  const [difficulty, setDifficulty] = useState("intermédiaire");
  const [caseSession, setCaseSession] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [caseStartedAtMs, setCaseStartedAtMs] = useState(null);
  const [caseQuestionStartedAtMs, setCaseQuestionStartedAtMs] = useState(null);
  const [answerDraft, setAnswerDraft] = useState("");
  const [corrections, setCorrections] = useState({});
  const [qcmSession, setQcmSession] = useState(null);
  const [currentQcmIndex, setCurrentQcmIndex] = useState(0);
  const [qcmStartedAtMs, setQcmStartedAtMs] = useState(null);
  const [qcmQuestionStartedAtMs, setQcmQuestionStartedAtMs] = useState(null);
  const [qcmSelections, setQcmSelections] = useState({});
  const [qcmCorrections, setQcmCorrections] = useState({});
  const [qcmCount, setQcmCount] = useState(10);
  const [leitnerCards, setLeitnerCards] = useState([]);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [progress, setProgress] = useState(null);
  const [mockCases, setMockCases] = useState([]);
  const [mockCount, setMockCount] = useState(3);
  const [annaleProgress, setAnnaleProgress] = useState({});
  const [annaleTypeFilter, setAnnaleTypeFilter] = useState("all");
  const [annaleYearFilter, setAnnaleYearFilter] = useState("all");
  const [activeAnnale, setActiveAnnale] = useState(null);
  const [annaleSession, setAnnaleSession] = useState(null);
  const [currentAnnaleIndex, setCurrentAnnaleIndex] = useState(0);
  const [annaleAnswerDraft, setAnnaleAnswerDraft] = useState("");
  const [annaleSelections, setAnnaleSelections] = useState({});
  const [annaleCorrections, setAnnaleCorrections] = useState({});
  const [annaleStartedAtMs, setAnnaleStartedAtMs] = useState(null);
  const [annaleQuestionStartedAtMs, setAnnaleQuestionStartedAtMs] = useState(null);
  const [loadingAnnaleId, setLoadingAnnaleId] = useState(null);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());

  const currentQuestion = caseSession?.questions?.[currentQuestionIndex];
  const currentQcmQuestion = qcmSession?.questions?.[currentQcmIndex];
  const currentAnnaleQuestion = annaleSession?.questions?.[currentAnnaleIndex];
  const totalScore = useMemo(() => {
    return Object.values(corrections).reduce(
      (acc, correction) => ({
        score: acc.score + Number(correction.score || 0),
        maxScore: acc.maxScore + Number(correction.maxScore || 0),
      }),
      { score: 0, maxScore: 0 },
    );
  }, [corrections]);
  const qcmTotalScore = useMemo(() => {
    return Object.values(qcmCorrections).reduce(
      (acc, correction) => ({
        score: acc.score + Number(correction.score || 0),
        maxScore: acc.maxScore + Number(correction.maxScore || 0),
      }),
      { score: 0, maxScore: 0 },
    );
  }, [qcmCorrections]);
  const annaleTotalScore = useMemo(() => {
    return Object.values(annaleCorrections).reduce(
      (acc, correction) => ({
        score: acc.score + Number(correction.score || 0),
        maxScore: acc.maxScore + Number(correction.maxScore || 0),
      }),
      { score: 0, maxScore: 0 },
    );
  }, [annaleCorrections]);

  useEffect(() => {
    if (activeTab === "leitner") loadDueCards();
    if (activeTab === "progress") loadProgress();
  }, [activeTab]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("nouky_annale_progress");
      if (saved) setAnnaleProgress(JSON.parse(saved));
    } catch {
      setAnnaleProgress({});
    }
  }, []);

  useEffect(() => {
    if (caseSession && currentQuestion && !corrections[currentQuestion.id]) {
      setCaseQuestionStartedAtMs(Date.now());
    }
  }, [caseSession?.id, currentQuestion?.id]);

  useEffect(() => {
    if (qcmSession && currentQcmQuestion && !qcmCorrections[currentQcmQuestion.id]) {
      setQcmQuestionStartedAtMs(Date.now());
    }
  }, [qcmSession?.id, currentQcmQuestion?.id]);

  useEffect(() => {
    if (annaleSession && currentAnnaleQuestion && !annaleCorrections[currentAnnaleQuestion.id]) {
      setAnnaleQuestionStartedAtMs(Date.now());
    }
  }, [annaleSession?.id, currentAnnaleQuestion?.id]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/auth/signin");
  }

  async function generateCase() {
    setLoading("case");
    setError("");
    setCorrections({});
    setAnswerDraft("");
    setCurrentQuestionIndex(0);
    try {
      const data = await fetchJson("/api/cases/generate", {
        method: "POST",
        body: JSON.stringify({ subjectId: caseSubjectId, difficulty }),
      });
      setCaseSession(data.caseSession);
      const startedAt = Date.now();
      setCaseStartedAtMs(startedAt);
      setCaseQuestionStartedAtMs(startedAt);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading("");
    }
  }

  async function submitAnswer(event) {
    event.preventDefault();
    if (!caseSession || !currentQuestion || !answerDraft.trim()) return;

    setLoading("answer");
    setError("");
    try {
      const durationSeconds = elapsedSeconds(caseQuestionStartedAtMs);
      const data = await fetchJson("/api/cases/answer", {
        method: "POST",
        body: JSON.stringify({
          caseSessionId: caseSession.id,
          questionId: currentQuestion.id,
          answer: answerDraft,
          durationSeconds,
        }),
      });
      setCorrections((current) => ({
        ...current,
        [currentQuestion.id]: data.correction,
      }));
      setAnswerDraft("");
      setProgress(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading("");
    }
  }

  async function generateQcm() {
    setLoading("qcm");
    setError("");
    setQcmCorrections({});
    setQcmSelections({});
    setCurrentQcmIndex(0);
    try {
      const data = await fetchJson("/api/qcm/generate", {
        method: "POST",
        body: JSON.stringify({ subjectId: qcmSubjectId, count: qcmCount }),
      });
      setQcmSession(data.qcmSession);
      const startedAt = Date.now();
      setQcmStartedAtMs(startedAt);
      setQcmQuestionStartedAtMs(startedAt);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading("");
    }
  }

  function toggleQcmOption(questionId, optionId) {
    setQcmSelections((current) => {
      const existing = current[questionId] || [];
      const next = existing.includes(optionId)
        ? existing.filter((item) => item !== optionId)
        : [...existing, optionId].sort();
      return { ...current, [questionId]: next };
    });
  }

  async function submitQcmAnswer(event) {
    event.preventDefault();
    if (!qcmSession || !currentQcmQuestion) return;

    const selectedOptionIds = qcmSelections[currentQcmQuestion.id] || [];
    if (!selectedOptionIds.length) return;

    setLoading("qcm-answer");
    setError("");
    try {
      const durationSeconds = elapsedSeconds(qcmQuestionStartedAtMs);
      const data = await fetchJson("/api/qcm/answer", {
        method: "POST",
        body: JSON.stringify({
          caseSessionId: qcmSession.id,
          questionId: currentQcmQuestion.id,
          selectedOptionIds,
          durationSeconds,
        }),
      });
      setQcmCorrections((current) => ({
        ...current,
        [currentQcmQuestion.id]: data.correction,
      }));
      setProgress(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading("");
    }
  }

  async function loadDueCards() {
    setLoading("leitner");
    setError("");
    try {
      const data = await fetchJson("/api/leitner/due");
      setLeitnerCards(data.cards || []);
      setActiveCardIndex(0);
      setShowBack(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading("");
    }
  }

  async function reviewCard(rating) {
    const card = leitnerCards[activeCardIndex];
    if (!card) return;
    setLoading("review");
    setError("");
    try {
      await fetchJson("/api/leitner/review", {
        method: "POST",
        body: JSON.stringify({ cardId: card.id, rating }),
      });
      const nextCards = leitnerCards.filter((item) => item.id !== card.id);
      setLeitnerCards(nextCards);
      setActiveCardIndex(0);
      setShowBack(false);
      setProgress(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading("");
    }
  }

  async function loadProgress() {
    setLoading("progress");
    setError("");
    try {
      const data = await fetchJson("/api/progress");
      setProgress(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading("");
    }
  }

  async function generateMockExam() {
    setLoading("mock");
    setError("");
    try {
      const subjectIds = CASE_PROGRAM_OPTIONS.slice(0, mockCount).map((item) => item.id);
      const data = await fetchJson("/api/mock-exam/generate", {
        method: "POST",
        body: JSON.stringify({ subjectIds, difficulty, count: mockCount }),
      });
      setMockCases(data.cases || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading("");
    }
  }

  function openMockCase(item) {
    setCaseSession(item);
    setCorrections({});
    setAnswerDraft("");
    setCurrentQuestionIndex(0);
    const startedAt = Date.now();
    setCaseStartedAtMs(startedAt);
    setCaseQuestionStartedAtMs(startedAt);
    setActiveTab("cases");
  }

  function updateAnnaleProgress(annaleId, patch) {
    setAnnaleProgress((current) => {
      const next = {
        ...current,
        [annaleId]: {
          ...(current[annaleId] || {}),
          ...patch,
          updatedAt: new Date().toISOString(),
        },
      };
      window.localStorage.setItem("nouky_annale_progress", JSON.stringify(next));
      return next;
    });
  }

  async function loadAnnale(annale) {
    setLoading("annale-load");
    setLoadingAnnaleId(annale.id);
    setError("");
    try {
      const data = await fetchJson("/api/annales/load", {
        method: "POST",
        body: JSON.stringify({ annaleId: annale.id }),
      });
      setActiveAnnale(data.annale);
      setAnnaleSession(data.annaleSession);
      setCurrentAnnaleIndex(0);
      setAnnaleAnswerDraft("");
      setAnnaleSelections({});
      setAnnaleCorrections({});
      const startedAt = Date.now();
      setAnnaleStartedAtMs(startedAt);
      setAnnaleQuestionStartedAtMs(startedAt);
      updateAnnaleProgress(annale.id, { status: "doing" });
    } catch (err) {
      setError(`Impossible de démarrer ${annale.label} : ${err.message}`);
    } finally {
      setLoading("");
      setLoadingAnnaleId(null);
    }
  }

  function closeAnnaleSession() {
    setActiveAnnale(null);
    setAnnaleSession(null);
    setAnnaleAnswerDraft("");
    setAnnaleSelections({});
    setAnnaleCorrections({});
    setCurrentAnnaleIndex(0);
  }

  function toggleAnnaleOption(questionId, optionId) {
    setAnnaleSelections((current) => {
      const existing = current[questionId] || [];
      const next = existing.includes(optionId)
        ? existing.filter((item) => item !== optionId)
        : [...existing, optionId].sort();
      return { ...current, [questionId]: next };
    });
  }

  async function submitAnnaleAnswer(event) {
    event.preventDefault();
    if (!annaleSession || !currentAnnaleQuestion) return;

    const isQcm = currentAnnaleQuestion.options?.length > 0;
    const selectedOptionIds = annaleSelections[currentAnnaleQuestion.id] || [];
    if (isQcm && !selectedOptionIds.length) return;
    if (!isQcm && !annaleAnswerDraft.trim()) return;

    setLoading("annale-answer");
    setError("");
    try {
      const durationSeconds = elapsedSeconds(annaleQuestionStartedAtMs);
      const data = await fetchJson("/api/annales/answer", {
        method: "POST",
        body: JSON.stringify({
          caseSessionId: annaleSession.id,
          questionId: currentAnnaleQuestion.id,
          answer: annaleAnswerDraft,
          selectedOptionIds,
          durationSeconds,
        }),
      });
      const nextCorrections = {
        ...annaleCorrections,
        [currentAnnaleQuestion.id]: data.correction,
      };
      setAnnaleCorrections(nextCorrections);
      setAnnaleAnswerDraft("");
      if (activeAnnale && Object.keys(nextCorrections).length === annaleSession.questions.length) {
        const totalScore = Object.values(nextCorrections).reduce((sum, correction) => sum + Number(correction.score || 0), 0);
        const totalMax = Object.values(nextCorrections).reduce((sum, correction) => sum + Number(correction.maxScore || 0), 0);
        updateAnnaleProgress(activeAnnale.id, {
          status: "done",
          score: totalMax ? Math.round((totalScore / totalMax) * 100) : "",
          scoreSource: "agent",
        });
      }
      setProgress(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading("");
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src="/Leoard.png" alt="" />
          <div>
            <div className="brand-name">Nouky</div>
            <div className="brand-subtitle">Internat pharmacie</div>
          </div>
        </div>
        <div className="userbar">
          <span>{user?.name || user?.email}</span>
          <button className="secondary-button small" onClick={handleLogout}>Déconnexion</button>
        </div>
      </header>

      <section className="hero-panel">
        <div>
          <div className="eyebrow">Préparation concours</div>
          <h1>Dossiers thérapeutiques et biologiques</h1>
          <p>QCM, dossiers, Leitner et progression par item pour l'internat de pharmacie.</p>
        </div>
      </section>

      <nav className="tabs" aria-label="Navigation principale">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {error ? <div className="error">{error}</div> : null}

      {activeTab === "cases" ? (
        <CasesTab
          answerDraft={answerDraft}
          caseSession={caseSession}
          corrections={corrections}
          currentQuestion={currentQuestion}
          currentQuestionIndex={currentQuestionIndex}
          difficulty={difficulty}
          loading={loading}
          nowMs={nowMs}
          questionStartedAtMs={caseQuestionStartedAtMs}
          sessionStartedAtMs={caseStartedAtMs}
          setAnswerDraft={setAnswerDraft}
          setCurrentQuestionIndex={setCurrentQuestionIndex}
          setDifficulty={setDifficulty}
          setSubjectId={setCaseSubjectId}
          subjectId={caseSubjectId}
          subjectOptions={CASE_PROGRAM_OPTIONS}
          submitAnswer={submitAnswer}
          totalScore={totalScore}
          generateCase={generateCase}
        />
      ) : null}

      {activeTab === "qcm" ? (
        <QcmTab
          corrections={qcmCorrections}
          currentQuestion={currentQcmQuestion}
          currentQuestionIndex={currentQcmIndex}
          generateQcm={generateQcm}
          loading={loading}
          nowMs={nowMs}
          questionStartedAtMs={qcmQuestionStartedAtMs}
          qcmCount={qcmCount}
          qcmSession={qcmSession}
          sessionStartedAtMs={qcmStartedAtMs}
          selections={qcmSelections}
          setCurrentQuestionIndex={setCurrentQcmIndex}
          setQcmCount={setQcmCount}
          setSubjectId={setQcmSubjectId}
          subjectId={qcmSubjectId}
          submitAnswer={submitQcmAnswer}
          toggleOption={toggleQcmOption}
          totalScore={qcmTotalScore}
        />
      ) : null}

      {activeTab === "leitner" ? (
        <LeitnerTab
          activeCardIndex={activeCardIndex}
          cards={leitnerCards}
          loading={loading}
          reviewCard={reviewCard}
          setActiveCardIndex={setActiveCardIndex}
          setShowBack={setShowBack}
          showBack={showBack}
          reload={loadDueCards}
        />
      ) : null}

      {activeTab === "annales" ? (
        <AnnalesTab
          activeAnnale={activeAnnale}
          annaleAnswerDraft={annaleAnswerDraft}
          annaleCorrections={annaleCorrections}
          annaleQuestionStartedAtMs={annaleQuestionStartedAtMs}
          annaleSelections={annaleSelections}
          annaleSession={annaleSession}
          annaleStartedAtMs={annaleStartedAtMs}
          closeAnnaleSession={closeAnnaleSession}
          currentQuestion={currentAnnaleQuestion}
          currentQuestionIndex={currentAnnaleIndex}
          error={error}
          loadAnnale={loadAnnale}
          loading={loading}
          loadingAnnaleId={loadingAnnaleId}
          nowMs={nowMs}
          progress={annaleProgress}
          setAnnaleAnswerDraft={setAnnaleAnswerDraft}
          setCurrentQuestionIndex={setCurrentAnnaleIndex}
          setTypeFilter={setAnnaleTypeFilter}
          setYearFilter={setAnnaleYearFilter}
          submitAnswer={submitAnnaleAnswer}
          toggleOption={toggleAnnaleOption}
          totalScore={annaleTotalScore}
          typeFilter={annaleTypeFilter}
          yearFilter={annaleYearFilter}
        />
      ) : null}

      {activeTab === "progress" ? (
        <ProgressTab loading={loading} progress={progress} reload={loadProgress} />
      ) : null}

      {activeTab === "mock" ? (
        <MockExamTab
          difficulty={difficulty}
          generateMockExam={generateMockExam}
          loading={loading}
          mockCases={mockCases}
          mockCount={mockCount}
          openMockCase={openMockCase}
          setDifficulty={setDifficulty}
          setMockCount={setMockCount}
        />
      ) : null}
    </main>
  );
}

function CasesTab(props) {
  const {
    answerDraft,
    caseSession,
    corrections,
    currentQuestion,
    currentQuestionIndex,
    difficulty,
    loading,
    nowMs,
    questionStartedAtMs,
    sessionStartedAtMs,
    setAnswerDraft,
    setCurrentQuestionIndex,
    setDifficulty,
    setSubjectId,
    subjectId,
    subjectOptions,
    submitAnswer,
    totalScore,
    generateCase,
  } = props;
  const currentCorrection = currentQuestion ? corrections[currentQuestion.id] : null;
  const questionDuration = currentCorrection?.durationSeconds ?? elapsedSeconds(questionStartedAtMs, nowMs);

  return (
    <section className="tab-panel">
      <div className="control-grid">
        <label>
          Matière
          <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
            {subjectOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          Difficulté
          <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
            {DIFFICULTIES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <button className="primary-button" onClick={generateCase} disabled={loading === "case"}>
          {loading === "case" ? "Génération..." : "Générer un dossier"}
        </button>
      </div>

      {!caseSession ? (
        <div className="empty-state">Sélectionne une matière puis génère un dossier progressif.</div>
      ) : (
        <div className="case-layout">
          <article className="panel case-document">
            <div className="panel-header">
              <div>
                <div className="eyebrow">{caseSession.subject}</div>
                <h2>{caseSession.title}</h2>
              </div>
              <div className="header-metrics">
                <TimerPill label="Session" seconds={elapsedSeconds(sessionStartedAtMs, nowMs)} />
                <span className="score-pill">Score {formatScore(totalScore.score, totalScore.maxScore)}</span>
              </div>
            </div>
            <div className="document-body">
              <h3>Énoncé</h3>
              <p>{caseSession.statement}</p>
              <h3>Bilan biologique</h3>
              <table className="data-table">
                <tbody>
                  {caseSession.biologicalData.map((item) => (
                    <tr key={`${item.label}-${item.value}`}>
                      <th>{item.label}</th>
                      <td>{item.value}</td>
                      <td>{item.interpretation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <aside className="panel question-panel">
            <div className="panel-header">
              <h2>Questions</h2>
              <div className="header-metrics compact">
                <TimerPill label="Question" seconds={questionDuration} />
                <span className="counter">{currentQuestionIndex + 1}/{caseSession.questions.length}</span>
              </div>
            </div>
            <div className="question-list">
              {caseSession.questions.map((question, index) => (
                <button
                  key={question.id}
                  className={`question-nav ${index === currentQuestionIndex ? "active" : ""} ${corrections[question.id] ? "done" : ""}`}
                  onClick={() => setCurrentQuestionIndex(index)}
                  type="button"
                >
                  Q{index + 1} · {corrections[question.id] ? formatScore(corrections[question.id].score, corrections[question.id].maxScore) : `${question.maxScore} pts`}
                </button>
              ))}
            </div>

            {currentQuestion ? (
              <form className="answer-form" onSubmit={submitAnswer}>
                <h3>Question {currentQuestionIndex + 1}</h3>
                <p>{currentQuestion.text}</p>
                <textarea
                  value={answerDraft}
                  onChange={(event) => setAnswerDraft(event.target.value)}
                  placeholder="Réponse structurée attendue : diagnostic, arguments, biologie, thérapeutique, surveillance..."
                  disabled={loading === "answer"}
                />
                <button className="primary-button" disabled={loading === "answer" || !answerDraft.trim()}>
                  {loading === "answer" ? "Correction..." : "Corriger"}
                </button>
              </form>
            ) : null}

            {currentQuestion && currentCorrection ? (
              <CorrectionBlock correction={currentCorrection} />
            ) : null}
          </aside>
        </div>
      )}
    </section>
  );
}

function QcmTab(props) {
  const {
    corrections,
    currentQuestion,
    currentQuestionIndex,
    generateQcm,
    loading,
    nowMs,
    questionStartedAtMs,
    qcmCount,
    qcmSession,
    sessionStartedAtMs,
    selections,
    setCurrentQuestionIndex,
    setQcmCount,
    setSubjectId,
    subjectId,
    submitAnswer,
    toggleOption,
    totalScore,
  } = props;
  const selected = currentQuestion ? selections[currentQuestion.id] || [] : [];
  const currentCorrection = currentQuestion ? corrections[currentQuestion.id] : null;
  const questionDuration = currentCorrection?.durationSeconds ?? elapsedSeconds(questionStartedAtMs, nowMs);
  const totalQuestions = qcmSession?.questions?.length || 0;
  const nextQuestionIndex = totalQuestions
    ? qcmSession.questions.findIndex((question, index) => index > currentQuestionIndex && !corrections[question.id])
    : -1;
  const fallbackNextIndex = currentQuestionIndex + 1 < totalQuestions ? currentQuestionIndex + 1 : -1;
  const canGoNext = nextQuestionIndex !== -1 || fallbackNextIndex !== -1;

  function goToNextQuestion() {
    const targetIndex = nextQuestionIndex !== -1 ? nextQuestionIndex : fallbackNextIndex;
    if (targetIndex !== -1) setCurrentQuestionIndex(targetIndex);
  }

  return (
    <section className="tab-panel">
      <div className="qcm-setup-bar">
        <label>
          Matière
          <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
            {QCM_PROGRAM_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          Nombre
          <select value={qcmCount} onChange={(event) => setQcmCount(Number(event.target.value))}>
            {[5, 10, 15, 20].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <button className="secondary-button" onClick={generateQcm} disabled={loading === "qcm"}>
          {loading === "qcm" ? "Génération..." : qcmSession ? "Nouvelle série" : "Générer"}
        </button>
      </div>

      {!qcmSession ? (
        <div className="empty-state">Sélectionne une matière puis génère une série de QCM.</div>
      ) : (
        <div className="case-layout">
          <article className="panel qcm-document">
            <div className="panel-header">
              <div>
                <div className="eyebrow">{qcmSession.subject}</div>
                <h2>{qcmSession.title}</h2>
              </div>
              <div className="header-metrics">
                <TimerPill label="Session" seconds={elapsedSeconds(sessionStartedAtMs, nowMs)} />
                <span className="score-pill">Score {formatScore(totalScore.score, totalScore.maxScore)}</span>
              </div>
            </div>
            <div className="qcm-question-list">
              {qcmSession.questions.map((question, index) => (
                <button
                  key={question.id}
                  className={`question-nav ${index === currentQuestionIndex ? "active" : ""} ${corrections[question.id] ? "done" : ""}`}
                  onClick={() => setCurrentQuestionIndex(index)}
                  type="button"
                >
                  Q{index + 1} · {corrections[question.id] ? formatScore(corrections[question.id].score, corrections[question.id].maxScore) : `${question.maxScore} pt`}
                </button>
              ))}
            </div>
          </article>

          <aside className="panel question-panel">
            <div className="panel-header">
              <h2>Question {currentQuestionIndex + 1}</h2>
              <div className="header-metrics compact">
                <TimerPill label="Question" seconds={questionDuration} />
                <span className="counter">{currentQuestionIndex + 1}/{qcmSession.questions.length}</span>
              </div>
            </div>
            {currentQuestion ? (
              <form className="qcm-form" onSubmit={submitAnswer}>
                <p className="qcm-stem">{currentQuestion.text}</p>
                <div className="option-list">
                  {currentQuestion.options.map((option) => (
                    <label
                      className={`option-row ${selected.includes(option.id) ? "selected" : ""}`}
                      key={option.id}
                    >
                      <input
                        checked={selected.includes(option.id)}
                        disabled={Boolean(currentCorrection) || loading === "qcm-answer"}
                        onChange={() => toggleOption(currentQuestion.id, option.id)}
                        type="checkbox"
                      />
                      <span className="option-letter">{option.id}</span>
                      <span>{option.text}</span>
                    </label>
                  ))}
                </div>
                <div className="qcm-actions">
                  <button
                    className="primary-button"
                    disabled={loading === "qcm-answer" || !selected.length || Boolean(currentCorrection)}
                  >
                    {currentCorrection ? "Corrigé" : loading === "qcm-answer" ? "Correction..." : "Valider"}
                  </button>
                  <button
                    className="secondary-button"
                    disabled={!currentCorrection || !canGoNext}
                    onClick={goToNextQuestion}
                    type="button"
                  >
                    Question suivante
                  </button>
                </div>
              </form>
            ) : null}

            {currentCorrection ? <QcmCorrectionBlock correction={currentCorrection} /> : null}
          </aside>
        </div>
      )}
    </section>
  );
}

function QcmCorrectionBlock({ correction }) {
  return (
    <div className="correction-block">
      <div className={`status ${correction.status}`}>{correction.status}</div>
      <h3>Correction QCM</h3>
      <p><strong>Score :</strong> {formatScore(correction.score, correction.maxScore)}</p>
      {correction.durationSeconds ? (
        <p><strong>Temps :</strong> {formatDuration(correction.durationSeconds)}</p>
      ) : null}
      <p><strong>Réponse donnée :</strong> {correction.selectedOptionIds?.join(", ") || "Aucune"}</p>
      <p><strong>Réponse attendue :</strong> {correction.expectedAnswer}</p>
      {correction.majorErrors?.length ? (
        <p><strong>Propositions fausses cochées :</strong> {correction.majorErrors.join(" ; ")}</p>
      ) : null}
      {correction.missingKeywords?.length ? (
        <p><strong>Propositions exactes oubliées :</strong> {correction.missingKeywords.join(", ")}</p>
      ) : null}
      <p><strong>Explication :</strong> {correction.examStyleCorrection}</p>
    </div>
  );
}

function CorrectionBlock({ correction }) {
  return (
    <div className="correction-block">
      <div className={`status ${correction.status}`}>{correction.status}</div>
      <h3>Correction concours</h3>
      <p><strong>Score estimé :</strong> {formatScore(correction.score, correction.maxScore)}</p>
      {correction.durationSeconds ? (
        <p><strong>Temps :</strong> {formatDuration(correction.durationSeconds)}</p>
      ) : null}
      <p><strong>Réponse attendue :</strong> {correction.expectedAnswer}</p>
      <p><strong>Correction type :</strong> {correction.examStyleCorrection}</p>
      {correction.missingKeywords?.length ? (
        <p><strong>Éléments attendus non cités :</strong> {correction.missingKeywords.join(", ")}</p>
      ) : null}
      {correction.majorErrors?.length ? (
        <p><strong>Erreurs importantes :</strong> {correction.majorErrors.join(", ")}</p>
      ) : null}
      <p><strong>Appréciation :</strong> {correction.feedback}</p>
    </div>
  );
}

function TimerPill({ label, seconds }) {
  return (
    <span className="timer-pill">
      <span>{label}</span>
      <strong>{formatDuration(seconds)}</strong>
    </span>
  );
}

function LeitnerTab({ activeCardIndex, cards, loading, reviewCard, setActiveCardIndex, setShowBack, showBack, reload }) {
  const card = cards[activeCardIndex];
  return (
    <section className="tab-panel">
      <div className="section-header">
        <div>
          <h2>Révisions Leitner</h2>
          <p>Cartes dues aujourd'hui, issues des items travaillés en QCM et dossiers.</p>
        </div>
        <button className="secondary-button" onClick={reload} disabled={loading === "leitner"}>Actualiser</button>
      </div>

      {!card ? (
        <div className="empty-state">Aucune carte due pour le moment.</div>
      ) : (
        <div className="leitner-card panel">
          <div className="eyebrow">{card.subject} · Box {card.box}</div>
          <h3>{card.front}</h3>
          {showBack ? <p className="card-back">{card.back}</p> : null}
          <div className="button-row">
            {!showBack ? (
              <button className="primary-button" onClick={() => setShowBack(true)}>Afficher la réponse</button>
            ) : (
              <>
                <button className="secondary-button" onClick={() => reviewCard("failure")}>Échec</button>
                <button className="secondary-button" onClick={() => reviewCard("difficult")}>Difficile</button>
                <button className="primary-button" onClick={() => reviewCard("correct")}>Correct</button>
                <button className="primary-button" onClick={() => reviewCard("mastered")}>Maîtrisé</button>
              </>
            )}
          </div>
          {cards.length > 1 ? (
            <div className="button-row">
              {cards.map((item, index) => (
                <button
                  key={item.id}
                  className={`dot-button ${index === activeCardIndex ? "active" : ""}`}
                  onClick={() => {
                    setActiveCardIndex(index);
                    setShowBack(false);
                  }}
                  type="button"
                >
                  {index + 1}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function AnnalesTab(props) {
  const {
    activeAnnale,
    annaleAnswerDraft,
    annaleCorrections,
    annaleQuestionStartedAtMs,
    annaleSelections,
    annaleSession,
    annaleStartedAtMs,
    closeAnnaleSession,
    currentQuestion,
    currentQuestionIndex,
    error,
    loadAnnale,
    loading,
    loadingAnnaleId,
    nowMs,
    progress,
    setAnnaleAnswerDraft,
    setCurrentQuestionIndex,
    setTypeFilter,
    setYearFilter,
    submitAnswer,
    toggleOption,
    totalScore,
    typeFilter,
    yearFilter,
  } = props;
  const filteredAnnales = ANNALE_CATALOG.filter((annale) => {
    const matchesType = typeFilter === "all" || annale.type === typeFilter;
    const matchesYear = yearFilter === "all" || String(annale.year) === yearFilter;
    return matchesType && matchesYear;
  });
  const stats = getAnnaleStats(progress);

  if (annaleSession && activeAnnale) {
    return (
      <AnnaleRunner
        activeAnnale={activeAnnale}
        answerDraft={annaleAnswerDraft}
        closeSession={closeAnnaleSession}
        corrections={annaleCorrections}
        currentQuestion={currentQuestion}
        currentQuestionIndex={currentQuestionIndex}
        loading={loading}
        nowMs={nowMs}
        questionStartedAtMs={annaleQuestionStartedAtMs}
        selections={annaleSelections}
        session={annaleSession}
        sessionStartedAtMs={annaleStartedAtMs}
        setAnswerDraft={setAnnaleAnswerDraft}
        setCurrentQuestionIndex={setCurrentQuestionIndex}
        submitAnswer={submitAnswer}
        toggleOption={toggleOption}
        totalScore={totalScore}
      />
    );
  }

  return (
    <section className="tab-panel">
      <div className="section-header">
        <div>
          <h2>Annales</h2>
          <p>Sujets MedShake depuis 1991, avec suivi personnel de réalisation.</p>
        </div>
        <a
          className="secondary-button"
          href="https://www.medshake.net/pharmacie/concours-internat/annales/"
          rel="noreferrer"
          target="_blank"
        >
          Source MedShake
        </a>
      </div>

      <div className="annales-dashboard">
        <Metric label="Annales terminées" value={`${stats.done}/${stats.total}`} />
        <Metric label="En cours" value={stats.doing} />
        <Metric label="Score moyen" value={stats.averageScore ? `${stats.averageScore}%` : "0%"} />
        <Metric label="QCM terminés" value={stats.byType.qcm} />
        <Metric label="Dossiers terminés" value={stats.byType.dossiers} />
        <Metric label="Exercices terminés" value={stats.byType.exercices} />
      </div>

      <div className="annales-filters">
        <label>
          Type
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">Tous</option>
            {ANNALE_TYPE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          Année
          <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
            <option value="all">Toutes</option>
            {ANNALE_YEAR_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      {error ? <div className="error annale-error">{error}</div> : null}

      <div className="annales-list">
        {filteredAnnales.map((annale) => {
          const itemProgress = progress[annale.id] || {};
          const status = itemProgress.status || "todo";
          const score = itemProgress.scoreSource === "agent" ? itemProgress.score : "";
          const isLoadingThisAnnale = loading === "annale-load" && loadingAnnaleId === annale.id;
          return (
            <article className="panel annale-row" key={annale.id}>
              <div>
                <span className={`mode-pill ${annale.type}`}>{annale.typeLabel}</span>
                <h3>{annale.label}</h3>
                <p>{annale.format} · {annale.year}</p>
                {isLoadingThisAnnale ? (
                  <p className="annale-loading">Préparation du sujet et de la grille de correction...</p>
                ) : null}
              </div>
              <div className="annale-controls">
                <div className="annale-readout">
                  <span>Statut</span>
                  <strong>{ANNALE_STATUS_LABELS[status]}</strong>
                </div>
                <div className="annale-readout">
                  <span>Score agent</span>
                  <strong>{score !== "" && score !== undefined ? `${score}%` : "-"}</strong>
                </div>
                <button
                  className="primary-button"
                  disabled={loading === "annale-load"}
                  onClick={() => loadAnnale(annale)}
                  type="button"
                >
                  {isLoadingThisAnnale ? "Préparation..." : "Démarrer"}
                </button>
                <a className="secondary-button" href={annale.url} rel="noreferrer" target="_blank">
                  Source
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function AnnaleRunner(props) {
  const {
    activeAnnale,
    answerDraft,
    closeSession,
    corrections,
    currentQuestion,
    currentQuestionIndex,
    loading,
    nowMs,
    questionStartedAtMs,
    selections,
    session,
    sessionStartedAtMs,
    setAnswerDraft,
    setCurrentQuestionIndex,
    submitAnswer,
    toggleOption,
    totalScore,
  } = props;
  const currentCorrection = currentQuestion ? corrections[currentQuestion.id] : null;
  const selected = currentQuestion ? selections[currentQuestion.id] || [] : [];
  const isQcm = currentQuestion?.options?.length > 0;
  const questionDuration = currentCorrection?.durationSeconds ?? elapsedSeconds(questionStartedAtMs, nowMs);
  const totalQuestions = session.questions.length;
  const nextQuestionIndex = session.questions.findIndex((question, index) => index > currentQuestionIndex && !corrections[question.id]);
  const fallbackNextIndex = currentQuestionIndex + 1 < totalQuestions ? currentQuestionIndex + 1 : -1;
  const canGoNext = nextQuestionIndex !== -1 || fallbackNextIndex !== -1;

  function goToNextQuestion() {
    const targetIndex = nextQuestionIndex !== -1 ? nextQuestionIndex : fallbackNextIndex;
    if (targetIndex !== -1) setCurrentQuestionIndex(targetIndex);
  }

  return (
    <section className="tab-panel">
      <div className="section-header">
        <div>
          <h2>{activeAnnale.label}</h2>
          <p>{activeAnnale.typeLabel} · {activeAnnale.sessionLabel}</p>
        </div>
        <button className="secondary-button" onClick={closeSession} type="button">Retour aux annales</button>
      </div>

      <div className="case-layout">
        <article className="panel case-document">
          <div className="panel-header">
            <div>
              <div className="eyebrow">{session.subject}</div>
              <h2>{session.title}</h2>
            </div>
            <div className="header-metrics">
              <TimerPill label="Session" seconds={elapsedSeconds(sessionStartedAtMs, nowMs)} />
              <span className="score-pill">Score {formatScore(totalScore.score, totalScore.maxScore)}</span>
            </div>
          </div>
          <div className="document-body annale-statement">
            <h3>Énoncé</h3>
            <p>{session.statement}</p>
          </div>
          <div className="qcm-question-list">
            {session.questions.map((question, index) => (
              <button
                key={question.id}
                className={`question-nav ${index === currentQuestionIndex ? "active" : ""} ${corrections[question.id] ? "done" : ""}`}
                onClick={() => setCurrentQuestionIndex(index)}
                type="button"
              >
                Q{index + 1} · {corrections[question.id] ? formatScore(corrections[question.id].score, corrections[question.id].maxScore) : `${question.maxScore} pt`}
              </button>
            ))}
          </div>
        </article>

        <aside className="panel question-panel">
          <div className="panel-header">
            <h2>Question {currentQuestionIndex + 1}</h2>
            <div className="header-metrics compact">
              <TimerPill label="Question" seconds={questionDuration} />
              <span className="counter">{currentQuestionIndex + 1}/{totalQuestions}</span>
            </div>
          </div>

          {currentQuestion ? (
            <form className={isQcm ? "qcm-form" : "answer-form"} onSubmit={submitAnswer}>
              <p className="qcm-stem">{currentQuestion.text}</p>
              {isQcm ? (
                <div className="option-list">
                  {currentQuestion.options.map((option) => (
                    <label
                      className={`option-row ${selected.includes(option.id) ? "selected" : ""}`}
                      key={option.id}
                    >
                      <input
                        checked={selected.includes(option.id)}
                        disabled={Boolean(currentCorrection) || loading === "annale-answer"}
                        onChange={() => toggleOption(currentQuestion.id, option.id)}
                        type="checkbox"
                      />
                      <span className="option-letter">{option.id}</span>
                      <span>{option.text}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <textarea
                  disabled={Boolean(currentCorrection) || loading === "annale-answer"}
                  onChange={(event) => setAnswerDraft(event.target.value)}
                  placeholder="Réponse structurée..."
                  value={answerDraft}
                />
              )}
              <div className="qcm-actions">
                <button
                  className="primary-button"
                  disabled={
                    loading === "annale-answer" ||
                    Boolean(currentCorrection) ||
                    (isQcm ? !selected.length : !answerDraft.trim())
                  }
                >
                  {currentCorrection ? "Corrigé" : loading === "annale-answer" ? "Correction..." : "Corriger"}
                </button>
                <button
                  className="secondary-button"
                  disabled={!currentCorrection || !canGoNext}
                  onClick={goToNextQuestion}
                  type="button"
                >
                  Question suivante
                </button>
              </div>
            </form>
          ) : null}

          {currentCorrection ? <CorrectionBlock correction={currentCorrection} /> : null}
        </aside>
      </div>
    </section>
  );
}

function getAnnaleStats(progress) {
  const initial = {
    total: ANNALE_CATALOG.length,
    done: 0,
    doing: 0,
    scores: [],
    byType: { qcm: 0, dossiers: 0, exercices: 0 },
  };

  const stats = ANNALE_CATALOG.reduce((acc, annale) => {
    const item = progress[annale.id];
    if (!item) return acc;
    if (item.status === "done") {
      acc.done += 1;
      acc.byType[annale.type] += 1;
    }
    if (item.status === "doing") acc.doing += 1;
    if (item.scoreSource === "agent" && item.score !== undefined && item.score !== "") {
      acc.scores.push(Number(item.score));
    }
    return acc;
  }, initial);

  const averageScore = stats.scores.length
    ? Math.round(stats.scores.reduce((sum, score) => sum + score, 0) / stats.scores.length)
    : 0;

  return { ...stats, averageScore };
}

function ProgressTab({ loading, progress, reload }) {
  const [selectedMastery, setSelectedMastery] = useState(null);
  const selectedPanelRef = useRef(null);

  useEffect(() => {
    if (selectedMastery) {
      selectedPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedMastery]);

  const selectedSubject = selectedMastery
    ? progress?.masteryBySubject?.find((subject) => subject.subjectId === selectedMastery.subjectId)
    : null;
  const selectedItems = selectedSubject?.items?.filter((item) => item.status === selectedMastery.status) || [];

  return (
    <section className="tab-panel">
      <div className="section-header">
        <div>
          <h2>Progression</h2>
          <p>Suivi des scores, matières faibles et cartes dues.</p>
        </div>
        <button className="secondary-button" onClick={reload} disabled={loading === "progress"}>Actualiser</button>
      </div>
      {!progress ? (
        <div className="empty-state">Charge les statistiques pour afficher la progression.</div>
      ) : (
        <>
          <div className="stats-grid">
            <Metric label="Score moyen" value={`${progress.averageScore}%`} />
            <Metric label="Sessions créées" value={progress.caseCount} />
            <Metric label="Réponses corrigées" value={progress.answerCount} />
            <Metric label="Cartes dues" value={progress.dueCards} />
            <Metric label="Cartes totales" value={progress.totalCards} />
            <Metric label="Temps moyen QCM" value={formatDuration(progress.speedStats?.qcm?.averageSeconds)} />
            <Metric label="Temps moyen dossier" value={formatDuration(progress.speedStats?.dossier?.averageSeconds)} />
            <Metric label="Temps moyen exercice" value={formatDuration(progress.speedStats?.exercices?.averageSeconds)} />
            <Metric label="Tendance QCM" value={formatSpeedDelta(progress.speedStats?.qcm?.deltaSeconds)} />
            <Metric label="Tendance dossier" value={formatSpeedDelta(progress.speedStats?.dossier?.deltaSeconds)} />
            <Metric label="Tendance exercice" value={formatSpeedDelta(progress.speedStats?.exercices?.deltaSeconds)} />
          </div>
          <SpeedProgressPanel speedStats={progress.speedStats} />
          {selectedMastery && selectedSubject ? (
            <MasteryItemsPanel
              items={selectedItems}
              onClose={() => setSelectedMastery(null)}
              panelRef={selectedPanelRef}
              status={selectedMastery.status}
              subject={selectedSubject}
            />
          ) : null}
          <div className="mastery-grid">
            {progress.masteryBySubject?.map((subject) => (
              <ProgressPieCard
                key={subject.subjectId}
                onSelectStatus={(status) => setSelectedMastery({ subjectId: subject.subjectId, status })}
                subject={subject}
              />
            ))}
          </div>
          <div className="two-columns">
            <ListPanel title="Matières faibles" items={progress.weakSubjects} render={(item) => `${item.subject} · ${item.rate}%`} />
            <ListPanel title="Compétences à revoir" items={progress.weakSkills} render={(item) => `${item.subject} · ${item.skillLabel || item.skillId} · ${item.failureCount} échec(s)`} />
          </div>
        </>
      )}
    </section>
  );
}

function MockExamTab({ difficulty, generateMockExam, loading, mockCases, mockCount, openMockCase, setDifficulty, setMockCount }) {
  return (
    <section className="tab-panel">
      <div className="section-header">
        <div>
          <h2>Concours blanc</h2>
          <p>Génère 3 à 5 dossiers et traite-les comme une série d'entraînement.</p>
        </div>
      </div>
      <div className="control-grid">
        <label>
          Nombre de dossiers
          <select value={mockCount} onChange={(event) => setMockCount(Number(event.target.value))}>
            {[3, 4, 5].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          Difficulté
          <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
            {DIFFICULTIES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <button className="primary-button" onClick={generateMockExam} disabled={loading === "mock"}>
          {loading === "mock" ? "Génération..." : "Générer le concours blanc"}
        </button>
      </div>
      <div className="case-list">
        {mockCases.map((item, index) => (
          <button className="case-item" key={item.id} onClick={() => openMockCase(item)} type="button">
            <span>Dossier {index + 1}</span>
            <strong>{item.title}</strong>
            <small>{item.subject} · {item.questions.length} questions</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SpeedProgressPanel({ speedStats }) {
  const recent = speedStats?.recent || [];
  return (
    <div className="panel speed-panel">
      <div className="speed-panel-header">
        <div>
          <h3>Vitesse</h3>
          <p>Temps par question sur les dernières réponses chronométrées.</p>
        </div>
      </div>
      {recent.length ? (
        <div className="speed-list">
          {recent.map((item, index) => (
            <div className="speed-row" key={`${item.createdAt}-${index}`}>
              <span className={`mode-pill ${item.mode}`}>{speedModeLabel(item.mode)}</span>
              <span>{item.subject}</span>
              <strong>{formatDuration(item.durationSeconds)}</strong>
              <small>{item.scoreRate}%</small>
            </div>
          ))}
        </div>
      ) : (
        <p className="speed-empty">Aucune réponse chronométrée pour l'instant.</p>
      )}
    </div>
  );
}

function speedModeLabel(mode) {
  if (mode === "qcm") return "QCM";
  if (mode === "exercices") return "Exercice";
  return "Dossier";
}

function MasteryItemsPanel({ items, onClose, panelRef, status, subject }) {
  return (
    <section className="panel mastery-items-panel" ref={panelRef}>
      <div className="mastery-items-header">
        <div>
          <span className="eyebrow">{subject.label}</span>
          <h3>{MASTERY_LABELS[status]}</h3>
        </div>
        <button className="secondary-button small" onClick={onClose} type="button">Fermer</button>
      </div>
      {items.length ? (
        <div className="mastery-items-list">
          {items.map((item) => (
            <article className="mastery-item-row" key={item.skillId}>
              <div>
                <strong>{item.label}</strong>
                <span>{item.skillId}</span>
              </div>
              <div className="mastery-item-meta">
                <span>{item.attempts} passage(s)</span>
                <span>{item.box ? `Box ${item.box}` : "Pas de box"}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="speed-empty">Aucun item dans cette catégorie.</p>
      )}
    </section>
  );
}

function ProgressPieCard({ onSelectStatus, subject }) {
  const mastered =
    Number(subject.counts.tres_bien_maitrise || 0) + Number(subject.counts.maitrise || 0);
  const masteredRate = subject.total ? Math.round((mastered / subject.total) * 100) : 0;
  return (
    <article className="panel mastery-card">
      <div className="mastery-card-header">
        <div>
          <span className="eyebrow">Section {subject.section}</span>
          <h3>{subject.label}</h3>
        </div>
        <strong>{masteredRate}%</strong>
      </div>
      <div className="mastery-body">
        <div className="pie-chart" style={buildPieStyle(subject.counts, subject.total)}>
          <span>{subject.total}</span>
        </div>
        <div className="legend-list">
          {Object.entries(MASTERY_LABELS).map(([status, label]) => (
            <button
              className="legend-row legend-button"
              key={status}
              onClick={() => onSelectStatus(status)}
              type="button"
            >
              <span className={`legend-dot ${status}`} />
              <span>{label}</span>
              <strong>{subject.counts[status] || 0}</strong>
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

function buildPieStyle(counts, total) {
  const colors = {
    tres_bien_maitrise: "#0f7a4f",
    maitrise: "#2563eb",
    a_revoir: "#d97706",
    jamais_vu: "#cbd5e1",
  };
  if (!total) return { background: colors.jamais_vu };
  let cursor = 0;
  const segments = Object.keys(MASTERY_LABELS).map((status) => {
    const start = cursor;
    cursor += ((counts[status] || 0) / total) * 100;
    return `${colors[status]} ${start}% ${cursor}%`;
  });
  return { background: `conic-gradient(${segments.join(", ")})` };
}

function ListPanel({ title, items, render }) {
  return (
    <div className="panel list-panel">
      <h3>{title}</h3>
      {items?.length ? (
        <ul>
          {items.map((item, index) => <li key={`${title}-${index}`}>{render(item)}</li>)}
        </ul>
      ) : (
        <p>Aucune donnée suffisante.</p>
      )}
    </div>
  );
}
