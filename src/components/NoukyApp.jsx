"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PROGRAM_OPTIONS } from "@/lib/internat-program";

const DIFFICULTIES = ["facile", "intermédiaire", "difficile"];
const TABS = [
  { id: "cases", label: "Dossiers" },
  { id: "leitner", label: "Révisions Leitner" },
  { id: "progress", label: "Progression" },
  { id: "mock", label: "Concours blanc" },
];

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

export default function NoukyApp({ user }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("cases");
  const [subjectId, setSubjectId] = useState("rhumatologie");
  const [difficulty, setDifficulty] = useState("intermédiaire");
  const [caseSession, setCaseSession] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answerDraft, setAnswerDraft] = useState("");
  const [corrections, setCorrections] = useState({});
  const [leitnerCards, setLeitnerCards] = useState([]);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [progress, setProgress] = useState(null);
  const [mockCases, setMockCases] = useState([]);
  const [mockCount, setMockCount] = useState(3);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");

  const currentQuestion = caseSession?.questions?.[currentQuestionIndex];
  const totalScore = useMemo(() => {
    return Object.values(corrections).reduce(
      (acc, correction) => ({
        score: acc.score + Number(correction.score || 0),
        maxScore: acc.maxScore + Number(correction.maxScore || 0),
      }),
      { score: 0, maxScore: 0 },
    );
  }, [corrections]);

  useEffect(() => {
    if (activeTab === "leitner") loadDueCards();
    if (activeTab === "progress") loadProgress();
  }, [activeTab]);

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
        body: JSON.stringify({ subjectId, difficulty }),
      });
      setCaseSession(data.caseSession);
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
      const data = await fetchJson("/api/cases/answer", {
        method: "POST",
        body: JSON.stringify({
          caseSessionId: caseSession.id,
          questionId: currentQuestion.id,
          answer: answerDraft,
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
      const subjectIds = PROGRAM_OPTIONS.slice(0, mockCount).map((item) => item.id);
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
    setActiveTab("cases");
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
          <p>Anki + annales + correction exigeante pour l'internat de pharmacie.</p>
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
          setAnswerDraft={setAnswerDraft}
          setCurrentQuestionIndex={setCurrentQuestionIndex}
          setDifficulty={setDifficulty}
          setSubjectId={setSubjectId}
          subjectId={subjectId}
          submitAnswer={submitAnswer}
          totalScore={totalScore}
          generateCase={generateCase}
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
    setAnswerDraft,
    setCurrentQuestionIndex,
    setDifficulty,
    setSubjectId,
    subjectId,
    submitAnswer,
    totalScore,
    generateCase,
  } = props;

  return (
    <section className="tab-panel">
      <div className="control-grid">
        <label>
          Matière
          <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
            {PROGRAM_OPTIONS.map((option) => (
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
              <span className="score-pill">Score {formatScore(totalScore.score, totalScore.maxScore)}</span>
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
              <span className="counter">{currentQuestionIndex + 1}/{caseSession.questions.length}</span>
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

            {currentQuestion && corrections[currentQuestion.id] ? (
              <CorrectionBlock correction={corrections[currentQuestion.id]} />
            ) : null}
          </aside>
        </div>
      )}
    </section>
  );
}

function CorrectionBlock({ correction }) {
  return (
    <div className="correction-block">
      <div className={`status ${correction.status}`}>{correction.status}</div>
      <h3>Correction concours</h3>
      <p><strong>Score estimé :</strong> {formatScore(correction.score, correction.maxScore)}</p>
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

function LeitnerTab({ activeCardIndex, cards, loading, reviewCard, setActiveCardIndex, setShowBack, showBack, reload }) {
  const card = cards[activeCardIndex];
  return (
    <section className="tab-panel">
      <div className="section-header">
        <div>
          <h2>Révisions Leitner</h2>
          <p>Cartes dues aujourd'hui, issues des erreurs de dossiers.</p>
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

function ProgressTab({ loading, progress, reload }) {
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
            <Metric label="Dossiers réalisés" value={progress.caseCount} />
            <Metric label="Réponses corrigées" value={progress.answerCount} />
            <Metric label="Cartes dues" value={progress.dueCards} />
            <Metric label="Cartes totales" value={progress.totalCards} />
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
