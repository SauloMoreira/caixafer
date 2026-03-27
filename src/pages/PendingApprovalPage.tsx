import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, XCircle, UserX, Store } from 'lucide-react';

export default function PendingApprovalPage() {
  const { session, profile, signOut, loading, isApproved, isProfileComplete } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  if (isApproved && isProfileComplete) return <Navigate to="/" replace />;
  if (isApproved && !isProfileComplete) return <Navigate to="/perfil" replace />;

  const status = profile?.approval_status;
  const isInactive = profile?.is_active === false;

  let icon = <Clock className="h-12 w-12 text-warning" />;
  let title = 'Aguardando Aprovação';
  let message = 'Seu cadastro foi realizado com sucesso e está aguardando a aprovação de um administrador. Você receberá acesso assim que for aprovado.';

  if (status === 'rejected') {
    icon = <XCircle className="h-12 w-12 text-expense" />;
    title = 'Cadastro Rejeitado';
    message = 'Seu cadastro foi analisado e não foi aprovado. Entre em contato com o administrador para mais informações.';
  } else if (isInactive) {
    icon = <UserX className="h-12 w-12 text-muted-foreground" />;
    title = 'Conta Desativada';
    message = 'Sua conta está desativada. Entre em contato com o administrador para reativação.';
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Store className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Caixa da FER</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
            {icon}
            <h2 className="font-heading text-lg font-bold">{title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
            <Button variant="outline" onClick={signOut} className="mt-2">
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
