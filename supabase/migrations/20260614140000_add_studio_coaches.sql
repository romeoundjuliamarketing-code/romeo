-- supabase/migrations/20260614140000_add_studio_coaches.sql

CREATE TABLE IF NOT EXISTS public.studio_coaches (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id  uuid NOT NULL REFERENCES public.studios(id)  ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       text,
  position   int NOT NULL DEFAULT 0,
  added_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, user_id)
);

ALTER TABLE public.studio_coaches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sc_select" ON public.studio_coaches;
CREATE POLICY "sc_select" ON public.studio_coaches
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "sc_insert" ON public.studio_coaches;
CREATE POLICY "sc_insert" ON public.studio_coaches
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      EXISTS (SELECT 1 FROM public.studios s WHERE s.id = studio_coaches.studio_id AND s.owner_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_coach = true AND p.studio_id = studio_coaches.studio_id)
    )
  );

DROP POLICY IF EXISTS "sc_update" ON public.studio_coaches;
CREATE POLICY "sc_update" ON public.studio_coaches
  FOR UPDATE TO authenticated
  USING (
    (
      EXISTS (SELECT 1 FROM public.studios s WHERE s.id = studio_coaches.studio_id AND s.owner_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_coach = true AND p.studio_id = studio_coaches.studio_id)
    )
  )
  WITH CHECK (
    (
      EXISTS (SELECT 1 FROM public.studios s WHERE s.id = studio_coaches.studio_id AND s.owner_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_coach = true AND p.studio_id = studio_coaches.studio_id)
    )
  );

DROP POLICY IF EXISTS "sc_delete" ON public.studio_coaches;
CREATE POLICY "sc_delete" ON public.studio_coaches
  FOR DELETE TO authenticated
  USING (
    (
      EXISTS (SELECT 1 FROM public.studios s WHERE s.id = studio_coaches.studio_id AND s.owner_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_coach = true AND p.studio_id = studio_coaches.studio_id)
    )
  );
