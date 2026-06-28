import { LegalPage } from "@/components/LegalPage";

/** Contenu miroir de /legal/politique-confidentialite.md à la racine du repo
 * — gardez les deux synchronisés tant que ce fichier reste la source de
 * relecture juridique. Les passages entre crochets restent à compléter avant
 * publication (raison sociale, adresse, email de contact, âge minimum —
 * cf. /legal/politique-confidentialite.md). */
export default function ConfidentialitePage() {
  return (
    <LegalPage title="Politique de Confidentialité — Horsetrack" updated="28 juin 2026">
      <h2>1. Qui sommes-nous</h2>
      <p>
        Anis Armand MESLIN, Entreprise individuelle (EI), 60 Route des Gardes, Passerelle 8 – RDC G, 92190 Meudon
        (immatriculé sous le numéro 952 094 456 R.C.S. Nanterre) (« nous »), éditeur de l&apos;application
        Horsetrack, est responsable du traitement des données décrites dans cette politique.
      </p>
      <p>Contact pour toute question relative à vos données : [EMAIL DE CONTACT].</p>

      <h2>2. Données que nous collectons</h2>
      <table>
        <thead>
          <tr>
            <th>Catégorie</th>
            <th>Détail</th>
            <th>Collectée quand</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Compte</td>
            <td>Adresse email, mot de passe (chiffré, géré par Supabase Auth)</td>
            <td>Création de compte</td>
          </tr>
          <tr>
            <td>Profil cavalier</td>
            <td>Niveau, discipline principale, fréquence de monte, objectif, notes libres</td>
            <td>Onboarding / modification du profil</td>
          </tr>
          <tr>
            <td>Profil cheval</td>
            <td>
              Nom, photo (optionnelle), année de naissance, sexe, race, taille, poids, discipline, niveau, forme
              physique, charge de travail, points forts/faibles, tempérament, conditions de santé, historique de
              blessures
            </td>
            <td>Onboarding / modification du profil</td>
          </tr>
          <tr>
            <td>Messages au Coach IA</td>
            <td>Contenu des messages envoyés à l&apos;assistant conversationnel et historique de conversation récent</td>
            <td>Utilisation du Coach IA</td>
          </tr>
          <tr>
            <td>Données d&apos;abonnement</td>
            <td>
              Statut d&apos;abonnement (essai, actif, expiré), identifiant RevenueCat — <strong>pas vos moyens de
              paiement</strong>, traités exclusivement par Apple/Google
            </td>
            <td>Souscription à un abonnement</td>
          </tr>
          <tr>
            <td>Données techniques</td>
            <td>Jeton de session, identifiant utilisateur, date de dernière mise à jour</td>
            <td>Utilisation normale de l&apos;app</td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>Nous ne collectons pas</strong> : votre localisation précise, vos contacts, des données de navigation
        publicitaire, ni aucun identifiant à des fins de tracking publicitaire — l&apos;Application n&apos;intègre aucun
        SDK publicitaire ni outil d&apos;analyse comportementale tiers.
      </p>
      <p>
        <strong>Précision sur les données de santé</strong> : les informations relatives à l&apos;état de santé saisies
        dans l&apos;Application concernent votre <strong>cheval</strong> (blessures, conditions de santé), pas
        vous-même — il ne s&apos;agit pas de données de santé au sens du RGPD pour ce qui vous concerne personnellement.
      </p>

      <h2>3. À quoi servent ces données</h2>
      <ul>
        <li>Créer et gérer votre compte.</li>
        <li>Générer et adapter votre programme d&apos;entraînement personnalisé.</li>
        <li>
          Faire fonctionner le Coach IA (vos messages sont transmis au fournisseur d&apos;intelligence artificielle
          pour générer une réponse, cf. section 5).
        </li>
        <li>Gérer votre abonnement et votre période d&apos;essai.</li>
        <li>Assurer la sécurité du service (authentification, limitation d&apos;usage abusif).</li>
      </ul>
      <p>Nous ne revendons aucune de vos données et ne les utilisons à aucune fin publicitaire.</p>

      <h2>4. Base légale du traitement</h2>
      <p>
        Le traitement de vos données repose sur l&apos;exécution du contrat qui nous lie (fourniture du service que
        vous avez demandé en créant un compte), et, pour les notes libres et données optionnelles, sur votre
        consentement explicite lors de leur saisie.
      </p>

      <h2>5. À qui transmettons-nous vos données</h2>
      <p>Nous faisons appel à des prestataires techniques tiers, strictement nécessaires au fonctionnement du service :</p>
      <table>
        <thead>
          <tr>
            <th>Prestataire</th>
            <th>Rôle</th>
            <th>Données concernées</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Supabase</strong></td>
            <td>Hébergement de la base de données et authentification (serveurs situés en Union Européenne)</td>
            <td>Toutes les données listées en section 2, à l&apos;exception des messages au Coach IA</td>
          </tr>
          <tr>
            <td><strong>OpenRouter</strong> (qui route la requête vers le modèle Claude d&apos;Anthropic)</td>
            <td>Génération des réponses du Coach IA</td>
            <td>
              Contenu des messages envoyés au Coach IA, et contexte de votre profil cavalier/cheval transmis pour
              personnaliser la réponse
            </td>
          </tr>
          <tr>
            <td><strong>RevenueCat</strong></td>
            <td>Gestion des abonnements et synchronisation avec Apple/Google</td>
            <td>Statut d&apos;abonnement, identifiant utilisateur</td>
          </tr>
          <tr>
            <td><strong>Apple (App Store) / Google (Play Store)</strong></td>
            <td>Traitement des paiements d&apos;abonnement</td>
            <td>Moyens de paiement (nous n&apos;y avons jamais accès)</td>
          </tr>
        </tbody>
      </table>
      <p>
        OpenRouter et Anthropic étant basés aux États-Unis, l&apos;envoi des messages du Coach IA constitue un transfert de données
        hors Union Européenne. Ce transfert est encadré par les clauses contractuelles types (CCT) prévues par la
        réglementation européenne. [À vérifier/compléter avec les engagements contractuels réels d&apos;OpenRouter et
        d&apos;Anthropic au moment de la publication — ce sous-traitant est amené à changer, cf. décision en cours sur
        le fournisseur du Coach IA.]
      </p>

      <h2>6. Durée de conservation</h2>
      <p>
        Vos données sont conservées tant que votre compte est actif. Si vous supprimez votre compte (Profil →
        Supprimer mon compte), l&apos;ensemble de vos données — profil, chevaux, programme, historique de progression —
        est supprimé immédiatement et de façon irréversible de nos serveurs.
      </p>
      <p>[Préciser ici si un délai de conservation différent s&apos;applique à des fins légales, ex. facturation.]</p>

      <h2>7. Vos droits</h2>
      <p>
        Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez d&apos;un droit
        d&apos;accès, de rectification, d&apos;effacement, de limitation, d&apos;opposition et de portabilité sur vos
        données.
      </p>
      <ul>
        <li><strong>Suppression</strong> : directement depuis l&apos;Application, à tout moment, sans avoir besoin de nous contacter (Profil → Supprimer mon compte).</li>
        <li><strong>Accès / rectification / autres demandes</strong> : en nous contactant à [EMAIL DE CONTACT].</li>
        <li>Vous disposez également du droit d&apos;introduire une réclamation auprès de la CNIL (www.cnil.fr) si vous estimez que vos droits ne sont pas respectés.</li>
      </ul>

      <h2>8. Sécurité</h2>
      <ul>
        <li>Les données sont protégées par des règles d&apos;accès strictes au niveau de la base de données (chaque utilisateur ne peut accéder qu&apos;à ses propres données).</li>
        <li>
          Le verrouillage par biométrie (Face ID / empreinte digitale), si vous l&apos;activez, est traité
          <strong> entièrement sur votre appareil</strong> — aucune donnée biométrique n&apos;est envoyée à nos
          serveurs ni stockée par nous.
        </li>
        <li>Les mots de passe ne sont jamais stockés en clair.</li>
      </ul>

      <h2>9. Mineurs</h2>
      <p>
        L&apos;Application n&apos;est pas destinée aux enfants de moins de [16] ans sans l&apos;autorisation d&apos;un
        titulaire de l&apos;autorité parentale. Nous ne collectons pas sciemment de données concernant des enfants en
        dessous de cet âge sans cette autorisation.
      </p>

      <h2>10. Modifications de cette politique</h2>
      <p>
        Cette politique peut être mise à jour pour refléter une évolution du service ou de la réglementation. Toute
        modification substantielle vous sera notifiée dans l&apos;Application.
      </p>

      <h2>11. Contact</h2>
      <p>Pour toute question relative à cette politique ou à vos données personnelles : [EMAIL DE CONTACT].</p>
    </LegalPage>
  );
}
