import { t } from "@/i18n";

/**
 * Message d'un échec d'achat, selon la cause réelle (codes RevenueCat,
 * PURCHASES_ERROR_CODE). Avant, tout échec disait « Vérifie ta connexion » :
 * faux pour un paiement refusé, un « Demander à acheter » en attente ou un
 * abonnement déjà lié à un autre compte, et sans issue pour l'utilisateur.
 *
 * `action` : ce que l'écran propose en plus d'« OK » — `restore` renvoie vers
 * « Restaurer mes achats », `none` n'ajoute rien. `null` : rien à afficher
 * (achat annulé par l'utilisateur lui-même).
 */
export type PurchaseFailure = { title: string; message: string; action: "none" | "restore" };

export function purchaseFailure(error: unknown): PurchaseFailure | null {
  const e = (error ?? {}) as { userCancelled?: boolean; code?: string | number };
  if (e.userCancelled) return null;
  switch (String(e.code ?? "")) {
    case "1": // PURCHASE_CANCELLED_ERROR
      return null;
    case "20": // PAYMENT_PENDING_ERROR (Demander à acheter, contrôle parental…)
      return {
        title: t("Achat en attente"),
        message: t("Ton achat attend une approbation (Demander à acheter ou paiement en cours). Tu retrouveras Premium dès qu'elle est donnée, sans rien refaire."),
        action: "none",
      };
    case "3": // PURCHASE_NOT_ALLOWED_ERROR
    case "4": // PURCHASE_INVALID_ERROR
      return {
        title: t("Paiement refusé"),
        message: t("L'achat n'a pas pu aboutir : vérifie ton moyen de paiement dans Réglages > ton nom > Moyens de paiement, ou que les achats sont autorisés sur cet appareil. Tu n'as pas été débité."),
        action: "none",
      };
    case "6": // PRODUCT_ALREADY_PURCHASED_ERROR
      return {
        title: t("Tu es déjà abonné"),
        message: t("Cet abonnement est déjà actif sur ton compte Apple. Touche « Restaurer mes achats » pour le retrouver, sans repayer."),
        action: "restore",
      };
    case "7": // RECEIPT_ALREADY_IN_USE_ERROR
      return {
        title: t("Abonnement déjà utilisé"),
        message: t("Cet abonnement est déjà lié à un autre compte Horsetrack. Connecte-toi avec ce compte, ou écris-nous depuis Profil > Contacter le support."),
        action: "none",
      };
    case "10": // NETWORK_ERROR
      return {
        title: t("Pas de connexion"),
        message: t("Vérifie ta connexion et réessaie. Si ton paiement est parti, touche « Restaurer mes achats » : tu retrouveras Premium sans repayer."),
        action: "restore",
      };
    case "2": // STORE_PROBLEM_ERROR
      return {
        title: t("La boutique ne répond pas"),
        message: t("L'App Store est temporairement indisponible. Réessaie dans quelques minutes. Si ton paiement est parti, touche « Restaurer mes achats » : tu retrouveras Premium sans repayer."),
        action: "restore",
      };
    case "15": // OPERATION_ALREADY_IN_PROGRESS_ERROR
      return {
        title: t("Achat en cours"),
        message: t("Un achat est déjà en cours. Patiente quelques secondes."),
        action: "none",
      };
    default:
      return {
        title: t("Achat non finalisé"),
        message: t("L'achat n'a pas pu être finalisé. Réessaie dans un instant ; si ça persiste, écris-nous depuis Profil > Contacter le support."),
        action: "none",
      };
  }
}
