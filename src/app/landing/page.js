"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src="/Leoard.png" alt="Nouky" />
          <span className="brand-name">Nouky</span>
        </div>
      </header>

      <section className="start-view">
        <div className="start-content">
          <div className="eyebrow">Internat pharmacie</div>
          <h1 className="start-title">Dossiers thérapeutiques et biologiques</h1>
          <p className="start-subtitle">
            Nouky génère des dossiers progressifs, corrige les réponses selon un barème strict et organise les
            révisions avec un système Leitner.
          </p>

          <div style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "1.25rem", marginBottom: "16px", color: "var(--ink)" }}>
              Pourquoi Nouky ?
            </h2>
            <ul style={{ color: "var(--muted)", lineHeight: "1.8", maxWidth: "600px" }}>
              <li>Dossiers proches concours générés par IA</li>
              <li>Correction immédiate avec mots-clés et points</li>
              <li>Cartes Leitner créées à partir des erreurs</li>
              <li>Progression suivie par matière et compétence</li>
            </ul>
          </div>

          <div className="start-actions">
            <Link href="/auth/signin">
              <button className="primary-button">Se connecter</button>
            </Link>
            <Link href="/auth/signup">
              <button className="secondary-button">Créer un compte</button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
