import { Alert, Platform } from "react-native";
import * as Calendar from "expo-calendar/legacy";
import { runNativeInteraction } from "@/lib/nativeInteraction";
import { track } from "@/lib/analytics";
import { toCalendarEvent, type CalendarSource } from "@/agenda/calendarEvent";
import { t } from "@/i18n";

/**
 * Ouvre la fiche « Nouvel événement » du système, préremplie : le cavalier
 * choisit son calendrier, ajuste l'heure de fin, puis valide. Rien n'est
 * écrit sans lui.
 *
 * Aucune autorisation sur iOS 17 et plus : la fiche est une interface
 * d'Apple, l'app ne lit ni n'écrit le calendrier elle-même. Avant iOS 17,
 * iOS exige l'accès au calendrier pour cette même fiche : on le demande
 * alors, au moment du geste. Sur Android, c'est l'app Agenda qui s'ouvre.
 */
export async function addToCalendar(src: CalendarSource): Promise<void> {
  try {
    const iosMajor = Platform.OS === "ios" ? parseInt(String(Platform.Version), 10) : 0;
    if (Platform.OS === "ios" && iosMajor < 17) {
      const { granted } = await Calendar.requestCalendarPermissionsAsync();
      if (!granted) {
        Alert.alert(
          t("Accès au calendrier refusé"),
          t("Autorise Horsetrack dans Réglages → Confidentialité → Calendriers pour ajouter ce rendez-vous.")
        );
        return;
      }
    }
    const event = toCalendarEvent(src, Platform.OS === "android" ? "android" : "ios");
    const result = await runNativeInteraction(() =>
      Calendar.createEventInCalendarAsync(
        {
          title: event.title,
          startDate: event.startDate,
          endDate: event.endDate,
          allDay: event.allDay,
          location: event.location || undefined,
          notes: event.notes,
        },
        { startNewActivityTask: false }
      )
    );
    track("calendar_event_added", { action: result.action, all_day: event.allDay });
  } catch (e) {
    console.warn("[calendar] ajout impossible", e);
    Alert.alert(t("Ajout impossible"), t("Le calendrier n'a pas pu s'ouvrir. Réessaie dans un instant."));
  }
}
