import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';

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
      setError(rpcError.message);
      return;
    }
    reportNetworkSuccess();
    setCode(data as string);
  }

  async function acceptInvite(codeInput: string): Promise<{ error: string | null; studioId: string | null }> {
    const { data, error: rpcError } = await supabase.rpc('accept_studio_invite', {
      p_code: codeInput,
    });
    if (rpcError !== null) {
      reportNetworkError(rpcError);
      return { error: rpcError.message, studioId: null };
    }
    reportNetworkSuccess();
    return { error: null, studioId: data as string };
  }

  return { code, loading, error, createInvite, acceptInvite };
}
