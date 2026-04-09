import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusBadge, getDeadlineInfo } from '@/components/StatusBadge';
import { Search, Building2, User, CalendarDays } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TodasSolicitacoes = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [page, setPage] = useState(0);

  const { data: result } = useQuery({
    queryKey: ['all-solicitations', search, statusFilter, page],
    queryFn: async () => {
      let query = supabase
        .from('solicitations')
        .select('*, operations(name), profiles!solicitations_requester_id_fkey(name)', { count: 'exact' })
        .neq('status', 'rascunho')
        .order('created_at', { ascending: false })
        .range(page * 15, (page + 1) * 15 - 1);

      if (statusFilter !== 'todos') {
        query = query.eq('status', statusFilter);
      }
      if (search) {
        query = query.or(`ticket_id.ilike.%${search}%,process_number.ilike.%${search}%,employee_name.ilike.%${search}%`);
      }

      const { data, count } = await query;
      return { items: data || [], total: count || 0 };
    },
  });

  const items = result?.items || [];
  const total = result?.total || 0;

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-6">Todas as Solicitações</h1>

      <Card className="p-6 mb-6">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="pl-10" placeholder="Buscar por ticket, processo ou funcionário..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="aberto">Aberto</SelectItem>
              <SelectItem value="em_atendimento">Em atendimento</SelectItem>
              <SelectItem value="parcialmente_concluido">Parc. concluído</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full">
          <thead className="bg-accent">
            <tr>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Ticket</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Operação</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Funcionário</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Prazo</th>
              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Solicitante</th>
              <th className="text-right p-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((s: any) => {
              const deadlineInfo = s.deadline ? getDeadlineInfo(s.deadline) : null;
              return (
                <tr key={s.id} className="border-t hover:bg-accent/50 cursor-pointer" onClick={() => navigate(`/solicitacoes/${s.id}`)}>
                  <td className="p-3 font-semibold text-primary">{s.ticket_id}</td>
                  <td className="p-3"><StatusBadge status={s.status} /></td>
                  <td className="p-3 text-sm">{(s.operations as any)?.name}</td>
                  <td className="p-3 text-sm">{s.employee_name}</td>
                  <td className="p-3 text-sm">
                    {deadlineInfo && (
                      <span className={deadlineInfo.className}>
                        {new Date(s.deadline + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">{(s.profiles as any)?.name}</td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="sm" className="text-primary">Ver</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {items.length === 0 && (
          <div className="p-12 text-center text-muted-foreground">Nenhuma solicitação encontrada</div>
        )}
      </Card>

      {total > 15 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          <span className="text-sm text-muted-foreground self-center">Página {page + 1} de {Math.ceil(total / 15)}</span>
          <Button variant="outline" size="sm" disabled={(page + 1) * 15 >= total} onClick={() => setPage(p => p + 1)}>Próxima</Button>
        </div>
      )}
    </div>
  );
};

export default TodasSolicitacoes;
