import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Store, Copy, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { logSecurityEvent } from '@/lib/security';

export default function MfaSetupPage() {
  const { profile, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [qrUrl, setQrUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(true);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!authLoading && !session) {
      navigate('/login', { replace: true });
      return;
    }
    if (session) enrollFactor();
  }, [session, authLoading]);

  const enrollFactor = async () => {
    setEnrolling(true);
    setErrorMsg('');
    try {
      // Ensure we have a valid session from the server
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        await supabase.auth.signOut();
        navigate('/login', { replace: true });
        return;
      }

      // Refresh to get a fresh token
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.error('MFA: refresh failed', refreshError);
        await supabase.auth.signOut();
        toast.error('Sessão expirada. Faça login novamente.');
        navigate('/login', { replace: true });
        return;
      }

      // Check if user already has TOTP factors
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      console.log('MFA factors:', JSON.stringify(factorsData));
      
      const existingVerified = factorsData?.totp?.find(f => f.status === 'verified');
      if (existingVerified) {
        // Already enrolled, redirect
        navigate('/', { replace: true });
        return;
      }
      
      // Unenroll ALL existing TOTP factors (stale verified or unverified)
      const allTotpFactors = factorsData?.totp || [];
      for (const f of allTotpFactors) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
      });
      if (error) {
        console.error('MFA enroll error:', error);
        if (error.message?.includes('session_not_found')) {
          await supabase.auth.signOut();
          toast.error('Sessão inválida. Faça login novamente.');
          navigate('/login', { replace: true });
          return;
        }
        throw error;
      }
      setQrUrl(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);

      await logSecurityEvent({
        event_type: 'mfa_enrollment_started',
        entity_type: 'auth',
        action: 'MFA_ENROLL',
        severity: 'medium',
        notes: 'Admin iniciou configuração de MFA TOTP',
      });
    } catch (err: any) {
      console.error('MFA setup error:', err);
      setErrorMsg(err.message || 'Erro desconhecido ao configurar MFA.');
      toast.error('Erro ao iniciar configuração do MFA: ' + (err.message || ''));
    }
    setEnrolling(false);
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
        event_type: 'mfa_enrollment_verified',
        entity_type: 'auth',
        action: 'MFA_VERIFIED',
        severity: 'high',
        notes: 'Admin concluiu ativação do MFA TOTP',
      });

      toast.success('MFA ativado com sucesso! Sua conta está protegida.');
      navigate('/', { replace: true });
    } catch (err: any) {
      toast.error('Código inválido. Tente novamente.');
      await logSecurityEvent({
        event_type: 'mfa_enrollment_failed',
        entity_type: 'auth',
        action: 'MFA_VERIFY_FAILED',
        severity: 'medium',
        notes: 'Falha na verificação do código MFA durante enrollment',
      });
    }
    setLoading(false);
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    toast.success('Chave copiada!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md animate-slide-up">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <Shield className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-heading text-xl font-bold text-foreground">Proteção da Conta</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure a verificação em duas etapas para proteger sua conta administrativa.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
              <p className="text-xs text-foreground leading-relaxed">
                <strong>Por que é importante?</strong> A verificação em duas etapas impede que alguém
                acesse sua conta mesmo que descubra sua senha. Use um app autenticador como
                Google Authenticator, Authy ou Microsoft Authenticator.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {enrolling ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : errorMsg && !qrUrl ? (
              <div className="space-y-4 py-6 text-center">
                <p className="text-sm text-destructive">{errorMsg}</p>
                <Button variant="outline" onClick={enrollFactor}>Tentar novamente</Button>
              </div>
            ) : (
              <>
                {/* Step 1: QR Code */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                    <p className="text-sm font-medium">Escaneie o QR Code no app autenticador</p>
                  </div>
                  {qrUrl && (
                    <div className="flex justify-center rounded-xl bg-white p-4">
                      <img src={qrUrl} alt="QR Code MFA" className="h-48 w-48" />
                    </div>
                  )}
                </div>

                {/* Alternative: Secret key */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Não consegue escanear? Use esta chave manualmente:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-xs font-mono break-all select-all">
                      {secret}
                    </code>
                    <Button variant="outline" size="icon" className="shrink-0 h-9 w-9" onClick={copySecret}>
                      {copied ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Step 2: Verify */}
                <form onSubmit={handleVerify} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                    <p className="text-sm font-medium">Informe o código do app</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mfa-code" className="sr-only">Código TOTP</Label>
                    <Input
                      id="mfa-code"
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
                    {loading ? 'Verificando...' : 'Ativar Proteção'}
                  </Button>
                </form>

                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  Guarde bem o acesso ao seu app autenticador. Ele será necessário em todos os próximos logins.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
