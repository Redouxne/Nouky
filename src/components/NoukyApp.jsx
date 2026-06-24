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
  { id: "progress", label: "Dashboard" },
  { id: "annales", label: "Annales" },
  { id: "qcm", label: "QCM" },
  { id: "cases", label: "Dossiers" },
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

function elapsedSeconds(startedAtMs, nowMs = Date.now()) {
  if (!startedAtMs) return 0;
  return Math.max(0, Math.round((nowMs - startedAtMs) / 1000));
}

export default function NoukyApp({ user }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("progress");
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
          <p>Dashboard, annales, QCM et dossiers pour l'internat de pharmacie.</p>
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

function MarkdownLite({ content }) {
  const [zoomedImage, setZoomedImage] = useState(null);
  const blocks = markdownBlocks(content);
  return (
    <>
      <div className="markdown-lite">
        {blocks.map((block, index) => {
          if (block.type === "heading") return <h4 key={index}><FormattedText text={block.text} /></h4>;
          if (block.type === "image") {
            return (
              <figure className="ocr-figure" key={index}>
                <button
                  aria-label="Agrandir l'image"
                  className="ocr-image-button"
                  onClick={() => setZoomedImage(block)}
                  type="button"
                >
                  <img alt={block.alt || "Figure du sujet"} src={block.src} />
                </button>
                {block.alt ? <figcaption><FormattedText text={block.alt} /></figcaption> : null}
              </figure>
            );
          }
          if (block.type === "table") {
            return (
              <div className="ocr-table-wrap" key={index}>
                <table className="ocr-table">
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => {
                          const Cell = rowIndex === 0 ? "th" : "td";
                          return <Cell key={cellIndex}><FormattedText text={cell} /></Cell>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          return <p key={index}><FormattedText text={block.text} /></p>;
        })}
      </div>
      {zoomedImage ? (
        <div className="image-zoom-backdrop" onClick={() => setZoomedImage(null)} role="presentation">
          <div
            className="image-zoom-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Image agrandie"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="image-zoom-close" onClick={() => setZoomedImage(null)} type="button">Fermer</button>
            <img alt={zoomedImage.alt || "Figure du sujet"} src={zoomedImage.src} />
            {zoomedImage.alt ? <p><FormattedText text={zoomedImage.alt} /></p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function FormattedText({ text }) {
  return renderFormattedText(text);
}

function renderFormattedText(text) {
  const raw = String(text || "");
  const parts = [];
  const regex = /\$([^$]+)\$/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(raw))) {
    if (match.index > lastIndex) parts.push(renderPlainText(raw.slice(lastIndex, match.index), `t${lastIndex}`));
    parts.push(<span className="formula" key={`f${match.index}`}>{renderFormula(match[1])}</span>);
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < raw.length) parts.push(renderPlainText(raw.slice(lastIndex), `t${lastIndex}`));
  return parts.flat();
}

function renderPlainText(text, keyPrefix) {
  return String(text || "")
    .split(/(\^{[^}]+}|_[{][^}]+[}]|\^[+-]|\d+\^\-?\d+)/g)
    .filter((part) => part !== "")
    .map((part, index) => renderFormulaToken(part, `${keyPrefix}-${index}`));
}

function renderFormula(formula) {
  const tokens = [];
  const regex = /(\^{[^}]+}|_\{[^}]+}|_[A-Za-z0-9+\-]+|\^[A-Za-z0-9+\-]+|[A-Za-z]+|\d+|[+\-=(),./])/g;
  let match;
  while ((match = regex.exec(formula))) {
    tokens.push(renderFormulaToken(match[1], `m${match.index}`));
  }
  return tokens.length ? tokens : formula;
}

function renderFormulaToken(token, key) {
  const value = String(token || "");
  if (value.startsWith("^{") && value.endsWith("}")) return <sup key={key}>{value.slice(2, -1)}</sup>;
  if (value.startsWith("_{") && value.endsWith("}")) return <sub key={key}>{value.slice(2, -1)}</sub>;
  if (value.startsWith("^")) return <sup key={key}>{value.slice(1)}</sup>;
  if (value.startsWith("_")) return <sub key={key}>{value.slice(1)}</sub>;
  return <span key={key}>{value}</span>;
}

function markdownBlocks(content) {
  const lines = String(content || "").split("\n");
  const blocks = [];
  let paragraph = [];

  function flushParagraph() {
    const text = cleanDisplayText(paragraph.join(" "));
    if (text) blocks.push({ type: "paragraph", text });
    paragraph = [];
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) {
      flushParagraph();
      continue;
    }

    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      flushParagraph();
      blocks.push({ type: "image", alt: cleanDisplayText(image[1]), src: image[2] });
      continue;
    }

    if (isMarkdownTableLine(line)) {
      flushParagraph();
      const rows = [];
      while (index < lines.length && isMarkdownTableLine(lines[index].trim())) {
        const rowLine = lines[index].trim();
        if (!isMarkdownSeparatorRow(rowLine)) rows.push(parseMarkdownTableRow(rowLine));
        index += 1;
      }
      index -= 1;
      if (rows.length) blocks.push({ type: "table", rows });
      continue;
    }

    const heading = line.match(/^#{1,4}\s+(.+)$/);
    if (heading) {
      flushParagraph();
      blocks.push({ type: "heading", text: cleanDisplayText(heading[1]) });
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  return blocks;
}

function isMarkdownTableLine(line) {
  return line.includes("|") && line.split("|").length >= 3;
}

function isMarkdownSeparatorRow(line) {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line);
}

function parseMarkdownTableRow(line) {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cleanDisplayText(cell));
}

function cleanDisplayText(value) {
  return String(value || "").replace(/\*\*/g, "").replace(/`/g, "").replace(/\s+/g, " ").trim();
}

function annaleQuestionLabel(question, index) {
  const match = String(question.id || "").match(/(?:exercice|dossier)_(\d+)_q(\d+)/);
  if (!match) return `Q${index + 1}`;
  return `${question.sectionTitle || `Exercice ${match[1]}`} · Q${match[2]}`;
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
  const currentSectionTitle = currentQuestion?.sectionTitle || "Énoncé";
  const currentSectionStatement = currentQuestion?.sectionStatement || session.statement;
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
            <h3>{currentSectionTitle}</h3>
            <MarkdownLite content={currentSectionStatement} />
          </div>
          <div className="qcm-question-list">
            {session.questions.map((question, index) => (
              <button
                key={question.id}
                className={`question-nav ${index === currentQuestionIndex ? "active" : ""} ${corrections[question.id] ? "done" : ""}`}
                onClick={() => setCurrentQuestionIndex(index)}
                type="button"
              >
                {annaleQuestionLabel(question, index)} · {corrections[question.id] ? formatScore(corrections[question.id].score, corrections[question.id].maxScore) : `${question.maxScore} pt`}
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
              <div className="qcm-stem">
                <MarkdownLite content={currentQuestion.text} />
              </div>
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
          <h2>Dashboard</h2>
          <p>Suivi des scores, matières faibles et progression par item.</p>
        </div>
        <button className="secondary-button" onClick={reload} disabled={loading === "progress"}>Actualiser</button>
      </div>
      {!progress ? (
        <div className="empty-state">Charge les statistiques pour afficher la progression.</div>
      ) : (
        <>
          <div className="stats-grid">
            <Metric label="Score moyen" value={`${progress.averageScore}%`} />
            <Metric label="Réponses corrigées" value={progress.answerCount} />
            <Metric label="Temps moyen QCM" value={formatDuration(progress.speedStats?.qcm?.averageSeconds)} />
            <Metric label="Temps moyen dossier" value={formatDuration(progress.speedStats?.dossier?.averageSeconds)} />
            <Metric label="Temps moyen exercice" value={formatDuration(progress.speedStats?.exercices?.averageSeconds)} />
          </div>
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
                <span>{item.box ? `Niveau ${item.box}` : "Non revu"}</span>
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
