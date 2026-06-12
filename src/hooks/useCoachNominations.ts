import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import { getCached, setCached } from '../lib/queryCache';
import type {
  Profile,
  CoachNomination,
  CoachNominationInsert,
  CoachNominationDetails,
  Json,
} from '../types/database.types';

// Raw shape returned by the Supabase join (votes nested)
type NominationRow = CoachNomination & {
  votes: Array<{ voter_id: string }>;
};

// Parses the jsonb result from an RPC call into { error } or { success }
function parseRpcResult(data: Json | null): { error: string | null } {
  if (data === null) return { error: 'Unbekannter Fehler' };
  const result = data as Record<string, string | boolean>;
  if (typeof result.error === 'string') return { error: result.error };
  return { error: null };
}

// Determines whether the current user may confirm a nomination
function computeCanConfirm(
  nom: NominationRow,
  userId: string,
  userProfile: Profile,
  teamCoaches: Profile[],
): boolean {
  if (nom.votes.some((v) => v.voter_id === userId)) return false; // already voted

  if (nom.type === 'promote') {
    // Coaches in the team excluding the nominee
    const coachesExcludingNominee = teamCoaches.filter((c) => c.id !== nom.nominee_id);
    // If coaches exist → only coaches may confirm
    if (coachesExcludingNominee.length > 0 && !userProfile.is_coach) return false;
    return true;
  }

  if (nom.type === 'demote') {
    if (!userProfile.is_coach) return false;
    if (nom.nominee_id === userId) return false; // use self_demote instead
    return true;
  }

  return false;
}

// Determines whether the current user may reject a nomination
function computeCanReject(
  nom: NominationRow,
  userId: string,
  userProfile: Profile,
): boolean {
  if (nom.nominator_id === userId) return true; // nominator can always cancel
  return userProfile.is_coach;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseCoachNominationsResult {
  pendingNominations: CoachNominationDetails[];
  teamCoaches: Profile[];
  teamMembers: Profile[];
  isCoach: boolean;
  loading: boolean;
  nominatePromotion: (nomineeId: string) => Promise<{ error: string | null }>;
  nominateDemotion: (nomineeId: string) => Promise<{ error: string | null }>;
  confirmNomination: (nominationId: string) => Promise<{ error: string | null }>;
  rejectNomination: (nominationId: string) => Promise<{ error: string | null }>;
  selfDemote: () => Promise<{ error: string | null }>;
  refetch: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

type NominationsSnapshot = {
  pendingNominations: CoachNominationDetails[];
  teamCoaches: Profile[];
  teamMembers: Profile[];
  userProfile: Profile | null;
};

// studioId: the team to load. Pass the id you already have (e.g. from route
// params) so we can skip the extra own-profile round-trip — the current user's
// profile is derived from the members list instead.
export function useCoachNominations(studioId: string | null): UseCoachNominationsResult {
  const { user } = useAuth();

  const cacheKey = user !== null && studioId !== null ? `useCoachNominations:${studioId}` : null;
  const cached = cacheKey ? getCached<NominationsSnapshot>(cacheKey) : undefined;

  const [pendingNominations, setPendingNominations] = useState<CoachNominationDetails[]>(() => cached?.pendingNominations ?? []);
  const [teamCoaches, setTeamCoaches] = useState<Profile[]>(() => cached?.teamCoaches ?? []);
  const [teamMembers, setTeamMembers] = useState<Profile[]>(() => cached?.teamMembers ?? []);
  const [userProfile, setUserProfile] = useState<Profile | null>(() => cached?.userProfile ?? null);
  // Spinner only on a genuine cold load — a cached snapshot renders instantly.
  const [loading, setLoading] = useState(cached === undefined && studioId !== null);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((n) => n + 1), []);

  useEffect(() => {
    if (user === null || studioId === null) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    // Keep showing cached data while revalidating — don't flip back to a spinner.
    if (cacheKey && getCached<NominationsSnapshot>(cacheKey) === undefined) {
      setLoading(true);
    }

    void (async () => {
      // Members (which includes the current user) + pending nominations run in
      // parallel — no sequential own-profile fetch gating them.
      const [membersRes, nominationsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('studio_id', studioId),
        supabase
          .from('coach_nominations')
          .select('*')
          .eq('team_id', studioId)
          .eq('status', 'pending'),
      ]);

      if (cancelled) return;

      const members = (membersRes.data ?? []) as Profile[];
      const nominations = nominationsRes.data ?? [];
      // Derive the current user's profile from the members list.
      const profile = members.find((m) => m.id === user.id) ?? null;

      const nominationIds = nominations.map((n) => n.id);
      const votesRes = nominationIds.length > 0
        ? await supabase
            .from('coach_votes')
            .select('nomination_id, voter_id')
            .in('nomination_id', nominationIds)
        : { data: [] as Array<{ nomination_id: string; voter_id: string }>, error: null };

      if (cancelled) return;

      // Group votes by nomination_id
      const votesByNomination = new Map<string, Array<{ voter_id: string }>>();
      for (const v of votesRes.data ?? []) {
        const list = votesByNomination.get(v.nomination_id) ?? [];
        list.push({ voter_id: v.voter_id });
        votesByNomination.set(v.nomination_id, list);
      }

      // Attach votes to nominations to build NominationRow[]
      const rawNominations: NominationRow[] = nominations.map((nom) => ({
        ...nom,
        votes: votesByNomination.get(nom.id) ?? [],
      }));

      const coaches = members.filter((m) => m.is_coach);
      const membersById = new Map(members.map((m) => [m.id, m]));

      const enriched: CoachNominationDetails[] = rawNominations.map((nom) => ({
        id: nom.id,
        nominee_id: nom.nominee_id,
        nominator_id: nom.nominator_id,
        team_id: nom.team_id,
        type: nom.type,
        status: nom.status,
        created_at: nom.created_at,
        nominee_name: membersById.get(nom.nominee_id)?.name ?? null,
        nominator_name: membersById.get(nom.nominator_id)?.name ?? null,
        vote_count: nom.votes.length,
        has_voted: nom.votes.some((v) => v.voter_id === user.id),
        // Without a resolved profile the user can't act on anything (safe default)
        can_confirm: profile !== null && computeCanConfirm(nom, user.id, profile, coaches),
        can_reject: profile !== null && computeCanReject(nom, user.id, profile),
      }));

      if (membersRes.error !== null) {
        reportNetworkError(membersRes.error);
      } else {
        reportNetworkSuccess();
      }
      setUserProfile(profile);
      setTeamMembers(members);
      setTeamCoaches(coaches);
      setPendingNominations(enriched);
      if (cacheKey) {
        setCached<NominationsSnapshot>(cacheKey, {
          pendingNominations: enriched,
          teamCoaches: coaches,
          teamMembers: members,
          userProfile: profile,
        });
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, studioId, trigger, cacheKey]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const nominatePromotion = useCallback(
    async (nomineeId: string): Promise<{ error: string | null }> => {
      if (user === null || userProfile === null) return { error: 'Nicht eingeloggt' };
      if (userProfile.studio_id === null) return { error: 'Kein Team beigetreten' };

      const nominee = teamMembers.find((m) => m.id === nomineeId);
      if (nominee === undefined) return { error: 'Person nicht im Team' };
      if (nominee.is_coach) return { error: 'Person ist bereits Trainer' };
      if (nomineeId === user.id) return { error: 'Selbst-Nominierung nicht möglich' };

      const insert: CoachNominationInsert = {
        nominee_id: nomineeId,
        nominator_id: user.id,
        team_id: userProfile.studio_id,
        type: 'promote',
      };

      const { error } = await supabase.from('coach_nominations').insert(insert);
      if (error !== null) {
        if (error.code === '23505') return { error: 'Bereits eine offene Nominierung vorhanden' };
        return { error: error.message };
      }

      refetch();
      return { error: null };
    },
    [user, userProfile, teamMembers, refetch],
  );

  const selfDemote = useCallback(async (): Promise<{ error: string | null }> => {
    const { data } = await supabase.rpc('self_demote_coach');
    const result = parseRpcResult(data);
    if (result.error === null) refetch();
    return result;
  }, [refetch]);

  const nominateDemotion = useCallback(
    async (nomineeId: string): Promise<{ error: string | null }> => {
      if (user === null || userProfile === null) return { error: 'Nicht eingeloggt' };
      if (!userProfile.is_coach) return { error: 'Nur Trainer können Entfernungen nominieren' };
      if (userProfile.studio_id === null) return { error: 'Kein Team beigetreten' };

      // Self-demotion: handled by dedicated RPC (immediate, no vote required)
      if (nomineeId === user.id) {
        const { data } = await supabase.rpc('self_demote_coach');
        const result = parseRpcResult(data);
        if (result.error === null) refetch();
        return result;
      }

      const nominee = teamMembers.find((m) => m.id === nomineeId);
      if (nominee === undefined) return { error: 'Person nicht im Team' };
      if (!nominee.is_coach) return { error: 'Person ist kein Trainer' };

      const insert: CoachNominationInsert = {
        nominee_id: nomineeId,
        nominator_id: user.id,
        team_id: userProfile.studio_id,
        type: 'demote',
      };

      const { error } = await supabase.from('coach_nominations').insert(insert);
      if (error !== null) {
        if (error.code === '23505') return { error: 'Bereits eine offene Nominierung vorhanden' };
        return { error: error.message };
      }

      refetch();
      return { error: null };
    },
    [user, userProfile, teamMembers, refetch],
  );

  const confirmNomination = useCallback(
    async (nominationId: string): Promise<{ error: string | null }> => {
      const { data } = await supabase.rpc('cast_coach_vote', {
        p_nomination_id: nominationId,
      });
      const result = parseRpcResult(data);
      if (result.error === null) refetch();
      return result;
    },
    [refetch],
  );

  const rejectNomination = useCallback(
    async (nominationId: string): Promise<{ error: string | null }> => {
      const { data } = await supabase.rpc('reject_coach_nomination', {
        p_nomination_id: nominationId,
      });
      const result = parseRpcResult(data);
      if (result.error === null) refetch();
      return result;
    },
    [refetch],
  );

  return {
    pendingNominations,
    teamCoaches,
    teamMembers,
    isCoach: userProfile?.is_coach ?? false,
    loading,
    nominatePromotion,
    nominateDemotion,
    confirmNomination,
    rejectNomination,
    selfDemote,
    refetch,
  };
}
