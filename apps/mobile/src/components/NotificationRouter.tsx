import { useEffect, useRef, useState } from "react";
import { router, useSegments, type Href } from "expo-router";
import * as Notifications from "expo-notifications";
import { isInternalRoute } from "@/lib/notificationLinks";
import { track } from "@/lib/analytics";

/** Racines de navigation depuis lesquelles on peut ouvrir la destination :
 * l'app est démarrée et l'utilisateur connecté. Pas pendant l'onboarding, la
 * connexion ou un écran de démarrage, qui redirigeraient par-dessus. */
const READY_ROOTS = new Set(["(tabs)", "horse"]);

/**
 * Ouvre l'écran d'une notification touchée (cf. lib/notificationLinks.ts) :
 * la page Santé du cheval pour un rappel de soin, le Planning pour un
 * concours, l'Accueil pour le bilan du dimanche.
 *
 * Deux cas : app déjà ouverte (écouteur), ou lancée PAR la notification
 * (dernière réponse lue au montage). Dans le second, l'écran de démarrage
 * redirige encore vers les onglets : la destination attend donc que l'app
 * y soit arrivée, sans quoi la redirection l'écraserait.
 *
 * Une notification sans destination (programmée avant cette version) ouvre
 * l'app comme avant. Rien n'est suivi en dehors des chemins internes.
 */
export function NotificationRouter() {
  const segments = useSegments();
  /** Destination en attente, numérotée : deux touchers successifs sur le
   * même rappel doivent ouvrir l'écran deux fois. */
  const [pending, setPending] = useState<{ url: string; seq: number } | null>(null);
  const handledSeq = useRef(0);

  useEffect(() => {
    let mounted = true;
    // Au lancement par la notification, la même réponse peut arriver à la
    // fois par la lecture initiale et par l'écouteur : une seule ouverture.
    let lastKey: string | null = null;
    function handle(response: Notifications.NotificationResponse | null) {
      if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const key = `${response.notification.request.identifier}:${response.notification.date}`;
      if (key === lastKey) return;
      lastKey = key;
      const url = response.notification.request.content.data?.url;
      track("notification_opened", { destination: isInternalRoute(url) ? url.split("?")[0] : null });
      if (mounted && isInternalRoute(url)) setPending((prev) => ({ url, seq: (prev?.seq ?? 0) + 1 }));
      // Sans ça, la même réponse serait relue au prochain lancement normal
      // de l'app, qui rouvrirait l'écran d'un rappel ancien.
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    }
    Notifications.getLastNotificationResponseAsync()
      .then(handle)
      .catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const root = segments[0] ?? "";
  const current = `/${segments.join("/")}`;
  useEffect(() => {
    if (!pending || pending.seq === handledSeq.current) return;
    // Déjà sur l'écran visé (« Tout va bien ? » touché pendant la séance en
    // direct) : rien à ouvrir. Sans ça, la destination attendait le retour
    // aux onglets et rouvrait l'écran de séance une fois celle-ci terminée.
    if (pending.url.split("?")[0] === current) {
      handledSeq.current = pending.seq;
      return;
    }
    if (!READY_ROOTS.has(root)) return;
    handledSeq.current = pending.seq;
    // Vers un onglet depuis un écran empilé (fiche cheval) : `push` comme
    // `navigate` empileraient une SECONDE instance des onglets, le crash
    // documenté dans horses/horseHubNavigation.test.ts. Seul `dismissTo`
    // revient sur l'instance existante. Depuis les onglets, `push` vers un
    // autre onglet se résout déjà en simple changement d'onglet.
    if (pending.url.startsWith("/(tabs)") && root !== "(tabs)") router.dismissTo(pending.url as Href);
    else router.push(pending.url as Href);
  }, [pending, root, current]);

  return null;
}
