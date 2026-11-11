# Audit « niveau premium » — états, cohérence, pires scénarios (2026-11-11)

Méthode : balayage du code (`app/`, `src/`) par motifs précis, lecture des flux
d'achat, d'inscription et de partage, puis correction de ce qui est sûr, testé
et sans effet sur les droits des abonnés. Rien n'a été relancé sur simulateur :
les corrections portent sur des textes et de la logique pure (721 tests verts,
tsc et eslint propres). **Elles ne sont pas dans le build n° 29** : il faut un
build n° 30 pour qu'elles partent (à décider, cf. § 4).

## 1. Corrigé (commits `Messages d'erreur traduits…` et `Achat échoué…`)

| Axe | Constat (preuve) | Correction |
|---|---|---|
| Pires scénarios | **Échec d'achat : un seul message pour tout** (« Vérifie ta connexion… », `subscription/store.tsx`). Faux pour un paiement refusé, un « Demander à acheter » en attente, un abonnement déjà actif ou lié à un autre compte ; aucune issue proposée. | `subscription/purchaseErrors.ts` (9 tests) : un titre et un message par cause (codes RevenueCat vérifiés dans le SDK), bouton **« Restaurer mes achats »** quand c'est la bonne issue. Jamais « tu n'as pas été débité » quand un débit a pu partir sans réponse. |
| Pires scénarios | **Messages techniques bruts** à l'inscription (`e.message` tel quel : « Network request failed », « Load failed »…), à la suppression du compte et au mot de passe oublié. | Tout passe par `translateAuthError`, qui reconnaît désormais les erreurs iOS (« Internet connection appears to be offline », « timed out », « Load failed »…). 8 tests. |
| Cohérence | Titres d'alerte d'erreur mélangés : « Erreur » (16) et « Oups » (4). | « Erreur » partout. |
| Cohérence / anti « look IA » | Emojis décoratifs 🎉 et 🏅 dans les écrans et notifications (règle du projet : aucun emoji décoratif). | Retirés ; icônes de l'app à la place (`medal-outline`, `star-circle-outline`). Les 🐴 des messages de partage envoyés à d'autres personnes sont gardés. |
| États invisibles | Écran du coach : rien ne partait sans accord — mais l'utilisateur ne le savait pas. | Écran « Autoriser le coach IA ? » (déjà livré dans le build n° 29). |

## 2. Vérifié, déjà bon

- **États vides** : 52 textes d'état vide, un même gabarit (pastille icône + phrase). Ceux
  qui paraissaient sans bouton (poids, créneaux, soins) ont leur bouton d'ajout juste
  dessous (`AddToggle`) : rien à changer.
- **Verrou Premium** : `Locked.tsx` est un composant unique (21 usages), qui décrit ce que
  la fonction apporte et n'annonce « Essayer gratuitement » que si l'essai est confirmé.
- **Chargements, hors ligne, refus serveur** : squelettes (`Skeleton`), bannières
  « attend la sauvegarde en ligne » et « modification refusée » sur l'Accueil.
- **Annulation** : toute suppression demande une confirmation nommant l'objet
  (« Supprimer cette séance ? »).

## 3. À faire ensuite — classé par effet, avec la solution proposée

1. **Une couche de retour commune (toast avec « Annuler »).** Constat : il n'existe ni toast
   ni snackbar. Un succès passe par un haptique, un texte en ligne, ou une alerte bloquante
   (`planning.tsx:782`, `useExpenseForm.ts:215`). Proposition : un composant `Toast`
   (≈ 3 s, « Annuler » sur les suppressions de séance, dépense, souvenir, avec
   `accessibilityLiveRegion`), puis remplacer les alertes de confirmation de suppression
   par la suppression immédiate + annulation. Chantier d'une demi-journée, à mettre
   en 1.3.0.
2. **Une seule formule pour « c'est réservé à Premium ».** Constat : 5 tournures pour la
   même idée — « Réservé à Premium », « Avec Premium. », « Disponible avec Premium »,
   « Premium. » seul, « réservée aux comptes Premium ». Proposition : une phrase-type
   « Avec Premium » en fin de description, « Réservé à Premium » seulement dans les
   écrans verrouillés ; unifier aussi « Horsetrack Premium » / « Premium ».
3. **Un composant `EmptyState` partagé.** Le gabarit est copié 52 fois avec de petites
   variations (marges, taille d'icône). Proposition : un composant (icône, phrase, bouton
   facultatif), pour garantir qu'un vide dise toujours quoi faire.
4. **Le coach répond dans la langue de la première demande du jour.** `coach_suggestions`
   (par compte, cheval, jour) et le résumé du mois sont servis du cache sans tenir compte de
   la langue : une app passée en anglais affiche le texte français déjà en cache. Correction
   serveur (stocker la langue dans le résultat, ignorer le cache si elle diffère).
5. **Messages de quotas écrits en dur et différents d'un écran à l'autre** :
   « Tu as posé tes {n} questions du mois… », « Suggestion du coach déjà donnée aujourd'hui
   pour tes chevaux », « Résumés de ce mois déjà demandés pour **3** chevaux » (le 3 est écrit
   en dur dans le texte, faux dès qu'un quota change). Proposition : une seule forme
   « {n} sur {limite} · repart le {date} », lue de `/api/coach/status`.
6. **Textes d'erreur du serveur affichés tels quels** (codes promo, invitations : français
   dans une app en anglais). Proposition : l'API renvoie un code stable, l'app traduit.
7. **Accessibilité du verrou** : sous l'overlay de `Locked`, le contenu atténué reste lu par
   VoiceOver. Proposition : `accessibilityElementsHidden` sur l'aperçu, libellé sur le cadenas.

## 4. Décision pour toi

Les corrections du § 1 (achat, erreurs réseau, emojis) méritent le prochain build : dis-moi
si je lance le **n° 30** maintenant (≈ 20 min, envoi automatique) ou si tu préfères attendre
le retour de la revue Apple sur le n° 29 pour ne pas la relancer. Les points du § 3 sont des
chantiers pour la 1.3.0.
