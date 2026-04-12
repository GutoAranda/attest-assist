import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Check, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

const notifStyles: Record<string, string> = {
  nova_solicitacao: 'border-l-4 border-l-primary bg-info/5',
  conclusao: 'border-l-4 border-l-success bg-success/5',
  revisao: 'border-l-4 border-l-status-revision bg-status-revision/5',
  cancelamento: 'border-l-4 border-l-muted-foreground bg-muted/30',
  comentario: 'border-l-4 border-l-info bg-info/5',
  sla_7dias: 'border-l-4 border-l-primary',
  sla_3dias: 'border-l-4 border-l-warning bg-warning/5',
  sla_1dia: 'border-l-4 border-l-danger bg-danger/5',
  sla_hoje: 'border-l-4 border-l-danger bg-danger/5',
  sla_vencido: 'border-l-4 border-l-danger bg-danger/5',
};

const PAGE_SIZE = 20;

const Notificacoes = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('todas');
  const [page, setPage] = useState(0);

  const { data: result } = useQuery({
    queryKey: ['all-notifications', profile?.id, filter, page],
    queryFn: async () => {
      if (!profile) return { items: [], total: 0 };
      let query = supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filter === 'nao_lidas') query = query.eq('read', false);
      if (filter === 'lidas') query = query.eq('read', true);

      const { data, count } = await query;
      return { items: data || [], total: count || 0 };
    },
    enabled: !!profile,
  });

  const notifications = result?.items || [];
  const total = result?.total || 0;

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

      <Card className="p-4 mb-6">
        <RadioGroup value={filter} onValueChange={(v) => { setFilter(v); setPage(0); }} className="flex gap-4">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="todas" id="todas" />
            <Label htmlFor="todas">Todas</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="nao_lidas" id="nao_lidas" />
            <Label htmlFor="nao_lidas">Não lidas</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="lidas" id="lidas" />
            <Label htmlFor="lidas">Lidas</Label>
          </div>
        </RadioGroup>
      </Card>

      {notifications.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Nenhuma notificação</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n: any) => (
            <Card
              key={n.id}
              className={`p-4 cursor-pointer hover:shadow-md transition-shadow ${notifStyles[n.type] || ''} ${!n.read ? 'font-medium' : 'opacity-80'}`}
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
                  <p className="text-xs text-muted-foreground mt-1">{formatRelativeTime(n.created_at)}</p>
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

      {total > PAGE_SIZE && (
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          <span className="text-sm text-muted-foreground self-center">Página {page + 1} de {Math.ceil(total / PAGE_SIZE)}</span>
          <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}>Próxima</Button>
        </div>
      )}
    </div>
  );
};

export default Notificacoes;
