import { useCallback, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import i18n from '../i18n';
import { fetchChatPage } from '../lib/chatPage';
import type { PageQuery } from '../utils/chatSync';
import { useChatMessageStream } from './useChatMessageStream';
import type { SparringGroupMessage } from '../types/database.types';

export interface GroupMessageWithSender extends SparringGroupMessage {
  senderName:      string | null;
  senderAvatarUrl: string | null;
}

export interface UseSparringGroupChat {
  messages:       GroupMessageWithSender[];
  loading:        boolean;
  loadingOlder:   boolean;
  hasMore:        boolean;
  loadOlder:      () => void;
  sending:        boolean;
  isReadOnly:     boolean;
  sendError:      string | null;
  sendText:       (content: string) => Promise<{ error: string | null }>;
  sendImage:      (localUri: string) => Promise<void>;
  markRead:       () => Promise<void>;
  clearSendError: () => void;
}

function computeIsReadOnly(scheduledAt: string, durationMin: number): boolean {
  return new Date(scheduledAt).getTime() + durationMin * 60_000 < Date.now();
}

export function useSparringGroupChat(
  sparringId:  string,
  scheduledAt: string,
  durationMin: number,
): UseSparringGroupChat {
  const { user } = useAuth();
  // Depend on the id, not the user object: a token refresh creates a new object.
  const userId = user?.id ?? null;
  const [sending,    setSending]    = useState(false);
  const [sendError,  setSendError]  = useState<string | null>(null);
  const senderNamesRef   = useRef<Map<string, string | null>>(new Map());
  const senderAvatarsRef = useRef<Map<string, string | null>>(new Map());

  const isReadOnly = computeIsReadOnly(scheduledAt, durationMin);

  const fetchPage = useCallback((query: PageQuery, limit: number): Promise<SparringGroupMessage[]> =>
    fetchChatPage(supabase.from('sparring_group_messages').select('*').eq('sparring_id', sparringId), query, limit),
  [sparringId]);

  // Resolves names/avatars for unknown senders once and caches them.
  const enrich = useCallback(async (rows: SparringGroupMessage[]): Promise<GroupMessageWithSender[]> => {
    const missing = new Set(rows.map((r) => r.sender_id).filter((id) => !senderNamesRef.current.has(id)));
    // Seed the current user so own messages show avatar/name even before they wrote anything.
    if (userId !== null && !senderNamesRef.current.has(userId)) missing.add(userId);
    if (missing.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', [...missing]);
      for (const p of profiles ?? []) {
        senderNamesRef.current.set(p.id, p.name);
        senderAvatarsRef.current.set(p.id, p.avatar_url ?? null);
      }
    }
    return rows.map((row) => ({
      ...row,
      senderName:      senderNamesRef.current.get(row.sender_id) ?? null,
      senderAvatarUrl: senderAvatarsRef.current.get(row.sender_id) ?? null,
    }));
  }, [userId]);

  const markRead = useCallback(async () => {
    if (userId === null) return;
    await supabase.from('sparring_chat_reads').upsert(
      { user_id: userId, sparring_id: sparringId, last_read_at: new Date().toISOString() },
      { onConflict: 'user_id,sparring_id' },
    );
  }, [sparringId, userId]);

  const stream = useChatMessageStream<SparringGroupMessage, GroupMessageWithSender>({
    streamKey:      `${sparringId}:${userId ?? ''}`,
    channelName:    `sparring-group-chat-${sparringId}`,
    table:          'sparring_group_messages',
    filter:         `sparring_id=eq.${sparringId}`,
    fetchPage,
    enrich,
    onMessagesSeen: () => { void markRead(); },
  });

  const { currentSync } = stream;

  const clearSendError = useCallback(() => setSendError(null), []);

  const sendText = useCallback(async (content: string): Promise<{ error: string | null }> => {
    if (userId === null || isReadOnly) return { error: null };
    // Captured before awaiting: a late response must not land in another chat.
    const sync = currentSync();
    setSending(true);
    setSendError(null);
    const { data: newRow, error } = await supabase
      .from('sparring_group_messages')
      .insert({ sparring_id: sparringId, sender_id: userId, content })
      .select('*')
      .single();
    if (error !== null) {
      setSendError(error.message);
      setSending(false);
      return { error: error.message };
    }
    if (newRow !== null && sync !== null) {
      const [msg] = await enrich([newRow]);
      if (msg !== undefined) sync.receive(msg);
    }
    setSending(false);
    return { error: null };
  }, [currentSync, enrich, isReadOnly, sparringId, userId]);

  const sendImage = useCallback(async (localUri: string) => {
    if (userId === null || isReadOnly) return;
    setSending(true);
    setSendError(null);
    try {
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const ext      = (localUri.split('?')[0] ?? '').split('.').pop() ?? 'jpg';
      const filename = `${sparringId}/${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(filename, decode(base64), { contentType: `image/${ext}` });

      if (uploadError !== null || uploadData === null) {
        setSendError(uploadError?.message ?? i18n.t('chat.screen.imageUploadFailed'));
        return;
      }

      const { data: urlData } = supabase.storage
        .from('chat-images')
        .getPublicUrl(uploadData.path);

      const { error: insertError } = await supabase.from('sparring_group_messages').insert({
        sparring_id: sparringId,
        sender_id:   userId,
        image_url:   urlData.publicUrl,
      });
      if (insertError !== null) setSendError(insertError.message);
    } finally {
      setSending(false);
    }
  }, [isReadOnly, sparringId, userId]);

  return {
    messages:     stream.messages,
    loading:      stream.loading,
    loadingOlder: stream.loadingOlder,
    hasMore:      stream.hasMore,
    loadOlder:    stream.loadOlder,
    sending, isReadOnly, sendError, sendText, sendImage, markRead, clearSendError,
  };
}
