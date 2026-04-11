import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge, getDeadlineInfo } from '@/components/StatusBadge';
import { FileText, Clock, CheckCircle, AlertTriangle, FolderOpen, PlusCircle } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#3B82F6', '#F59E0B', '#1E3A5F', '#22C55E', '#6B7280'];

const Dashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const [open, inProgress, partial, done, overdue, total] = await Promise.all([
        supabase.from('solicitations').select('*', { count: 'exact', head: true }).eq('status', 'aberto'),
        supabase.from('solicitations').select('*', { count: 'exact', head: true }).eq('status', 'em_atendimento'),
        supabase.from('solicitations').select('*', { count: 'exact', head: true }).eq('status', 'parcialmente_concluido'),
        supabase.from('solicitations').select('*', { count: 'exact', head: true }).eq('status', 'concluido'),
        supabase.from('solicitations').select('*', { count: 'exact', head: true }).in('status', ['aberto', 'em_atendimento', 'parcialmente_concluido']).lt('deadline', today),
        supabase.from('solicitations').select('*', { count: 'exact', head: true }).neq('status', 'rascunho'),
      ]);
      return {
        open: open.count || 0,
        inProgress: inProgress.count || 0,
        partial: partial.count || 0,
        done: done.count || 0,
        overdue: overdue.count || 0,
        total: total.count || 0,
      };
    },
  });

  const { data: chartData } = useQuery({
    queryKey: ['dashboard-charts'],
    queryFn: async () => {
      // Status distribution
      const { data: allSols } = await supabase.from('solicitations').select('status, operation_id, operations(name), deadline, created_at, concluded_at').neq('status', 'rascunho');
      
      const statusDist = [
        { name: 'Abertos', value: (allSols || []).filter(s => s.status === 'aberto').length, color: '#3B82F6' },
        { name: 'Em atendimento', value: (allSols || []).filter(s => s.status === 'em_atendimento').length, color: '#F59E0B' },
        { name: 'Parc. concluído', value: (allSols || []).filter(s => s.status === 'parcialmente_concluido').length, color: '#1E3A5F' },
        { name: 'Concluídos', value: (allSols || []).filter(s => s.status === 'concluido').length, color: '#22C55E' },
        { name: 'Cancelados', value: (allSols || []).filter(s => s.status === 'cancelado').length, color: '#6B7280' },
      ].filter(s => s.value > 0);

      // Tickets per operation
      const opMap: Record<string, number> = {};
      (allSols || []).forEach(s => {
        const name = (s.operations as any)?.name || 'N/A';
        opMap[name] = (opMap[name] || 0) + 1;
      });
      const ticketsByOp = Object.entries(opMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

      // Docs pending by area
      const { data: pendingDocs } = await supabase.from('documents').select('responsible_area_id, areas(name)').in('status', ['pendente', 'revisao_solicitada', 'em_busca']);
      const areaMap: Record<string, number> = {};
      (pendingDocs || []).forEach(d => {
        const name = (d.areas as any)?.name || 'N/A';
        areaMap[name] = (areaMap[name] || 0) + 1;
      });
      const docsByArea = Object.entries(areaMap).map(([name, count]) => ({ name, count }));

      // Average resolution time
      const concluded = (allSols || []).filter(s => s.concluded_at && s.created_at);
      let avgDays = 0;
      if (concluded.length > 0) {
        const totalMs = concluded.reduce((acc, s) => {
          return acc + (new Date(s.concluded_at!).getTime() - new Date(s.created_at).getTime());
        }, 0);
        avgDays = Math.round(totalMs / concluded.length / (1000 * 60 * 60 * 24));
      }

      return { statusDist, ticketsByOp, docsByArea, avgDays, concludedCount: concluded.length };
    },
  });

  const { data: urgentSolicitations = [] } = useQuery({
    queryKey: ['urgent-solicitations'],
    queryFn: async () => {
      const today = new Date();
      const in3days = new Date(today);
      in3days.setDate(today.getDate() + 3);
      const { data } = await supabase
        .from('solicitations')
        .select('*, operations(name)')
        .in('status', ['aberto', 'em_atendimento', 'parcialmente_concluido'])
        .lte('deadline', in3days.toISOString().split('T')[0])
        .order('deadline', { ascending: true })
        .limit(10);
      return data || [];
    },
  });

  const statCards = [
    { label: 'Abertos', value: stats?.open || 0, icon: FolderOpen, color: 'text-info', filter: 'aberto' },
    { label: 'Em Atendimento', value: stats?.inProgress || 0, icon: Clock, color: 'text-warning', filter: 'em_atendimento' },
    { label: 'Parc. Concluídos', value: stats?.partial || 0, icon: AlertTriangle, color: 'text-primary', filter: 'parcialmente_concluido' },
    { label: 'Concluídos', value: stats?.done || 0, icon: CheckCircle, color: 'text-success', filter: 'concluido' },
    { label: 'Vencidos', value: stats?.overdue || 0, icon: FileText, color: 'text-danger', filter: 'vencidos', border: 'border-danger/20' },
  ];

  const isEmpty = (stats?.total || 0) === 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Dashboard</h1>

      {isEmpty ? (
        <Card className="p-12 text-center">
          <FolderOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Nenhuma solicitação ainda</h2>
          <p className="text-muted-foreground mb-6">Crie sua primeira solicitação para começar</p>
          <Button onClick={() => navigate('/nova-solicitacao')}>
            <PlusCircle className="h-4 w-4 mr-2" /> Criar primeira solicitação
          </Button>
        </Card>
      ) : (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-5 gap-4 mb-8">
            {statCards.map((s) => (
              <Card
                key={s.label}
                className={`p-6 text-center cursor-pointer hover:shadow-md transition-shadow ${s.border || ''}`}
                onClick={() => navigate(`/solicitacoes?status=${s.filter}`)}
              >
                <s.icon className={`h-8 w-8 mx-auto mb-2 ${s.color}`} />
                <p className="text-3xl font-bold text-foreground">{s.value}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </Card>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <Card className="p-6">
              <h3 className="text-sm font-semibold text-primary mb-4">Distribuição por Status</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={chartData?.statusDist || []} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {(chartData?.statusDist || []).map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6">
              <h3 className="text-sm font-semibold text-primary mb-4">Tickets por Operação</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData?.ticketsByOp || []} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1E3A5F" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6">
              <h3 className="text-sm font-semibold text-primary mb-4">Docs Pendentes por Área</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData?.docsByArea || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6 flex flex-col items-center justify-center">
              <h3 className="text-sm font-semibold text-primary mb-4">Tempo Médio de Atendimento</h3>
              <p className="text-6xl font-bold text-primary">{chartData?.avgDays || 0}</p>
              <p className="text-muted-foreground mt-2">dias em média</p>
              <p className="text-xs text-muted-foreground mt-1">{chartData?.concludedCount || 0} ticket(s) concluído(s)</p>
            </Card>
          </div>

          {/* Urgent Tickets */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-primary mb-4">Tickets Vencidos e Urgentes</h2>
            {urgentSolicitations.length === 0 ? (
              <p className="text-success text-center py-4">✅ Nenhum ticket urgente</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 text-sm text-muted-foreground">ID</th>
                    <th className="text-left p-2 text-sm text-muted-foreground">Operação</th>
                    <th className="text-left p-2 text-sm text-muted-foreground">Prazo</th>
                    <th className="text-left p-2 text-sm text-muted-foreground">Situação</th>
                    <th className="text-right p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {urgentSolicitations.map((s: any) => {
                    const deadlineInfo = s.deadline ? getDeadlineInfo(s.deadline) : null;
                    return (
                      <tr key={s.id} className="border-b hover:bg-accent/50">
                        <td className="p-2 font-semibold text-primary">{s.ticket_id}</td>
                        <td className="p-2 text-sm">{(s.operations as any)?.name}</td>
                        <td className="p-2 text-sm">
                          {deadlineInfo && <span className={deadlineInfo.className}>{new Date(s.deadline + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                        </td>
                        <td className="p-2"><StatusBadge status={s.status} /></td>
                        <td className="p-2 text-right">
                          <Button variant="outline" size="sm" className="text-primary" onClick={() => navigate(`/solicitacoes/${s.id}`)}>Abrir</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default Dashboard;
