import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusBadge, getDeadlineInfo } from '@/components/StatusBadge';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Download, ChevronUp, ChevronDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

type SortCol = 'ticket_id' | 'operation' | 'employee_name' | 'employee_registration' | 'requester' | 'status' | 'deadline';

const TodasSolicitacoes = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [operationFilters, setOperationFilters] = useState<string[]>([]);
  const [requesterFilters, setRequesterFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
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

  const { data: result, isLoading } = useQuery({
    queryKey: ['all-solicitations', search, statusFilters, operationFilters, requesterFilters, page, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from('solicitations')
        .select('*, operations(name), profiles!solicitations_requester_id_fkey(name), documents(id, responsible_area_id, areas(name))', { count: 'exact' })
        .neq('status', 'rascunho');

      if (statusFilters.length > 0) {
        if (statusFilters.includes('vencidos')) {
          const today = new Date().toISOString().split('T')[0];
          const statusList = statusFilters.filter(s => s !== 'vencidos');
          const vencidosStatuses = ['aberto', 'em_atendimento', 'parcialmente_concluido'];
          const combined = [...statusList, ...vencidosStatuses];
          query = query.in('status', combined).lt('deadline', today);
        } else {
          query = query.in('status', statusFilters);
        }
      }
      if (operationFilters.length > 0) {
        query = query.in('operation_id', operationFilters);
      }
      if (requesterFilters.length > 0) {
        query = query.in('requester_id', requesterFilters);
      }
      if (search) {
        query = query.or(`ticket_id.ilike.%${search}%,process_number.ilike.%${search}%,employee_name.ilike.%${search}%`);
      }
      if (dateFrom) {
        query = query.gte('created_at', dateFrom + 'T00:00:00');
      }
      if (dateTo) {
        query = query.lte('created_at', dateTo + 'T23:59:59');
      }

      const { data, count } = await query;
      return { items: data || [], total: count || 0 };
    },
  });

  const items = result?.items || [];
  const total = result?.total || 0;

  const sortedItems = useMemo(() => {
    let sorted = [...items];
    if (sortCol) {
      sorted.sort((a: any, b: any) => {
        let va: any, vb: any;
        switch (sortCol) {
          case 'ticket_id': va = a.ticket_id || ''; vb = b.ticket_id || ''; break;
          case 'operation': va = (a.operations as any)?.name || ''; vb = (b.operations as any)?.name || ''; break;
          case 'employee_name': va = a.employee_name || ''; vb = b.employee_name || ''; break;
          case 'employee_registration': va = a.employee_registration || ''; vb = b.employee_registration || ''; break;
          case 'requester': va = (a.profiles as any)?.name || ''; vb = (b.profiles as any)?.name || ''; break;
          case 'status': va = a.status || ''; vb = b.status || ''; break;
          case 'deadline': va = a.deadline || ''; vb = b.deadline || ''; break;
        }
        const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
        return sortAsc ? cmp : -cmp;
      });
    } else {
      // Default sort: overdue → today → ≤3d → >3d → concluídos → cancelados
      sorted.sort((a: any, b: any) => {
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
    }
    return sorted;
  }, [items, sortCol, sortAsc]);

  const pagedItems = sortedItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(sortedItems.length / PAGE_SIZE);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) {
      if (sortAsc) { setSortAsc(false); }
      else { setSortCol(null); setSortAsc(true); }
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
    setPage(0);
  };

  const SortHeader = ({ col, children }: { col: SortCol; children: React.ReactNode }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(col)}>
      <div className="flex items-center gap-1">
        {children}
        {sortCol === col && (sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </div>
    </TableHead>
  );

  const exportCSV = () => {
    const headers = ['ID', 'Operação', 'Nº Processo', 'Funcionário', 'Matrícula', 'Solicitante', 'Status', 'Prazo', 'Data criação', 'Data conclusão'];
    const rows = sortedItems.map((s: any) => [
      s.ticket_id,
      (s.operations as any)?.name,
      s.process_number || '',
      s.employee_name || '',
      s.employee_registration || '',
      (s.profiles as any)?.name,
      s.status,
      s.deadline ? new Date(s.deadline + 'T00:00:00').toLocaleDateString('pt-BR') : '',
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
<<<<<<< HEAD
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} placeholder="De" />
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} placeholder="Até" />
=======
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-2">Operação</h3>
            <div className="grid grid-cols-2 gap-2">
              {operations.map((o: any) => (
                <label key={o.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={operationFilters.includes(o.id)}
                    onCheckedChange={(checked) => setOperationFilters(prev =>
                      checked ? [...prev, o.id] : prev.filter(id => id !== o.id)
                    )}
                  />
                  {o.name}
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2">Solicitante</h3>
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
              {profiles.map((p: any) => (
                <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={requesterFilters.includes(p.id)}
                    onCheckedChange={(checked) => setRequesterFilters(prev =>
                      checked ? [...prev, p.id] : prev.filter(id => id !== p.id)
                    )}
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2">Status</h3>
            <div className="grid grid-cols-2 gap-2">
              {['aberto', 'em_atendimento', 'parcialmente_concluido', 'concluido', 'cancelado', 'vencidos'].map((status) => (
                <label key={status} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={statusFilters.includes(status)}
                    onCheckedChange={(checked) => {
                      setStatusFilters(prev =>
                        checked ? [...prev, status] : prev.filter(s => s !== status)
                      );
                      setPage(0);
                    }}
                  />
                  {status === 'em_atendimento' ? 'Em atendimento' : status === 'parcialmente_concluido' ? 'Parc. concluído' : status === 'concluido' ? 'Concluído' : status === 'cancelado' ? 'Cancelado' : status === 'aberto' ? 'Aberto' : 'Vencidos'}
                </label>
              ))}
            </div>
          </div>

          {(operationFilters.length > 0 || requesterFilters.length > 0 || statusFilters.length > 0) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOperationFilters([]);
                setRequesterFilters([]);
                setStatusFilters([]);
                setPage(0);
              }}
            >
              Limpar todos os filtros
            </Button>
          )}
>>>>>>> 189bd96 (Fix document duplication in drafts and implement cumulative filters)
        </div>
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader col="ticket_id">Ticket</SortHeader>
                <SortHeader col="status">Status</SortHeader>
                <SortHeader col="operation">Operação</SortHeader>
                <SortHeader col="employee_name">Funcionário</SortHeader>
                <SortHeader col="employee_registration">Matrícula</SortHeader>
                <SortHeader col="deadline">Prazo</SortHeader>
                <SortHeader col="requester">Solicitante</SortHeader>
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
                    <TableCell className="text-sm text-muted-foreground">{s.employee_registration || '—'}</TableCell>
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
        )}
        {!isLoading && pagedItems.length === 0 && (
          <div className="p-12 text-center text-muted-foreground">Nenhuma solicitação encontrada</div>
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          <span className="text-sm text-muted-foreground self-center">Página {page + 1} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
        </div>
      )}
    </div>
  );
};

export default TodasSolicitacoes;
