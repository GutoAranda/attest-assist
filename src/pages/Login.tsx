import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, profile, user } = useAuth();
  const navigate = useNavigate();

  // Redirect after profile loads
  useEffect(() => {
    if (profile) {
      if (!profile.is_active) {
        toast.error('Seu acesso foi desativado. Contate o administrador.');
        supabase.auth.signOut();
        return;
      }
      navigate(profile.role === 'juridico' ? '/dashboard' : '/minhas-solicitacoes', { replace: true });
    }
  }, [profile, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Preencha todos os campos');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      if (error.message?.includes('Invalid login')) {
        toast.error('Email ou senha incorretos');
      } else if (error.message?.includes('Email not confirmed')) {
        toast.error('Email não confirmado. Verifique sua caixa de entrada.');
      } else {
        toast.error(`Erro ao fazer login: ${error.message}`);
      }
      return;
    }
    // Redirect handled by useEffect above after profile loads
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error('Digite seu email primeiro');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/aceitar-convite`,
    });
    if (error) {
      toast.error('Erro ao enviar email de recuperação');
    } else {
      toast.success('Email de recuperação enviado!');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-md bg-card rounded-xl shadow-lg p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="h-12 w-12 rounded bg-primary flex items-center justify-center mb-2">
            <span className="text-primary-foreground font-bold text-lg">LG</span>
          </div>
          <h1 className="text-xl font-bold text-foreground">LOTS Group</h1>
          <p className="text-sm text-muted-foreground">Solicitações Jurídicas</p>
        </div>

        <hr className="mb-6" />

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.email@lotsgroup.com"
            />
          </div>
          <div>
            <Label htmlFor="password">Senha *</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        <button
          onClick={handleForgotPassword}
          className="block w-full text-center mt-4 text-sm text-primary hover:underline"
        >
          Esqueci minha senha
        </button>
      </div>
    </div>
  );
};

export default Login;
