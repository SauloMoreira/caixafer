import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  mfaEnrolled: boolean;
  mfaVerified: boolean;
  mfaLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshMfaStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_CHECK_INTERVAL = 2 * 60 * 1000; // 2 min for single-session checks

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaEnrolled, setMfaEnrolled] = useState(false);
  const [mfaVerified, setMfaVerified] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(true);
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

  const checkMfaStatus = useCallback(async () => {
    setMfaLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) {
        setMfaEnrolled(false);
        setMfaVerified(false);
        setMfaLoading(false);
        return;
      }
      setMfaVerified(data.currentLevel === 'aal2');
      setMfaEnrolled(data.nextLevel === 'aal2' || data.currentLevel === 'aal2');
    } catch {
      setMfaEnrolled(false);
      setMfaVerified(false);
    }
    setMfaLoading(false);
  }, []);

  const refreshMfaStatus = useCallback(async () => {
    await checkMfaStatus();
  }, [checkMfaStatus]);

  const secureSignOut = useCallback(async (showMessage?: string) => {
    if (sessionCheckRef.current) {
      clearInterval(sessionCheckRef.current);
      sessionCheckRef.current = undefined;
    }
    
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setMfaEnrolled(false);
    setMfaVerified(false);
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.startsWith('supabase'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      sessionStorage.clear();
    } catch {}
    if (showMessage) {
      // Slight delay so toast renders after state clears
      setTimeout(() => toast.info(showMessage), 100);
    }
  }, []);

  // Update last login timestamp
  const registerSession = useCallback(async (userId: string, _sessionId: string) => {
    await supabase
      .from('profiles')
      .update({
        last_login_at: new Date().toISOString(),
      } as any)
      .eq('id', userId);
  }, []);

  // Periodic check: deactivation, role changes
  const validateSession = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('is_active, approval_status, role')
      .eq('id', userId)
      .single();
    
    if (!data) return true;

    // Check if user was deactivated/unapproved
    if (!data.is_active || data.approval_status !== 'approved') {
      await secureSignOut('Sua conta foi desativada. Entre em contato com o administrador.');
      return false;
    }

    // Update role if changed
    setProfile(prev => prev ? { ...prev, role: data.role as any, is_active: data.is_active, approval_status: data.approval_status } : prev);

    return true;
  }, [secureSignOut]);

  const startSessionCheck = useCallback((userId: string) => {
    if (sessionCheckRef.current) clearInterval(sessionCheckRef.current);
    sessionCheckRef.current = setInterval(async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        await secureSignOut();
        return;
      }
      await validateSession(userId);
    }, SESSION_CHECK_INTERVAL);
  }, [secureSignOut, validateSession]);

  // Validate on visibility change (user returns to tab)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && user) {
        validateSession(user.id);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user, validateSession]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
            startSessionCheck(session.user.id);
            checkMfaStatus();
          }, 0);
        } else {
          setProfile(null);
          setMfaEnrolled(false);
          setMfaVerified(false);
          setMfaLoading(false);
          if (sessionCheckRef.current) {
            clearInterval(sessionCheckRef.current);
            sessionCheckRef.current = undefined;
          }
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        startSessionCheck(session.user.id);
        checkMfaStatus();
      } else {
        setMfaLoading(false);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      if (sessionCheckRef.current) clearInterval(sessionCheckRef.current);
    };
  }, [fetchProfile, startSessionCheck, checkMfaStatus]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error as Error | null };
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

      // Update last login
      const sessionId = crypto.randomUUID();
      await registerSession(data.user.id, sessionId);

      await checkMfaStatus();
    }
    return { error: null };
  }, [fetchProfile, checkMfaStatus, registerSession]);

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
      mfaEnrolled,
      mfaVerified,
      mfaLoading,
      signIn, signUp, signOut: secureSignOut, refreshProfile, refreshMfaStatus,
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
