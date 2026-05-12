import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Download, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import * as XLSX from 'xlsx';

import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge, getDeadlineInfo } from '@/components/StatusBadge';
import { cn } from '@/lib/utils';

interface Props {
  mode: 'juridico' | 'atendente';
  /** For atendente: array of {operation_id, area_id} the user has access to */
  scope?: { operation_id: string; area_id: string }[];
  /** For atendente: profile.id */
  profileId?: string;
}

interface MultiSelectProps {
  label: string;
  items: { id: string; label: string; sub?: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

const MultiSelect = ({ label, items, selected, onChange }: MultiSelectProps) => {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between min-w-[180px]">
          <span className="truncate">
            {label}
            {selected.length > 0 && <span className="ml-1 text-primary">({selected.length})</span>}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-72 overflow-y-auto bg-popover z-50 min-w-[220px]">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">Sem opções</div>}
        {items.map(it => (
          <DropdownMenuCheckboxItem
            key={it.id}
            checked={selected.includes(it.id)}
            onCheckedChange={() => toggle(it.id)}
            onSelect={(e) => e.preventDefault()}
          >
            <div className="flex flex-col">
              <span>{it.label}</span>
              {it.sub && <span className="text-[11px] text-muted-foreground">{it.sub}</span>}
            </div>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const DateField = ({ value, onChange, placeholder }: { value?: Date; onChange: (d?: Date) => void; placeholder: string }) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline" className={cn('w-full justify-start text-left font-normal min-w-[150px]', !value && 'text-muted-foreground')}>
        <CalendarIcon className="mr-2 h-4 w-4" />
        {value ? format(value, 'dd/MM/yyyy') : placeholder}
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-auto p-0" align="start">
      <Calendar mode="single" selected={value} onSelect={onChange} locale={ptBR} className={cn('p-3 pointer-events-auto')} />
      {value && <div className="p-2 border-t"><Button variant="ghost" size="sm" className="w-full" onClick={() => onChange(undefined)}>Limpar</Button></div>}
    </PopoverContent>
  </Popover>
);

export const DashboardView = ({ mode, scope, profileId }: Props) => {
  const navigate = useNavigate();

  const [selOps, setSelOps] = useState<string[]>([]);
  const [selAreas, setSelAreas] = useState<string[]>([]);
  const [selAttendants, setSelAttendants] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  // Allowed scope sets (for atendente)
  const allowedOpSet = useMemo(() => mode === 'atendente' ? new Set((scope || []).map(s => s.operation_id)) : null, [mode, scope]);
  const allowedAreaSet = useMemo(() => mode === 'atendente' ? new Set((scope || []).map(s => s.area_id)) : null, [mode, scope]);
  const allowedPairSet = useMemo(() => mode === 'atendente' ? new Set((scope || []).map(s => `${s.operation_id}|${s.area_id}`)) : null, [mode, scope]);

  // Reference data
  const { data: operations = [] } = useQuery({
    queryKey: ['dash-operations'],
    queryFn: async () => (await supabase.from('operations').select('id, name').order('name')).data || [],
  });
  const { data: areas = [] } = useQuery({
    queryKey: ['dash-areas'],
    queryFn: async () => (await supabase.from('areas').select('id, name').order('name')).data || [],
  });
  const { data: attendants = [] } = useQuery({
    queryKey: ['dash-attendants'],
    queryFn: async () => (await supabase.from('profiles').select('id, name, email').eq('role', 'atendente').eq('is_active', true).order('name')).data || [],
    enabled: mode === 'juridico',
  });
  const { data: assignments = [] } = useQuery({
    queryKey: ['dash-assignments'],
    queryFn: async () => (await supabase.from('user_group_assignments').select('user_id, area_id, operation_id')).data || [],
  });

  // Solicitations + documents
  const { data: rawSols = [], isLoading } = useQuery({
    queryKey: ['dash-sols'],
    queryFn: async () => {
      const { data } = await supabase
        .from('solicitations')
        .select('*, operations(name), documents(id, status, responsible_area_id, observations, document_name, areas(name))')
        .neq('status', 'rascunho')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  // Filter options: for atendente mode we only show their scope
  const opOptions = useMemo(() => {
    if (mode === 'atendente') return operations.filter((o: any) => allowedOpSet!.has(o.id)).map((o: any) => ({ id: o.id, label: o.name }));
    return operations.map((o: any) => ({ id: o.id, label: o.name }));
  }, [operations, mode, allowedOpSet]);

  const areaOptions = useMemo(() => {
    if (mode === 'atendente') return areas.filter((a: any) => allowedAreaSet!.has(a.id)).map((a: any) => ({ id: a.id, label: a.name }));
    return areas.map((a: any) => ({ id: a.id, label: a.name }));
  }, [areas, mode, allowedAreaSet]);

  const attendantOptions = useMemo(
    () => attendants.map((a: any) => ({ id: a.id, label: a.name, sub: a.email })),
    [attendants]
  );

  // Profile -> areas/operations map for attendant filter
  const profileToPairs = useMemo(() => {
    const m: Record<string, { area_id: string; operation_id: string }[]> = {};
    assignments.forEach((a: any) => {
      if (!m[a.user_id]) m[a.user_id] = [];
      m[a.user_id].push({ area_id: a.area_id, operation_id: a.operation_id });
    });
    return m;
  }, [assignments]);

  // Apply filters
  const filteredSols = useMemo(() => {
    return rawSols.filter((s: any) => {
      // Atendente scope: at least one doc must match an allowed (operation, area)
      if (mode === 'atendente') {
        const ok = (s.documents || []).some((d: any) => allowedPairSet!.has(`${s.operation_id}|${d.responsible_area_id}`));
        if (!ok) return false;
      }
      if (selOps.length && !selOps.includes(s.operation_id)) return false;
      if (selAreas.length) {
        const hasArea = (s.documents || []).some((d: any) => selAreas.includes(d.responsible_area_id));
        if (!hasArea) return false;
      }
      if (selAttendants.length) {
        // Match if any selected attendant has an assignment for (s.operation_id, doc.area_id)
        const matchesAtt = selAttendants.some(uid => {
          const pairs = profileToPairs[uid] || [];
          return (s.documents || []).some((d: any) =>
            pairs.some(p => p.operation_id === s.operation_id && p.area_id === d.responsible_area_id)
          );
        });
        if (!matchesAtt) return false;
      }
      if (dateFrom) {
        const c = new Date(s.created_at);
        const f = new Date(dateFrom); f.setHours(0, 0, 0, 0);
        if (c < f) return false;
      }
      if (dateTo) {
        const c = new Date(s.created_at);
        const t = new Date(dateTo); t.setHours(23, 59, 59, 999);
        if (c > t) return false;
      }
      return true;
    });
  }, [rawSols, mode, allowedPairSet, selOps, selAreas, selAttendants, profileToPairs, dateFrom, dateTo]);

  // For atendente: only count docs in their scope; for juridico: all docs (or filtered by selAreas)
  const filterDocs = (sol: any): any[] => {
    let docs = sol.documents || [];
    if (mode === 'atendente') docs = docs.filter((d: any) => allowedPairSet!.has(`${sol.operation_id}|${d.responsible_area_id}`));
    if (selAreas.length) docs = docs.filter((d: any) => selAreas.includes(d.responsible_area_id));
    return docs;
  };

  // Metrics
  const concluded = filteredSols.filter((s: any) => s.concluded_at && s.created_at);
  const avgDays = useMemo(() => {
    if (concluded.length === 0) return 0;
    const total = concluded.reduce((acc: number, s: any) => acc + (new Date(s.concluded_at).getTime() - new Date(s.created_at).getTime()), 0);
    return Math.round(total / concluded.length / (1000 * 60 * 60 * 24));
  }, [concluded]);

  // Within deadline
  const deadlineDist = useMemo(() => {
    let onTime = 0, late = 0;
    concluded.forEach((s: any) => {
      if (!s.deadline) return;
      const conc = new Date(s.concluded_at);
      const dl = new Date(s.deadline + 'T23:59:59');
      if (conc <= dl) onTime++; else late++;
    });
    return [
      { name: 'Dentro do prazo', value: onTime, color: '#22C55E' },
      { name: 'Fora do prazo', value: late, color: '#EF4444' },
    ].filter(x => x.value > 0);
  }, [concluded]);

  // Doc status distribution
  const docDist = useMemo(() => {
    let enviado = 0, inexJ = 0, pend = 0;
    filteredSols.forEach((s: any) => {
      filterDocs(s).forEach((d: any) => {
        if (d.status === 'enviado') enviado++;
        else if (d.status === 'inexistente') inexJ++;
        else pend++;
      });
    });
    return [
      { name: 'Enviados', value: enviado, color: '#22C55E' },
      { name: 'Inexistente c/ justificativa', value: inexJ, color: '#F59E0B' },
      { name: 'Pendentes', value: pend, color: '#9CA3AF' },
    ].filter(x => x.value > 0);
  }, [filteredSols, mode, allowedPairSet, selAreas]);

  // Volume by month (last 3 months)
  const volumeMonths = useMemo(() => {
    const months: { key: string; label: string; count: number }[] = [];
    const now = new Date();
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: format(d, 'MMM/yy', { locale: ptBR }), count: 0 });
    }
    filteredSols.forEach((s: any) => {
      const d = new Date(s.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const m = months.find(x => x.key === key);
      if (m) m.count++;
    });
    return months;
  }, [filteredSols]);

  // Urgent table: vencidos OU prazo <= 3 dias, status aberto/em_atendimento/parc
  const urgentList = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const lim = new Date(today); lim.setDate(today.getDate() + 3);
    return filteredSols.filter((s: any) => {
      if (!s.deadline) return false;
      if (!['aberto', 'em_atendimento', 'parcialmente_concluido'].includes(s.status)) return false;
      const dl = new Date(s.deadline + 'T00:00:00');
      return dl <= lim;
    }).sort((a: any, b: any) => (a.deadline || '').localeCompare(b.deadline || ''));
  }, [filteredSols]);

  const goToTicket = (id: string) => {
    navigate(mode === 'juridico' ? `/solicitacoes/${id}` : `/minhas-solicitacoes/${id}`);
  };

  // Exports
  const buildExportRows = () => {
    const opName = (id: string) => operations.find((o: any) => o.id === id)?.name || '';
    const areaName = (id: string) => areas.find((a: any) => a.id === id)?.name || '';
    const sols = filteredSols.map((s: any) => {
      const concDate = s.concluded_at ? new Date(s.concluded_at) : null;
      const created = new Date(s.created_at);
      const days = concDate ? Math.round((concDate.getTime() - created.getTime()) / 86400000) : '';
      const onTime = concDate && s.deadline ? (concDate <= new Date(s.deadline + 'T23:59:59') ? 'Sim' : 'Não') : '';
      return {
        Ticket: s.ticket_id || '',
        Operação: opName(s.operation_id),
        Funcionário: s.employee_name || '',
        Matrícula: s.employee_registration || '',
        'Nº Processo': s.process_number || '',
        Status: s.status,
        Prazo: s.deadline ? format(new Date(s.deadline + 'T00:00:00'), 'dd/MM/yyyy') : '',
        'Data Criação': format(created, 'dd/MM/yyyy'),
        'Data Conclusão': concDate ? format(concDate, 'dd/MM/yyyy') : '',
        'Dias para Conclusão': days,
        'Dentro do Prazo': onTime,
      };
    });

    const docs: any[] = [];
    filteredSols.forEach((s: any) => {
      filterDocs(s).forEach((d: any) => {
        // Find attendants for this area+operation
        const att = (assignments as any[])
          .filter(a => a.area_id === d.responsible_area_id && a.operation_id === s.operation_id)
          .map(a => attendants.find((p: any) => p.id === a.user_id)?.name)
          .filter(Boolean)
          .join('; ');
        docs.push({
          Ticket: s.ticket_id || '',
          Documento: d.document_name,
          Área: areaName(d.responsible_area_id),
          Status: d.status,
          Atendente: att,
        });
      });
    });
    return { sols, docs };
  };

  const exportCsv = () => {
    const { sols, docs } = buildExportRows();
    const toCsv = (rows: any[]) => {
      if (rows.length === 0) return '';
      const headers = Object.keys(rows[0]);
      const esc = (v: any) => {
        const s = String(v ?? '');
        return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      return [headers.join(';'), ...rows.map(r => headers.map(h => esc(r[h])).join(';'))].join('\n');
    };
    const content = '\uFEFF=== SOLICITAÇÕES ===\n' + toCsv(sols) + '\n\n=== DOCUMENTOS ===\n' + toCsv(docs);
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportXlsx = () => {
    const { sols, docs } = buildExportRows();
    const opName = (id: string) => operations.find((o: any) => o.id === id)?.name || '';
    const areaName = (id: string) => areas.find((a: any) => a.id === id)?.name || '';
    const opCounts: Record<string, number> = {};
    const areaCounts: Record<string, number> = {};
    filteredSols.forEach((s: any) => {
      const o = opName(s.operation_id);
      opCounts[o] = (opCounts[o] || 0) + 1;
      filterDocs(s).forEach((d: any) => {
        const an = areaName(d.responsible_area_id);
        areaCounts[an] = (areaCounts[an] || 0) + 1;
      });
    });
    const resumo = [
      { Métrica: 'Total de solicitações', Valor: filteredSols.length },
      { Métrica: 'Concluídas', Valor: concluded.length },
      { Métrica: 'Tempo médio (dias)', Valor: avgDays },
      { Métrica: 'Tickets urgentes', Valor: urgentList.length },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), 'Resumo');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sols), 'Solicitações');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(docs), 'Documentos');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(Object.entries(opCounts).map(([k, v]) => ({ Operação: k, Quantidade: v }))), 'Por Operação');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(Object.entries(areaCounts).map(([k, v]) => ({ Área: k, Documentos: v }))), 'Por Área');
    XLSX.writeFile(wb, `relatorio_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-1" /> Exportar Dados (CSV)
          </Button>
          <Button variant="outline" size="sm" onClick={exportXlsx}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Exportar Relatório (Excel)
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <MultiSelect label="Operação" items={opOptions} selected={selOps} onChange={setSelOps} />
          <MultiSelect label="Área" items={areaOptions} selected={selAreas} onChange={setSelAreas} />
          {mode === 'juridico' && (
            <MultiSelect label="Atendente" items={attendantOptions} selected={selAttendants} onChange={setSelAttendants} />
          )}
          <DateField value={dateFrom} onChange={setDateFrom} placeholder="De" />
          <DateField value={dateTo} onChange={setDateTo} placeholder="Até" />
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="p-4 text-center"><p className="text-3xl font-bold text-primary">{filteredSols.length}</p><p className="text-xs text-muted-foreground">Solicitações</p></Card>
            <Card className="p-4 text-center"><p className="text-3xl font-bold text-success">{concluded.length}</p><p className="text-xs text-muted-foreground">Concluídas</p></Card>
            <Card className="p-4 text-center"><p className="text-3xl font-bold text-primary">{avgDays}</p><p className="text-xs text-muted-foreground">Tempo médio (dias)</p></Card>
            <Card className="p-4 text-center"><p className="text-3xl font-bold text-danger">{urgentList.length}</p><p className="text-xs text-muted-foreground">Urgentes</p></Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-primary mb-3">Cumprimento de Prazo</h3>
              {deadlineDist.length === 0 ? <p className="text-sm text-muted-foreground text-center py-12">Sem dados</p> : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={deadlineDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${value}`}>
                      {deadlineDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Card>
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-primary mb-3">Documentos por Status</h3>
              {docDist.length === 0 ? <p className="text-sm text-muted-foreground text-center py-12">Sem dados</p> : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={docDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ value }) => `${value}`}>
                      {docDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Card>
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-primary mb-3">Volume (últimos 3 meses)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={volumeMonths}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(213, 52%, 24%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Urgent table */}
          <Card className="p-4 md:p-6">
            <h2 className="text-lg font-semibold text-primary mb-4">Tickets Urgentes (vencidos ou ≤ 3 dias)</h2>
            {urgentList.length === 0 ? (
              <p className="text-success text-center py-4">✅ Nenhum ticket urgente</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 text-xs text-muted-foreground">Ticket</th>
                      <th className="text-left p-2 text-xs text-muted-foreground">Operação</th>
                      <th className="text-left p-2 text-xs text-muted-foreground">Funcionário</th>
                      <th className="text-left p-2 text-xs text-muted-foreground">Prazo</th>
                      <th className="text-left p-2 text-xs text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {urgentList.map((s: any) => {
                      const dl = s.deadline ? getDeadlineInfo(s.deadline) : null;
                      return (
                        <tr key={s.id} className="border-b hover:bg-accent/50 cursor-pointer" onClick={() => goToTicket(s.id)}>
                          <td className="p-2 font-semibold text-primary">{s.ticket_id}</td>
                          <td className="p-2 text-sm">{(s.operations as any)?.name}</td>
                          <td className="p-2 text-sm">{s.employee_name}</td>
                          <td className="p-2 text-sm">
                            {dl && <span className={dl.className}>{format(new Date(s.deadline + 'T00:00:00'), 'dd/MM/yyyy')}</span>}
                          </td>
                          <td className="p-2"><StatusBadge status={s.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default DashboardView;
