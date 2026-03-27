import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface Profile {
  id: string;
  full_name: string;
  role: 'admin' | 'cashier' | 'volunteer';
  phone: string | null;
  address: string | null;
  email: string | null;
  avatar_url: string | null;
  is_active: boolean;
  approval_status: string;
  approved_by: string | null;
  approved_at: string | null;
  volunteer_id: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isCashier: boolean;
  isVolunteer: boolean;
  isApproved: boolean;
  isProfileComplete: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Session revalidation interval (5 minutes)
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionCheckRef = useRef<ReturnType<typeof setInterval>>();

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    const p = data as unknown as Profile | null;
    setProfile(p);
    return p;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  // Secure logout: clear all local state and caches
  const secureSignOut = useCallback(async () => {
    // Clear interval
    if (sessionCheckRef.current) {
      clearInterval(sessionCheckRef.current);
      sessionCheckRef.current = undefined;
    }

    // Sign out from Supabase
    await supabase.auth.signOut();

    // Clear all state
    setSession(null);
    setUser(null);
    setProfile(null);

    // Clear any cached query data
    // (QueryClient is external, but localStorage cleanup helps)
    try {
      // Remove any app-specific localStorage items
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.startsWith('supabase'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();
    } catch {
      // Fail silently
    }
  }, []);

  // Periodic session & profile revalidation
  const startSessionCheck = useCallback((userId: string) => {
    if (sessionCheckRef.current) clearInterval(sessionCheckRef.current);

    sessionCheckRef.current = setInterval(async () => {
      // Check if session is still valid
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        await secureSignOut();
        return;
      }

      // Revalidate profile status (could have been deactivated/blocked)
      const { data: freshProfile } = await supabase
        .from('profiles')
        .select('is_active, approval_status, role')
        .eq('id', userId)
        .single();

      if (freshProfile && (!freshProfile.is_active || freshProfile.approval_status !== 'approved')) {
        await secureSignOut();
      } else if (freshProfile) {
        // Update role in case it changed
        setProfile(prev => prev ? { ...prev, role: freshProfile.role as any, is_active: freshProfile.is_active, approval_status: freshProfile.approval_status } : prev);
      }
    }, SESSION_CHECK_INTERVAL);
  }, [secureSignOut]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Use setTimeout to avoid Supabase auth deadlock
          setTimeout(() => {
            fetchProfile(session.user.id);
            startSessionCheck(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          if (sessionCheckRef.current) {
            clearInterval(sessionCheckRef.current);
            sessionCheckRef.current = undefined;
          }
        }
        setLoading(false);
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        startSessionCheck(session.user.id);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      if (sessionCheckRef.current) clearInterval(sessionCheckRef.current);
    };
  }, [fetchProfile, startSessionCheck]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return { error: error as Error | null };

    // After successful auth, check profile status
    if (data.user) {
      const p = await fetchProfile(data.user.id);
      if (p && !p.is_active) {
        await supabase.auth.signOut();
        return { error: new Error('Sua conta está desativada. Entre em contato com o administrador.') };
      }
      if (p && p.approval_status === 'rejected') {
        await supabase.auth.signOut();
        return { error: new Error('Sua conta foi recusada. Entre em contato com o administrador.') };
      }
    }

    return { error: null };
  }, [fetchProfile]);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error as Error | null };
  }, []);

  const isVolunteer = profile?.role === 'volunteer';

  const isProfileComplete = isVolunteer
    ? !!(profile && profile.full_name && profile.phone && profile.email)
    : !!(profile && profile.full_name && profile.phone && profile.email && profile.avatar_url);

  const isApproved = profile?.approval_status === 'approved' && profile?.is_active === true;

  return (
    <AuthContext.Provider value={{
      session, user, profile, loading,
      isAdmin: profile?.role === 'admin',
      isCashier: profile?.role === 'cashier',
      isVolunteer,
      isApproved,
      isProfileComplete,
      signIn, signUp, signOut: secureSignOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
