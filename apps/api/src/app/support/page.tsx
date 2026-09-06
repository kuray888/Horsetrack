import { LegalPage } from "@/components/LegalPage";

/** Page de support publique requise par Apple/Google (URL de support de la
 * fiche store) — pas de formulaire, juste un point de contact direct. */
export default function SupportPage() {
  return (
    <LegalPage title="Support — Horsetrack" updated="30 juin 2026">
      <p>
        Une question, un bug à signaler, ou besoin d&apos;aide avec l&apos;application Horsetrack&nbsp;? Écrivez-nous
        à <a href="mailto:horsetrack.app@gmail.com">horsetrack.app@gmail.com</a>, nous répondons sous quelques jours
        ouvrés.
      </p>

      <h2>Questions fréquentes</h2>

      <h3>Comment supprimer mon compte ?</h3>
      <p>
        Directement depuis l&apos;application&nbsp;: Profil → Supprimer mon compte. La suppression est immédiate et
        irréversible (profil, chevaux, séances, rendez-vous, journal, dépenses, documents et objectifs).
      </p>

      <h3>Comment gérer ou annuler mon abonnement ?</h3>
      <p>
        Les abonnements sont gérés par l&apos;App Store (iOS) ou le Play Store (Android), pas par Horsetrack
        directement. Rendez-vous dans les réglages d&apos;abonnement de votre compte Apple ou Google pour modifier,
        suspendre ou annuler.
      </p>

      <h3>Le verrouillage Face ID / empreinte ne fonctionne pas</h3>
      <p>
        Vérifiez que la biométrie est activée à la fois dans les réglages de votre téléphone et dans
        Horsetrack (Profil → Sécurité). Cette donnée reste entièrement sur votre appareil, nous n&apos;y avons jamais
        accès.
      </p>

      <h3>Liens utiles</h3>
      <ul>
        <li>
          <a href="/cgu">Conditions Générales d&apos;Utilisation</a>
        </li>
        <li>
          <a href="/confidentialite">Politique de Confidentialité</a>
        </li>
      </ul>
    </LegalPage>
  );
}
