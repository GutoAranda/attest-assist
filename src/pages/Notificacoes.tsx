import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Notificacoes = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['all-notifications', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!profile,
  });

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['all-notifications'] });
    queryClient.invalidateQueries({ queryKey: ['unread-notifications-count'] });
  };

  const markAllAsRead = async () => {
    if (!profile) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', profile.id).eq('read', false);
    queryClient.invalidateQueries({ queryKey: ['all-notifications'] });
    queryClient.invalidateQueries({ queryKey: ['unread-notifications-count'] });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Notificações</h1>
        <Button variant="outline" size="sm" onClick={markAllAsRead}>
          <CheckCheck className="h-4 w-4 mr-1" /> Marcar todas como lidas
        </Button>
      </div>

      {notifications.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Nenhuma notificação</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n: any) => (
            <Card
              key={n.id}
              className={`p-4 cursor-pointer hover:shadow-md transition-shadow ${!n.read ? 'border-l-4 border-l-info bg-info/5' : ''}`}
              onClick={() => {
                markAsRead(n.id);
                if (n.solicitation_id) {
                  navigate(profile?.role === 'juridico' ? `/solicitacoes/${n.solicitation_id}` : `/minhas-solicitacoes/${n.solicitation_id}`);
                }
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-foreground">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString('pt-BR')}</p>
                </div>
                {!n.read && (
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}>
                    <Check className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notificacoes;
