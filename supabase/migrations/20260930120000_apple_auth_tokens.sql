-- Sign in with Apple: Apple refresh tokens, needed to revoke the user's Apple
-- authorization when the account is deleted (App Store guideline 5.1.1(v)).
-- Written and read only by the `apple-auth` Edge Function (service_role).
-- No client access: RLS on, no policies, privileges revoked.

CREATE TABLE IF NOT EXISTS public.apple_auth_tokens (
  user_id       uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  refresh_token text NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.apple_auth_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.apple_auth_tokens FROM anon, authenticated;
