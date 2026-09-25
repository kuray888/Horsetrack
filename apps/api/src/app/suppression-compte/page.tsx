import { LegalPage } from "@/components/LegalPage";

/**
 * Page publique de demande de suppression de compte — exigée par Google Play
 * (formulaire « Sécurité des données » : toute app permettant de créer un
 * compte doit fournir, EN PLUS du chemin dans l'app, une URL web accessible
 * sans installer ni rouvrir l'application).
 *
 * Volontairement sans formulaire ni appel d'API : l'endpoint de suppression
 * (DELETE /api/account) exige un jeton de session, qu'une page publique ne
 * peut pas obtenir sans réimplémenter une connexion complète. Une demande par
 * email traitée à la main répond à l'exigence, et reste vérifiable — c'est
 * l'adresse du compte qui fait foi.
 */
export default function SuppressionComptePage() {
  return (
    <LegalPage title="Supprimer son compte Horsetrack" updated="23 septembre 2026">
      <p>
        Vous pouvez supprimer votre compte Horsetrack et toutes les données associées à tout moment, de deux
        façons.
      </p>

      <h2>1. Depuis l&apos;application (immédiat)</h2>
      <p>
        Ouvrez Horsetrack, puis&nbsp;: <strong>Profil → Supprimer mon compte</strong>. La suppression est immédiate
        et irréversible, aucune confirmation par email n&apos;est nécessaire.
      </p>

      <h2>2. Par email (si vous n&apos;avez plus l&apos;application)</h2>
      <p>
        Écrivez à <a href="mailto:horsetrack.app@gmail.com">horsetrack.app@gmail.com</a> depuis{" "}
        <strong>l&apos;adresse email de votre compte Horsetrack</strong>, avec « Suppression de compte » en objet.
        Nous procédons à la suppression sous 30 jours au plus, et vous confirmons par retour d&apos;email.
      </p>
      <p>
        L&apos;envoi depuis l&apos;adresse du compte nous sert de vérification&nbsp;: sans elle, nous ne pouvons pas
        nous assurer que la demande vient bien du titulaire, et nous vous recontacterons avant toute suppression.
      </p>

      <h2>Ce qui est supprimé</h2>
      <p>
        L&apos;intégralité de votre compte et de son contenu&nbsp;: profil cavalier, chevaux, séances
        d&apos;entraînement, rendez-vous, entrées de journal, dépenses, documents du coffre-fort, objectifs, pesées
        et partages de chevaux. La suppression est définitive&nbsp;: ces données ne peuvent pas être restaurées.
      </p>
      <p>
        Aucune donnée n&apos;est conservée après la suppression, hormis ce que la loi nous impose de garder
        (par exemple les justificatifs comptables liés à un abonnement payé, conservés par nos prestataires de
        paiement Apple et Google, et non par Horsetrack).
      </p>

      <h2>Et mon abonnement Premium&nbsp;?</h2>
      <p>
        Supprimer votre compte <strong>n&apos;annule pas</strong> votre abonnement&nbsp;: il est géré par le Play
        Store ou l&apos;App Store, pas par Horsetrack. Annulez-le d&apos;abord depuis les réglages
        d&apos;abonnement de votre compte Google ou Apple, sans quoi il continuerait à être facturé.
      </p>

      <h2>Liens utiles</h2>
      <ul>
        <li>
          <a href="/confidentialite">Politique de Confidentialité</a>
        </li>
        <li>
          <a href="/support">Support</a>
        </li>
      </ul>
    </LegalPage>
  );
}
