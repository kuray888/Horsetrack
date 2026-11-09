"use client";

import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import styles from "./Gestion.module.css";

/**
 * Connexion à l'espace gestionnaire : les identifiants de l'app (adresse et
 * mot de passe), ou un lien de connexion envoyé par email — utile quand on
 * se connecte à l'app avec Apple ou Google et qu'on n'a pas de mot de passe.
 */
export function SignIn({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error: err } = await client.auth.signInWithPassword({ email: email.trim(), password });
    // Message volontairement unique : on ne dit pas si l'adresse existe.
    if (err) setError("Adresse ou mot de passe incorrect.");
    setBusy(false);
  }

  async function sendLink() {
    if (busy || !email.trim()) {
      if (!email.trim()) setError("Saisissez d'abord votre adresse email.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/gestion`, shouldCreateUser: false },
    });
    setBusy(false);
    if (err) setError("Le lien n'a pas pu être envoyé. Réessayez dans un instant.");
    else setNotice("Si un compte existe avec cette adresse, un lien de connexion vient d'être envoyé.");
  }

  return (
    <div className={`${styles.card} ${styles.narrow}`}>
      <h1 className={styles.title}>Espace gestionnaire</h1>
      <p className={styles.lead}>
        Le planning de votre écurie sur grand écran. Connectez-vous avec les identifiants de l&apos;app Horsetrack.
      </p>
      <form className={styles.form} onSubmit={submit}>
        <label className={styles.field}>
          Adresse email
          <input
            className={styles.input}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          Mot de passe
          <input
            className={styles.input}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        ) : null}
        <button className={styles.button} type="submit" disabled={busy}>
          {busy ? "Un instant…" : "Se connecter"}
        </button>
        <button className={styles.link} type="button" onClick={sendLink} disabled={busy}>
          Recevoir un lien de connexion par email
        </button>
      </form>
    </div>
  );
}
