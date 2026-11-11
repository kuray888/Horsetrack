# Cahier — Annuaire de professionnels

## Problème
Le cavalier gère son véto, son maréchal, son ostéo… dans « Mes contacts » (`rider_contacts` :
nom, rôle, téléphone, e-mail, notes ; personnels, RLS « les siens »). Il ne peut ni appeler
d'un toucher depuis un rendez-vous, ni savoir quand le maréchal doit repasser, ni trouver un
professionnel quand il déménage.

## Phase 1 — enrichir « Mes contacts » (sans risque, sans donnée de tiers nouvelle)
- Actions directes : appeler, écrire, itinéraire (adresse ajoutée au contact ; ouvre Plans,
  aucune carte dans l'app).
- Lien contact ↔ rendez-vous : choisir le professionnel dans le formulaire de rendez-vous
  (un formulaire, réutilisé) ; « Rappeler le maréchal » depuis la fiche du contact.
- **Prochaine visite** : à partir du dernier rendez-vous et d'une fréquence (ferrure 6–8
  semaines, dentiste 1 an, vaccin selon le carnet) → proposition de rendez-vous, **pas** de
  notification nouvelle (les rappels de rendez-vous existants suffisent ; tableau des relances
  de CLAUDE.md inchangé).
- Données : colonne `address` (texte) sur `rider_contacts`, colonne `contactId` facultative
  sur les rendez-vous. Migration additive, rejouable, sans effet sur les comptes existants ;
  test `test:rls` (un contact reste invisible des autres comptes, même partagé au cheval).
- Gratuit : appel / itinéraire. Premium : prochaine visite calculée. → **Décision pour toi.**

## Phase 2 — annuaire partagé (à valider avant tout code)
Questions qui sont les tiennes (données personnelles de professionnels, juridique) :

| Question | Proposition |
|---|---|
| Qui crée les fiches ? | Le professionnel lui-même (fiche réclamée et vérifiée) ; un cavalier peut **suggérer** un pro, la fiche n'est publiée qu'après accord du pro. Jamais de fiche créée à partir des contacts privés des utilisateurs. |
| Vérification | Numéro d'ordre (vétérinaires : Ordre national), SIRET pour les autres, contrôle manuel dans /admin. |
| Base légale RGPD | Consentement du professionnel (publication) ; droit de retrait immédiat ; mentions dans la politique de confidentialité. |
| Avis | Seulement après un rendez-vous enregistré avec ce pro ; modérés avant publication ; signalement ; aucun avis importé ni inventé ; pas de note chiffrée la première année (risque de diffamation, modération coûteuse). |
| Paiement | Aucun (ni réservation ni mise en avant payante). |
| Gratuit / Premium | Recherche gratuite ; rien de payant pour les pros. |

Tant que ces points ne sont pas validés, **seule la phase 1 est construite**.

## Événements
`contact_called`, `contact_directions_opened`, `contact_next_visit_planned` (`{ role }`).
Aucun nom ni numéro dans les propriétés.

## Cas limites
Contact sans téléphone (bouton masqué, pas grisé sans explication), numéro étranger, iPad
sans téléphone (proposer FaceTime ou copier), rendez-vous dont le contact a été supprimé
(nom gardé en texte), demi-pension (ne voit pas les contacts du propriétaire).

## Plan de test
Logique pure (prochaine visite, formats de numéro) ; `test:rls` pour la colonne ajoutée ;
captures et VoiceOver sur la fiche contact.
