"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AuthForm({ mode = "signin" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";
  const endpoint = isSignup ? "/api/auth/signup" : "/api/auth/signin";
  const buttonText = isSignup ? "Créer un compte" : "Se connecter";
  const linkText = isSignup ? "Déjà inscrit ?" : "Pas encore de compte ?";
  const linkHref = isSignup ? "/auth/signin" : "/auth/signup";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = isSignup ? { email, password, name } : { email, password };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Une erreur est survenue");
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      setError("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src="/Leoard.png" alt="Nouky" />
          <span className="brand-name">Nouky</span>
        </div>
      </header>

      <section className="start-view">
        <div className="start-content" style={{ maxWidth: "400px" }}>
          <div className="eyebrow">{isSignup ? "Créer un compte" : "Se connecter"}</div>
          <h1 className="start-title" style={{ fontSize: "2rem" }}>
            {isSignup ? "Rejoins Nouky" : "Bienvenue"}
          </h1>

          <form onSubmit={handleSubmit} style={{ marginTop: "24px" }}>
            {isSignup && (
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontWeight: 500 }}>
                  Nom
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ton nom"
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "1rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            )}

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontWeight: 500 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ton@email.com"
                required
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "1rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontWeight: 500 }}>
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignup ? "Au moins 8 caractères" : "Ton mot de passe"}
                required
                minLength={isSignup ? 8 : undefined}
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "1rem",
                  boxSizing: "border-box",
                }}
              />
              {isSignup && (
                <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "6px 0 0" }}>
                  Minimum 8 caractères
                </p>
              )}
            </div>

            {error && <div className="error">{error}</div>}

            <button
              type="submit"
              disabled={loading}
              className="primary-button"
              style={{ width: "100%", marginBottom: "16px" }}
            >
              {loading ? "Chargement..." : buttonText}
            </button>
          </form>

          <p style={{ textAlign: "center", color: "var(--muted)" }}>
            {linkText}{" "}
            <Link
              href={linkHref}
              style={{ color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}
            >
              {isSignup ? "Se connecter" : "S'inscrire"}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
