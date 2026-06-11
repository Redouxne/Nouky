"use client";

import { useMemo, useState } from "react";
import { SPECIALTIES } from "@/lib/text";

function Message({ message }) {
  const isStudent = message.role === "student";
  const avatar = isStudent ? "/usericon.png" : "/Leoard.png";
  const rowClass = `message-row ${isStudent ? "student" : ""}`;
  const bubbleClass = `bubble ${message.role}`;

  return (
    <div className={rowClass}>
      <img className="avatar" src={avatar} alt="" />
      <div className={bubbleClass}>{message.content}</div>
    </div>
  );
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Erreur serveur");
  }
  return data;
}

export default function NoukyApp() {
  const [selectedSpecialty, setSelectedSpecialty] = useState(SPECIALTIES[0]);
  const [caseData, setCaseData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");

  const exchangeCount = useMemo(
    () => messages.filter((message) => message.role === "student").length,
    [messages],
  );

  async function startCase() {
    setLoading("case");
    setError("");
    setFeedback("");
    setDiagnosis("");
    setMessages([]);
    try {
      const data = await postJson("/api/case", { specialty: selectedSpecialty });
      setCaseData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading("");
    }
  }

  async function sendQuestion(event) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || !caseData) return;

    const nextMessages = [...messages, { role: "student", content: trimmed }];
    setMessages(nextMessages);
    setQuestion("");
    setLoading("chat");
    setError("");

    try {
      const reply = await postJson("/api/chat", {
        caseToken: caseData.caseToken,
        messages,
        question: trimmed,
      });
      setMessages([...nextMessages, reply]);
    } catch (err) {
      setError(err.message);
      setMessages(messages);
    } finally {
      setLoading("");
    }
  }

  async function evaluateDiagnosis(event) {
    event.preventDefault();
    const trimmed = diagnosis.trim();
    if (!trimmed || !caseData) return;

    setLoading("diagnosis");
    setError("");
    try {
      const data = await postJson("/api/evaluate", {
        caseToken: caseData.caseToken,
        diagnosis: trimmed,
        messages,
      });
      setFeedback(data.feedback);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading("");
    }
  }

  function reset() {
    setCaseData(null);
    setMessages([]);
    setQuestion("");
    setDiagnosis("");
    setFeedback("");
    setError("");
    setLoading("");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src="/Leoard.png" alt="" />
          <span className="brand-name">Nouky</span>
        </div>
      </header>

      {!caseData ? (
        <section className="start-view">
          <div className="start-content">
            <div className="eyebrow">Simulation clinique</div>
            <h1 className="start-title">Choisis une spécialité et lance la consultation.</h1>
            <p className="start-subtitle">
              Le patient est généré cote serveur. La cle Mistral reste hors du navigateur.
            </p>

            <div className="specialty-grid">
              {SPECIALTIES.map((specialty) => (
                <button
                  className={`specialty-card ${selectedSpecialty === specialty ? "selected" : ""}`}
                  key={specialty}
                  onClick={() => setSelectedSpecialty(specialty)}
                  type="button"
                >
                  <strong>{specialty}</strong>
                </button>
              ))}
            </div>

            {error ? <div className="error">{error}</div> : null}

            <div className="start-actions">
              <button className="primary-button" disabled={loading === "case"} onClick={startCase}>
                {loading === "case" ? "Generation du patient..." : "Demarrer un cas"}
              </button>
              <span className="hint">Spécialité sélectionnée : {selectedSpecialty}</span>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="case-header">
            <div>
              <div className="eyebrow">{caseData.specialty}</div>
              <h1>Consultation en cours</h1>
              <p>Pose tes questions, demande les examens utiles, puis propose ton diagnostic !</p>
            </div>
            <button className="secondary-button" onClick={reset} type="button">
              Nouveau cas
            </button>
          </section>

          {error ? <div className="error">{error}</div> : null}

          <section className="workspace">
            <div className="panel conversation">
              <div className="panel-header">
                <h2>Patient</h2>
                <span className="counter">{exchangeCount} question(s)</span>
              </div>

              <div className="messages">
                {messages.length === 0 ? (
                  <div className="empty-dialogue">Pose ta premiere question.</div>
                ) : (
                  messages.map((message, index) => <Message key={`${message.role}-${index}`} message={message} />)
                )}
              </div>

              <form className="composer" onSubmit={sendQuestion}>
                <textarea
                  disabled={loading === "chat"}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ex. Depuis quand avez-vous mal ?"
                  value={question}
                />
                <button className="primary-button" disabled={loading === "chat" || !question.trim()} type="submit">
                  {loading === "chat" ? "..." : "Envoyer"}
                </button>
              </form>
            </div>

            <aside className="panel">
              <div className="panel-header">
                <h2>Diagnostic</h2>
              </div>
              <form className="diagnosis" onSubmit={evaluateDiagnosis}>
                <textarea
                  disabled={loading === "diagnosis"}
                  onChange={(event) => setDiagnosis(event.target.value)}
                  placeholder="Diagnostic, arguments, examens, prise en charge..."
                  value={diagnosis}
                />
                <button
                  className="primary-button"
                  disabled={loading === "diagnosis" || !diagnosis.trim()}
                  type="submit"
                >
                  {loading === "diagnosis" ? "Evaluation..." : "Evaluer"}
                </button>
                {feedback ? <div className="feedback">{feedback}</div> : null}
              </form>
            </aside>
          </section>
        </>
      )}
    </main>
  );
}
