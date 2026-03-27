import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import EmailInput from '@/components/EmailInput';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import logoImg from '@/assets/logo.png';
import { isValidEmail, normalizeEmail } from '@/lib/masks';

type View = 'login' | 'signup' | 'forgot';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  );
}

export default function LoginPage() {
  const { signIn, signUp, session, loading: authLoading, profile, isAdmin, mfaEnrolled, mfaVerified, mfaLoading } = useAuth();
  const [view, setView] = useState<View>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (authLoading || mfaLoading) return null;

  // If admin session exists, check MFA
  if (session && profile?.role === 'admin') {
    if (!mfaEnrolled) return <Navigate to="/mfa-setup" replace />;
    if (!mfaVerified) return <Navigate to="/mfa-verify" replace />;
    return <Navigate to="/" replace />;
  }
  if (session) return <Navigate to="/" replace />;

  const resetFields = () => {
    setEmail('');
    setPassword('');
    setFullName('');
    setSubmitted(false);
  };

  const validateEmail = (): boolean => {
    if (!email.trim()) {
      toast.error('Informe o e-mail.');
      return false;
    }
    if (!isValidEmail(email)) {
      toast.error('E-mail inválido. Verifique o formato.');
      return false;
    }
    return true;
  };

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    setSocialLoading(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error('Erro ao entrar com ' + (provider === 'google' ? 'Google' : 'Apple') + '. Tente novamente.');
      }
    } catch (err: any) {
      toast.error('Erro ao iniciar login social. Tente novamente.');
    }
    setSocialLoading(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!validateEmail()) return;
    setLoading(true);
    const { error } = await signIn(normalizeEmail(email), password);
    if (error) {
      const msg = error.message?.includes('desativada') || error.message?.includes('recusada')
        ? error.message
        : 'Falha no login. Verifique suas credenciais.';
      toast.error(msg);
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!fullName.trim()) { toast.error('Informe o nome completo.'); return; }
    if (!validateEmail()) return;
    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);
    const { error } = await signUp(normalizeEmail(email), password, fullName);
    if (error) {
      toast.error(error.message || 'Erro ao criar conta.');
    } else {
      toast.success('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
      setView('login');
      resetFields();
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!validateEmail()) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(error.message || 'Erro ao enviar e-mail de recuperação.');
    } else {
      toast.success('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
    }
    setLoading(false);
  };

  const SocialButtons = ({ labelPrefix }: { labelPrefix: string }) => (
    <div className="space-y-2.5">
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full gap-3 text-sm font-medium"
        onClick={() => handleSocialLogin('google')}
        disabled={!!socialLoading || loading}
      >
        {socialLoading === 'google' ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
        ) : (
          <GoogleIcon className="h-5 w-5" />
        )}
        {labelPrefix} com Google
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full gap-3 text-sm font-medium"
        onClick={() => handleSocialLogin('apple')}
        disabled={!!socialLoading || loading}
      >
        {socialLoading === 'apple' ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
        ) : (
          <AppleIcon className="h-5 w-5" />
        )}
        {labelPrefix} com Apple
      </Button>
    </div>
  );

  const Divider = () => (
    <div className="relative my-5">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs">
        <span className="bg-card px-3 text-muted-foreground">ou</span>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="mb-8 text-center">
          <img src={logoImg} alt="Fraternidade Espírita Ramatis" className="mx-auto mb-4 h-24 w-24 rounded-2xl object-contain" />
          <h1 className="font-heading text-2xl font-bold text-foreground">Caixa da FER</h1>
          <p className="mt-1 text-sm text-muted-foreground">Fraternidade Espírita Ramatis</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            {view !== 'login' && (
              <button
                type="button"
                onClick={() => { setView('login'); resetFields(); }}
                className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar ao login
              </button>
            )}
            <p className="text-center text-sm text-muted-foreground">
              {view === 'login' && 'Entre com suas credenciais'}
              {view === 'signup' && 'Crie sua conta'}
              {view === 'forgot' && 'Recupere sua senha'}
            </p>
          </CardHeader>
          <CardContent>
            {/* LOGIN */}
            {view === 'login' && (
              <div className="space-y-0">
                <SocialButtons labelPrefix="Entrar" />
                <Divider />
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <EmailInput value={email} onChange={setEmail} placeholder="seu@email.com" className="h-12" showError={submitted && email.length > 0 ? !isValidEmail(email) : undefined} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Senha</Label>
                      <button type="button" onClick={() => { setView('forgot'); setSubmitted(false); }} className="text-xs text-primary hover:underline">
                        Esqueceu a senha?
                      </button>
                    </div>
                    <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12" />
                  </div>
                  <Button type="submit" className="h-12 w-full text-base" disabled={loading || !!socialLoading}>
                    {loading ? 'Entrando...' : 'Entrar'}
                  </Button>
                  <p className="text-center text-sm text-muted-foreground">
                    Não tem conta?{' '}
                    <button type="button" onClick={() => { setView('signup'); resetFields(); }} className="text-primary font-medium hover:underline">
                      Criar conta
                    </button>
                  </p>
                </form>
              </div>
            )}

            {/* SIGNUP */}
            {view === 'signup' && (
              <div className="space-y-0">
                <SocialButtons labelPrefix="Cadastrar" />
                <Divider />
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nome completo</Label>
                    <Input id="fullName" type="text" placeholder="Seu nome" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="h-12" />
                    {submitted && !fullName.trim() && <p className="text-xs text-destructive">Nome é obrigatório.</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signupEmail">E-mail</Label>
                    <EmailInput value={email} onChange={setEmail} placeholder="seu@email.com" className="h-12" showError={submitted && email.length > 0 ? !isValidEmail(email) : undefined} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signupPassword">Senha</Label>
                    <Input id="signupPassword" type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="h-12" />
                  </div>
                  <Button type="submit" className="h-12 w-full text-base" disabled={loading || !!socialLoading}>
                    {loading ? 'Criando...' : 'Criar conta'}
                  </Button>
                  <p className="text-center text-sm text-muted-foreground">
                    Já tem conta?{' '}
                    <button type="button" onClick={() => { setView('login'); resetFields(); }} className="text-primary font-medium hover:underline">
                      Fazer login
                    </button>
                  </p>
                </form>
              </div>
            )}

            {/* FORGOT PASSWORD */}
            {view === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgotEmail">E-mail</Label>
                  <EmailInput value={email} onChange={setEmail} placeholder="seu@email.com" className="h-12" showError={submitted && email.length > 0 ? !isValidEmail(email) : undefined} />
                </div>
                <Button type="submit" className="h-12 w-full text-base" disabled={loading}>
                  {loading ? 'Enviando...' : 'Enviar link de recuperação'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
