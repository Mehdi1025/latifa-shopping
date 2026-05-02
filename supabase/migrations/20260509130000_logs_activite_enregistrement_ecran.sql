-- Replay d'écran rrweb pour les lignes critiques (encaissement, annulation panier, ligne entière).
-- À appliquer après 20260509120000_logs_activite.sql

ALTER TABLE public.logs_activite
  ADD COLUMN IF NOT EXISTS enregistrement_ecran jsonb DEFAULT NULL;

COMMENT ON COLUMN public.logs_activite.enregistrement_ecran IS
  'Événements rrweb sérialisés (tableau JSON) pour replay administrateur VAR';
