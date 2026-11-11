# Audit « niveau premium » — 2026-11-11 (Mission 1, premier passage)

Branche `release/1.3.0`. **Méthode de ce passage** : mesures automatiques sur les 160 écrans
et composants (`app/`, `src/`), lecture ciblée, corrections testées. **Pas encore fait** : la
grille de notes écran par écran avec captures avant/après sur simulateur. Elle demande une
build Release du simulateur (la dernière date du 27/10) et le mot de passe du compte démo ;
les parcours Maestro existent dans `apps/mobile/.maestro/` (connexion, paywall, captures) ; Maestro demande `JAVA_HOME=/opt/homebrew/opt/openjdk@17`.

Contrôles après corrections : `tsc` 0 erreur, 87 fichiers / 739 tests verts, eslint propre
(hors avertissements `import/first` déjà présents dans `_layout.tsx`).

## 1. Corrigé dans ce passage

| Axe | Écran | Preuve | Gravité | Correction | Test |
|---|---|---|---|---|---|
| Couleurs | Planning, Accueil, Tâches, Frais (coche « faite ») ; balayage « Supprimer » | Blanc en dur sur les couleurs d'état : **2,9:1** en mode sombre (AA : 4,5:1) | Moyenne (toutes les palettes sombres) | Jeton `textOnStatus` / `text-on-status` | `palettes.test.ts` (clair + sombre) |
| Cohérence | Accueil (série 🔥), résumé d'onboarding (★ ✓), sélecteur de chevaux (🔒) | Emoji décoratifs, contraires à CLAUDE.md | Faible | Icônes de l'app (`fire`, `star`, `check`, `lock`) | `designRules.test.ts` |
| Cohérence | `CircularProgress` | Défauts `#eee` / `#000` hors thème | Faible | Couleurs obligatoires | tsc |
| Dérive | Tout le code | Règles de design vérifiées seulement à la relecture | — | **`designRules.test.ts`** : pas de couleur en dur ni Tailwind brute, photos via `AppImage`, aucun emoji décoratif, un seul `text-3xl` par écran, plafond des espacements hors grille (182, ne peut que baisser). Chaque exception est justifiée dans le test. | 7 tests |
| Micro-interactions / pires moments | Planning : supprimer une séance | Balayer « Supprimer » ouvrait encore une alerte « définitive » : 2 gestes, aucun retour | Moyenne | **Toast « Séance supprimée · Annuler »** (5 s, rien ne part au serveur avant ; validé à la mise en arrière-plan ; une relecture du serveur ne fait pas réapparaître la séance) | `undoQueue.test.ts` (6) |
| Anglais | Toast | « Annuler » = « Cancel » dans le dictionnaire, faux pour un toast | Faible | `tc("undo", "Annuler")` → « Undo » | `i18n.test.ts` |

**À voir sur simulateur avant le build 1.3.0** : le toast (position au-dessus de la barre
d'onglets, mode sombre, VoiceOver, « Réduire les animations »).

## 2. Mesures (état actuel)

| Mesure | Valeur | Lecture |
|---|---|---|
| Couleurs hex / rgba hors thème | 7, toutes justifiées (photo, visionneuse, interrupteur iOS) | Bon. Les couleurs figées des tables de catégories passent par `ThemedIcon`, qui les ramène à la palette active. |
| Couleurs Tailwind brutes (`text-red-500`…) | 0 | Bon. |
| Espacements hors grille (`gap-1.5`, `py-2.5`…) | 182, dont 17 dans `AppointmentCard`, 9 `TodaySection`, 8 `TodayCards` | À corriger écran par écran avec captures (le test empêche d'en ajouter). |
| `text-3xl` | 1 par écran (sauf la carte « Mon année », justifiée) | Bon. |
| **Échelle typographique** | Le code utilise l'échelle Tailwind par défaut : `text-xs` 12, `text-sm` 14 (440 usages), `text-base` 16, `text-lg` 18, `text-2xl` 24, `text-3xl` 30. CLAUDE.md annonce 11 / 13 / 15 / 17 / 20 / 28 / 34 (iOS). Seuls 49 `text-[11px]`, `text-[13px]`, `text-[15px]` suivent la règle. | **Écart réel entre la règle et l'app.** Voir § 3, P3. |
| Dynamic Type | Aucun `maxFontSizeMultiplier` : le texte grandit sans limite | Bon pour l'accessibilité ; les tailles AX1–AX5 n'ont jamais été vérifiées (cases 28 pt, boutons 44 pt, rangées à largeur fixe). |
| Attente | 2 écrans avec `Skeleton`, 21 `ActivityIndicator` | CLAUDE.md demande un squelette pour chaque chargement : à reprendre écran par écran. |
| Alertes bloquantes | 102 `Alert.alert` (login 9, changement de mot de passe 9, création de compte 8, séance en direct 8, partage 8) | Beaucoup sont des erreurs légitimes ; les confirmations de suppression (journal, rendez-vous, poids, tâches, contacts) peuvent passer au toast « Annuler ». |
| Listes | 0 `FlatList` ; pagination par `LIST_PAGE_SIZE` + `ShowMoreButton` | Conforme à CLAUDE.md. |
| Tunnel d'analytics | Complet (cf. `etat-des-lieux-2026-11-11.md` § 4) | Bon. |

## 3. Plan priorisé (impact conversion / rétention, effort, risque)

| # | Chantier | Impact | Effort | Risque | Mesure de succès |
|---|---|---|---|---|---|
| P1 | **Captures de référence** : flux Maestro existants complétés (Accueil, fiche cheval, planning, paywall, profil) × clair/sombre × FR/EN, build Release simulateur | Débloque tout le reste de l'audit visuel et les visuels anglais de l'App Store | ½ j | Nul | Jeu de captures commité dans `tools/` |
| P2 | Toast « Annuler » étendu aux autres suppressions (journal, rendez-vous, poids, dépenses, contacts), même mécanique | Ressenti de qualité, moins d'erreurs irréversibles | ½ j | Faible (mêmes garanties que la séance) | `deletion_undone / item_deleted` |
| P3 | **Échelle typographique** : décider entre (a) aligner `tailwind.config.js` sur 11/13/15/17/20/28/34 (change toute l'app d'un coup) ou (b) corriger CLAUDE.md sur l'échelle réelle. Recommandation : (a), après P1, avec captures avant/après | Finition « iOS natif » | ½ j + relecture | Moyen (visuel global) | Captures |
| P4 | Squelettes à la place des `ActivityIndicator` sur les écrans de contenu (équipe, documents, coach, rapport) | Perception de vitesse | ½ j | Faible | — |
| P5 | Dynamic Type AX1–AX5 sur les 5 écrans principaux, corrections de débordement | Accessibilité (et revue Apple) | ½ j | Faible | Captures AX5 |
| P6 | Espacements hors grille : 182 → 0, écran par écran, en commençant par l'Accueil | Cohérence | 1 j | Faible | Plafond du test à 0 |
| P7 | Composant `EmptyState` partagé (52 copies du même gabarit) | Cohérence, chaque vide dit quoi faire | ½ j | Faible | — |

**Expériences à préparer** (`EXPERIMENTS`, livrées `enabled: false`, témoin = actuel) :
- `delete_undo` n'a pas besoin d'A/B (correction d'ergonomie).
- `default_palette` : palette par défaut d'un nouveau compte (Marine en témoin) — n'a de sens
  qu'avec assez d'installations ; à lancer seulement si tes chiffres le permettent (≥ 1 000
  installations par variante pour lire la conversion à l'essai).

## 4. Pas encore couvert (suite de la Mission 1)

Matrice des pires moments écran par écran, notifications et tableau de relances, widget et
pistes iOS (Live Activity), ASO, observabilité : au prochain passage, après P1.
