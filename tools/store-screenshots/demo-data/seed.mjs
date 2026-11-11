// Données de démonstration pour les captures App Store (compte lealilou).
// Tous les identifiants commencent par demo_store_ ; unseed.mjs les supprime.
import { writeFileSync } from "node:fs";
import { login, rest } from "./sb.mjs";
const F = "hmquurwfvfbuqoy", G = "hmtsrg9ujo325s9"; // Floy De Tus, Gin Tonic De Laume
const naive = (iso) => iso.replace(/\.\d+Z$/, ""); // les dates de la base sont sans fuseau
const day = (ymd) => { const [y, m, d] = ymd.split("-").map(Number); return naive(new Date(y, m - 1, d).toISOString()); };
const now = naive(new Date().toISOString());
let n = 0; const id = (k) => `demo_store_${k}${++n}`;

const sessions = [
  [F, "CSO", "2026-11-10", "17h30", 60, "medium", "Gymnastique sur barres au sol, puis un petit enchaînement.", false],
  [F, "DRESSAGE", "2026-11-11", "18h00", 45, "low", "Pas et trot, transitions et cercles.", false],
  [G, "LONGE", "2026-11-12", "17h00", 30, "low", "Détente à la longe, travail des deux mains.", false],
  [F, "BALADE", "2026-11-13", "16h00", 60, "low", "Sortie en forêt avec Léa.", false],
  [F, "CSO", "2026-11-14", "10h30", 60, "high", "Parcours à 1,10 m.", false],
  [G, "DRESSAGE", "2026-11-15", "11h00", 45, "medium", "Travail latéral, épaule en dedans.", false],
  [F, "CSO", "2026-11-08", "17h00", 60, "medium", "Très en forme, il a sauté avec de la légèreté.", true],
  [F, "DRESSAGE", "2026-11-06", "18h00", 45, "medium", "Bon travail de décontraction.", true],
  [F, "BALADE", "2026-11-03", "16h00", 60, "low", "Balade au pas et au trot, il était détendu.", true],
].map(([horseId, activityType, d, time, durationMinutes, intensity, notes, completed]) => ({
  id: id("s"), horseId, activityType, date: day(d), time, durationMinutes, intensity, notes, completed, updatedAt: now,
}));

const appointments = [
  [F, "VACCINATION", "Rappel vaccin grippe", "2026-11-20", "09h00", "Clinique vétérinaire", "1d"],
  [G, "VERMIFUGE", "Vermifuge", "2026-11-18", "08h00", "Écurie", "1d"],
  [F, "CONCOURS", "Concours à Fontainebleau", "2026-11-21", "09h00", "Fontainebleau", "1d"],
  [F, "DENTISTE", "Contrôle dentaire", "2026-12-08", "14h00", "Écurie", "1w"],
].map(([horseId, type, title, d, time, location, reminder]) => ({
  id: id("a"), horseId, type, title, date: day(d), time, location, notes: "", reminder, updatedAt: now,
}));

const expenses = [
  [F, "PENSION", 450, "2026-11-02", "Pension de novembre", true],
  [F, "ALIMENTATION", 62, "2026-11-07", "Granulés et foin", true],
  [F, "VETO", 85, "2026-11-05", "Visite de contrôle", false],
  [G, "MARECHAL", 95, "2026-11-04", "Ferrure", false],
  [F, "PENSION", 450, "2026-10-03", "Pension d'octobre", true],
  [F, "MARECHAL", 95, "2026-10-12", "Ferrure", true],
  [F, "COACHING", 60, "2026-10-20", "Cours particulier", true],
  [F, "TRANSPORT", 40, "2026-10-28", "Van pour le concours", true],
  [F, "PENSION", 450, "2026-09-02", "Pension de septembre", true],
  [F, "DENTISTE", 70, "2026-09-15", "Soin dentaire", true],
  [F, "COMPLEMENTS", 38, "2026-09-22", "Compléments minéraux", true],
].map(([horseId, category, amount, d, notes, isPaid]) => ({
  id: id("e"), horseId, category, amount, currency: "EUR", date: day(d), notes, isPaid, updatedAt: now,
}));

const journal = [
  [F, "CSO", "GREAT", "2026-11-08", "17h00", "Super séance, il a sauté avec de la légèreté.", `${F}/photo.jpg`],
  [F, "BALADE", "GOOD", "2026-11-03", "16h00", "Belle balade en forêt, il est resté calme et attentif.", `${F}/photo.jpg`],
  [G, "DRESSAGE", "GOOD", "2026-11-01", "11h00", "Progrès nets dans les transitions.", `${G}/photo.jpg`],
].map(([horseId, activityType, mood, d, time, notes, photoPath]) => ({
  id: id("j"), horseId, activityType, mood, date: day(d), time, notes, photoPath, updatedAt: now,
}));

const { token } = await login();
const plan = { training_sessions: sessions, appointments, expenses, journal_entries: journal };
const ids = {};
for (const [table, rows] of Object.entries(plan)) {
  await rest(token, "POST", table, rows);
  ids[table] = rows.map((r) => r.id);
  console.log(table, rows.length, "ajoutées");
}
writeFileSync(new URL("./demo-ids.json", import.meta.url), JSON.stringify(ids, null, 2));
