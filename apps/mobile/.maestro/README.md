# Tests de bout en bout (Maestro)

Parcours joués sur un vrai simulateur ou un vrai iPhone, en touchant l'écran
comme un utilisateur. Les éléments sont repérés par des `testID` (stables,
quelle que soit la langue de l'app).

| Parcours | Tag | Compte | Ce qu'il vérifie |
|---|---|---|---|
| `smoke-launch.yaml` | smoke | aucun | Démarrage à neuf, accueil, écran de connexion. Ne crée aucun compte. |
| `paywall-browse-and-close.yaml` | account | gratuit | Le paywall s'ouvre depuis Profil, montre les deux formules avec leurs prix, se ferme sans rien acheter. |
| `paywall-promo-invalid.yaml` | account | gratuit | Un code inconnu est refusé, aucun Premium accordé, aucune feuille d'achat ouverte. |
| `paywall-sandbox-purchase.yaml` | sandbox | jamais abonné | Achat mensuel réel en environnement de test Apple, jusqu'à l'écran de bienvenue Premium. |

Aucun parcours ne simule un paiement : l'achat sandbox échoue tant qu'Apple
n'a pas confirmé et que RevenueCat n'a pas renvoyé le droit Premium.

## Prérequis

- Maestro (`curl -fsSL "https://get.maestro.mobile.dev" | bash`) et un Java 17
  (`brew install openjdk@17`, puis
  `export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home`).
- L'app installée sur le simulateur ou l'iPhone : build TestFlight, build de
  production, ou client de développement avec Metro lancé (`npx expo start --dev-client`).
- Pour les tags `account` et `sandbox` : des comptes Horsetrack **de test**,
  jamais ceux de vrais clients. Le parcours sandbox consomme l'essai et la
  première souscription du compte : prévoir un nouveau compte par passage, ou
  annuler l'abonnement sandbox entre deux passages.
- Pour `sandbox` sur iPhone : un compte testeur créé dans App Store Connect
  (Utilisateurs et accès → Sandbox), connecté dans Réglages → App Store →
  Compte sandbox.

## Lancer

Depuis `apps/mobile` :

```sh
# Démarrage (à chaque build). Avec un client de développement :
maestro test .maestro/smoke-launch.yaml -e DEV_SERVER=http%3A%2F%2Flocalhost%3A8081
# Avec un build TestFlight / production : sans DEV_SERVER.
maestro test .maestro/smoke-launch.yaml

# Paywall, compte gratuit :
maestro test .maestro --include-tags account \
  -e FREE_EMAIL=test-gratuit@exemple.fr -e FREE_PASSWORD='…'

# Achat sandbox :
maestro test .maestro/paywall-sandbox-purchase.yaml \
  -e SANDBOX_EMAIL=test-achat-01@exemple.fr -e SANDBOX_PASSWORD='…' \
  -e APPLE_SANDBOX_PASSWORD='…'
```

`DEV_SERVER` est l'adresse de Metro, encodée : seulement avec un client de
développement, dont le menu est fermé automatiquement au premier chargement.

## Repères (`testID`)

`welcome-start`, `account-go-login`, `login-email`, `login-password`,
`login-submit`, `profile-premium`, `paywall-close`, `paywall-plan-annual`,
`paywall-plan-monthly`, `paywall-cta`, `paywall-free`, `paywall-restore`,
`paywall-promo-open`, `paywall-promo-input`, `paywall-promo-apply`,
`paywall-promo-ok`, `paywall-promo-error`, `premium-welcome-title`.

Renommer l'un d'eux casse ces parcours : les garder en même temps.
