import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { FileText, Clock, CheckCircle, AlertTriangle, FolderOpen } from 'lucide-react';

const Dashboard = () => {
  const { profile } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [open, inProgress, partial, done, total] = await Promise.all([
        supabase.from('solicitations').select('*', { count: 'exact', head: true }).eq('status', 'aberto'),
        supabase.from('solicitations').select('*', { count: 'exact', head: true }).eq('status', 'em_atendimento'),
        supabase.from('solicitations').select('*', { count: 'exact', head: true }).eq('status', 'parcialmente_concluido'),
        supabase.from('solicitations').select('*', { count: 'exact', head: true }).eq('status', 'concluido'),
        supabase.from('solicitations').select('*', { count: 'exact', head: true }).neq('status', 'rascunho'),
      ]);
      return {
        open: open.count || 0,
        inProgress: inProgress.count || 0,
        partial: partial.count || 0,
        done: done.count || 0,
        total: total.count || 0,
      };
    },
  });

  const { data: urgentSolicitations = [] } = useQuery({
    queryKey: ['urgent-solicitations'],
    queryFn: async () => {
      const today = new Date();
      const in7days = new Date(today);
      in7days.setDate(today.getDate() + 7);
      const { data } = await supabase
        .from('solicitations')
        .select('*, operations(name)')
        .in('status', ['aberto', 'em_atendimento', 'parcialmente_concluido'])
        .lte('deadline', in7days.toISOString().split('T')[0])
        .order('deadline', { ascending: true })
        .limit(5);
      return data || [];
    },
  });

  const statCards = [
    { label: 'Abertas', value: stats?.open || 0, icon: FolderOpen, color: 'text-info' },
    { label: 'Em Atendimento', value: stats?.inProgress || 0, icon: Clock, color: 'text-warning' },
    { label: 'Parc. Concluídas', value: stats?.partial || 0, icon: AlertTriangle, color: 'text-primary' },
    { label: 'Concluídas', value: stats?.done || 0, icon: CheckCircle, color: 'text-success' },
    { label: 'Total', value: stats?.total || 0, icon: FileText, color: 'text-foreground' },
  ];

  const getDeadlineColor = (deadline: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(deadline + 'T00:00:00');
    const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff <= 0) return 'text-danger font-bold';
    if (diff <= 3) return 'text-warning font-semibold';
    return 'text-success';
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Dashboard</h1>

      <div className="grid grid-cols-5 gap-4 mb-8">
        {statCards.map((s) => (
          <Card key={s.label} className="p-6 text-center">
            <s.icon className={`h-8 w-8 mx-auto mb-2 ${s.color}`} />
            <p className="text-3xl font-bold text-foreground">{s.value}</p>
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-primary mb-4">Solicitações Urgentes</h2>
        {urgentSolicitations.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">Nenhuma solicitação urgente</p>
        ) : (
          <div className="space-y-3">
            {urgentSolicitations.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-accent">
                <div>
                  <span className="font-semibold">{s.ticket_id}</span>
                  <span className="text-muted-foreground ml-2">{(s.operations as any)?.name}</span>
                  <span className="text-muted-foreground ml-2">• {s.employee_name}</span>
                </div>
                <span className={getDeadlineColor(s.deadline)}>
                  {new Date(s.deadline + 'T00:00:00').toLocaleDateString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Dashboard;
