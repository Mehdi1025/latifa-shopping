-- Gestion d'équipe : les admins peuvent modifier les profils (rôle, nom affiché).

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(trim(coalesce(p.role, ''))) = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(trim(coalesce(p.role, ''))) = 'admin'
    )
  );

COMMENT ON POLICY "profiles_update_admin" ON public.profiles IS
  'Permet aux admins de modifier rôle et nom des membres de l''équipe.';
