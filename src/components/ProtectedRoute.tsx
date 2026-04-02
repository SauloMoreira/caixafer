import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { logSecurityIncident, logSecurityEvent } from '@/lib/security';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  allowedRoles?: Array<'admin' | 'cashier' | 'cash_coordinator' | 'volunteer'>;
}

export function ProtectedRoute({ children, adminOnly = false, allowedRoles }: ProtectedRouteProps) {
  const {
    session, loading, isAdmin, isApproved, isProfileComplete, profile,
    mfaEnrolled, mfaVerified, mfaLoading,
  } = useAuth();
  const loggedRef = useRef(false);
  const location = useLocation();
  // Track if we've ever finished loading to prevent re-showing spinner
  const hasLoadedOnce = useRef(false);

  // Log unauthorized access attempts once per mount
  useEffect(() => {
    if (loading || !session || !profile || loggedRef.current) return;

    const role = profile.role;
    const denied =
      (adminOnly && !isAdmin) ||
      (allowedRoles && !allowedRoles.includes(role));

    if (denied) {
      loggedRef.current = true;
      logSecurityIncident({
        incident_type: 'unauthorized_route_access',
        context: { role, adminOnly, allowedRoles },
        severity: 'medium',
      });
    }
  }, [loading, session, profile, adminOnly, allowedRoles, isAdmin]);

  // Only show full-screen spinner on initial load, never after
  const isInitialLoad = (loading || mfaLoading) && !hasLoadedOnce.current;
  
  if (!loading && !mfaLoading) {
    hasLoadedOnce.current = true;
  }

  if (isInitialLoad) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // If still loading after initial render, don't unmount children
  if (loading || mfaLoading) {
    // Session already established - keep showing children to prevent flicker
    if (session && profile) {
      return <>{children}</>;
    }
    // No session yet - show spinner
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  // Check approval status
  if (profile && profile.approval_status !== 'approved') {
    return <Navigate to="/pending-approval" replace />;
  }

  // Check if active
  if (profile && !profile.is_active) {
    return <Navigate to="/pending-approval" replace />;
  }

  // ─── MFA enforcement for admins ───
  if (profile?.role === 'admin') {
    if (!mfaEnrolled) {
      // Admin has no MFA set up → force enrollment
      if (location.pathname !== '/mfa-setup') {
        return <Navigate to="/mfa-setup" replace />;
      }
    } else if (!mfaVerified) {
      // Admin has MFA but hasn't verified this session → force challenge
      if (location.pathname !== '/mfa-verify') {
        // Log blocked access
        logSecurityEvent({
          event_type: 'admin_access_blocked_missing_mfa',
          entity_type: 'auth',
          action: 'MFA_REQUIRED',
          severity: 'high',
          route: location.pathname,
          notes: 'Admin tentou acessar rota protegida sem MFA verificado',
        });
        return <Navigate to="/mfa-verify" replace />;
      }
    }
  }

  // Check profile completion
  if (profile && !isProfileComplete) {
    return <Navigate to="/perfil" replace />;
  }

  // Volunteer: redirect to meu-consumo if trying to access non-allowed routes
  if (profile?.role === 'volunteer' && allowedRoles && !allowedRoles.includes('volunteer')) {
    return <Navigate to="/meu-consumo" replace />;
  }

  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
