export type SessionTemplate = {
  dayOffset: number; // 0 = Lundi ... 6 = Dimanche
  time: string;
  title: string;
  durationMin: number;
  focus: string;
  exercises: string[];
};

export type PlannedSession = {
  id: string;
  date: Date;
  dayIndex: number;
  time: string;
  title: string;
  durationMin: number;
  focus: string;
  exercises: string[];
};

export type ProgramWeek = {
  weekNumber: number;
  sessions: PlannedSession[];
};

// --- Programme mock (à brancher sur l'API plus tard) ---
export const PROGRAM = {
  title: "Préparation Concours CSO",
  theme: "Précision, équilibre & confiance avant les premiers concours.",
  totalWeeks: 8,
};

// Les 4 séances type se répètent chaque semaine, cohérent avec sessionsPerWeek de Today
export const SESSION_TEMPLATES: SessionTemplate[] = [
  {
    dayOffset: 0,
    time: "17h00",
    title: "Dressage — transitions",
    durationMin: 45,
    focus: "Engagement & rectitude",
    exercises: [
      "Échauffement 10 min au pas/trot",
      "Transitions trot-galop x8",
      "Travail sur le cercle, incurvation",
      "Retour au calme au pas",
    ],
  },
  {
    dayOffset: 2,
    time: "18h30",
    title: "Obstacle — barres au sol",
    durationMin: 40,
    focus: "Précision & équilibre",
    exercises: [
      "Échauffement avec barres au sol",
      "Ligne de 3 barres, distances variées",
      "Petits sauts à 60 cm",
      "Travail sans étriers",
    ],
  },
  {
    dayOffset: 4,
    time: "17h30",
    title: "Sortie extérieure",
    durationMin: 60,
    focus: "Endurance & mental",
    exercises: [
      "Marche en extérieur 15 min",
      "Trot enlevé sur terrain plat",
      "Galop sur ligne droite sécurisée",
      "Retour au pas, étirements",
    ],
  },
  {
    dayOffset: 5,
    time: "10h00",
    title: "Dressage — assouplissements",
    durationMin: 50,
    focus: "Souplesse & écoute",
    exercises: [
      "Étirements à pied",
      "Épaule en dedans au pas",
      "Appuyers au trot",
      "Reculer et immobilité",
    ],
  },
];

export const WEEK_DAYS_SHORT = ["L", "M", "M", "J", "V", "S", "D"];
export const WEEK_DAYS_FULL = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function getMondayOfCurrentWeek(): Date {
  const today = new Date();
  const idx = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - idx);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// "Aujourd'hui" tombe dans cette semaine du programme — les semaines précédentes
// sont donc déjà passées (mock plus réaliste qu'un programme qui démarre toujours à S1).
export const CURRENT_WEEK_NUMBER = 3;
const CURRENT_MONDAY = getMondayOfCurrentWeek();

export function getWeekMonday(weekNumber: number): Date {
  const d = new Date(CURRENT_MONDAY);
  d.setDate(d.getDate() + (weekNumber - CURRENT_WEEK_NUMBER) * 7);
  return d;
}

export function getWeekDates(weekNumber: number): Date[] {
  const monday = getWeekMonday(weekNumber);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function generateWeekSessions(weekNumber: number): PlannedSession[] {
  const monday = getWeekMonday(weekNumber);
  return SESSION_TEMPLATES.map((tpl, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + tpl.dayOffset);
    return {
      id: `w${weekNumber}-s${i}`,
      date,
      dayIndex: tpl.dayOffset,
      time: tpl.time,
      title: tpl.title,
      durationMin: tpl.durationMin,
      focus: tpl.focus,
      exercises: tpl.exercises,
    };
  });
}

export const PROGRAM_WEEKS: ProgramWeek[] = Array.from({ length: PROGRAM.totalWeeks }, (_, i) => {
  const weekNumber = i + 1;
  return { weekNumber, sessions: generateWeekSessions(weekNumber) };
});
export const ALL_SESSIONS = PROGRAM_WEEKS.flatMap((w) => w.sessions);

export function isSameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatDuration(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m}`;
}

/** Semaine en cours (celle qui contient la date d'aujourd'hui). */
export function getCurrentWeek(): ProgramWeek | undefined {
  return PROGRAM_WEEKS.find((w) => w.weekNumber === CURRENT_WEEK_NUMBER);
}
