import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import i18n from '../i18n';
import { serverErrorText } from '../utils/serverErrorText';

interface UseStudioInviteResult {
  code:         string | null;
  loading:      boolean;
  error:        string | null;
  createInvite: (studioId: string) => Promise<void>;
  acceptInvite: (code: string) => Promise<{ error: string | null; studioId: string | null }>;
}

export function useStudioInvite(): UseStudioInviteResult {
  const [code, setCode]       = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function createInvite(studioId: string): Promise<void> {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('create_studio_invite', {
      p_studio_id: studioId,
    });
    setLoading(false);
    if (rpcError !== null) {
      reportNetworkError(rpcError);
      setError(serverErrorText(rpcError.message));
      return;
    }
    reportNetworkSuccess();
    setCode(data as string);
  }

  async function acceptInvite(codeInput: string): Promise<{ error: string | null; studioId: string | null }> {
    const { data, error: rpcError } = await supabase.rpc('accept_studio_invite_v2', {
      p_code: codeInput,
    });
    if (rpcError !== null) {
      reportNetworkError(rpcError);
      return { error: serverErrorText(rpcError.message), studioId: null };
    }
    reportNetworkSuccess();
    const result: unknown = data;
    const status: unknown = typeof result === 'object' && result !== null && 'status' in result
      ? (result as { status?: unknown }).status
      : undefined;
    if (status === 'ok') {
      const id: unknown = (result as { studio_id?: unknown }).studio_id;
      if (typeof id === 'string' && id.length > 0) return { error: null, studioId: id };
      return { error: i18n.t('team.invite.invalid'), studioId: null };
    }
    if (status === 'locked') return { error: i18n.t('team.invite.locked'), studioId: null };
    if (status === 'no_subscription') return { error: i18n.t('team.invite.noSubscription'), studioId: null };
    if (status === 'not_signed_in') return { error: i18n.t('team.errors.notSignedIn'), studioId: null };
    return { error: i18n.t('team.invite.invalid'), studioId: null };
  }

  return { code, loading, error, createInvite, acceptInvite };
}
