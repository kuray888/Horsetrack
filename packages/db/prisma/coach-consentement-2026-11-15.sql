-- Coach IA : l'accord de l'utilisateur pour envoyer son carnet au prestataire
-- d'intelligence artificielle est désormais gardé et vérifié côté serveur
-- (avant, seule l'app le vérifiait : un ancien build ou un appel direct à
-- l'API envoyait le carnet sans accord). À appliquer AVANT de déployer l'API.
-- Rétrocompatible : colonne nullable, aucune ligne existante n'est modifiée ;
-- l'app renvoie l'accord déjà donné sur l'appareil au premier appel refusé.

alter table public.rider_profiles
  add column if not exists "coachConsentAt" timestamptz;
