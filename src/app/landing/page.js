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
          <div className="eyebrow">Simulation Clinique</div>
          <h1 className="start-title">Entraîne-toi à la consultation médicale</h1>
          <p className="start-subtitle">
            Nouky est une plateforme de simulation clinique pour développer tes compétences de diagnostic. Pose
            des questions, demande des examens, et propose ton diagnostic face à des cas cliniques réalistes.
          </p>

          <div style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "1.25rem", marginBottom: "16px", color: "var(--ink)" }}>
              Pourquoi Nouky ?
            </h2>
            <ul style={{ color: "var(--muted)", lineHeight: "1.8", maxWidth: "600px" }}>
              <li>✓ Cas cliniques générés par IA</li>
              <li>✓ Feedback immédiat sur tes diagnostics</li>
              <li>✓ Entraînement multispecialités</li>
              <li>✓ Progression suivie et sécurisée</li>
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
