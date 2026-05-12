import { cn } from '@/lib/utils';

type SolicitationStatus = 'rascunho' | 'aberto' | 'em_atendimento' | 'parcialmente_concluido' | 'concluido' | 'cancelado';
type DocumentStatus = 'pendente' | 'enviado' | 'em_busca' | 'inexistente' | 'revisao_solicitada';

const statusLabels: Record<SolicitationStatus, string> = {
  rascunho: 'Rascunho',
  aberto: 'Aberto',
  em_atendimento: 'Em atendimento',
  parcialmente_concluido: 'Parcialmente concluído',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

const statusStyles: Record<SolicitationStatus, string> = {
  rascunho: 'bg-muted text-muted-foreground',
  aberto: 'bg-status-open text-info',
  em_atendimento: 'bg-status-in-progress text-warning',
  parcialmente_concluido: 'bg-status-partial text-muted-foreground',
  concluido: 'bg-status-done text-success',
  cancelado: 'bg-status-cancelled text-destructive',
};

const docStatusLabels: Record<DocumentStatus, string> = {
  pendente: 'Pendente',
  enviado: 'Enviado',
  em_busca: 'Em busca',
  inexistente: 'Inexistente',
  revisao_solicitada: 'Revisão solicitada',
};

export const StatusBadge = ({ status }: { status: SolicitationStatus }) => (
  <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', statusStyles[status])}>
    {statusLabels[status]}
  </span>
);

export const DocStatusBadge = ({ status }: { status: DocumentStatus }) => {
  const styles: Record<DocumentStatus, string> = {
    pendente: 'bg-info/10 border border-info/30 text-info',
    enviado: 'bg-success/10 border border-success/30 text-success',
    em_busca: 'bg-warning/10 border border-warning/30 text-warning',
    inexistente: 'bg-destructive/10 border border-destructive/30 text-destructive',
    revisao_solicitada: 'bg-status-revision/10 border border-status-revision/30 text-status-revision',
  };
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', styles[status])}>
      {docStatusLabels[status]}
    </span>
  );
};

export const getDeadlineInfo = (deadline: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(deadline + 'T00:00:00');
  const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) return { label: `Vencido há ${Math.abs(diff)} dia(s)`, className: 'text-danger font-bold' };
  if (diff === 0) return { label: 'Vence hoje!', className: 'text-danger font-bold' };
  if (diff <= 3) return { label: `${diff} dia(s) restante(s)`, className: 'text-warning font-semibold' };
  return { label: `${diff} dia(s) restante(s)`, className: 'text-success' };
};
