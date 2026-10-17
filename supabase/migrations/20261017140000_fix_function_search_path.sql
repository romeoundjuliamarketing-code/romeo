-- Supabase advisor "function_search_path_mutable": pin search_path on the
-- remaining functions. All of them only call built-ins or schema-qualified
-- public.* functions, so behaviour is unchanged.
ALTER FUNCTION public.enforce_clean_open_sparring() SET search_path = public;
ALTER FUNCTION public.enforce_clean_group_message() SET search_path = public;
ALTER FUNCTION public.enforce_clean_profile_bio() SET search_path = public;
ALTER FUNCTION public.enforce_clean_studio_name() SET search_path = public;
ALTER FUNCTION public.guard_profiles_studio_id() SET search_path = public;
ALTER FUNCTION public.normalize_text(text) SET search_path = public;
ALTER FUNCTION public.onboarding_age_ok(date) SET search_path = public;
