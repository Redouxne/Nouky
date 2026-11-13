"use client";

import Link from "next/link";
import SunprintArtwork from "@/components/SunprintArtwork";

export default function LandingPage() {
  return (
    <main className="app-shell landing-shell">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src="/Leoard.png" alt="Nouky" />
          <span className="brand-name">Nouky</span>
        </div>
      </header>

      <section className="start-view landing-view">
        <div className="start-content">
          <div className="eyebrow">L’atelier de révision · Internat pharmacie</div>
          <h1 className="start-title">La révision prend <em>forme.</em></h1>
          <p className="start-subtitle">
            Annales, QCM et dossiers thérapeutiques réunis dans un espace clair pour avancer à ton rythme vers le concours.
          </p>
          <div className="start-actions">
            <Link className="primary-button" href="/auth/signup">Commencer à réviser <span aria-hidden="true">↗</span></Link>
            <Link className="secondary-button" href="/auth/signin">Se connecter</Link>
          </div>
          <div className="landing-note">Un parcours simple, des progrès visibles, séance après séance.</div>
        </div>
        <SunprintArtwork />
      </section>
      <section className="landing-features" aria-label="Les outils Nouky">
        <article><span>01 / S’exercer</span><h2>Des cas qui font réfléchir.</h2><p>Dossiers proches du concours et QCM par matière.</p></article>
        <article><span>02 / Comprendre</span><h2>Une correction utile.</h2><p>Mots-clés, points et explications dès la réponse.</p></article>
        <article><span>03 / Avancer</span><h2>Le progrès en vue.</h2><p>Un suivi de tes acquis pour cibler les prochaines révisions.</p></article>
      </section>
    </main>
  );
}
