import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { StatusBadge, DocStatusBadge, getDeadlineInfo } from '@/components/StatusBadge';
import { ChevronLeft, ChevronDown, Send, XCircle, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

const DetalheTicketJuridico = () => {
  const { id } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [revisionDialog, setRevisionDialog] = useState<string | null>(null);
  const [revisionReason, setRevisionReason] = useState('');

  const { data: solicitation } = useQuery({
    queryKey: ['solicitation', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('solicitations')
        .select('*, operations(name), profiles!solicitations_requester_id_fkey(name)')
        .eq('id', id)
        .single();
      return data;
    },
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('documents')
        .select('*, areas(name)')
        .eq('solicitation_id', id)
        .order('created_at');
      return data || [];
    },
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ['attachments', id],
    queryFn: async () => {
      const { data } = await supabase.from('attachments').select('*, profiles(name)').eq('solicitation_id', id).order('uploaded_at');
      return data || [];
    },
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', id],
    queryFn: async () => {
      const { data } = await supabase.from('comments').select('*, profiles(name, role)').eq('solicitation_id', id).order('created_at');
      return data || [];
    },
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['audit-logs', id],
    queryFn: async () => {
      const { data } = await supabase.from('audit_logs').select('*, profiles(name)').eq('solicitation_id', id).order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: areaConclusions = [] } = useQuery({
    queryKey: ['area-conclusions', id],
    queryFn: async () => {
      const { data } = await supabase.from('area_conclusions').select('*, areas(name)').eq('solicitation_id', id);
      return data || [];
    },
  });

  const sendComment = async () => {
    if (!comment.trim() || !profile) return;
    await supabase.from('comments').insert({ solicitation_id: id!, user_id: profile.id, message: comment });
    await supabase.from('audit_logs').insert({ solicitation_id: id!, user_id: profile.id, action: 'Comentário adicionado', details: comment });
    setComment('');
    queryClient.invalidateQueries({ queryKey: ['comments', id] });
    queryClient.invalidateQueries({ queryKey: ['audit-logs', id] });
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) { toast.error('Informe o motivo'); return; }
    await supabase.from('solicitations').update({ status: 'cancelado', cancel_reason: cancelReason }).eq('id', id);
    await supabase.from('audit_logs').insert({ solicitation_id: id!, user_id: profile!.id, action: 'Solicitação cancelada', details: cancelReason });
    queryClient.invalidateQueries();
    setCancelDialog(false);
    toast.success('Solicitação cancelada');
  };

  const handleRevision = async () => {
    if (!revisionReason.trim() || !revisionDialog) { toast.error('Informe o motivo'); return; }
    await supabase.from('documents').update({ status: 'revisao_solicitada', revision_reason: revisionReason }).eq('id', revisionDialog);

    // Remove area conclusion if exists
    const doc = documents.find((d: any) => d.id === revisionDialog);
    if (doc) {
      await supabase.from('area_conclusions').delete().eq('solicitation_id', id!).eq('area_id', (doc as any).responsible_area_id);
    }

    // Revert solicitation status
    await supabase.from('solicitations').update({ status: 'em_atendimento', concluded_at: null }).eq('id', id);

    await supabase.from('audit_logs').insert({ solicitation_id: id!, user_id: profile!.id, action: 'Revisão solicitada', details: `Documento: ${(doc as any)?.document_name}. Motivo: ${revisionReason}` });

    queryClient.invalidateQueries();
    setRevisionDialog(null);
    setRevisionReason('');
    toast.success('Revisão solicitada');
  };

  if (!solicitation) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;

  const deadlineInfo = solicitation.deadline ? getDeadlineInfo(solicitation.deadline) : null;

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="p-6 mb-6">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate('/solicitacoes')}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl font-bold text-foreground">Solicitação {solicitation.ticket_id}</h1>
          <StatusBadge status={solicitation.status as any} />
        </div>
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div><p className="text-sm text-muted-foreground">Operação</p><p className="font-semibold">{(solicitation.operations as any)?.name}</p></div>
          <div><p className="text-sm text-muted-foreground">Funcionário</p><p className="font-semibold">{solicitation.employee_name}</p></div>
          <div><p className="text-sm text-muted-foreground">Solicitante</p><p className="font-semibold">{(solicitation.profiles as any)?.name}</p></div>
          <div>
            <p className="text-sm text-muted-foreground">Prazo fatal</p>
            {deadlineInfo && <p className={`font-semibold ${deadlineInfo.className}`}>{new Date(solicitation.deadline + 'T00:00:00').toLocaleDateString('pt-BR')} ({deadlineInfo.label})</p>}
          </div>
        </div>
        {solicitation.observations && (
          <div className="bg-accent p-3 rounded text-sm"><strong>Observações:</strong> {solicitation.observations}</div>
        )}
        {solicitation.cancel_reason && (
          <div className="bg-danger/10 text-danger p-3 rounded text-sm mt-2"><strong>Motivo do cancelamento:</strong> {solicitation.cancel_reason}</div>
        )}
      </Card>

      {/* Documents */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-primary mb-4">Documentos Solicitados</h2>
        {documents.map((doc: any) => (
          <div key={doc.id} className="bg-accent rounded-lg p-4 mb-3 border">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold">{doc.document_name}</span>
                <span className="text-muted-foreground text-sm ml-2">({(doc.areas as any)?.name})</span>
              </div>
              <div className="flex items-center gap-2">
                <DocStatusBadge status={doc.status} />
                {(doc.status === 'enviado' || doc.status === 'inexistente') && solicitation.status !== 'cancelado' && (
                  <Button variant="ghost" size="sm" className="text-status-revision" onClick={() => setRevisionDialog(doc.id)}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Solicitar revisão
                  </Button>
                )}
              </div>
            </div>
            {doc.observations && <p className="text-sm text-muted-foreground mt-2">{doc.observations}</p>}
            {doc.file_url && (
              <a href={doc.file_url} target="_blank" className="text-sm text-info hover:underline mt-1 block">📎 Ver arquivo</a>
            )}
            {doc.revision_reason && (
              <div className="bg-status-revision/10 border-l-4 border-status-revision p-2 mt-2 rounded text-sm">
                <strong>Motivo da revisão:</strong> {doc.revision_reason}
              </div>
            )}
          </div>
        ))}
      </Card>

      {/* Attachments */}
      {attachments.length > 0 && (
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold text-primary mb-4">Anexos</h2>
          {attachments.map((a: any) => (
            <div key={a.id} className="flex items-center gap-2 p-2 border-b">
              <a href={a.file_url} target="_blank" className="text-info hover:underline text-sm flex-1">{a.file_name}</a>
              <span className="text-xs text-muted-foreground">{(a.profiles as any)?.name} • {new Date(a.uploaded_at).toLocaleDateString('pt-BR')}</span>
            </div>
          ))}
        </Card>
      )}

      {/* Comments */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold text-primary mb-4">Comentários</h2>
        <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
          {comments.map((c: any) => (
            <div key={c.id} className={`p-3 rounded-lg ${(c.profiles as any)?.role === 'juridico' ? 'bg-info/5' : 'bg-accent'}`}>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span className="font-medium">{(c.profiles as any)?.name}</span>
                <span>{new Date(c.created_at).toLocaleString('pt-BR')}</span>
              </div>
              <p className="text-sm">{c.message}</p>
            </div>
          ))}
          {comments.length === 0 && <p className="text-muted-foreground text-center">Nenhum comentário</p>}
        </div>
        {solicitation.status !== 'cancelado' && solicitation.status !== 'concluido' && (
          <div className="flex gap-2">
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Escreva um comentário..." className="flex-1" />
            <Button size="sm" className="self-end" disabled={!comment.trim()} onClick={sendComment}>
              <Send className="h-4 w-4 mr-1" /> Enviar
            </Button>
          </div>
        )}
      </Card>

      {/* Audit */}
      <Card className="p-6 mb-6">
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-lg font-semibold text-primary cursor-pointer">
            <ChevronDown className={`h-4 w-4 transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
            Histórico ({auditLogs.length})
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-2">
            {auditLogs.map((log: any) => (
              <div key={log.id} className="flex gap-3 text-sm p-2 border-b">
                <span className="text-muted-foreground whitespace-nowrap">{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                <div>
                  <span className="font-medium">{log.action}</span>
                  {log.details && <span className="text-muted-foreground"> — {log.details}</span>}
                </div>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Actions */}
      {solicitation.status !== 'cancelado' && solicitation.status !== 'concluido' && (
        <div className="flex justify-end gap-3">
          <Button variant="destructive" onClick={() => setCancelDialog(true)}>
            <XCircle className="h-4 w-4 mr-1" /> Cancelar solicitação
          </Button>
        </div>
      )}

      {/* Cancel Dialog */}
      <Dialog open={cancelDialog} onOpenChange={setCancelDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancelar solicitação</DialogTitle></DialogHeader>
          <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Motivo do cancelamento *" rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog(false)}>Voltar</Button>
            <Button variant="destructive" onClick={handleCancel}>Confirmar cancelamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revision Dialog */}
      <Dialog open={!!revisionDialog} onOpenChange={() => setRevisionDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Solicitar revisão</DialogTitle></DialogHeader>
          <Textarea value={revisionReason} onChange={(e) => setRevisionReason(e.target.value)} placeholder="Motivo da devolutiva *" rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevisionDialog(null)}>Cancelar</Button>
            <Button onClick={handleRevision}>Solicitar revisão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DetalheTicketJuridico;
