import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusBadge, getDeadlineInfo } from '@/components/StatusBadge';
import { Search, Building2, User, CalendarDays, FileText } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';

const PAGE_SIZE = 10;

const MinhasSolicitacoes = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<string[]>(['aberto', 'em_atendimento']);
  const [page, setPage] = useState(0);

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
    queryKey: ['my-solicitations', profile?.id, search, statusFilters, myAssignments],
    queryFn: async () => {
      if (!profile || myAssignments.length === 0) return { items: [], total: 0 };

      let query = supabase
        .from('solicitations')
        .select('*, operations(name), documents(id, status, responsible_area_id, document_name)')
        .neq('status', 'rascunho')
        .order('deadline', { ascending: true });

      if (statusFilters.length > 0) query = query.in('status', statusFilters);
      if (search) {
        query = query.or(`ticket_id.ilike.%${search}%,process_number.ilike.%${search}%,employee_name.ilike.%${search}%`);
      }

      const { data } = await query;

      const filtered = (data || []).filter((s: any) => {
        return s.documents?.some((d: any) =>
          myAssignments.some(a => a.area_id === d.responsible_area_id && a.operation_id === s.operation_id)
        );
      });

      return { items: filtered, total: filtered.length };
    },
    enabled: !!profile && myAssignments.length > 0,
  });

  const allItems = solicitationsData?.items || [];
  const pagedItems = allItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(allItems.length / PAGE_SIZE);

  const toggleFilter = (status: string) => {
    setStatusFilters(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
    setPage(0);
  };

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

      <Card className="p-6 mb-6">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Buscar por ticket, processo ou funcionário..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <div className="flex gap-4">
          {[
            { value: 'aberto', label: 'Abertas' },
            { value: 'em_atendimento', label: 'Em atendimento' },
          ].map(f => (
            <label key={f.value} className="flex items-center gap-2 text-sm">
              <Checkbox checked={statusFilters.includes(f.value)} onCheckedChange={() => toggleFilter(f.value)} />
              {f.label}
            </label>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-6 text-center"><p className="text-3xl font-bold text-primary">{openCount}</p><p className="text-sm text-muted-foreground">Abertas</p></Card>
        <Card className="p-6 text-center"><p className="text-3xl font-bold text-warning">{urgentCount}</p><p className="text-sm text-muted-foreground">Vencendo (≤ 7 dias)</p></Card>
        <Card className="p-6 text-center"><p className="text-3xl font-bold text-primary">{pendingDocs}</p><p className="text-sm text-muted-foreground">Docs pendentes (total)</p></Card>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : allItems.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-4xl mb-2">📂</p>
          <p className="text-lg font-semibold text-foreground">Nenhuma solicitação encontrada</p>
          <p className="text-muted-foreground text-sm">Tente ajustar os filtros de busca</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {pagedItems.map((s: any) => {
            const myDocs = s.documents?.filter((d: any) =>
              myAssignments.some(a => a.area_id === d.responsible_area_id && a.operation_id === s.operation_id)
            ) || [];
            const doneDocs = myDocs.filter((d: any) => d.status === 'enviado' || d.status === 'inexistente').length;
            const progress = myDocs.length > 0 ? (doneDocs / myDocs.length) * 100 : 0;
            const deadlineInfo = s.deadline ? getDeadlineInfo(s.deadline) : null;

            return (
              <Card key={s.id} className="p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <StatusBadge status={s.status} />
                      <span className="text-lg font-bold text-foreground">{s.ticket_id}</span>
                    </div>
                    <div className="flex gap-4 text-sm text-muted-foreground mb-1">
                      <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {(s.operations as any)?.name}</span>
                      <span className="flex items-center gap-1"><User className="h-3 w-3" /> {s.employee_name}</span>
                      {deadlineInfo && (
                        <span className={`flex items-center gap-1 ${deadlineInfo.className}`}>
                          <CalendarDays className="h-3 w-3" /> {deadlineInfo.label}
                        </span>
                      )}
                    </div>
                    {s.process_number && (
                      <p className="text-sm text-muted-foreground mb-2">
                        <FileText className="h-3 w-3 inline mr-1" />Processo: {s.process_number}
                      </p>
                    )}
                    <div className="mb-2">
                      <Progress value={progress} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">Pendentes: {myDocs.length - doneDocs} de {myDocs.length}</p>
                    </div>
                  </div>
                  <Button variant="outline" className="text-primary border-primary" onClick={() => navigate(`/minhas-solicitacoes/${s.id}`)}>
                    Abrir
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
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
