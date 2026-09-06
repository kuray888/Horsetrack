import { describe, expect, it } from "vitest";
import { isNewPlanningDestination } from "@/planning/planningDestination";

/**
 * Régression : Horse Hub > Entraînement puis Concours (ou l'inverse)
 * affichait parfois encore le formulaire de la visite précédente au lieu de
 * la destination demandée (cf. audit du 2026-09-05, round 4). PlanningScreen
 * utilise `isNewPlanningDestination` pour décider quand fermer les
 * formulaires résiduels (Nouvelle séance / rendez-vous / dépense / journal) —
 * ce test couvre exactement les scénarios A-H de cet audit.
 */
describe("isNewPlanningDestination", () => {
  it("détecte Entraînement -> Concours comme une nouvelle destination", () => {
    expect(isNewPlanningDestination("session", "concours")).toBe(true);
  });

  it("détecte Concours -> Entraînement comme une nouvelle destination", () => {
    expect(isNewPlanningDestination("concours", "session")).toBe(true);
  });

  it("détecte une arrivée depuis un état sans filtre (première visite)", () => {
    expect(isNewPlanningDestination(undefined, "session")).toBe(true);
    expect(isNewPlanningDestination(undefined, "concours")).toBe(true);
  });

  it("alternance répétée : chaque changement de destination est détecté", () => {
    let prev: string | undefined = undefined;
    const sequence = ["session", "concours", "session", "concours"];
    for (const next of sequence) {
      expect(isNewPlanningDestination(prev, next)).toBe(true);
      prev = next;
    }
  });

  it("ne redéclenche PAS pour la même destination répétée", () => {
    expect(isNewPlanningDestination("session", "session")).toBe(false);
    expect(isNewPlanningDestination("concours", "concours")).toBe(false);
  });

  it("ignore un paramètre absent (ex: Quick Add Séance qui ne passe que ?openForm=session) — ne doit pas fermer un formulaire en cours ailleurs", () => {
    expect(isNewPlanningDestination("concours", undefined)).toBe(false);
    expect(isNewPlanningDestination(undefined, undefined)).toBe(false);
  });

  it("ignore un paramètre invalide", () => {
    expect(isNewPlanningDestination("session", "n'importe-quoi")).toBe(false);
  });
});
