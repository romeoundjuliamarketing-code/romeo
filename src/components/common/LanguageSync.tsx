import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { syncLanguageWithProfile } from '../../i18n/language';

// Applies the profile language after login / account switch, or uploads the
// local one when the profile has none. Renders nothing.
export default function LanguageSync(): null {
  const { user } = useAuth();
  const userId = user?.id;
  useEffect(() => {
    if (userId) void syncLanguageWithProfile(userId);
  }, [userId]);
  return null;
}
