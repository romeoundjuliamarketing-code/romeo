// Invisible component: calls read-only data hooks once to warm the query cache
// for the Profil tab while the user is on Home.
// Returns null — no UI, no layout impact.
import { useFightRecord } from '../../hooks/useFightRecord';
import { useStudio } from '../../hooks/useStudio';
import { useProfile } from '../../hooks/useProfile';
import { useEntitlement } from '../../hooks/useEntitlement';
import { useVerification } from '../../hooks/useVerification';

// Hooks deliberately excluded:
// - Sparring-map hooks: excluded per spec (too heavy).

export default function CacheWarmer(): null {
  // Mirror the same default argument (0) that screens pass on their first render
  useFightRecord(0);
  useStudio(0);
  useProfile(0);
  useEntitlement(0);
  useVerification(0);

  return null;
}
