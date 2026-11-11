import { describe, expect, it } from "vitest";
import { purchaseFailure } from "./purchaseErrors";

/** Codes RevenueCat (PURCHASES_ERROR_CODE) : chaque échec dit ce qui s'est
 * passé et ce qu'on peut faire, au lieu de « Vérifie ta connexion » partout. */
describe("purchaseFailure", () => {
  it("achat annulé par l'utilisateur : rien à afficher", () => {
    expect(purchaseFailure({ userCancelled: true })).toBeNull();
    expect(purchaseFailure({ code: "1" })).toBeNull();
  });

  it("paiement en attente d'approbation (Demander à acheter) : rassure, ne parle pas d'erreur", () => {
    const f = purchaseFailure({ code: "20" })!;
    expect(f.title).toBe("Achat en attente");
    expect(f.message).toContain("approbation");
    expect(f.action).toBe("none");
  });

  it("moyen de paiement refusé ou achats interdits : renvoie vers les réglages Apple", () => {
    for (const code of ["3", "4"]) {
      const f = purchaseFailure({ code })!;
      expect(f.title).toBe("Paiement refusé");
      expect(f.message).toContain("moyen de paiement");
    }
  });

  it("déjà abonné : propose de restaurer, ne laisse pas repayer", () => {
    const f = purchaseFailure({ code: "6" })!;
    expect(f.title).toBe("Tu es déjà abonné");
    expect(f.action).toBe("restore");
  });

  it("abonnement déjà lié à un autre compte : le dit, avec la voie de sortie", () => {
    const f = purchaseFailure({ code: "7" })!;
    expect(f.title).toBe("Abonnement déjà utilisé");
    expect(f.message).toContain("autre compte");
  });

  it("réseau : message de connexion", () => {
    const f = purchaseFailure({ code: "10" })!;
    expect(f.title).toBe("Pas de connexion");
    expect(f.message).toContain("Vérifie ta connexion");
    // Le débit a pu partir sans réponse : jamais « tu n'as pas été débité ».
    expect(f.message).not.toContain("pas été débité");
    expect(f.action).toBe("restore");
  });

  it("problème côté boutique : ce n'est pas la faute de l'utilisateur, et la voie de sortie est la restauration", () => {
    const f = purchaseFailure({ code: "2" })!;
    expect(f.title).toBe("La boutique ne répond pas");
    expect(f.message).not.toContain("pas été débité");
    expect(f.action).toBe("restore");
  });

  it("achat déjà en cours : patience", () => {
    expect(purchaseFailure({ code: "15" })!.title).toBe("Achat en cours");
  });

  it("cause inconnue : message prudent, sans accuser le réseau", () => {
    const f = purchaseFailure(new Error("boom"))!;
    expect(f.title).toBe("Achat non finalisé");
    expect(f.message).not.toContain("connexion");
    expect(f.message).toContain("support");
  });
});
