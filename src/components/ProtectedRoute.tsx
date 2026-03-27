import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
  allowedRoles?: Array<'admin' | 'cashier' | 'volunteer'>;
}

export function ProtectedRoute({ children, adminOnly = false, allowedRoles }: ProtectedRouteProps) {
  const { session, loading, isAdmin, isApproved, isProfileComplete, profile } = useAuth();

  if (loading) {
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

  // Check profile completion
  if (profile && !isProfileComplete) {
    return <Navigate to="/perfil" replace />;
  }

  // Volunteer: redirect to meu-spr if trying to access non-allowed routes
  if (profile?.role === 'volunteer' && allowedRoles && !allowedRoles.includes('volunteer')) {
    return <Navigate to="/meu-spr" replace />;
  }

  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
