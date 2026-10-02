import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrainingSession } from "@/sessions/store";
import type { Appointment, CompetitionEntry } from "@/agenda/store";
import { cleanCompetitionEntry } from "@/agenda/competitionEntry";

/**
 * Cycle de vie RÉEL d'une séance / d'un rendez-vous / d'un concours :
 * saisie → disque local → envoi Supabase → fermeture de l'app → relancement →
 * relecture du serveur → fusion → ce que le Planning affiche.
 *
 * Tout ce qui décide du résultat est le vrai code (lib/cloudSync.ts,
 * lib/remoteIndex.ts, lib/syncQueue.ts, lib/mergeRemote.ts). Seuls sont
 * simulés : le disque (un fichier JSON par clé, comme lib/localStore.ts), et
 * le serveur — avec la sémantique EXACTE des colonnes `date` en production :
 * `DateTime` Prisma sans annotation = `timestamp(3)` SANS fuseau. Postgres y
 * ignore le « Z » envoyé, et PostgREST le relit sans décalage (vérifié sur
 * Postgres 16 : `2026-10-02T22:00:00.000Z` → stocké puis renvoyé
 * `"2026-10-02T22:00:00"`).
 *
 * Fermer l'app = perdre la mémoire, les minuteries et les requêtes en vol ;
 * seul le disque (et le serveur) survit.
 */

// Fuseau des utilisateurs (France) : heure d'été (UTC+2) jusqu'au 25 octobre 2026.
process.env.TZ = "Europe/Paris";

type Mode = "ok" | "offline" | "lost" | "applied-no-reply" | "slow";

const sim = vi.hoisted(() => {
  const disk = new Map<string, string>();
  const tables = new Map<string, Map<string, Record<string, unknown>>>();
  const plans: { table: string; mode: string }[] = [];
  /** Écritures reçues par le serveur, dans l'ordre où il les applique. */
  const writes: { table: string; row: Record<string, unknown> | null; id: string }[] = [];
  return { disk, tables, plans, writes };
});

vi.mock("@/lib/localStore", () => ({
  readJson: async (key: string, fallback: unknown) => {
    const raw = sim.disk.get(key);
    return raw === undefined ? fallback : JSON.parse(raw);
  },
  readJsonChecked: async (key: string, fallback: unknown) => {
    const raw = sim.disk.get(key);
    return { ok: true, value: raw === undefined ? fallback : JSON.parse(raw) };
  },
  writeJson: async (key: string, value: unknown) => {
    sim.disk.set(key, JSON.stringify(value));
    return true;
  },
  removeJson: async (key: string) => {
    sim.disk.delete(key);
  },
}));

vi.mock("expo-file-system", () => ({ File: class {}, Paths: {} }));

vi.mock("@/lib/supabase", () => {
  const TIMESTAMP_COLUMNS = ["date", "endDate", "nextDueDate", "updatedAt", "targetDate", "occurredAt"];

  /** Ce que Postgres fait d'une chaîne ISO écrite dans un `timestamp(3)` sans
   * fuseau, puis ce que to_json en renvoie : fuseau ignoré, aucun décalage en
   * sortie, zéros décimaux de fin retirés. */
  function postgresTimestamp(input: string): string {
    const wall = input.replace(/(Z|[+-]\d{2}(:?\d{2})?)$/i, "");
    const [main, fraction = ""] = wall.split(".");
    const ms = fraction.slice(0, 3).replace(/0+$/, "");
    return ms ? `${main}.${ms}` : main;
  }

  function table(name: string) {
    let rows = sim.tables.get(name);
    if (!rows) sim.tables.set(name, (rows = new Map()));
    return rows;
  }

  function nextMode(name: string): string {
    const index = sim.plans.findIndex((p) => p.table === name);
    if (index === -1) return "ok";
    return sim.plans.splice(index, 1)[0].mode;
  }

  function write(name: string, apply: () => void): Promise<{ error: { message: string } | null }> {
    const mode = nextMode(name);
    if (mode === "offline") return Promise.resolve({ error: { message: "TypeError: Network request failed" } });
    // App fermée avant que la requête ne parte : jamais appliquée, jamais de réponse.
    if (mode === "lost") return new Promise(() => {});
    // Réseau lent : appliquée et confirmée plus tard que les requêtes suivantes.
    if (mode === "slow") {
      return (async () => {
        for (let i = 0; i < 3; i++) await new Promise((resolve) => setImmediate(resolve));
        apply();
        return { error: null };
      })();
    }
    apply();
    // Appliquée côté serveur, mais l'app est fermée avant d'avoir la réponse.
    if (mode === "applied-no-reply") return new Promise(() => {});
    return Promise.resolve({ error: null });
  }

  /** Colonnes NOT NULL sans défaut, refusées si absentes (cf. schema.prisma). */
  const NOT_NULL: Record<string, string[]> = { competition_entries: ["name", "discipline", "time"] };
  let createdSeq = 0;

  function upsert(name: string, row: Record<string, unknown>) {
    const missing = (NOT_NULL[name] ?? []).find((column) => row[column] === null || row[column] === undefined);
    if (missing) {
      return Promise.resolve({ error: { code: "23502", message: `null value in column "${missing}" violates not-null constraint` } });
    }
    return write(name, () => {
      sim.writes.push({ table: name, id: row.id as string, row: { ...row } });
      const previous = table(name).get(row.id as string);
      const stored: Record<string, unknown> = { createdAt: previous?.createdAt ?? ++createdSeq, ...previous, ...row };
      for (const column of TIMESTAMP_COLUMNS) {
        if (typeof stored[column] === "string") stored[column] = postgresTimestamp(stored[column] as string);
      }
      // Postgres réécrit une ligne modifiée ailleurs dans la table : sans
      // ORDER BY, elle revient en dernier.
      table(name).delete(row.id as string);
      table(name).set(row.id as string, stored);
    });
  }

  function select(name: string, entryOrder: string[]) {
    const rows = [...table(name).values()].map((row) => ({ ...row }));
    if (name === "appointments") {
      for (const row of rows) {
        const entries = [...table("competition_entries").values()].filter((e) => e.appointmentId === row.id);
        for (const column of [...entryOrder].reverse()) {
          entries.sort((a, b) => (a[column] as number | string) < (b[column] as number | string) ? -1 : (a[column] as number | string) > (b[column] as number | string) ? 1 : 0);
        }
        row.competition_entries = entries.map((e) => ({ id: e.id, name: e.name, discipline: e.discipline, time: e.time, result: e.result ?? null }));
      }
    }
    return Promise.resolve({ data: rows, error: null });
  }

  /** Requête de lecture : `.order(…, { referencedTable })` trie les lignes imbriquées. */
  function query(name: string) {
    const entryOrder: string[] = [];
    const builder = {
      order(column: string, options?: { referencedTable?: string }) {
        if (options?.referencedTable === "competition_entries") entryOrder.push(column);
        return builder;
      },
      then<R>(resolve: (value: { data: Record<string, unknown>[]; error: null }) => R, reject?: (e: unknown) => R) {
        return select(name, entryOrder).then(resolve, reject);
      },
    };
    return builder;
  }

  return {
    supabase: {
      auth: {
        getUser: async () => ({ data: { user: { id: "u1" } } }),
        getSession: async () => ({ data: { session: { user: { id: "u1" } } } }),
      },
      from: (name: string) => ({
        upsert: (row: Record<string, unknown>) => upsert(name, row),
        select: () => query(name),
        delete: () => ({
          eq: (_column: string, id: string) =>
            write(name, () => {
              sim.writes.push({ table: name, id, row: null });
              table(name).delete(id);
            }),
        }),
      }),
    },
  };
});

const SESSIONS_KEY = "training_sessions_v1";
const APPOINTMENTS_KEY = "agenda_appointments_v1";
const HORSE = "h1";

/** Prochaines écritures vers `table` : se comportent comme indiqué, dans l'ordre. */
function plan(table: string, ...modes: Mode[]) {
  for (const mode of modes) sim.plans.push({ table, mode });
}

/** Laisse aller au bout tout ce qui peut l'être (réponses déjà reçues,
 * enchaînements), sans faire avancer les minuteries. */
async function settle() {
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
}

function session(id: string, date: Date, patch: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id,
    horseId: HORSE,
    activityType: "dressage",
    customActivityLabel: null,
    date,
    time: "10:00",
    durationMinutes: 45,
    intensity: "medium",
    notes: "",
    completed: false,
    ...patch,
  };
}

function appointment(id: string, date: Date, patch: Partial<Appointment> = {}): Appointment {
  return {
    id,
    horseId: HORSE,
    type: "veto",
    title: "Vaccin grippe",
    date,
    time: "14:00",
    location: "Écurie",
    notes: "",
    reminder: "none",
    reminderNotificationId: null,
    emailReminderId: null,
    result: null,
    checklist: [],
    dossard: null,
    competitionEntries: [],
    competitionLevel: null,
    endDate: null,
    professional: null,
    cost: null,
    nextDueDate: null,
    nextDueNotificationId: null,
    ...patch,
  };
}

function entry(id: string, name: string, result: string | null = null, time = "09:15"): CompetitionEntry {
  return { id, name, discipline: "SHOW_JUMPING", time, result };
}

/**
 * Une instance de l'app : modules neufs (mémoire vide), données relues du
 * disque. Les mutateurs reproduisent la séquence des stores
 * (sessions/store.tsx, agenda/store.tsx) : état → écriture disque (l'effet
 * qui suit chaque changement) → envoi au serveur.
 */
class App {
  sessions: TrainingSession[] = [];
  appointments: Appointment[] = [];
  private cloud!: typeof import("@/lib/cloudSync");
  private index!: typeof import("@/lib/remoteIndex");
  private queue!: typeof import("@/lib/syncQueue");
  private merge!: typeof import("@/lib/mergeRemote");

  static async launch(): Promise<App> {
    const app = new App();
    app.cloud = await import("@/lib/cloudSync");
    app.index = await import("@/lib/remoteIndex");
    app.queue = await import("@/lib/syncQueue");
    app.merge = await import("@/lib/mergeRemote");
    // Lecture locale (cf. les effets de chargement des stores).
    const rawSessions = JSON.parse(sim.disk.get(SESSIONS_KEY) ?? "[]") as TrainingSession[];
    app.sessions = rawSessions.map((s) => ({ ...s, date: new Date(s.date) }));
    const rawAppointments = JSON.parse(sim.disk.get(APPOINTMENTS_KEY) ?? "[]") as Appointment[];
    app.appointments = rawAppointments.map((a) => ({
      ...a,
      date: new Date(a.date),
      endDate: a.endDate ? new Date(a.endDate) : null,
      nextDueDate: a.nextDueDate ? new Date(a.nextDueDate) : null,
    }));
    // Reprise des envois en attente dès le démarrage (cf. app/_layout.tsx).
    void app.cloud.retryPendingWrites().catch(() => {});
    return app;
  }

  private saveSessions() {
    sim.disk.set(SESSIONS_KEY, JSON.stringify(this.sessions));
  }

  private saveAppointments() {
    sim.disk.set(APPOINTMENTS_KEY, JSON.stringify(this.appointments));
  }

  addSession(s: TrainingSession) {
    this.sessions = [...this.sessions, s];
    this.saveSessions();
    this.cloud.pushTrainingSession(s).catch(() => {});
  }

  updateSession(s: TrainingSession) {
    this.sessions = this.sessions.map((x) => (x.id === s.id ? s : x));
    this.saveSessions();
    this.cloud.pushTrainingSession(s).catch(() => {});
  }

  /** Reprise de la file, comme au retour de l'app au premier plan (cf. app/_layout.tsx). */
  retry() {
    return this.cloud.retryPendingWrites();
  }

  deleteSession(id: string) {
    this.sessions = this.sessions.filter((s) => s.id !== id);
    this.saveSessions();
    this.cloud.deleteTrainingSessionRemote(id).catch(() => {});
  }

  addAppointment(a: Appointment) {
    // Épreuves nettoyées comme par le formulaire (cf. useAppointmentForm).
    a = { ...a, competitionEntries: a.competitionEntries.flatMap((e) => cleanCompetitionEntry(e) ?? []) };
    this.appointments = [...this.appointments, a];
    this.saveAppointments();
    this.cloud.pushAppointmentWithEntries(a).catch(() => {});
  }

  updateAppointment(id: string, patch: Partial<Appointment>) {
    this.appointments = this.appointments.map((a) => (a.id === id ? { ...a, ...patch } : a));
    this.saveAppointments();
    const updated = this.appointments.find((a) => a.id === id);
    if (updated) this.cloud.pushAppointment(updated).catch(() => {});
  }

  addCompetitionEntry(apptId: string, input: CompetitionEntry) {
    const e = cleanCompetitionEntry(input);
    if (!e) return;
    this.appointments = this.appointments.map((a) =>
      a.id === apptId ? { ...a, competitionEntries: [...a.competitionEntries, e] } : a
    );
    this.saveAppointments();
    this.cloud.pushCompetitionEntry(apptId, e).catch(() => {});
  }

  updateCompetitionEntry(apptId: string, entryId: string, patch: Partial<Omit<CompetitionEntry, "id">>) {
    let next: CompetitionEntry | null = null;
    this.appointments = this.appointments.map((a) =>
      a.id !== apptId
        ? a
        : {
            ...a,
            competitionEntries: a.competitionEntries.map((e) =>
              e.id === entryId ? ((next = cleanCompetitionEntry({ ...e, ...patch })) ?? e) : e
            ),
          }
    );
    this.saveAppointments();
    if (next) this.cloud.pushCompetitionEntry(apptId, next).catch(() => {});
  }

  deleteCompetitionEntry(apptId: string, entryId: string) {
    this.appointments = this.appointments.map((a) =>
      a.id === apptId ? { ...a, competitionEntries: a.competitionEntries.filter((e) => e.id !== entryId) } : a
    );
    this.saveAppointments();
    this.cloud.deleteCompetitionEntryRemote(apptId, entryId).catch(() => {});
  }

  /** Relecture du serveur + fusion, comme au lancement (cf. lib/cloudRefresh.tsx
   * `run`, sessions/store.tsx et agenda/store.tsx `mergeFromCloud`). */
  async refresh() {
    const { cloud, index, queue, merge } = this;
    await Promise.all([index.loadRemoteIndex(), queue.ensureSyncQueueLoaded()]);
    await cloud.retryPendingWrites().catch(() => {});
    await cloud.resendUnconfirmedDeletes().catch(() => {});
    const pullStartedAt = Date.now();
    const [remoteAppointments, remoteSessions] = await Promise.all([cloud.pullAppointments(), cloud.pullTrainingSessions()]);
    index.noteServerHorses([HORSE]);

    if (remoteSessions) {
      const guard = index.syncGuard("training_sessions", pullStartedAt, queue.pendingIdsFor("training_sessions"));
      const unsynced = new Set(merge.unsyncedLocalIds(this.sessions, remoteSessions, guard, (s) => index.isHorseOnServer(s.horseId)));
      this.sessions = merge.mergeRemote(this.sessions, remoteSessions, guard).items;
      index.noteRemoteSnapshot("training_sessions", remoteSessions.map((s) => s.id), pullStartedAt);
      for (const s of this.sessions) if (unsynced.has(s.id)) cloud.pushTrainingSession(s).catch(() => {});
      this.saveSessions();
    }

    if (remoteAppointments) {
      const guard = index.syncGuard("appointments", pullStartedAt, queue.pendingIdsFor("appointments"));
      const preserve = (l: Appointment, r: Appointment): Appointment => ({
        ...r,
        reminderNotificationId: l.reminderNotificationId,
        emailReminderId: l.emailReminderId,
        nextDueNotificationId: l.nextDueNotificationId,
      });
      const unsynced = merge.unsyncedLocalIds(this.appointments, remoteAppointments, guard, (a) => index.isHorseOnServer(a.horseId));
      for (const id of unsynced) {
        const appt = this.appointments.find((a) => a.id === id);
        if (appt) cloud.pushAppointmentWithEntries(appt).catch(() => {});
      }
      this.appointments = merge.mergeRemote(this.appointments, remoteAppointments, guard, preserve).items;
      index.noteRemoteSnapshot("appointments", remoteAppointments.map((a) => a.id), pullStartedAt);
      this.saveAppointments();
    }
    await settle();
  }

  session(id: string) {
    return this.sessions.find((s) => s.id === id);
  }

  appointment(id: string) {
    return this.appointments.find((a) => a.id === id);
  }
}

/** Ferme l'app (rien d'autre que le disque et le serveur ne survit) et la relance. */
async function quitAndRelaunch(): Promise<App> {
  vi.clearAllTimers();
  vi.resetModules();
  const app = await App.launch();
  await settle();
  // Relecture au lancement (cf. lib/cloudRefresh.tsx, STARTUP_DELAY_MS).
  await app.refresh();
  return app;
}

/** Ce qu'un autre appareil (ou la demi-pension) relirait du serveur. */
async function serverSessions(): Promise<TrainingSession[]> {
  const { pullTrainingSessions } = await import("@/lib/cloudSync");
  return (await pullTrainingSessions()) ?? [];
}

async function serverAppointments(): Promise<Appointment[]> {
  const { pullAppointments } = await import("@/lib/cloudSync");
  return (await pullAppointments()) ?? [];
}

/** Jour affiché par le Planning (cf. planning.tsx, regroupement par toDateString). */
const day = (d: Date | null | undefined) => d?.toDateString();

beforeEach(() => {
  sim.disk.clear();
  sim.tables.clear();
  sim.plans.length = 0;
  sim.writes.length = 0;
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("séance créée pour une date précise, app fermée tout de suite", () => {
  // 3 octobre choisi dans le calendrier : minuit heure locale (cf. DatePickerField).
  const chosen = new Date(2026, 9, 3);

  it("envoi confirmé juste avant la fermeture : même jour, même instant après relancement", async () => {
    const app = await App.launch();
    app.addSession(session("s1", chosen));
    await settle(); // le serveur a répondu ; la sauvegarde différée du registre n'a pas eu lieu
    const relaunched = await quitAndRelaunch();

    expect(relaunched.session("s1")).toBeDefined();
    expect(relaunched.session("s1")!.date.getTime()).toBe(chosen.getTime());
    expect(day(relaunched.session("s1")!.date)).toBe("Sat Oct 03 2026");
    // Et pour tout autre appareil.
    expect((await serverSessions()).find((s) => s.id === "s1")!.date.getTime()).toBe(chosen.getTime());
  });

  it("app fermée pendant l'envoi (requête jamais arrivée) : gardée, renvoyée, bonne date partout", async () => {
    const app = await App.launch();
    plan("training_sessions", "lost");
    app.addSession(session("s1", chosen));
    await settle();
    const relaunched = await quitAndRelaunch();

    expect(relaunched.session("s1")!.date.getTime()).toBe(chosen.getTime());
    expect((await serverSessions()).find((s) => s.id === "s1")!.date.getTime()).toBe(chosen.getTime());
  });

  it("requête appliquée mais réponse jamais reçue : bonne date après relancement", async () => {
    const app = await App.launch();
    plan("training_sessions", "applied-no-reply");
    app.addSession(session("s1", chosen));
    await settle();
    const relaunched = await quitAndRelaunch();

    expect(relaunched.session("s1")!.date.getTime()).toBe(chosen.getTime());
    expect(day(relaunched.session("s1")!.date)).toBe("Sat Oct 03 2026");
  });

  it("aucune dérive au fil des relancements et des modifications", async () => {
    let app = await App.launch();
    app.addSession(session("s1", chosen));
    await settle();
    for (let i = 0; i < 3; i++) {
      app = await quitAndRelaunch();
      // Cocher « faite » renvoie la séance telle qu'elle est en mémoire.
      app.updateSession({ ...app.session("s1")!, completed: !app.session("s1")!.completed });
      await settle();
    }
    app = await quitAndRelaunch();
    expect(app.session("s1")!.date.getTime()).toBe(chosen.getTime());
    expect((await serverSessions())[0].date.getTime()).toBe(chosen.getTime());
  });

  it("dates proches du changement d'heure, et saisie tardive du jour même", async () => {
    const dates = [
      new Date(2026, 9, 25), // jour du passage à l'heure d'hiver
      new Date(2026, 9, 26), // heure d'hiver (UTC+1)
      new Date(2027, 2, 28), // passage à l'heure d'été
      new Date(2026, 9, 2, 23, 47, 12, 345), // « aujourd'hui » par défaut, saisi à 23 h 47
      new Date(2026, 9, 3, 0, 30, 0, 0), // juste après minuit
    ];
    const app = await App.launch();
    dates.forEach((d, i) => app.addSession(session(`d${i}`, d)));
    await settle();
    const relaunched = await quitAndRelaunch();
    dates.forEach((d, i) => {
      expect(relaunched.session(`d${i}`)!.date.getTime()).toBe(d.getTime());
      expect(day(relaunched.session(`d${i}`)!.date)).toBe(day(d));
    });
  });
});

describe("données déjà décalées par l'ancienne version", () => {
  it("une séance juste sur le serveur mais décalée sur le téléphone est réparée au lancement", async () => {
    const chosen = new Date(2026, 9, 3);
    // Serveur : la valeur écrite à la création, correcte.
    sim.tables.set("training_sessions", new Map([["s1", { ...session("s1", chosen), date: "2026-10-02T22:00:00", activityType: "DRESSAGE" }]]));
    // Téléphone : la même séance, relue en heure locale par l'ancienne version (veille à 22 h).
    const shifted = new Date(2026, 9, 2, 22, 0, 0, 0);
    sim.disk.set(SESSIONS_KEY, JSON.stringify([session("s1", shifted)]));
    sim.disk.set("remote_index_v1", JSON.stringify({ known: { "training_sessions\u0000s1": 1 }, tombstones: {} }));
    const app = await quitAndRelaunch();
    expect(app.session("s1")!.date.getTime()).toBe(chosen.getTime());
    expect(day(app.session("s1")!.date)).toBe("Sat Oct 03 2026");
  });
});

describe("séance existante modifiée, app fermée tout de suite", () => {
  const before = new Date(2026, 9, 3);
  const after = new Date(2026, 9, 4); // déplacée au lendemain

  async function existing(): Promise<App> {
    const app = await App.launch();
    app.addSession(session("s1", before));
    await settle();
    return quitAndRelaunch();
  }

  it("déplacée au lendemain, envoi confirmé : reste au lendemain", async () => {
    const app = await existing();
    app.updateSession({ ...app.session("s1")!, date: after });
    await settle();
    const relaunched = await quitAndRelaunch();
    expect(day(relaunched.session("s1")!.date)).toBe("Sun Oct 04 2026");
    expect(relaunched.session("s1")!.date.getTime()).toBe(after.getTime());
  });

  it("déplacée au lendemain, app fermée pendant l'envoi : reste au lendemain, le serveur suit", async () => {
    const app = await existing();
    plan("training_sessions", "lost");
    app.updateSession({ ...app.session("s1")!, date: after });
    await settle();
    const relaunched = await quitAndRelaunch();
    expect(relaunched.session("s1")!.date.getTime()).toBe(after.getTime());
    expect((await serverSessions())[0].date.getTime()).toBe(after.getTime());
  });

  it("une version plus ancienne en attente de réseau n'écrase pas la dernière modification", async () => {
    const app = await existing();
    // 1re modification sans réseau : mise en file de reprise.
    plan("training_sessions", "offline");
    app.updateSession({ ...app.session("s1")!, notes: "v1" });
    await settle();
    // 2e modification : l'app est fermée pendant son envoi.
    plan("training_sessions", "lost");
    app.updateSession({ ...app.session("s1")!, notes: "v2", date: after });
    await settle();
    sim.writes.length = 0;
    const relaunched = await quitAndRelaunch();
    // La version périmée n'est jamais renvoyée — pas même un instant, qu'une
    // demi-pension aurait vu.
    expect(sim.writes.map((w) => w.row?.notes)).toEqual(["v2"]);
    expect(relaunched.session("s1")!.notes).toBe("v2");
    expect(relaunched.session("s1")!.date.getTime()).toBe(after.getTime());
    const server = (await serverSessions())[0];
    expect(server.notes).toBe("v2");
    expect(server.date.getTime()).toBe(after.getTime());
  });
});

describe("modifications rapprochées et suppressions", () => {
  const chosen = new Date(2026, 9, 3);

  it("deux modifications d'affilée sur un réseau lent : la dernière reste, au serveur comme à l'écran", async () => {
    let app = await App.launch();
    app.addSession(session("s1", chosen));
    await settle();
    app = await quitAndRelaunch();
    // La 1re réponse arrive après que la 2e modification est partie.
    plan("training_sessions", "slow");
    app.updateSession({ ...app.session("s1")!, completed: true });
    app.updateSession({ ...app.session("s1")!, completed: false, notes: "annulé" });
    await settle();
    expect((await serverSessions())[0].notes).toBe("annulé");
    const relaunched = await quitAndRelaunch();
    expect(relaunched.session("s1")!.notes).toBe("annulé");
    expect(relaunched.session("s1")!.completed).toBe(false);
  });

  it("modifiée pendant la reprise d'une ancienne version, app fermée une seconde après : la modification tient", async () => {
    let app = await App.launch();
    app.addSession(session("s1", chosen));
    await settle();
    app = await quitAndRelaunch();
    plan("training_sessions", "offline");
    app.updateSession({ ...app.session("s1")!, notes: "v1" });
    await settle();
    // Retour du réseau : la reprise de v1 est partie (réponse lente)…
    plan("training_sessions", "slow", "lost");
    void app.retry();
    while (sim.plans.some((p) => p.mode === "slow")) await new Promise((resolve) => setImmediate(resolve));
    // …quand la séance est déplacée ; son envoi, lui, n'aboutira pas.
    const moved = new Date(2026, 9, 9);
    app.updateSession({ ...app.session("s1")!, notes: "v2", date: moved });
    await settle();
    vi.advanceTimersByTime(1000); // l'app reste ouverte une seconde : sauvegardes différées écrites
    await settle();
    const relaunched = await quitAndRelaunch();
    expect(relaunched.session("s1")!.notes).toBe("v2");
    expect(relaunched.session("s1")!.date.getTime()).toBe(moved.getTime());
    expect((await serverSessions())[0].notes).toBe("v2");
  });

  it("reprise de la file lancée pendant l'envoi d'une modification plus récente : l'ancienne version ne passe pas après", async () => {
    let app = await App.launch();
    app.addSession(session("s1", chosen));
    await settle();
    app = await quitAndRelaunch();
    plan("training_sessions", "offline");
    app.updateSession({ ...app.session("s1")!, notes: "v1" });
    await settle();
    // Le réseau revient : la modification suivante part (réponse lente)…
    plan("training_sessions", "slow");
    app.updateSession({ ...app.session("s1")!, notes: "v2" });
    // …et l'app revient au premier plan pendant ce temps : reprise de la file.
    await app.retry();
    await settle();
    expect((await serverSessions())[0].notes).toBe("v2");
    vi.advanceTimersByTime(1000);
    await settle();
    const relaunched = await quitAndRelaunch();
    expect(relaunched.session("s1")!.notes).toBe("v2");
  });

  it("séance supprimée puis app fermée pendant l'envoi : ne revient pas", async () => {
    let app = await App.launch();
    app.addSession(session("s1", chosen));
    await settle();
    app = await quitAndRelaunch();
    plan("training_sessions", "lost");
    app.deleteSession("s1");
    await settle();
    const relaunched = await quitAndRelaunch();
    expect(relaunched.session("s1")).toBeUndefined();
    expect(await serverSessions()).toEqual([]);
  });

  it("supprimée alors qu'une ancienne version attendait le réseau : pas ressuscitée", async () => {
    let app = await App.launch();
    app.addSession(session("s1", chosen));
    await settle();
    app = await quitAndRelaunch();
    plan("training_sessions", "offline");
    app.updateSession({ ...app.session("s1")!, notes: "hors ligne" });
    await settle();
    plan("training_sessions", "lost");
    app.deleteSession("s1");
    await settle();
    sim.writes.length = 0;
    const relaunched = await quitAndRelaunch();
    expect(relaunched.session("s1")).toBeUndefined();
    expect(await serverSessions()).toEqual([]);
    // L'ancienne version n'est pas renvoyée avant la suppression.
    expect(sim.writes.filter((w) => w.row !== null)).toEqual([]);
  });
});

describe("rendez-vous", () => {
  const chosen = new Date(2026, 9, 12);

  it("créé puis app fermée : existe au bon jour, rappel de prochaine échéance compris", async () => {
    const nextDue = new Date(2027, 3, 12);
    const app = await App.launch();
    app.addAppointment(appointment("a1", chosen, { nextDueDate: nextDue }));
    await settle();
    const relaunched = await quitAndRelaunch();
    expect(relaunched.appointment("a1")!.date.getTime()).toBe(chosen.getTime());
    expect(relaunched.appointment("a1")!.nextDueDate!.getTime()).toBe(nextDue.getTime());
  });

  it("modifié (nouvelle date) puis app fermée pendant l'envoi : la modification tient", async () => {
    let app = await App.launch();
    app.addAppointment(appointment("a1", chosen));
    await settle();
    app = await quitAndRelaunch();
    plan("appointments", "lost");
    app.updateAppointment("a1", { date: new Date(2026, 9, 14), title: "Rappel vaccin" });
    await settle();
    const relaunched = await quitAndRelaunch();
    expect(day(relaunched.appointment("a1")!.date)).toBe("Wed Oct 14 2026");
    expect(relaunched.appointment("a1")!.title).toBe("Rappel vaccin");
    expect(day((await serverAppointments())[0].date)).toBe("Wed Oct 14 2026");
  });
});

describe("concours", () => {
  const first = new Date(2026, 9, 15);
  const last = new Date(2026, 9, 18);

  it("créé avec ses épreuves, app fermée pendant l'envoi des épreuves : rien ne manque", async () => {
    const app = await App.launch();
    // La 1re épreuve part et l'app est fermée avant la réponse ; la 2e attendait
    // son tour derrière elle (cf. remoteIndex.serializeWrite).
    plan("competition_entries", "lost");
    app.addAppointment(
      appointment("c1", first, {
        type: "concours",
        title: "CSI Fontainebleau",
        competitionLevel: "international",
        endDate: last,
        competitionEntries: [entry("e1", "Grand Prix"), entry("e2", "Vitesse")],
      })
    );
    await settle();
    const relaunched = await quitAndRelaunch();
    const c1 = relaunched.appointment("c1")!;
    expect(c1.date.getTime()).toBe(first.getTime());
    expect(c1.endDate!.getTime()).toBe(last.getTime());
    expect(c1.competitionEntries.map((e) => e.id).sort()).toEqual(["e1", "e2"]);
    const server = (await serverAppointments())[0];
    expect(server.competitionEntries.map((e) => e.id).sort()).toEqual(["e1", "e2"]);
    expect(server.endDate!.getTime()).toBe(last.getTime());
  });

  it("enregistré normalement : rien n'est renvoyé au relancement", async () => {
    const app = await App.launch();
    app.addAppointment(
      appointment("c1", first, { type: "concours", competitionEntries: [entry("e1", "Grand Prix"), entry("e2", "Vitesse")] })
    );
    await settle();
    vi.advanceTimersByTime(1000); // l'app reste ouverte : sauvegardes différées écrites
    await settle();
    sim.writes.length = 0;
    const relaunched = await quitAndRelaunch();
    expect(relaunched.appointment("c1")!.competitionEntries).toHaveLength(2);
    expect(sim.writes).toEqual([]);
  });

  describe("épreuve sans heure de passage", () => {
    const serverEntry = (id: string) => sim.tables.get("competition_entries")?.get(id);

    it("créée avec le concours sans heure : enregistrée telle quelle, aucune heure inventée", async () => {
      const app = await App.launch();
      app.addAppointment(
        appointment("c1", first, {
          type: "concours",
          competitionEntries: [entry("e1", "Grand Prix 1m30", null, ""), entry("e2", "Vitesse", null, "  ")],
        })
      );
      await settle();
      const relaunched = await quitAndRelaunch();
      const c1 = relaunched.appointment("c1")!;
      expect(c1.date.getTime()).toBe(first.getTime());
      expect(c1.competitionEntries.map((e) => [e.id, e.time])).toEqual([
        ["e1", ""],
        ["e2", ""],
      ]);
      // Côté serveur : une heure vide (colonne NOT NULL), ni null ni « 00:00 ».
      expect(serverEntry("e1")!.time).toBe("");
      expect(serverEntry("e2")!.time).toBe("");
    });

    it("ajoutée depuis la carte sans heure : enregistrée", async () => {
      let app = await App.launch();
      app.addAppointment(appointment("c1", first, { type: "concours" }));
      await settle();
      app = await quitAndRelaunch();
      app.addCompetitionEntry("c1", entry("e1", "Club 2", null, ""));
      await settle();
      const relaunched = await quitAndRelaunch();
      expect(relaunched.appointment("c1")!.competitionEntries.map((e) => [e.name, e.time])).toEqual([["Club 2", ""]]);
      expect(serverEntry("e1")!.time).toBe("");
    });

    it("heure ajoutée plus tard, app fermée pendant l'envoi : l'heure tient, à l'écran comme au serveur", async () => {
      let app = await App.launch();
      app.addAppointment(appointment("c1", first, { type: "concours", competitionEntries: [entry("e1", "GP", null, "")] }));
      await settle();
      app = await quitAndRelaunch();
      plan("competition_entries", "lost");
      app.updateCompetitionEntry("c1", "e1", { time: "14h30" });
      await settle();
      const relaunched = await quitAndRelaunch();
      expect(relaunched.appointment("c1")!.competitionEntries[0].time).toBe("14h30");
      expect(serverEntry("e1")!.time).toBe("14h30");
      expect(relaunched.appointment("c1")!.date.getTime()).toBe(first.getTime());
    });

    it("compléter l'heure d'une épreuve ne change pas l'ordre des épreuves", async () => {
      let app = await App.launch();
      app.addAppointment(
        appointment("c1", first, {
          type: "concours",
          competitionEntries: [entry("e1", "Club 1", null, ""), entry("e2", "Club 2"), entry("e3", "Club 3", null, "")],
        })
      );
      await settle();
      app = await quitAndRelaunch();
      app.updateCompetitionEntry("c1", "e1", { time: "08h00" });
      app.updateCompetitionEntry("c1", "e3", { time: "15h00" });
      await settle();
      vi.advanceTimersByTime(1000); // envois confirmés et notés : rien à renvoyer au relancement
      await settle();
      const relaunched = await quitAndRelaunch();
      expect(relaunched.appointment("c1")!.competitionEntries.map((e) => e.id)).toEqual(["e1", "e2", "e3"]);
      expect((await serverAppointments())[0].competitionEntries.map((e) => e.id)).toEqual(["e1", "e2", "e3"]);
    });

    it("le nom reste obligatoire : l'effacer ne vide pas l'épreuve", async () => {
      let app = await App.launch();
      app.addAppointment(appointment("c1", first, { type: "concours", competitionEntries: [entry("e1", "GP", null, "")] }));
      await settle();
      app = await quitAndRelaunch();
      app.updateCompetitionEntry("c1", "e1", { name: "   " });
      app.addCompetitionEntry("c1", entry("e2", "", null, "09h00"));
      await settle();
      const relaunched = await quitAndRelaunch();
      expect(relaunched.appointment("c1")!.competitionEntries.map((e) => e.name)).toEqual(["GP"]);
      expect(serverEntry("e1")!.name).toBe("GP");
    });
  });

  async function existingConcours(): Promise<App> {
    const app = await App.launch();
    app.addAppointment(
      appointment("c1", first, {
        type: "concours",
        competitionLevel: "international",
        endDate: last,
        competitionEntries: [entry("e1", "Grand Prix"), entry("e2", "Vitesse")],
      })
    );
    await settle();
    return quitAndRelaunch();
  }

  it("épreuve ajoutée puis app fermée pendant l'envoi : toujours là", async () => {
    const app = await existingConcours();
    plan("competition_entries", "lost");
    app.addCompetitionEntry("c1", entry("e3", "Six barres"));
    await settle();
    const relaunched = await quitAndRelaunch();
    expect(relaunched.appointment("c1")!.competitionEntries.map((e) => e.id).sort()).toEqual(["e1", "e2", "e3"]);
    expect((await serverAppointments())[0].competitionEntries).toHaveLength(3);
  });

  it("résultat saisi puis app fermée pendant l'envoi : gardé", async () => {
    const app = await existingConcours();
    plan("competition_entries", "lost");
    app.updateCompetitionEntry("c1", "e1", { result: "2e" });
    await settle();
    const relaunched = await quitAndRelaunch();
    expect(relaunched.appointment("c1")!.competitionEntries.find((e) => e.id === "e1")!.result).toBe("2e");
    expect((await serverAppointments())[0].competitionEntries.find((e) => e.id === "e1")!.result).toBe("2e");
  });

  it("épreuve supprimée puis app fermée pendant l'envoi : ne revient pas", async () => {
    const app = await existingConcours();
    plan("competition_entries", "lost");
    app.deleteCompetitionEntry("c1", "e2");
    await settle();
    const relaunched = await quitAndRelaunch();
    expect(relaunched.appointment("c1")!.competitionEntries.map((e) => e.id)).toEqual(["e1"]);
    expect((await serverAppointments())[0].competitionEntries.map((e) => e.id)).toEqual(["e1"]);
  });
});
