import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Signup failures must not reveal whether an email address already has an
 * account. Any "already registered / already exists" style response from the
 * auth provider is collapsed into a single neutral message; genuinely
 * non-identifying problems (e.g. a weak password) keep their own wording.
 */
function safeSignUpError(message: string | undefined): string | null {
  if (!message) return null;

  const normalized = message.toLowerCase();
  const revealsExistence =
    normalized.includes('already registered') ||
    normalized.includes('already exists') ||
    normalized.includes('already been registered') ||
    normalized.includes('user already');

  if (revealsExistence) {
    return 'We could not create an account with those details. If you already have an account, try signing in instead.';
  }

  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) console.error('Session error:', error);
        setSession(data.session);
      })
      .catch((err) => {
        console.error('getSession failed:', err);
      })
      .finally(() => {
        setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: safeSignUpError(error?.message) };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    // Sign-in failures are always reported the same way so that a wrong
    // password and an unknown address are indistinguishable.
    return { error: error ? 'Incorrect email or password' : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, loading, signUp, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
