import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: 'juridico' | 'atendente';
  is_admin: boolean;
  is_active: boolean;
  avatar_url?: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (data) {
      setProfile(data as Profile);
    } else {
      setProfile(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    let lastFetchedUserId: string | null = null;

    const loadProfile = (userId: string, finishLoading = false) => {
      if (lastFetchedUserId === userId) {
        if (finishLoading && mounted) setLoading(false);
        return;
      }
      lastFetchedUserId = userId;
      fetchProfile(userId)
        .catch(() => { if (mounted) setProfile(null); })
        .finally(() => { if (finishLoading && mounted) setLoading(false); });
    };

    // IMPORTANT: do NOT await Supabase calls inside onAuthStateChange — it can deadlock.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => mounted && loadProfile(session.user.id), 0);
      } else {
        lastFetchedUserId = null;
        setProfile(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id, true);
      } else {
        setLoading(false);
      }
    });

    const refreshHandler = () => {
      lastFetchedUserId = null;
      const uid = (supabase.auth as any)._currentSession?.user?.id;
      if (uid) loadProfile(uid);
    };
    window.addEventListener('profile-refresh', refreshHandler);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener('profile-refresh', refreshHandler);
    };
  }, []);

  // Polling runtime de is_active: se admin desativa, expira sessão em ≤60s
  useEffect(() => {
    if (!profile?.user_id) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('user_id', profile.user_id)
        .single();
      if (data && data.is_active === false) {
        await supabase.auth.signOut();
        setProfile(null);
        setUser(null);
        setSession(null);
        // Soft redirect via reload to clear all state
        if (typeof window !== 'undefined') window.location.href = '/login';
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [profile?.user_id]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
