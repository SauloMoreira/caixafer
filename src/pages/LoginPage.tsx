import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';
import { Store, ArrowLeft } from 'lucide-react';

type View = 'login' | 'signup' | 'forgot';

export default function LoginPage() {
  const { signIn, signUp, session, loading } = useAuth();

  if (loading) return null;
  if (session) return <Navigate to="/" replace />;

  const [view, setView] = useState<View>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  const resetFields = () => {
    setEmail('');
    setPassword('');
    setFullName('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) toast.error('Falha no login. Verifique suas credenciais.');
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, fullName);
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
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(error.message || 'Erro ao enviar e-mail de recuperação.');
    } else {
      toast.success('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Store className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Caixa da FER</h1>
          <p className="mt-1 text-sm text-muted-foreground">Cantina da FER — Controle de Caixa</p>
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
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Senha</Label>
                    <button type="button" onClick={() => setView('forgot')} className="text-xs text-primary hover:underline">
                      Esqueceu a senha?
                    </button>
                  </div>
                  <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12" />
                </div>
                <Button type="submit" className="h-12 w-full text-base" disabled={loading}>
                  {loading ? 'Entrando...' : 'Entrar'}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Não tem conta?{' '}
                  <button type="button" onClick={() => { setView('signup'); resetFields(); }} className="text-primary font-medium hover:underline">
                    Criar conta
                  </button>
                </p>
              </form>
            )}

            {/* SIGNUP */}
            {view === 'signup' && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome completo</Label>
                  <Input id="fullName" type="text" placeholder="Seu nome" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="h-12" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signupEmail">E-mail</Label>
                  <Input id="signupEmail" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signupPassword">Senha</Label>
                  <Input id="signupPassword" type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="h-12" />
                </div>
                <Button type="submit" className="h-12 w-full text-base" disabled={loading}>
                  {loading ? 'Criando...' : 'Criar conta'}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Já tem conta?{' '}
                  <button type="button" onClick={() => { setView('login'); resetFields(); }} className="text-primary font-medium hover:underline">
                    Fazer login
                  </button>
                </p>
              </form>
            )}

            {/* FORGOT PASSWORD */}
            {view === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgotEmail">E-mail</Label>
                  <Input id="forgotEmail" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12" />
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
