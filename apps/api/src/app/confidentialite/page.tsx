import { LegalPage } from "@/components/LegalPage";

/** Contenu miroir de /legal/politique-confidentialite.md à la racine du repo
 * — gardez les deux synchronisés tant que ce fichier reste la source de
 * relecture juridique. Les passages entre crochets restent à compléter avant
 * publication (raison sociale, adresse, email de contact, âge minimum —
 * cf. /legal/politique-confidentialite.md). */
export default function ConfidentialitePage() {
  return (
    <LegalPage title="Politique de Confidentialité — Horsetrack" updated="28 octobre 2026">
      <h2>1. Qui sommes-nous</h2>
      <p>
        Léa Lilou VERCASSON, Entrepreneur individuel (micro-entreprise), 14 Rue Robert Esnault-Pelterie, 78117
        Toussus-le-Noble (immatriculée sous le numéro SIREN 981 898 125, SIRET 981 898 125 00027) (« nous »),
        éditrice de l&apos;application Horsetrack, est responsable du traitement des données décrites dans cette
        politique.
      </p>
      <p>Contact pour toute question relative à vos données : horsetrack.app@gmail.com.</p>

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
            <td>
              Adresse email, mot de passe (chiffré, géré par Supabase Auth) ; avec « Continuer avec Apple » ou « Continuer
              avec Google », l&apos;identifiant transmis par ce service
            </td>
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
            <td>Agenda, journal, finances</td>
            <td>
              Rendez-vous, notes de journal (humeur, activité, météo), documents du coffre-fort, dépenses liées à un
              cheval
            </td>
            <td>Utilisation normale de l&apos;app</td>
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
          <tr>
            <td>Mesure d&apos;usage</td>
            <td>
              Écrans consultés et actions effectuées dans l&apos;app (ex. « formule annuelle choisie », « rappel créé », code promo accepté),
              version de l&apos;app, système du téléphone, rattachés à votre identifiant utilisateur —{" "}
              <strong>jamais</strong> le contenu de vos fiches (noms, notes, documents)
            </td>
            <td>Utilisation normale de l&apos;app</td>
          </tr>
          <tr>
            <td>Photos prises avec l&apos;appareil</td>
            <td>
              Photo d&apos;un cheval, d&apos;une ordonnance ou d&apos;une facture, uniquement quand vous choisissez « Prendre
              une photo »
            </td>
            <td>Ajout d&apos;une photo ou d&apos;un document</td>
          </tr>
          <tr>
            <td>Parcours des séances en direct</td>
            <td>
              Positions GPS pendant une séance que vous démarrez vous-même, y compris écran verrouillé : tracé
              simplifié, distance, vitesse et temps passé à chaque allure, enregistrés avec la séance. Rien n&apos;est
              collecté en dehors d&apos;une séance en cours, ni quand vous la démarrez sans GPS
            </td>
            <td>Séance en direct</td>
          </tr>
          <tr>
            <td>Coach (Premium)</td>
            <td>
              Les questions que vous posez au coach. Pour y répondre, l&apos;Application envoie des faits calculés sur
              votre cheval (âge, niveau, discipline, conditions de santé, blessures en cours, séances des dernières
              semaines, soins et échéances, concours, dépenses par catégorie, poids, ressenti du journal, météo prévue) —{" "}
              <strong>jamais</strong> son nom, le vôtre, votre email, ni ses numéros SIRE, de transpondeur ou
              d&apos;assurance, ni vos notes libres. Nous gardons la suggestion du jour et le résumé du mois ; pour chaque
              appel, seulement des compteurs techniques (taille, coût, issue), jamais le contenu des questions
            </td>
            <td>Carte « Ton coach », écran du coach</td>
          </tr>
          <tr>
            <td>Fil d&apos;un cheval</td>
            <td>
              Commentaires et réactions sur une séance ou un souvenir, visibles par le propriétaire et les personnes
              avec qui le cheval est partagé ; signalements d&apos;un commentaire
            </td>
            <td>Commentaires, réactions, signalement</td>
          </tr>
          <tr>
            <td>Notifications push</td>
            <td>Jeton de notification de votre téléphone et langue de l&apos;app, pour vous prévenir d&apos;un nouveau commentaire</td>
            <td>Notifications déjà autorisées</td>
          </tr>
          <tr>
            <td>Sécurité en balade (facultative)</td>
            <td>
              Votre prénom, le nom et l&apos;adresse email des proches (3 au plus) que vous choisissez, et votre
              dernière position pendant la balade. Ces proches reçoivent un lien de suivi et, si besoin, une alerte.
              Seule la dernière position est conservée ; elle est supprimée 7 jours après la fin de la balade
            </td>
            <td>Séance en direct avec « Prévenir mes proches » activé</td>
          </tr>
          <tr>
            <td>Fiche complémentaire du cheval</td>
            <td>
              Numéros SIRE, UELN et de transpondeur, assureur et numéro de contrat, écurie, ration alimentaire,
              organisation de la demi-pension (prénom, jours, participation) ; visibles par les personnes avec qui vous
              partagez le cheval
            </td>
            <td>Saisie dans la fiche du cheval</td>
          </tr>
          <tr>
            <td>Carnet de contacts</td>
            <td>Nom, métier, téléphone, email et notes des professionnels que vous ajoutez (vétérinaire, maréchal…)</td>
            <td>Profil → Mes contacts</td>
          </tr>
          <tr>
            <td>Vidéos du journal</td>
            <td>Vidéo d&apos;une minute au plus que vous choisissez d&apos;ajouter à un souvenir (Premium)</td>
            <td>Ajout d&apos;une vidéo</td>
          </tr>
          <tr>
            <td>Parrainage</td>
            <td>Votre code de parrainage, et le lien entre votre compte et celui de l&apos;ami qui vous a parrainé</td>
            <td>Partage ou saisie d&apos;un code</td>
          </tr>
        </tbody>
      </table>
      <p>
        <strong>Nous ne collectons pas</strong> : votre localisation en dehors d&apos;une séance en direct que vous
        démarrez vous-même, le carnet de contacts de votre téléphone, des données de navigation
        publicitaire, ni aucun identifiant à des fins de tracking publicitaire — l&apos;Application n&apos;intègre aucun
        SDK publicitaire. La mesure d&apos;usage ci-dessus sert uniquement à améliorer l&apos;Application ; elle
        n&apos;est ni revendue, ni croisée avec des données d&apos;autres applications ou sites.
      </p>
      <p>
        <strong>Précision sur les données de santé</strong> : les informations relatives à l&apos;état de santé saisies
        dans l&apos;Application concernent votre <strong>cheval</strong> (blessures, conditions de santé), pas
        vous-même — il ne s&apos;agit pas de données de santé au sens du RGPD pour ce qui vous concerne personnellement.
      </p>

      <h2>3. À quoi servent ces données</h2>
      <ul>
        <li>Créer et gérer votre compte.</li>
        <li>Fournir les fonctionnalités de suivi de l&apos;Application (planning, agenda, journal, coffre-fort, finances, objectifs).</li>
        <li>Envoyer les rappels et notifications que vous avez programmés (push et email), et les emails liés à un partage de cheval que vous initiez.</li>
        <li>
          Permettre le partage d&apos;un cheval avec une demi-pension ou un coach que vous invitez, et les échanges dans
          le fil de ce cheval (avec notification des participants, et traitement des signalements sous 24 h).
        </li>
        <li>
          Faire fonctionner le coach (Premium) : proposer la prochaine séance, répondre à vos questions sur le carnet
          du cheval, résumer chaque mois. Le coach ne donne aucun avis vétérinaire.
        </li>
        <li>Gérer votre abonnement et votre période d&apos;essai.</li>
        <li>Assurer la sécurité du service (authentification, limitation d&apos;usage abusif).</li>
        <li>
          Comprendre comment l&apos;Application est utilisée (écrans qui posent problème, fonctions utiles ou ignorées)
          pour l&apos;améliorer.
        </li>
      </ul>
      <p>Nous ne revendons aucune de vos données et ne les utilisons à aucune fin publicitaire.</p>

      <h2>4. Base légale du traitement</h2>
      <p>
        Le traitement de vos données repose sur l&apos;exécution du contrat qui nous lie (fourniture du service que
        vous avez demandé en créant un compte), et, pour les notes libres et données optionnelles, sur votre
        consentement explicite lors de leur saisie. La mesure d&apos;usage repose sur notre intérêt légitime à
        améliorer l&apos;Application ; vous pouvez vous y opposer en nous écrivant à l&apos;adresse de contact
        ci-dessus.
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
            <td>Hébergement de la base de données, authentification et stockage des documents du coffre-fort (serveurs situés en Union Européenne)</td>
            <td>Toutes les données listées en section 2</td>
          </tr>
          <tr>
            <td><strong>Resend</strong></td>
            <td>
              Envoi des emails de rappel de rendez-vous, d&apos;invitation à partager un cheval, et de sécurité en
              balade (lien de suivi, alerte)
            </td>
            <td>
              Adresse email du destinataire, contenu de l&apos;email (nom du cheval, type de rendez-vous ou
              d&apos;invitation ; pour la sécurité en balade, votre prénom et un lien vers votre dernière position)
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
          <tr>
            <td><strong>PostHog</strong></td>
            <td>Mesure d&apos;usage de l&apos;Application (serveurs situés en Union Européenne)</td>
            <td>Mesure d&apos;usage décrite en section 2, identifiant utilisateur</td>
          </tr>
          <tr>
            <td><strong>Anthropic</strong></td>
            <td>Modèle d&apos;intelligence artificielle du coach (Claude), appelé uniquement par nos serveurs</td>
            <td>
              Les faits sur le cheval décrits en section 2 (rubrique « Coach ») et le texte de vos questions — sans nom,
              email ni numéro d&apos;identification. Anthropic n&apos;utilise pas ces données pour entraîner ses modèles
              et ne les conserve que pour une durée limitée prévue par ses conditions commerciales
            </td>
          </tr>
          <tr>
            <td><strong>Expo (Expo Push)</strong></td>
            <td>Acheminement des notifications push vers Apple et Google</td>
            <td>Jeton de notification, titre et début du commentaire notifié, nom du cheval</td>
          </tr>
        </tbody>
      </table>
      <p>
        Resend, Anthropic et Expo étant basés aux États-Unis, l&apos;envoi d&apos;emails, les appels au coach et
        l&apos;acheminement des notifications constituent des transferts de données hors Union Européenne, encadrés par
        les clauses contractuelles types (CCT) prévues par la réglementation européenne.
      </p>

      <h2>6. Durée de conservation</h2>
      <p>
        Vos données sont conservées tant que votre compte est actif. Si vous supprimez votre compte (Profil →
        Supprimer mon compte), l&apos;ensemble de vos données — profil, chevaux, planning, agenda, journal,
        coffre-fort, finances — est supprimé immédiatement et de façon irréversible de nos serveurs.
      </p>

      <h2>7. Vos droits</h2>
      <p>
        Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez d&apos;un droit
        d&apos;accès, de rectification, d&apos;effacement, de limitation, d&apos;opposition et de portabilité sur vos
        données.
      </p>
      <ul>
        <li><strong>Portabilité</strong> : Profil → Exporter mes données, qui produit vos données en fichiers lisibles par un tableur.</li>
        <li><strong>Suppression</strong> : directement depuis l&apos;Application, à tout moment, sans avoir besoin de nous contacter (Profil → Supprimer mon compte).</li>
        <li><strong>Accès / rectification / autres demandes</strong> : en nous contactant à horsetrack.app@gmail.com.</li>
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
        L&apos;Application n&apos;est pas destinée aux enfants de moins de 15 ans sans l&apos;autorisation d&apos;un
        titulaire de l&apos;autorité parentale. Nous ne collectons pas sciemment de données concernant des enfants en
        dessous de cet âge sans cette autorisation.
      </p>

      <h2>10. Modifications de cette politique</h2>
      <p>
        Cette politique peut être mise à jour pour refléter une évolution du service ou de la réglementation. Toute
        modification substantielle vous sera notifiée dans l&apos;Application.
      </p>

      <h2>11. Contact</h2>
      <p>Pour toute question relative à cette politique ou à vos données personnelles : horsetrack.app@gmail.com.</p>
    </LegalPage>
  );
}
