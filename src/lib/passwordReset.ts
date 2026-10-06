import type { AuthError } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Deep link handled by RootNavigator's recovery flow (ResetPasswordScreen).
export const PASSWORD_RESET_REDIRECT = 'sparr://reset-password';

// Sends the password-reset mail. Used by the login screen and the settings.
export async function requestPasswordReset(
  email: string,
  captchaToken: string | undefined,
): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    captchaToken,
    redirectTo: PASSWORD_RESET_REDIRECT,
  });
  return { error };
}
