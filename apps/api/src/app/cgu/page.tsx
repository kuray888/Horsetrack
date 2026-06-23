import { LegalPage } from "@/components/LegalPage";

/** Contenu miroir de /legal/cgu.md à la racine du repo — gardez les deux
 * synchronisés tant que ce fichier reste la source de relecture juridique.
 * Les passages entre crochets restent à compléter avant publication
 * (raison sociale, adresse, SIRET, email de contact, âge minimum, droit
 * applicable — cf. /legal/cgu.md). */
export default function CguPage() {
  return (
    <LegalPage title="Conditions Générales d'Utilisation — Horsetrack" updated="[DATE]">
      <h2>1. Objet</h2>
      <p>
        Les présentes Conditions Générales d&apos;Utilisation (« CGU ») régissent l&apos;accès et l&apos;utilisation de
        l&apos;application mobile Horsetrack (« l&apos;Application »), éditée par [NOM DE L&apos;ÉDITEUR / RAISON SOCIALE],
        [forme juridique], dont le siège est situé [ADRESSE], immatriculée sous le numéro [SIRET/RCS] (« l&apos;Éditeur »).
      </p>
      <p>
        En créant un compte ou en utilisant l&apos;Application, l&apos;utilisateur (« l&apos;Utilisateur ») accepte sans
        réserve les présentes CGU.
      </p>

      <h2>2. Description du service</h2>
      <p>Horsetrack est une application de coaching équestre qui permet à l&apos;Utilisateur de :</p>
      <ul>
        <li>créer un profil cavalier et un ou plusieurs profils cheval (discipline, niveau, forme physique, antécédents de blessure, etc.) ;</li>
        <li>recevoir un programme d&apos;entraînement personnalisé généré automatiquement à partir de ce profil ;</li>
        <li>suivre sa progression (séances réalisées, statistiques, badges) ;</li>
        <li>
          échanger avec un assistant conversationnel nommé Julien (« le Coach IA »), propulsé par un modèle
          d&apos;intelligence artificielle tiers (Anthropic, modèle Claude), à des fins d&apos;information générale sur
          l&apos;entraînement et le bien-être équin.
        </li>
      </ul>

      <h2>3. Avertissement important — le Coach IA n&apos;est pas un professionnel</h2>
      <p>
        Le Coach IA fournit des conseils générés automatiquement à titre purement informatif. Il <strong>ne remplace
        en aucun cas l&apos;avis d&apos;un vétérinaire, d&apos;un ostéopathe équin ou d&apos;un enseignant d&apos;équitation
        qualifié</strong>. L&apos;Utilisateur reconnaît que :
      </p>
      <ul>
        <li>les réponses du Coach IA peuvent être incomplètes, inexactes ou inadaptées à une situation spécifique ;</li>
        <li>
          toute décision concernant la santé, l&apos;alimentation, le ferrage ou les soins vétérinaires de son cheval
          doit être prise en concertation avec un professionnel qualifié ;
        </li>
        <li>
          l&apos;Éditeur ne saurait être tenu responsable des conséquences d&apos;une décision prise sur la seule base
          d&apos;une réponse du Coach IA.
        </li>
      </ul>

      <h2>4. Création de compte et âge minimum</h2>
      <p>L&apos;accès à l&apos;Application nécessite la création d&apos;un compte (adresse email et mot de passe).</p>
      <p>
        L&apos;Application est réservée aux personnes âgées d&apos;au moins <strong>[16]</strong> ans. Les mineurs de moins
        de [16] ans ne peuvent utiliser l&apos;Application qu&apos;avec l&apos;autorisation d&apos;un titulaire de
        l&apos;autorité parentale, qui demeure responsable de l&apos;utilisation qui en est faite et, le cas échéant, des
        paiements effectués.
      </p>
      <p>
        L&apos;Utilisateur s&apos;engage à fournir des informations exactes lors de la création de son compte et à les
        maintenir à jour.
      </p>

      <h2>5. Abonnements, essai gratuit et paiement</h2>
      <p>
        Certaines fonctionnalités (notamment l&apos;accès complet au programme d&apos;entraînement au-delà de la semaine
        en cours) sont réservées aux Utilisateurs disposant d&apos;un abonnement payant ou d&apos;un essai gratuit en
        cours.
      </p>
      <ul>
        <li>
          <strong>Essai gratuit</strong> : un essai gratuit de 7 jours peut être proposé à la souscription. Sauf
          annulation avant son terme, il se transforme automatiquement en abonnement payant.
        </li>
        <li><strong>Formules</strong> : abonnement mensuel ou annuel, dont le prix est affiché dans l&apos;Application avant tout engagement.</li>
        <li>
          <strong>Paiement et renouvellement</strong> : les paiements sont traités exclusivement par l&apos;App Store
          (Apple) ou le Play Store (Google), selon la plateforme utilisée. L&apos;abonnement se renouvelle
          automatiquement à chaque période sauf annulation par l&apos;Utilisateur au moins 24 heures avant la fin de la
          période en cours.
        </li>
        <li>
          <strong>Résiliation</strong> : l&apos;Utilisateur peut annuler son abonnement à tout moment depuis les
          réglages de son compte Apple ou Google — l&apos;Éditeur n&apos;a pas la capacité technique d&apos;annuler un
          abonnement à la place de l&apos;Utilisateur ni de rembourser directement un achat, ces opérations relevant
          exclusivement d&apos;Apple ou de Google.
        </li>
        <li>
          <strong>Modification des prix</strong> : l&apos;Éditeur se réserve le droit de modifier les prix des
          abonnements ; toute modification sera annoncée avant d&apos;affecter un abonnement en cours.
        </li>
      </ul>

      <h2>6. Suppression de compte</h2>
      <p>
        L&apos;Utilisateur peut supprimer définitivement son compte et l&apos;ensemble de ses données associées à tout
        moment depuis l&apos;Application (Profil → Supprimer mon compte). Cette action est irréversible : profil
        cavalier, profils cheval, programme d&apos;entraînement et historique de progression sont supprimés sans
        possibilité de récupération.
      </p>
      <p>
        La suppression du compte n&apos;entraîne pas automatiquement l&apos;annulation d&apos;un abonnement en cours
        auprès d&apos;Apple ou Google — celle-ci doit être effectuée séparément depuis les réglages du compte concerné.
      </p>

      <h2>7. Comportement de l&apos;Utilisateur</h2>
      <p>L&apos;Utilisateur s&apos;engage à utiliser l&apos;Application conformément à sa destination et à ne pas :</p>
      <ul>
        <li>tenter d&apos;accéder aux données d&apos;un autre Utilisateur ;</li>
        <li>
          utiliser le Coach IA à des fins étrangères au domaine équestre (entraînement, santé, bien-être du cheval)
          de manière abusive ou répétée ;
        </li>
        <li>perturber le fonctionnement de l&apos;Application ou de ses serveurs.</li>
      </ul>

      <h2>8. Propriété intellectuelle</h2>
      <p>
        L&apos;Application, son contenu (textes, visuels, structure des programmes générés) et sa marque sont la
        propriété de l&apos;Éditeur ou de ses concédants. Aucune disposition des présentes CGU ne confère à
        l&apos;Utilisateur de droit de propriété intellectuelle sur l&apos;Application.
      </p>
      <p>
        Les données saisies par l&apos;Utilisateur (profil, informations sur ses chevaux) restent sa propriété ;
        l&apos;Éditeur dispose seulement du droit de les traiter pour fournir le service, dans les conditions décrites
        par la <a href="/confidentialite">Politique de Confidentialité</a>.
      </p>

      <h2>9. Disponibilité du service</h2>
      <p>
        L&apos;Éditeur s&apos;efforce d&apos;assurer un accès continu à l&apos;Application mais ne garantit pas une
        disponibilité ininterrompue. L&apos;Application peut être suspendue temporairement pour maintenance, mise à
        jour ou en cas de force majeure.
      </p>

      <h2>10. Responsabilité</h2>
      <p>Dans la limite permise par la loi applicable, l&apos;Éditeur ne saurait être tenu responsable :</p>
      <ul>
        <li>
          des conséquences d&apos;un entraînement ou d&apos;une décision de santé prise sur la base des recommandations
          du programme ou du Coach IA (cf. article 3) ;
        </li>
        <li>des dommages indirects résultant de l&apos;utilisation de l&apos;Application ;</li>
        <li>de l&apos;indisponibilité temporaire du service.</li>
      </ul>

      <h2>11. Modification des CGU</h2>
      <p>
        L&apos;Éditeur peut modifier les présentes CGU à tout moment. Les Utilisateurs seront informés de toute
        modification substantielle ; la poursuite de l&apos;utilisation de l&apos;Application après modification vaut
        acceptation des nouvelles CGU.
      </p>

      <h2>12. Droit applicable et litiges</h2>
      <p>
        Les présentes CGU sont soumises au droit [français]. En cas de litige, et après tentative de résolution
        amiable, les tribunaux [compétents selon le droit applicable] seront seuls compétents, sous réserve des
        dispositions impératives applicables aux consommateurs.
      </p>

      <h2>13. Contact</h2>
      <p>Pour toute question relative aux présentes CGU : [EMAIL DE CONTACT].</p>
    </LegalPage>
  );
}
