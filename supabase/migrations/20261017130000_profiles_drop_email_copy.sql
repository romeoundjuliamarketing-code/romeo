-- profiles.email was a copy of auth.users.email, readable by every signed-in
-- user (profiles SELECT policy + column grants). Nothing reads it: no app build,
-- no function (is_venue_admin reads auth.users), no website/dashboard query.
-- Stop copying it and clear the copies; the column stays so old builds'
-- select('*') keeps working. auth.users.email remains the source of truth.

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, credits)
  values (new.id, 20)
  on conflict (id) do nothing;
  return new;
end;
$function$;

UPDATE public.profiles SET email = NULL WHERE email IS NOT NULL;
