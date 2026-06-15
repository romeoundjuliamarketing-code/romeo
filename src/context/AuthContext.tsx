import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { clearQueryCache, hydrateQueryCache } from '../lib/queryCache';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, captchaToken?: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // Track previous user ID to detect account switches
  const prevUserIdRef = useRef<string | null>(null);

  // Hydrate the query cache once on mount before showing any UI
  useEffect(() => {
    hydrateQueryCache().finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION synchronously with the persisted session,
    // replacing the need for a separate getSession() call and avoiding race conditions.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      const newUserId = newSession?.user.id ?? null;
      // Clear cache on sign-out or when a different account signs in
      if (_event === 'SIGNED_OUT' || (newUserId !== null && newUserId !== prevUserIdRef.current && prevUserIdRef.current !== null)) {
        clearQueryCache();
      }
      prevUserIdRef.current = newUserId;
      setSession(newSession);
      setAuthReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string, captchaToken?: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken !== undefined ? { captchaToken } : undefined,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, captchaToken?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: captchaToken !== undefined ? { captchaToken } : undefined,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading: !authReady || !hydrated, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
