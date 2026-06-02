import { useCallback, useEffect, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { SparringGroupMessage } from '../types/database.types';

export interface GroupMessageWithSender extends SparringGroupMessage {
  senderName: string | null;
}

export interface UseSparringGroupChat {
  messages:       GroupMessageWithSender[];
  loading:        boolean;
  sending:        boolean;
  isReadOnly:     boolean;
  sendError:      string | null;
  sendText:       (content: string) => Promise<void>;
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
  const [messages,   setMessages]   = useState<GroupMessageWithSender[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [sending,    setSending]    = useState(false);
  const [sendError,  setSendError]  = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const isReadOnly = computeIsReadOnly(scheduledAt, durationMin);

  const loadMessages = useCallback(async () => {
    const { data: rows } = await supabase
      .from('sparring_group_messages')
      .select('*')
      .eq('sparring_id', sparringId)
      .order('created_at', { ascending: true });

    const senderIds = [...new Set((rows ?? []).map((r) => r.sender_id))];
    const { data: profiles } = senderIds.length > 0
      ? await supabase.from('profiles').select('id, name').in('id', senderIds)
      : { data: [] };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.name]));

    const enriched: GroupMessageWithSender[] = (rows ?? []).map((row) => ({
      id:          row.id,
      sparring_id: row.sparring_id,
      sender_id:   row.sender_id,
      content:     row.content,
      image_url:   row.image_url,
      is_system:   row.is_system,
      created_at:  row.created_at,
      senderName:  nameMap.get(row.sender_id) ?? null,
    }));
    setMessages(enriched);
    setLoading(false);
  }, [sparringId]);

  const markRead = useCallback(async () => {
    if (user === null) return;
    await supabase.from('sparring_chat_reads').upsert(
      { user_id: user.id, sparring_id: sparringId, last_read_at: new Date().toISOString() },
      { onConflict: 'user_id,sparring_id' },
    );
  }, [sparringId, user]);

  useEffect(() => {
    void loadMessages();
    void markRead();

    channelRef.current = supabase
      .channel(`sparring-group-chat-${sparringId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sparring_group_messages', filter: `sparring_id=eq.${sparringId}` },
        async () => {
          await loadMessages();
          await markRead();
        },
      )
      .subscribe();

    return () => {
      if (channelRef.current !== null) {
        void supabase.removeChannel(channelRef.current);
      }
    };
  }, [sparringId, loadMessages, markRead]);

  const clearSendError = useCallback(() => setSendError(null), []);

  const sendText = useCallback(async (content: string) => {
    if (user === null || isReadOnly) return;
    setSending(true);
    setSendError(null);
    const { error } = await supabase.from('sparring_group_messages').insert({
      sparring_id: sparringId,
      sender_id:   user.id,
      content,
    });
    if (error !== null) setSendError(error.message);
    setSending(false);
  }, [isReadOnly, sparringId, user]);

  const sendImage = useCallback(async (localUri: string) => {
    if (user === null || isReadOnly) return;
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
        setSendError(uploadError?.message ?? 'Bild-Upload fehlgeschlagen.');
        return;
      }

      const { data: urlData } = supabase.storage
        .from('chat-images')
        .getPublicUrl(uploadData.path);

      const { error: insertError } = await supabase.from('sparring_group_messages').insert({
        sparring_id: sparringId,
        sender_id:   user.id,
        image_url:   urlData.publicUrl,
      });
      if (insertError !== null) setSendError(insertError.message);
    } finally {
      setSending(false);
    }
  }, [isReadOnly, sparringId, user]);

  return { messages, loading, sending, isReadOnly, sendError, sendText, sendImage, markRead, clearSendError };
}
