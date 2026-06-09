-- supabase/migrations/20260609180000_add_studio_profile.sql

-- New columns on studios
ALTER TABLE public.studios
  ADD COLUMN IF NOT EXISTS description   text,
  ADD COLUMN IF NOT EXISTS banner_url    text,
  ADD COLUMN IF NOT EXISTS avatar_url    text,
  ADD COLUMN IF NOT EXISTS disciplines   text[] NOT NULL DEFAULT '{}';

-- Featured fighters table
CREATE TABLE IF NOT EXISTS public.studio_featured_fighters (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id   uuid NOT NULL REFERENCES public.studios(id)   ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  added_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, user_id)
);

ALTER TABLE public.studio_featured_fighters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sff_select" ON public.studio_featured_fighters;
CREATE POLICY "sff_select" ON public.studio_featured_fighters
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "sff_insert" ON public.studio_featured_fighters;
CREATE POLICY "sff_insert" ON public.studio_featured_fighters
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.studios s
      WHERE s.id = studio_id AND s.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "sff_delete" ON public.studio_featured_fighters;
CREATE POLICY "sff_delete" ON public.studio_featured_fighters
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.studios s
      WHERE s.id = studio_id AND s.owner_user_id = auth.uid()
    )
  );

-- Storage bucket for studio banner and avatar images
INSERT INTO storage.buckets (id, name, public)
VALUES ('studio-assets', 'studio-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "studio_assets_select" ON storage.objects;
CREATE POLICY "studio_assets_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'studio-assets');

DROP POLICY IF EXISTS "studio_assets_insert" ON storage.objects;
CREATE POLICY "studio_assets_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'studio-assets');

DROP POLICY IF EXISTS "studio_assets_update" ON storage.objects;
CREATE POLICY "studio_assets_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'studio-assets' AND owner = auth.uid());

DROP POLICY IF EXISTS "studio_assets_delete" ON storage.objects;
CREATE POLICY "studio_assets_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'studio-assets' AND owner = auth.uid());
