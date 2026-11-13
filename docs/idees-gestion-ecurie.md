# Idées pour le projet « gestion d'écurie » (chantier séparé, rien de construit ici)

- Le backend Pro reste en place : `ride_slots`, `stable_tasks`, `participation_fees`, rôles, RLS testée,
  espace `/gestion` en lecture seule. Point de départ naturel du futur projet.
- `/gestion` n'est lié nulle part et est `noindex` ; son texte mentionne encore « Écurie Pro » (page privée).
- La limite de débit en mémoire (`lib/rateLimit.ts`) devra devenir une table ou le WAF si l'usage monte.
- Le lien public de séance pourrait servir de brique « fiche partageable » pour les écuries.
