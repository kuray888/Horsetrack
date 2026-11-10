# Fiche App Store — textes prêts à coller

Textes pour App Store Connect (langue : français). Les longueurs respectent les limites d'Apple (vérifiées).

## Champs principaux

| Champ | Texte | Longueur |
|---|---|---|
| Nom | Horsetrack : suivi du cheval | 28 / 30 |
| Sous-titre | Soins, planning et concours | 27 / 30 |
| Mots-clés | `equitation,écurie,véto,maréchal,vaccin,vermifuge,dressage,cso,demi-pension,carnet,budget,cavalier` | 97 / 100 |
| Texte promotionnel | Nouveau : un coach IA qui connaît ton cheval, la séance en direct avec GPS, tes créneaux de la semaine et l'export de tes dépenses en PDF. | 129 / 170 |

Pour les mots-clés : ne répète pas un mot déjà présent dans le nom ou le sous-titre, Apple les indexe déjà. Pas d'espace après les virgules.

## Description

> Toi et ton cheval, organisés.
>
> Horsetrack réunit tout le suivi de ton cheval au même endroit : séances, soins, concours, papiers et budget. Fini les ordonnances perdues, le vermifuge oublié ou le carnet resté à l'écurie.
>
> **SUIVI SANTÉ**
> • Véto, maréchal, ostéo, dentiste, vaccins, vermifuges : tout est noté, avec les prochaines échéances
> • Un rappel avant chaque rendez-vous (1 à la fois en gratuit, illimités avec Premium)
> • Carnet de santé exportable en PDF, à envoyer au véto en un geste
> • Un coach IA qui répond d'après le carnet de ton cheval : séances, soins, dépenses, poids (il ne remplace pas ton vétérinaire)
> • Séance en direct : chrono, distance, allures et tracé GPS, même écran verrouillé ; en Premium, tes proches suivent ta position en balade
>
> **PLANNING ET JOURNAL**
> • Planifie tes séances, coche-les une fois faites
> • Créneaux réguliers : « mardi 18 h, cours » revient chaque semaine (Premium)
> • Journal d'entraînement avec la météo du jour
> • Bilan de la semaine, bilan du mois et rapport du mois en PDF à partager
>
> **CONCOURS**
> • Prépare tes concours, épreuve par épreuve (Premium)
>
> **PAPIERS ET BUDGET**
> • Photographie ordonnances et factures, elles sont rangées et retrouvées en deux secondes (Premium)
> • Suis tes dépenses, et avec Premium, ce qui est payé et ce qui reste à régler
> • Exporte les dépenses d'une année en PDF ou en tableur (Premium)
>
> **À PLUSIEURS**
> • Partage ton cheval avec ta demi-pension, ton coach ou ton groom (une personne par cheval) : elle retrouve son planning, ses soins et ses rendez-vous (Premium)
> • Chacun ses droits : ta DP note ses séances, ton groom les soins courants, ton budget reste à toi
>
> **GRATUIT POUR COMMENCER**
> La version gratuite suit 1 cheval avec le planning, l'agenda, le journal, les dépenses et un rappel à la fois. Horsetrack Premium ajoute les chevaux illimités, les rappels illimités, le coffre-fort, le partage, les concours détaillés, les créneaux réguliers, le rapport du mois et l'export des dépenses. Essai gratuit d'1 mois, puis 3,99 €/mois ou 39,99 €/an. Abonnements renouvelés automatiquement, annulables à tout moment dans Réglages > Abonnements.
>
> Conditions : [lien /cgu] · Confidentialité : [lien /confidentialite]

## Captures d'écran (10, dans cet ordre)

Générées par `tools/store-screenshots` (`npm run render`, sortie dans `out/fr/soins/`, 1290 × 2796 ; les captures brutes sans mise en page sont dans `out/captures-brutes/`, 1320 × 2868). Les trois premières comptent le plus : elles apparaissent dans les résultats de recherche.

1. **Toute sa fiche dans ta poche** (+ médaille « 5,0 · 11 avis » : chiffres à tenir à jour, cf. `RATING` dans `screens.mjs`)
2. **Ne rate plus aucun soin**
3. **Ta journée en un coup d'œil**
4. **Suis tes balades en direct** (traceur GPS)
5. **Planifie chaque séance**
6. **Un coach IA qui connaît ton cheval**
7. **Sache ce que ton cheval te coûte**
8. **Partage avec ta demi-pension**
9. **Garde chaque souvenir**
10. **Ton cheval, au même endroit** (récapitulatif et bouton de téléchargement)

Jeux d'ordre pour le test de page produit (Product Page Optimization) : `soins` (par défaut), `coach`, `ecurie`.

## Pages produit personnalisées (une par public)

À créer dans App Store Connect → Pages produit personnalisées, puis à utiliser comme lien dans tes publications ou campagnes selon le public :

| Page | Première capture | Pour qui |
|---|---|---|
| Propriétaire avec DP | « Partage ton cheval avec ta demi-pension » | Groupes Facebook et annonces de demi-pension |
| Compétition (CSO, dressage, CCE) | « Prépare tes concours, épreuve par épreuve » | Publications en saison de concours |
| Santé | « Ne rate plus un vaccin ni un vermifuge » | Printemps et automne (campagnes de vaccination) |

## Événements in-app (App Store)

| Période | Événement | Accroche |
|---|---|---|
| Mars | Vaccins de printemps | « Planifie vaccins et vermifuges de la saison » |
| Avril à juin | Saison des concours | « Prépare ta saison, épreuve par épreuve » |
| Septembre | Rentrée à l'écurie | « Nouvelle saison : planning, DP, budget » |
| Décembre | Bilan de l'année | « Ton année avec ton cheval » |

## Réponses aux avis (modèles)

- **Avis positif** : « Merci beaucoup ! Ravis que Horsetrack t'aide avec [cheval/soins]. Une idée pour la suite ? Écris-nous depuis Profil → Contacter le support. »
- **Bug** : « Désolés pour ce souci. Écris-nous depuis Profil → Contacter le support (la version de l'app est ajoutée automatiquement) pour qu'on règle ça vite. »
- **Prix / Premium** : « Merci pour ton retour. La version gratuite reste complète pour 1 cheval, avec un rappel offert ; Premium ajoute les rappels illimités, le coffre-fort, le partage, les chevaux illimités et les créneaux réguliers, avec 1 mois d'essai annulable à tout moment. »

## « Nouveautés » de la version 1.2

> • Un coach IA qui répond d'après le carnet de ton cheval
> • Séance en direct avec GPS : chrono, distance, allures et tracé
> • Créneaux réguliers : tes séances de la semaine reviennent chaque semaine
> • Rapport du mois en PDF, et export de tes dépenses en PDF ou en tableur
> • Fiche du cheval plus claire, et un widget pour l'écran d'accueil
> • Partage avec ta demi-pension, ton coach ou ton groom : chacun ses droits

> Écurie Pro (plusieurs personnes par cheval, vue écurie) est en pause : ne pas la mentionner, et ne pas rattacher de produit Pro à la 1.2.0.

## « Nouveautés » de la version 1.1.x

> • Prends en photo ordonnances, factures et ton cheval directement depuis l'app
> • Bilan du mois à partager, et ta série de semaines actives
> • Invite ta demi-pension ou ton coach par message
> • Nouvel écran Premium, plus clair sur les prix, l'essai et sa date de fin
> • Rappel avant la fin de l'essai
> • Corrections : bilan du dimanche plus juste, notifications mieux expliquées
