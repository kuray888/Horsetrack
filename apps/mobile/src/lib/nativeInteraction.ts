/**
 * Marque les moments où l'app laisse la main à un écran du système qu'elle a
 * elle-même déclenché : sélecteur de photos, sélecteur de fichiers, feuille de
 * partage, boîte de dialogue de permission, écran de paiement du store.
 *
 * Pourquoi c'est nécessaire, et seulement sur Android : chacun de ces écrans
 * est une *activité* distincte, qui met la nôtre en pause. React Native
 * traduit cette pause par un passage de l'app en "background"
 * (cf. AppStateModule.onHostPause côté React Native), exactement le même
 * signal que lorsqu'on quitte vraiment l'app. Sur iOS, aucun de ces écrans ne
 * fait passer l'app en arrière-plan — d'où un verrou biométrique
 * (cf. components/BiometricGate.tsx) qui se comporte correctement sur iPhone
 * et redemanderait l'empreinte à CHAQUE ajout de photo sur Android.
 *
 * Le compteur est volontairement un simple entier de module : on ne cherche
 * pas à savoir QUEL écran est ouvert, seulement s'il y en a un. `try/finally`
 * dans `runNativeInteraction` garantit qu'il retombe à zéro même si l'appel
 * échoue ou si l'utilisateur annule — sans quoi le verrou biométrique
 * resterait désactivé pour le reste de la session.
 */
let openInteractions = 0;

/** Vrai tant qu'au moins un écran système déclenché par l'app est ouvert. */
export function isNativeInteractionActive(): boolean {
  return openInteractions > 0;
}

/**
 * Exécute `fn` en signalant que l'app est en train de passer la main à un
 * écran système. Renvoie exactement ce que renvoie `fn`, et laisse passer ses
 * erreurs telles quelles : les appelants gardent leur propre gestion d'erreur.
 */
export async function runNativeInteraction<T>(fn: () => Promise<T>): Promise<T> {
  openInteractions++;
  try {
    return await fn();
  } finally {
    openInteractions--;
  }
}
