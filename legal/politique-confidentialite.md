# Politique de Confidentialité — Horsetrack

> **Brouillon de travail — pas une validation juridique.** Rédigé à partir du fonctionnement réel de l'app (vérifié dans le code : ce qui est collecté, où c'est stocké, à qui c'est transmis), pas d'un modèle générique. À faire relire par un professionnel du droit avant publication, et à tenir à jour si de nouvelles fonctionnalités changent les traitements décrits ici. Remplace les passages entre crochets `[...]` avant publication.

**Dernière mise à jour : [DATE]**

## 1. Qui sommes-nous

[NOM DE L'ÉDITEUR / RAISON SOCIALE], [forme juridique], [ADRESSE] (« nous »), éditeur de l'application Horsetrack, est responsable du traitement des données décrites dans cette politique.

Contact pour toute question relative à vos données : [EMAIL DE CONTACT].

## 2. Données que nous collectons

| Catégorie | Détail | Collectée quand |
|---|---|---|
| Compte | Adresse email, mot de passe (chiffré, géré par Supabase Auth) | Création de compte |
| Profil cavalier | Niveau, discipline principale, fréquence de monte, objectif, notes libres | Onboarding / modification du profil |
| Profil cheval | Nom, photo (optionnelle), année de naissance, sexe, race, taille, poids, discipline, niveau, forme physique, charge de travail, points forts/faibles, tempérament, conditions de santé, historique de blessures | Onboarding / modification du profil |
| Messages au Coach IA | Contenu des messages envoyés à l'assistant conversationnel et historique de conversation récent | Utilisation du Coach IA |
| Données d'abonnement | Statut d'abonnement (essai, actif, expiré), identifiant RevenueCat — **pas vos moyens de paiement**, traités exclusivement par Apple/Google | Souscription à un abonnement |
| Données techniques | Jeton de session, identifiant utilisateur, date de dernière mise à jour | Utilisation normale de l'app |

**Nous ne collectons pas** : votre localisation précise, vos contacts, des données de navigation publicitaire, ni aucun identifiant à des fins de tracking publicitaire — l'Application n'intègre aucun SDK publicitaire ni outil d'analyse comportementale tiers.

**Précision sur les données de santé** : les informations relatives à l'état de santé saisies dans l'Application concernent votre **cheval** (blessures, conditions de santé), pas vous-même — il ne s'agit pas de données de santé au sens du RGPD pour ce qui vous concerne personnellement.

## 3. À quoi servent ces données

- Créer et gérer votre compte.
- Générer et adapter votre programme d'entraînement personnalisé.
- Faire fonctionner le Coach IA (vos messages sont transmis au fournisseur d'intelligence artificielle pour générer une réponse, cf. section 5).
- Gérer votre abonnement et votre période d'essai.
- Assurer la sécurité du service (authentification, limitation d'usage abusif).

Nous ne revendons aucune de vos données et ne les utilisons à aucune fin publicitaire.

## 4. Base légale du traitement

Le traitement de vos données repose sur l'exécution du contrat qui nous lie (fourniture du service que vous avez demandé en créant un compte), et, pour les notes libres et données optionnelles, sur votre consentement explicite lors de leur saisie.

## 5. À qui transmettons-nous vos données

Nous faisons appel à des prestataires techniques tiers, strictement nécessaires au fonctionnement du service :

| Prestataire | Rôle | Données concernées |
|---|---|---|
| **Supabase** | Hébergement de la base de données et authentification (serveurs situés en Union Européenne) | Toutes les données listées en section 2, à l'exception des messages au Coach IA |
| **Anthropic** (modèle Claude) | Génération des réponses du Coach IA | Contenu des messages envoyés au Coach IA, et contexte de votre profil cavalier/cheval transmis pour personnaliser la réponse |
| **RevenueCat** | Gestion des abonnements et synchronisation avec Apple/Google | Statut d'abonnement, identifiant utilisateur |
| **Apple (App Store) / Google (Play Store)** | Traitement des paiements d'abonnement | Moyens de paiement (nous n'y avons jamais accès) |

Anthropic étant basé aux États-Unis, l'envoi des messages du Coach IA constitue un transfert de données hors Union Européenne. Ce transfert est encadré par les clauses contractuelles types (CCT) prévues par la réglementation européenne. [À vérifier/compléter avec les engagements contractuels réels d'Anthropic au moment de la publication.]

## 6. Durée de conservation

Vos données sont conservées tant que votre compte est actif. Si vous supprimez votre compte (Profil → Supprimer mon compte), l'ensemble de vos données — profil, chevaux, programme, historique de progression — est supprimé immédiatement et de façon irréversible de nos serveurs.

[Préciser ici si un délai de conservation différent s'applique à des fins légales, ex. facturation.]

## 7. Vos droits

Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité sur vos données.

- **Suppression** : directement depuis l'Application, à tout moment, sans avoir besoin de nous contacter (Profil → Supprimer mon compte).
- **Accès / rectification / autres demandes** : en nous contactant à [EMAIL DE CONTACT].
- Vous disposez également du droit d'introduire une réclamation auprès de la CNIL (www.cnil.fr) si vous estimez que vos droits ne sont pas respectés.

## 8. Sécurité

- Les données sont protégées par des règles d'accès strictes au niveau de la base de données (chaque utilisateur ne peut accéder qu'à ses propres données).
- Le verrouillage par biométrie (Face ID / empreinte digitale), si vous l'activez, est traité **entièrement sur votre appareil** — aucune donnée biométrique n'est envoyée à nos serveurs ni stockée par nous.
- Les mots de passe ne sont jamais stockés en clair.

## 9. Mineurs

L'Application n'est pas destinée aux enfants de moins de [16] ans sans l'autorisation d'un titulaire de l'autorité parentale. Nous ne collectons pas sciemment de données concernant des enfants en dessous de cet âge sans cette autorisation.

## 10. Modifications de cette politique

Cette politique peut être mise à jour pour refléter une évolution du service ou de la réglementation. Toute modification substantielle vous sera notifiée dans l'Application.

## 11. Contact

Pour toute question relative à cette politique ou à vos données personnelles : [EMAIL DE CONTACT].
