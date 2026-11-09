"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadProHorses, loadTeams, loadWeek, type WeekData } from "@/lib/gestion/data";
import {
  addDays,
  buildWeek,
  dayKey,
  feesCsv,
  planningCsv,
  riderLabel,
  startOfDay,
  tasksCsv,
  weekStart,
  weekTasks,
  type Horse,
  type TeamMember,
} from "@/lib/gestion/planning";
import styles from "./Gestion.module.css";

const EMPTY: WeekData = { sessions: [], slots: [], tasks: [], completions: [], fees: [] };

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const dayLabel = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });

/**
 * Planning de la semaine (chevaux × jours), tâches et exports CSV, en lecture
 * seule. Tout ce qui s'affiche a déjà été filtré par les règles RLS de la
 * personne connectée : ce composant ne décide d'aucun droit.
 */
export function Dashboard({ client, email }: { client: SupabaseClient; email: string }) {
  const [horses, setHorses] = useState<Horse[] | null>(null);
  const [teams, setTeams] = useState<Record<string, TeamMember[]>>({});
  const [start, setStart] = useState(() => weekStart(new Date()));
  const [data, setData] = useState<WeekData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chevaux d'un propriétaire Écurie Pro, et leurs équipes : une fois.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await loadProHorses(client);
        const t = list.length ? await loadTeams(client, list.map((h) => h.id)) : {};
        if (alive) {
          setHorses(list);
          setTeams(t);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Chargement impossible.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [client]);

  // Semaine affichée : relue à chaque changement de semaine.
  useEffect(() => {
    if (!horses || horses.length === 0) return;
    let alive = true;
    setLoading(true);
    loadWeek(client, horses.map((h) => h.id), start)
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Chargement impossible."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [client, horses, start]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);
  const items = useMemo(() => buildWeek(data.sessions, data.slots, start), [data, start]);
  const tasks = useMemo(() => weekTasks(data.tasks, data.completions, start), [data, start]);
  const today = dayKey(startOfDay(new Date()));
  const label = `${days[0].toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;
  const who = (id: string, item: { riderUserId: string | null; riderName: string | null }) => riderLabel(item, teams[id] ?? []);
  const stamp = dayKey(start);

  if (error && !horses) {
    return (
      <p className={styles.error} role="alert">
        {error}
      </p>
    );
  }
  if (!horses) return <p className={styles.lead}>Chargement de votre écurie…</p>;
  if (horses.length === 0) {
    return (
      <div className={`${styles.card} ${styles.narrow}`}>
        <h1 className={styles.title}>Espace gestionnaire</h1>
        <p className={styles.lead}>
          {email} : aucun cheval d&apos;un compte Écurie Pro n&apos;est associé à cette adresse. Cet espace est disponible
          pour les écuries abonnées à Écurie Pro, et pour leur équipe (gérant, coach, groom).
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={styles.bar}>
        <h1 className={styles.title}>Planning de la semaine</h1>
        <div className={styles.nav}>
          <button className={`${styles.button} ${styles.secondary}`} type="button" aria-label="Semaine précédente" onClick={() => setStart((s) => addDays(s, -7))}>
            ←
          </button>
          <span className={styles.week} aria-live="polite">
            {label}
          </span>
          <button className={`${styles.button} ${styles.secondary}`} type="button" aria-label="Semaine suivante" onClick={() => setStart((s) => addDays(s, 7))}>
            →
          </button>
          <button className={`${styles.button} ${styles.secondary}`} type="button" onClick={() => setStart(weekStart(new Date()))}>
            Aujourd&apos;hui
          </button>
        </div>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.tableWrap} aria-busy={loading}>
        <table className={styles.table}>
          <caption className="sr-only">Séances et créneaux de la semaine, par cheval et par jour</caption>
          <thead>
            <tr>
              <th scope="col">Cheval</th>
              {days.map((d) => (
                <th key={d.getTime()} scope="col" className={dayKey(d) === today ? styles.today : undefined}>
                  {dayLabel(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {horses.map((h) => (
              <tr key={h.id}>
                <th scope="row">{h.name}</th>
                {days.map((d) => {
                  const cell = items.filter((i) => i.horseId === h.id && dayKey(i.day) === dayKey(d));
                  return (
                    <td key={d.getTime()} className={dayKey(d) === today ? styles.today : undefined}>
                      {cell.length === 0 ? (
                        <span className={styles.empty} aria-label="Rien de prévu">
                          —
                        </span>
                      ) : (
                        <div className={styles.cell}>
                          {cell.map((i) => (
                            <span key={i.id} className={`${styles.chip} ${i.done ? styles.chipDone : ""} ${i.fromSlot && !i.done ? styles.chipSlot : ""}`}>
                              <strong>{i.time ?? "—"}</strong>
                              {who(h.id, i) ?? "Cavalier non précisé"}
                              {i.done ? <span aria-label="Fait"> ✓</span> : null}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.note}>Pointillés : séance d&apos;un créneau régulier, pas encore faite. ✓ : faite.</p>

      <h2 className={styles.h2}>Tâches de la semaine</h2>
      {tasks.length === 0 ? (
        <p className={styles.lead}>Aucune tâche cette semaine.</p>
      ) : (
        <ul className={styles.taskList}>
          {tasks.map((r) => (
            <li key={`${r.task.id}-${dayKey(r.day)}`} className={styles.taskRow}>
              <span>
                <strong>{r.day.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })}</strong>
                {r.task.time ? ` · ${r.task.time}` : ""} · {horses.find((h) => h.id === r.task.horseId)?.name} · {r.task.title}
              </span>
              <span>
                {r.task.assigneeUserId
                  ? (teams[r.task.horseId] ?? []).find((m) => m.userId === r.task.assigneeUserId)?.name
                  : r.task.assigneeName}
                {r.completion ? " · fait ✓" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h2 className={styles.h2}>Exports</h2>
      <div className={styles.exports}>
        <button className={`${styles.button} ${styles.secondary}`} type="button" onClick={() => download(`planning-${stamp}.csv`, planningCsv(items, horses, teams))}>
          Planning de la semaine (CSV)
        </button>
        <button className={`${styles.button} ${styles.secondary}`} type="button" onClick={() => download(`taches-${stamp}.csv`, tasksCsv(tasks, horses, teams))}>
          Tâches de la semaine (CSV)
        </button>
        {data.fees.length > 0 ? (
          <button className={`${styles.button} ${styles.secondary}`} type="button" onClick={() => download(`participation-frais-${[...new Set(data.fees.map((f) => f.month))].sort().join("_")}.csv`, feesCsv(data.fees, horses, teams))}>
            Participation aux frais (CSV)
          </button>
        ) : null}
      </div>
      <p className={styles.note}>
        Lecture seule : pour modifier le planning, utilisez l&apos;app. Chacun voit ce que son rôle permet : la
        participation aux frais n&apos;apparaît que pour le propriétaire et le gérant.
      </p>
    </>
  );
}
