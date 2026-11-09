"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getGestionClient, gestionConfigured } from "@/lib/gestion/client";
import { Dashboard } from "./Dashboard";
import { SignIn } from "./SignIn";
import styles from "./Gestion.module.css";

/** Espace gestionnaire : connexion, puis tableau de bord (cf. Dashboard). */
export function GestionApp() {
  const client = useMemo(() => getGestionClient(), []);
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!client) return;
    let alive = true;
    client.auth.getSession().then(({ data }) => alive && setSession(data.session));
    const { data } = client.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  if (!gestionConfigured || !client) {
    return (
      <div className={`${styles.card} ${styles.narrow}`}>
        <h1 className={styles.title}>Espace gestionnaire</h1>
        <p className={styles.lead}>Cet espace n&apos;est pas encore ouvert. Revenez bientôt.</p>
      </div>
    );
  }
  if (session === undefined) return <p className={styles.lead}>Chargement…</p>;
  if (!session) return <SignIn client={client} />;

  return (
    <>
      <div className={styles.bar}>
        <p className={styles.lead}>Connecté : {session.user.email}</p>
        <button className={`${styles.button} ${styles.secondary}`} type="button" onClick={() => client.auth.signOut()}>
          Se déconnecter
        </button>
      </div>
      <Dashboard client={client} email={session.user.email ?? ""} />
    </>
  );
}
