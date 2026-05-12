import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusBadge, getDeadlineInfo } from '@/components/StatusBadge';
import { Search, ChevronUp, ChevronDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';

import { useIsMobile } from '@/hooks/use-mobile';

type SortCol = 'ticket_id' | 'status' | 'operation' | 'process_number' | 'employee_name' | 'employee_registration' | 'deadline' | 'progress';

const PAGE_SIZE = 10;

const STATUS_COLORS: Record<string, string> = {
  pendente: '#3b82f6',
  em_busca: '#f59e0b',
  enviado: '#22c55e',
  inexistente: '#ef4444',
  revisao_solicitada: '#f97316',
};

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  em_busca: 'Em busca',
  enviado: 'Enviado',
  inexistente: 'Inexistente',
  revisao_solicitada: 'Revisão',
};

const MinhasSolicitacoes = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [filterAberto, setFilterAberto] = useState(false);
  const [filterEmAtendimento, setFilterEmAtendimento] = useState(false);
  const [filterEmRevisao, setFilterEmRevisao] = useState(false);
  const [page, setPage] = useState(0);
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const { data: myAssignments = [] } = useQuery({
    queryKey: ['my-assignments', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase.from('user_group_assignments').select('area_id, operation_id').eq('user_id', profile.id);
      return data || [];
    },
    enabled: !!profile,
  });

  const { data: solicitationsData, isLoading } = useQuery({
    queryKey: ['my-solicitations', profile?.id, search, myAssignments],
    queryFn: async () => {
      if (!profile || myAssignments.length === 0) return [];
      let query = supabase
        .from('solicitations')
        .select('*, operations(name), documents(id, status, responsible_area_id, document_name)')
        .neq('status', 'rascunho')
        .order('deadline', { ascending: true });
      if (search) {
        query = query.or(`ticket_id.ilike.%${search}%,process_number.ilike.%${search}%,employee_name.ilike.%${search}%`);
      }
      const { data } = await query;
      return (data || []).filter((s: any) => {
        return s.documents?.some((d: any) =>
          myAssignments.some(a => a.area_id === d.responsible_area_id && a.operation_id === s.operation_id)
        );
      });
    },
    enabled: !!profile && myAssignments.length > 0,
  });

  const allItems = solicitationsData || [];

  const getDocProgress = (s: any) => {
    const myDocs = s.documents?.filter((d: any) =>
      myAssignments.some(a => a.area_id === d.responsible_area_id && a.operation_id === s.operation_id)
    ) || [];
    const done = myDocs.filter((d: any) => d.status === 'enviado' || d.status === 'inexistente').length;
    return { done, total: myDocs.length };
  };

  // Dashboard data
  const docStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    allItems.forEach((s: any) => {
      const myDocs = s.documents?.filter((d: any) =>
        myAssignments.some(a => a.area_id === d.responsible_area_id && a.operation_id === s.operation_id)
      ) || [];
      myDocs.forEach((d: any) => {
        counts[d.status] = (counts[d.status] || 0) + 1;
      });
    });
    return Object.entries(counts).map(([status, count]) => ({
      name: STATUS_LABELS[status] || status,
      value: count,
      color: STATUS_COLORS[status] || '#9ca3af',
    }));
  }, [allItems, myAssignments]);

  const operationData = useMemo(() => {
    const counts: Record<string, number> = {};
    allItems.forEach((s: any) => {
      const name = (s.operations as any)?.name || 'Sem operação';
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [allItems]);

  const filteredItems = useMemo(() => {
    const anyFilterActive = filterAberto || filterEmAtendimento || filterEmRevisao;
    if (!anyFilterActive) return allItems;
    return allItems.filter((s: any) => {
      if (filterAberto && s.status === 'aberto') return true;
      if (filterEmAtendimento && s.status === 'em_atendimento') return true;
      if (filterEmRevisao) {
        const myDocs = s.documents?.filter((d: any) =>
          myAssignments.some(a => a.area_id === d.responsible_area_id && a.operation_id === s.operation_id)
        ) || [];
        if (myDocs.some((d: any) => d.status === 'revisao_solicitada')) return true;
      }
      return false;
    });
  }, [allItems, filterAberto, filterEmAtendimento, filterEmRevisao, myAssignments]);

  const sortedItems = useMemo(() => {
    const sorted = [...filteredItems];
    if (sortCol) {
      sorted.sort((a: any, b: any) => {
        let va: any, vb: any;
        switch (sortCol) {
          case 'ticket_id': va = a.ticket_id || ''; vb = b.ticket_id || ''; break;
          case 'status': va = a.status || ''; vb = b.status || ''; break;
          case 'operation': va = (a.operations as any)?.name || ''; vb = (b.operations as any)?.name || ''; break;
          case 'process_number': va = a.process_number || ''; vb = b.process_number || ''; break;
          case 'employee_name': va = a.employee_name || ''; vb = b.employee_name || ''; break;
          case 'employee_registration': va = a.employee_registration || ''; vb = b.employee_registration || ''; break;
          case 'deadline': va = a.deadline || ''; vb = b.deadline || ''; break;
          case 'progress':
            const pa = getDocProgress(a); const pb = getDocProgress(b);
            va = pa.total > 0 ? pa.done / pa.total : 0;
            vb = pb.total > 0 ? pb.done / pb.total : 0;
            break;
        }
        const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
        return sortAsc ? cmp : -cmp;
      });
    }
    return sorted;
  }, [filteredItems, sortCol, sortAsc, myAssignments]);

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

  const openCount = allItems.filter((s: any) => s.status === 'aberto').length;
  const urgentCount = allItems.filter((s: any) => {
    if (!s.deadline) return false;
    const d = new Date(s.deadline + 'T00:00:00');
    const diff = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff <= 7 && diff >= 0;
  }).length;
  const pendingDocs = allItems.reduce((acc: number, s: any) => {
    const myDocs = s.documents?.filter((d: any) =>
      myAssignments.some(a => a.area_id === d.responsible_area_id && a.operation_id === s.operation_id)
    ) || [];
    return acc + myDocs.filter((d: any) => d.status === 'pendente' || d.status === 'revisao_solicitada').length;
  }, 0);

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-6">Minhas Solicitações</h1>

      <Card className="p-4 md:p-6 mb-6">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Buscar por ticket, processo ou funcionário..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={filterAberto} onCheckedChange={() => { setFilterAberto(!filterAberto); setPage(0); }} />
            Abertas
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={filterEmAtendimento} onCheckedChange={() => { setFilterEmAtendimento(!filterEmAtendimento); setPage(0); }} />
            Em atendimento
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={filterEmRevisao} onCheckedChange={() => { setFilterEmRevisao(!filterEmRevisao); setPage(0); }} />
            Em revisão
          </label>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-4 md:p-6 text-center"><p className="text-2xl md:text-3xl font-bold text-primary">{openCount}</p><p className="text-xs md:text-sm text-muted-foreground">Abertas</p></Card>
        <Card className="p-4 md:p-6 text-center"><p className="text-2xl md:text-3xl font-bold text-warning">{urgentCount}</p><p className="text-xs md:text-sm text-muted-foreground">Vencendo (≤ 7d)</p></Card>
        <Card className="p-4 md:p-6 text-center"><p className="text-2xl md:text-3xl font-bold text-primary">{pendingDocs}</p><p className="text-xs md:text-sm text-muted-foreground">Docs pendentes</p></Card>
      </div>

      {/* Dashboard charts */}
      {allItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Documentos por Status</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={docStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>
                  {docStatusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Tickets por Operação</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={operationData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(213, 52%, 24%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Mobile cards or desktop table */}
      {isMobile ? (
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
          ) : pagedItems.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">Nenhuma solicitação encontrada</Card>
          ) : pagedItems.map((s: any) => {
            const deadlineInfo = s.deadline ? getDeadlineInfo(s.deadline) : null;
            const prog = getDocProgress(s);
            return (
              <Card key={s.id} className="p-4 cursor-pointer hover:shadow-md" onClick={() => navigate(`/minhas-solicitacoes/${s.id}`)}>
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-primary">{s.ticket_id}</span>
                  <StatusBadge status={s.status} />
                </div>
                <p className="text-sm">{s.employee_name}</p>
                <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                  <span>{(s.operations as any)?.name}</span>
                  {deadlineInfo && <span className={deadlineInfo.className}>{new Date(s.deadline + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                  <span>{prog.done}/{prog.total} docs</span>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
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
                  <SortHeader col="process_number">Nº Processo</SortHeader>
                  <SortHeader col="employee_name">Funcionário</SortHeader>
                  <SortHeader col="employee_registration">Matrícula</SortHeader>
                  <SortHeader col="deadline">Prazo</SortHeader>
                  <SortHeader col="progress">Progresso</SortHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedItems.map((s: any) => {
                  const deadlineInfo = s.deadline ? getDeadlineInfo(s.deadline) : null;
                  const prog = getDocProgress(s);
                  return (
                    <TableRow key={s.id} className="cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/minhas-solicitacoes/${s.id}`)}>
                      <TableCell><span className="font-semibold text-primary">{s.ticket_id}</span></TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                      <TableCell className="text-sm">{(s.operations as any)?.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.process_number || '—'}</TableCell>
                      <TableCell className="text-sm">{s.employee_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{(s as any).employee_registration || '—'}</TableCell>
                      <TableCell className="text-sm">
                        {deadlineInfo && (
                          <span className={deadlineInfo.className}>
                            {new Date(s.deadline + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{prog.done}/{prog.total}</TableCell>
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
      )}

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

export default MinhasSolicitacoes;
