# Soumission App Store 1.2.0 — ce qu'il faut remplir (hors textes de la fiche)

Les textes (nom, sous-titre, mots-clés, description, nouveautés, FR + EN) sont dans
`fiche-app-store-1.2.0.md`. Ici : le reste des champs d'App Store Connect.
**Aucun mot de passe dans ce fichier** : à saisir à la main dans App Store Connect.

## 1. Adresses (identiques à celles de l'app)

| Champ | Valeur |
|---|---|
| URL d'assistance | https://api-mu-tan-94.vercel.app/support |
| URL marketing (facultatif) | https://horsetrack.fr |
| Politique de confidentialité | https://api-mu-tan-94.vercel.app/confidentialite |
| Conditions d'utilisation (EULA) | https://api-mu-tan-94.vercel.app/cgu (à mettre aussi dans « Contrat de licence » si tu n'utilises pas celui d'Apple) |
| E-mail de contact (revue) | horsetrack.app@gmail.com |

## 2. Informations pour l'équipe de revue (« App Review Information »)

Compte de démonstration : ouvre un compte **Premium** (code promo ou essai) et saisis son
e-mail et son mot de passe dans les deux champs prévus. Apple ne peut pas acheter dans
l'app sans compte sandbox : le compte doit déjà avoir Premium.

**Notes (anglais, à coller)**

> Horsetrack is a horse care log for riders. The demo account has a horse, sessions,
> care appointments, expenses and Premium unlocked.
>
> Subscriptions (Premium, monthly and yearly, 1-month free trial): Profile > "See Premium"
> opens the paywall. "Restore purchases", "Terms of Use" and "Privacy Policy" are on the
> paywall and in Profile. Account deletion: Profile > Delete my account.
> Sign in with Apple is offered next to Google sign-in.
>
> AI coach (Premium): Home > "Your AI coach" card. It answers questions from the horse's own record
> (sessions, care, expenses, weight) using a third-party AI model (Anthropic) called by our
> servers. Messages that mention symptoms are not sent to the model: the app tells the
> rider to call a vet. The coach gives no medical advice.
>
> Live ride and "Notify my contacts" use location only while the rider starts a ride.
> The app does not offer any other subscription: there is no Écurie Pro product.

## 3. « What to Test » (TestFlight, facultatif)

**FR** : Nouveau : coach IA, séance en direct avec GPS, créneaux réguliers, rapport du mois
et export des dépenses. À tester en priorité : changer la photo d'un cheval sur un
appareil et vérifier qu'elle change sur l'autre ; se déconnecter avec des modifications
hors ligne.

**EN**: New: AI coach, live ride with GPS, weekly slots, monthly report and expense export.
Please test: replacing a horse photo on one device and checking it changes on the other;
signing out with offline changes.

## 4. Catégorie, classification, confidentialité des données

- Catégorie principale : **Style de vie** ; secondaire : **Sports** (inchangé si déjà réglé).
- Classification d'âge : répondre « Non » à tout (aucun contenu sensible) ; l'IA du coach
  ne produit ni contenu médical ni contenu adulte. Réponses « Oui » éventuelles : aucune.
- Confidentialité des données (« App Privacy »), d'après le code et la page
  `/confidentialite` — **à confirmer ligne par ligne**, c'est l'éditeur qui en répond :
  - Coordonnées : e-mail (compte). Liées à l'utilisateur, pas utilisées pour le suivi.
  - Contenu de l'utilisateur : photos, documents, notes, données des chevaux.
  - Localisation précise : séance en direct et « Prévenir mes proches » (Premium).
  - Achats : via RevenueCat. Identifiants : identifiant du compte.
  - Données d'utilisation et diagnostics : PostHog, Sentry (cf. page de confidentialité).
  - Aucun suivi publicitaire : réponse « Non » à « utilisé pour vous suivre ».

## 5. À décider avant d'envoyer à la revue

**Consentement explicite pour l'IA (règle 5.1.2(i) d'Apple).** Le coach envoie le carnet du
cheval à un prestataire d'IA tiers (Anthropic). Apple demande d'informer l'utilisateur de
ce partage ET d'obtenir son accord avant l'envoi. L'app le dit dans la politique de
confidentialité, mais **n'affiche pas de demande d'accord au premier usage du coach**
(vérifié : aucun écran de consentement dans `app/coach.tsx` ni `src/coach/`).
Risque : refus de la revue. Recommandation : un écran « J'autorise » au premier usage
(question, idée de séance, résumé), mémorisé sur l'appareil, puis un nouveau build.

## 6. Ordre des opérations

1. Build n° 27 terminé et envoyé (envoi automatique en cours).
2. App Store Connect → version 1.2.0 → retirer de la revue si besoin → choisir le build 27.
3. Coller les textes FR puis EN, ajouter les visuels (`tools/store-screenshots/out/`).
4. Remplir §1, §2, §4 ci-dessus. Vérifier : aucun produit Écurie Pro.
5. Tester le build sur deux appareils (photo changée d'un côté, vue de l'autre).
6. Ajouter pour examen, puis soumettre.
