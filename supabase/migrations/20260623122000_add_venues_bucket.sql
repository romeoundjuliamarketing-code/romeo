-- Storage bucket for venue banner, avatar, and gallery images
INSERT INTO storage.buckets (id, name, public)
VALUES ('venues', 'venues', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "venues_select" ON storage.objects;
CREATE POLICY "venues_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'venues');

DROP POLICY IF EXISTS "venues_insert" ON storage.objects;
CREATE POLICY "venues_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'venues');

DROP POLICY IF EXISTS "venues_update" ON storage.objects;
CREATE POLICY "venues_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'venues' AND owner = auth.uid());

DROP POLICY IF EXISTS "venues_delete" ON storage.objects;
CREATE POLICY "venues_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'venues' AND owner = auth.uid());
