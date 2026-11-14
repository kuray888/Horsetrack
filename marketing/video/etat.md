# État — chaîne vidéo (2026-11-14)

## Décisions
- Moteur local Python + Pillow + FFmpeg ; voix Piper `fr_FR-siwis-medium` (gratuite, locale). Aucun service payant utilisé.
- Visuels = captures des maquettes du site (`apps/web/src/assets/screens`), recadrées sur l'écran. Pas de musique.
- 3 angles, accroche 1 retenue pour chacun (hypothèses A/B à tester avec l'accroche 2) : voir JSON.

## Avancement
- [x] Moteur `build.py`, contrôles `verify.py`, `lot1.sh`, `suivi.csv`.
- [x] A01 partage demi-pension (27 s) · B01 soins + coach IA (22 s) · C01 séance en direct gratuite (20,5 s). Contrôles auto OK.
- [x] Incrustation présentateur testée (clip factice).
- [ ] Format présentateur IA : clip virtuel manquant.

## Points à vérifier par vous
- Les captures sont des maquettes du site : confirmer qu'elles reflètent l'app publiée (A01 : rôles qui écrivent = Premium, noté à l'écran ; coach IA = Premium en 1.2.0, 3 questions offertes en 1.3.0 — non mentionné).
- C01 annonce « gratuite » : vrai si le build publié ne verrouille pas la séance en direct (règle du 13/11).
- Droits : photo du cheval/personne (B01 seul, 1 s), licence de la voix siwis.
- Écoute humaine : prononciation, naturel de la voix ; je ne peux pas écouter.
- Aperçu sur téléphone (zones de l'interface TikTok/Instagram) non testé : marges prévues, pas vérifiées.

## Problèmes connus
- Voix synthétique reconnaissable (Piper) : à tester contre une voix humaine.
- Mouvements de zoom approximatifs sur les maquettes (pas de vraie capture écran filmée).

## Prochaine action
Écouter/regarder les 3 MP4, valider ou corriger les textes ; fournir une vraie capture d'écran filmée (simulateur) pour une démo plus vivante ; fournir un clip présentateur.
