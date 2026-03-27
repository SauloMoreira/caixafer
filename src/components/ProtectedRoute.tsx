import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
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

  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
}
