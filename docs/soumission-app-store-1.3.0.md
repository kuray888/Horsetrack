# Soumission App Store 1.3.0 (préparée le 2026-11-13)

Adresses, réponses de confidentialité et compte de revue : inchangés, cf. `soumission-app-store-1.2.0.md`.
**Réponses de confidentialité à mettre à jour** : « Localisation précise » (traces GPS, déjà déclarée si
la 1.2.0 l'était) ; le lien public ajoute « contenu de l'utilisateur » (séance partagée volontairement).

## Nouveautés (FR)

• Séance en direct gratuite pour tous : chrono, GPS, allures, export GPX
• Relire une séance : tracé par allure, vitesse, dénivelé
• Partager une séance en story ou en carré, avec un lien web que tu peux supprimer
• Météo plus fiable, alertes gel, chaleur, vent et orage
• Progression de ton cheval : régularité, temps de travail, poids
• Contacts : adresse et bouton Itinéraire, prochaine visite conseillée
• Invite gratuitement une personne en lecture seule ; 3 questions offertes au coach IA
• Annule une suppression pendant 5 secondes

## What's New (EN)

• Live rides are now free for everyone: timer, GPS, gaits, GPX export
• Replay a ride: route by gait, speed, elevation
• Share a ride as a story or square card, with a web link you can delete
• More reliable weather, with frost, heat, wind and storm alerts
• Your horse's progress: consistency, work time, weight
• Contacts: address and Directions button, suggested next visit
• Invite one person for free (read-only); 3 free AI coach questions
• Undo a deletion for 5 seconds

## Notes pour l'App Review (ajouter à celles de la 1.2.0, en anglais)

> New in 1.3.0: live rides are free. To test the public link: record or open a saved ride
> (Horse > Rides), tap Share, then "Create a link to share" (explained consent screen). The
> link opens a web page in Safari showing the route shape, duration, distance and gaits, no
> map and no rider name; "Delete the link" removes the page immediately. Weather uses MET
> Norway through our server. The demo account is a free account with data; Premium is tested
> with a sandbox purchase from the paywall.

## Captures à refaire
Séance en direct, Relire la séance, carte à partager (story), Progression, Contact avec Itinéraire,
Accueil — FR et EN (compte démo : cf. mémoire, il est gratuit sur simulateur neuf).

## Checklist finale

**Fait par moi** : nom du cheval masqué par défaut sur le lien public (interrupteur) ; Next 15.5.29 ; site recentré (commit `90613d0`), correctifs API (`d8ab5fb`), lien public révoqué à la
suppression de séance, audit (`audit-securite-1.3.0.md`), textes ci-dessus, tests verts
(API 168, mobile 818, RLS 15 fichiers, web 11).

**À faire par toi, dans l'ordre**
1. Coller `tools/verif-prod-lecture-seule.sql` dans Supabase (lecture seule) et me donner le résultat.
2. Vercel : règle de débit (cf. audit § à décider 3).
3. Relire `pnpm audit` chez toi (cf. audit § à décider 4).
4. Ton accord pour : push `release/1.3.0`, fusion `main`, déploiement API puis `tools/check-prod.sh`.
5. Revue sur simulateur (liste ci-dessous), puis ton accord pour le build EAS.
6. App Store Connect : version « 1.3.0 », nouveautés, notes, publication manuelle, bon build.
7. Publier le site après la sortie.

**Revue manuelle sur simulateur (non faite : je n'ai pas piloté le simulateur)**
séance en direct (démarrer, pause, fin, GPS refusé) ; relecture ; partage story/carré, masquage
départ/arrivée, code de parrainage ; lien public créé → ouvert dans Safari → supprimé → page « n'existe
plus » ; **supprimer la séance → le lien disparaît** ; contacts (adresse, Itinéraire) ; Progression ;
invitation gratuite VIEWER à deux comptes ; anglais ; mode sombre ; Réduire les animations ; VoiceOver ;
hors ligne ; prix absents ; 1 vs N chevaux ; gratuit / essai / Premium offert.
