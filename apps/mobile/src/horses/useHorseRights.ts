import { useMemo } from "react";
import { useHorses } from "@/horses/store";
import { useCurrentUserId } from "@/lib/currentUser";
import {
  can,
  canCreateAppointment,
  canWriteAppointment,
  canWriteJournal,
  canWriteSession,
  canWriteWeight,
  roleOf,
  type Author,
  type Capability,
  type HorseRole,
} from "@/lib/permissions";

type Owned = { horseId: string | null; createdByUserId?: Author };

/**
 * Droits de l'utilisateur sur chaque cheval de sa liste (cf.
 * lib/permissions.ts) : sert à cacher les actions que la base refuserait.
 * Une ligne sans cheval (ancienne donnée locale) ou d'un cheval absent de la
 * liste appartient à l'utilisateur lui-même.
 */
export function useHorseRights() {
  const { horses } = useHorses();
  const me = useCurrentUserId();
  return useMemo(() => {
    const roleFor = (horseId: string | null | undefined): HorseRole => {
      const horse = horseId ? horses.find((h) => h.id === horseId) : undefined;
      return roleOf(horse?.sharedRole) ?? "OWNER";
    };
    return {
      me,
      roleFor,
      can: (horseId: string | null | undefined, capability: Capability) => can(roleFor(horseId), capability),
      session: (s: Owned) => canWriteSession(roleFor(s.horseId), s.createdByUserId, me),
      appointment: (a: Owned & { type: string }) => canWriteAppointment(roleFor(a.horseId), a.type, a.createdByUserId, me),
      createAppointment: (horseId: string | null | undefined, type: string) => canCreateAppointment(roleFor(horseId), type),
      journal: (j: Owned) => canWriteJournal(roleFor(j.horseId), j.createdByUserId, me),
      weight: (w: Owned) => canWriteWeight(roleFor(w.horseId), w.createdByUserId, me),
      expenses: (horseId: string | null | undefined) => can(roleFor(horseId), "manage_expenses"),
    };
  }, [horses, me]);
}
