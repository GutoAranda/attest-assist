import { Bell, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const formatRelativeTime = (dateStr: string) => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} minuto${diffMin > 1 ? 's' : ''}`;
  if (diffHours < 24) return `há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  if (diffDays < 30) return `há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
  return date.toLocaleDateString('pt-BR');
};

const Header = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unread-notifications-count'],
    queryFn: async () => {
      if (!profile) return 0;
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('read', false);
      return count || 0;
    },
    enabled: !!profile,
    refetchInterval: 30000,
  });

  const { data: recentNotifications = [] } = useQuery({
    queryKey: ['recent-notifications'],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!profile,
    refetchInterval: 30000,
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-primary z-50 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded bg-primary-foreground/20 flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-xs">LG</span>
        </div>
        <span className="text-primary-foreground font-bold text-lg">LOTS Group</span>
        <span className="text-primary-foreground/50">|</span>
        <span className="text-primary-foreground/70 text-sm">Solicitações Jurídicas</span>
      </div>

      <div className="flex items-center gap-4">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative text-primary-foreground hover:bg-primary-foreground/10">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-danger text-primary-foreground text-xs flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="p-3 border-b">
              <h4 className="font-semibold text-sm">Notificações</h4>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {recentNotifications.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">Nenhuma notificação</p>
              ) : (
                recentNotifications.map((n: any) => (
                  <div key={n.id} className={`p-3 border-b text-sm cursor-pointer hover:bg-accent ${!n.read ? 'bg-info/5' : ''}`}
                    onClick={() => {
                      if (n.solicitation_id) {
                        navigate(profile?.role === 'juridico' ? `/solicitacoes/${n.solicitation_id}` : `/minhas-solicitacoes/${n.solicitation_id}`);
                      }
                    }}>
                    <p className="text-foreground">{n.message}</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      {formatRelativeTime(n.created_at)}
                    </p>
                  </div>
                ))
              )}
            </div>
            <div className="p-2 border-t">
              <Button variant="ghost" size="sm" className="w-full text-primary" onClick={() => navigate('/notificacoes')}>
                Ver todas
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <span className="text-primary-foreground text-sm">{profile?.name}</span>

        <Button variant="ghost" size="sm" className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 gap-1" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </header>
  );
};

export default Header;
