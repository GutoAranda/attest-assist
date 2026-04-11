import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusBadge, getDeadlineInfo } from '@/components/StatusBadge';
import { Search, Download } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const TodasSolicitacoes = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'todos');
  const [operationFilter, setOperationFilter] = useState('todos');
  const [requesterFilter, setRequesterFilter] = useState('todos');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  const { data: operations = [] } = useQuery({
    queryKey: ['operations'],
    queryFn: async () => {
      const { data } = await supabase.from('operations').select('*').order('name');
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['juridico-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, name').eq('role', 'juridico');
      return data || [];
    },
  });

  const { data: result } = useQuery({
    queryKey: ['all-solicitations', search, statusFilter, operationFilter, requesterFilter, page],
    queryFn: async () => {
      let query = supabase
        .from('solicitations')
        .select('*, operations(name), profiles!solicitations_requester_id_fkey(name), documents(id, responsible_area_id, areas(name))', { count: 'exact' })
        .neq('status', 'rascunho');

      if (statusFilter !== 'todos' && statusFilter !== 'vencidos') {
        query = query.eq('status', statusFilter);
      }
      if (statusFilter === 'vencidos') {
        const today = new Date().toISOString().split('T')[0];
        query = query.in('status', ['aberto', 'em_atendimento', 'parcialmente_concluido']).lt('deadline', today);
      }
      if (operationFilter !== 'todos') {
        query = query.eq('operation_id', operationFilter);
      }
      if (requesterFilter !== 'todos') {
        query = query.eq('requester_id', requesterFilter);
      }
      if (search) {
        query = query.or(`ticket_id.ilike.%${search}%,process_number.ilike.%${search}%,employee_name.ilike.%${search}%`);
      }

      const { data, count } = await query;

      // Custom sort: overdue → today → ≤3d → >3d → concluídos → cancelados
      const sorted = (data || []).sort((a: any, b: any) => {
        const getPriority = (s: any) => {
          if (s.status === 'cancelado') return 100;
          if (s.status === 'concluido') return 90;
          if (!s.deadline) return 50;
          const today = new Date(); today.setHours(0, 0, 0, 0);
          const d = new Date(s.deadline + 'T00:00:00');
          const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diff < 0) return 0;
          if (diff === 0) return 1;
          if (diff <= 3) return 2;
          return 3 + diff;
        };
        return getPriority(a) - getPriority(b);
      });

      return { items: sorted, total: count || 0 };
    },
  });

  const items = result?.items || [];
  const total = result?.total || 0;
  const pagedItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const exportCSV = () => {
    const headers = ['ID', 'Operação', 'Nº Processo', 'Funcionário', 'Solicitante', 'Status', 'Prazo', 'Data criação', 'Data conclusão'];
    const rows = items.map((s: any) => [
      s.ticket_id,
      (s.operations as any)?.name,
      s.process_number || '',
      s.employee_name || '',
      (s.profiles as any)?.name,
      s.status,
      s.deadline || '',
      new Date(s.created_at).toLocaleDateString('pt-BR'),
      s.concluded_at ? new Date(s.concluded_at).toLocaleDateString('pt-BR') : '',
    ]);
    const csv = [headers, ...rows].map(r => r.map((c: string) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solicitacoes_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Todas as Solicitações</h1>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      <Card className="p-6 mb-6">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="pl-10" placeholder="Buscar por ticket, processo ou funcionário..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Select value={operationFilter} onValueChange={(v) => { setOperationFilter(v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="Operação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas operações</SelectItem>
              {operations.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={requesterFilter} onValueChange={(v) => { setRequesterFilter(v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="Solicitante" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos solicitantes</SelectItem>
              {profiles.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="aberto">Aberto</SelectItem>
              <SelectItem value="em_atendimento">Em atendimento</SelectItem>
              <SelectItem value="parcialmente_concluido">Parc. concluído</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
              <SelectItem value="vencidos">Vencidos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Operação</TableHead>
              <TableHead>Funcionário</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>Solicitante</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedItems.map((s: any) => {
              const deadlineInfo = s.deadline ? getDeadlineInfo(s.deadline) : null;
              const areaNames = [...new Set((s.documents || []).map((d: any) => (d.areas as any)?.name).filter(Boolean))];
              return (
                <TableRow
                  key={s.id}
                  className={`cursor-pointer hover:bg-accent/50 ${s.status === 'cancelado' ? 'opacity-50' : ''}`}
                  onClick={() => navigate(`/solicitacoes/${s.id}`)}
                >
                  <TableCell>
                    <span className="font-semibold text-primary">{s.ticket_id}</span>
                    {areaNames.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {areaNames.map((a: string) => (
                          <span key={a} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{a}</span>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell><StatusBadge status={s.status} /></TableCell>
                  <TableCell className="text-sm">{(s.operations as any)?.name}</TableCell>
                  <TableCell className="text-sm">{s.employee_name}</TableCell>
                  <TableCell className="text-sm">
                    {deadlineInfo && (
                      <span className={deadlineInfo.className}>
                        {new Date(s.deadline + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{(s.profiles as any)?.name}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {pagedItems.length === 0 && (
          <div className="p-12 text-center text-muted-foreground">Nenhuma solicitação encontrada</div>
        )}
      </Card>

      {items.length > PAGE_SIZE && (
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          <span className="text-sm text-muted-foreground self-center">Página {page + 1} de {Math.ceil(items.length / PAGE_SIZE)}</span>
          <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= items.length} onClick={() => setPage(p => p + 1)}>Próxima</Button>
        </div>
      )}
    </div>
  );
};

export default TodasSolicitacoes;
