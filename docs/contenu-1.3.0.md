# Contenu de la 1.3.0 (état au 2026-11-13)

## Fini (sur `release/1.3.0`)
- Séance en direct **gratuite pour tous** (verrou du 13/11 annulé), carte à partager en story,
  **export GPX** du tracé.
- Météo : prévisions MET Norway via notre serveur (attribution affichée), meilleur créneau pour
  monter (Premium), alertes gel / chaleur / vent / orage (gratuites), localisation demandée sur geste.
- Coach IA : 3 questions offertes à un compte gratuit.
- Partage : un compte gratuit invite une personne par cheval en lecture seule ; texte
  d'introduction corrigé ; site à jour.
- Progression du cheval : écran dans la fiche (régularité, temps de travail sur 12 semaines, poids).
- Annulation d'une suppression (séance, journal, dépense) pendant 5 s ; synchro : profil serveur recréé.
- Carte de parrainage de l'Accueil.

## À finir avant soumission
- Vérifier le partage à deux comptes sur simulateur (lecture seule gratuit, rôle Premium).
- Revue Maestro et captures avant/après sur simulateur ; matrice des pires moments (cf. prompt).
- Bannière « non synchronisé » : audit des chemins qui laissent une donnée seulement sur le téléphone.
- Relire en anglais : Progression, export GPX, texte de partage.

## À reporter (1.3.x ou 1.4)
- Séance relue : altitude, dénivelé lissé, tracé coloré par allure, curseur de relecture
  (demande une colonne `training_session_rides` : trace détaillée, migration additive + test:rls).
- Fond de carte (build de développement requis).
- Progression : carte partageable, concours / soins / budget, courbes 6 et 12 mois ;
  gratuit / Premium à décider (proposition du cahier : historique complet et carte en Premium).
- Annuaire phase 1 : itinéraire (colonne `address`), « Prendre rendez-vous » depuis un contact,
  prochaine visite (migration additive + test:rls). Phase 2 : à valider avant tout code.

## À faire à la main avant le build
1. Supabase : `invitation-gratuite-2026-11-13.sql` (aucun SQL pour la séance en direct).
2. Déployer l'API de `release/1.3.0` (fusion dans `main` sur ton accord), puis `tools/check-prod.sh`.
3. App Store Connect : version 1.3.0, notes de revue (compte gratuit avec données).
4. Publier le site après la sortie.
5. Si `seance-direct-premium-1-colonne` a été exécuté : rien à défaire, la colonne est inerte.
