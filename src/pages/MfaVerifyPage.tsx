import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Store, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { logSecurityEvent } from '@/lib/security';

export default function MfaVerifyPage() {
  const { profile, signOut, session, loading: authLoading, refreshMfaStatus } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState('');
  const [loadingFactors, setLoadingFactors] = useState(true);

  useEffect(() => {
    if (!authLoading && !session) {
      navigate('/login', { replace: true });
      return;
    }
    if (session) loadFactors();
  }, [session, authLoading]);

  const loadFactors = async () => {
    setLoadingFactors(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) {
      toast.error('Erro ao carregar fatores MFA.');
      setLoadingFactors(false);
      return;
    }
    const totp = data.totp.find(f => f.status === 'verified');
    if (totp) {
      setFactorId(totp.id);
    } else {
      // No verified factor - redirect to setup
      navigate('/mfa-setup', { replace: true });
    }
    setLoadingFactors(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error('Informe o código de 6 dígitos.');
      return;
    }
    setLoading(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;

      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code,
      });
      if (verify.error) throw verify.error;

      await logSecurityEvent({
        event_type: 'mfa_login_verified',
        entity_type: 'auth',
        action: 'MFA_LOGIN',
        severity: 'info',
        notes: 'Admin completou verificação MFA no login',
      });

      await refreshMfaStatus();

      toast.success('Verificação concluída!');
      navigate('/', { replace: true });
    } catch (err: any) {
      toast.error('Código inválido. Tente novamente.');
      await logSecurityEvent({
        event_type: 'mfa_login_failed',
        entity_type: 'auth',
        action: 'MFA_LOGIN_FAILED',
        severity: 'high',
        notes: 'Falha na verificação MFA durante login',
      });
    }
    setLoading(false);
    setCode('');
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <Shield className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-heading text-xl font-bold text-foreground">Verificação em Duas Etapas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Informe o código do seu app autenticador para continuar.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-5">
            {loadingFactors ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : (
              <form onSubmit={handleVerify} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mfa-verify-code" className="sr-only">Código TOTP</Label>
                  <Input
                    id="mfa-verify-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000000"
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                    className="h-14 text-center text-2xl tracking-[0.5em] font-mono"
                    autoFocus
                    autoComplete="one-time-code"
                  />
                </div>
                <Button type="submit" className="h-12 w-full text-base" disabled={loading || code.length !== 6}>
                  {loading ? 'Verificando...' : 'Verificar'}
                </Button>
              </form>
            )}

            <div className="text-center">
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <LogOut className="h-3 w-3" />
                Sair e usar outra conta
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
