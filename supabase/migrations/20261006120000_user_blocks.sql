-- user_blocks: a user hides another user's chat messages (App Store guideline 1.2).
-- Private to the blocker: the blocked user can neither see nor infer the row.
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT user_blocks_not_self CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocked_id_idx ON public.user_blocks (blocked_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own blocks" ON public.user_blocks
  FOR SELECT TO authenticated
  USING (blocker_id = (SELECT auth.uid()));

CREATE POLICY "Insert own blocks" ON public.user_blocks
  FOR INSERT TO authenticated
  WITH CHECK (blocker_id = (SELECT auth.uid()));

CREATE POLICY "Delete own blocks" ON public.user_blocks
  FOR DELETE TO authenticated
  USING (blocker_id = (SELECT auth.uid()));

REVOKE ALL ON public.user_blocks FROM anon;
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
