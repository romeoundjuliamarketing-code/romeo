import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';

export interface ChatMessage {
  id: string;
  role: 'user' | 'coach';
  text: string;
}

export function useCoachChat() {
  const { session } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  async function sendMessage(text: string): Promise<void> {
    if (loading) return;

    const userMsg: ChatMessage = { id: String(Date.now()), role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      // Explicitly pass the JWT so the Edge Function receives it correctly in Expo
      const headers: Record<string, string> = session !== null
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};

      const { data, error } = await supabase.functions.invoke('coach-chat', {
        body: { message: text },
        headers,
      });

      if (error !== null) {
        reportNetworkError(error);
        throw error;
      }
      reportNetworkSuccess();

      const result = data as { reply?: string; error?: string; remaining?: number };

      if (result.error === 'limit_reached') {
        const limitMsg: ChatMessage = {
          id: String(Date.now() + 1),
          role: 'coach',
          text: 'Du hast heute dein Limit von 10 Nachrichten erreicht. Morgen bin ich wieder da.',
        };
        setMessages((prev) => [...prev, limitMsg]);
        setRemaining(0);
        return;
      }

      if (result.remaining !== undefined) {
        setRemaining(result.remaining);
      }

      const coachMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: 'coach',
        text: result.reply ?? 'Keine Antwort erhalten.',
      };
      setMessages((prev) => [...prev, coachMsg]);

    } catch {
      const errMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: 'coach',
        text: 'Verbindungsfehler. Versuch es nochmal.',
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }

  return { messages, loading, remaining, sendMessage };
}
