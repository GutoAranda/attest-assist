import { cn } from '@/lib/utils';

type SolicitationStatus = 'aberto' | 'em_atendimento' | 'parcialmente_concluido' | 'concluido' | 'cancelado';
type DocumentStatus = 'pendente' | 'enviado' | 'em_busca' | 'inexistente' | 'revisao_solicitada';

const statusLabels: Record<SolicitationStatus, string> = {
  aberto: 'Aberto',
  em_atendimento: 'Em atendimento',
  parcialmente_concluido: 'Parcialmente concluído',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

const statusStyles: Record<SolicitationStatus, string> = {
  aberto: 'bg-badge-open-bg text-badge-open-fg',
  em_atendimento: 'bg-badge-progress-bg text-badge-progress-fg',
  parcialmente_concluido: 'bg-badge-partial-bg text-badge-partial-fg',
  concluido: 'bg-badge-done-bg text-badge-done-fg',
  cancelado: 'bg-badge-cancelled-bg text-badge-cancelled-fg',
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
  // Compara apenas as partes de ano/mês/dia (ignora timezone) para evitar discrepância
  // entre dia local do usuário e dia UTC do prazo armazenado.
  const today = new Date();
  const todayY = today.getFullYear(), todayM = today.getMonth(), todayD = today.getDate();

  // deadline format: 'YYYY-MM-DD'
  const [y, m, d] = deadline.split('-').map(Number);
  if (!y || !m || !d) return { label: 'Data inválida', className: 'text-muted-foreground' };

  // Calcula diferença em dias usando UTC para evitar problemas de DST
  const todayUtc = Date.UTC(todayY, todayM, todayD);
  const deadlineUtc = Date.UTC(y, m - 1, d);
  const diff = Math.ceil((deadlineUtc - todayUtc) / (1000 * 60 * 60 * 24));

  if (diff < 0) return { label: `Vencido há ${Math.abs(diff)} dia(s)`, className: 'text-danger font-bold' };
  if (diff === 0) return { label: 'Vence hoje!', className: 'text-danger font-bold' };
  if (diff <= 3) return { label: `${diff} dia(s) restante(s)`, className: 'text-warning font-semibold' };
  return { label: `${diff} dia(s) restante(s)`, className: 'text-success' };
};
