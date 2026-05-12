import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { StatusBadge, DocStatusBadge, getDeadlineInfo } from '@/components/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronDown, Send, XCircle, RotateCcw, Edit, Download, FileText, Loader2, PackageOpen, History, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useState, useMemo, useEffect, useRef } from 'react';
import { openStorageFile } from '@/lib/storage';
import { AttachmentActions } from '@/components/FilePreviewDialog';
import { sendRevisionEmail, sendCommentEmail, sendCancelEmail, sendConclusionEmail, sendReopenEmail, getAttendeesEmails } from '@/lib/email';
import JSZip from 'jszip';

const DetalheTicketJuridico = () => {
  const { id } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [revisionDialog, setRevisionDialog] = useState<string | null>(null);
  const [revisionReason, setRevisionReason] = useState('');
  const [revising, setRevising] = useState(false);
  const [reopenDialog, setReopenDialog] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopening, setReopening] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>({});
  const [deleteFilesDialog, setDeleteFilesDialog] = useState(false);
  const [deletingFiles, setDeletingFiles] = useState(false);
  const [changingAreaDoc, setChangingAreaDoc] = useState<{ id: string; name: string; oldAreaId: string; newAreaId: string } | null>(null);
  const [changingArea, setChangingArea] = useState(false);

  // Typing indicator
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>();
  const channelRef = useRef<any>(null);

  const { data: solicitation, isLoading } = useQuery({
    queryKey: ['solicitation', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('solicitations')
        .select('*, operations(name), profiles!solicitations_requester_id_fkey(name, email)')
        .eq('id', id)
        .single();
      return data;
    },
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', id],
    queryFn: async () => {
      const { data } = await supabase.from('documents').select('*, areas(name)').eq('solicitation_id', id).order('created_at');
      return data || [];
    },
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ['attachments', id],
    queryFn: async () => {
      const { data } = await supabase.from('attachments').select('*, profiles(name)').eq('solicitation_id', id).is('document_id', null).order('uploaded_at');
      return data || [];
    },
  });

  const { data: docAttachments = [] } = useQuery({
    queryKey: ['doc-attachments', id],
    queryFn: async () => {
      const { data } = await supabase.from('attachments').select('*, profiles(name)').eq('solicitation_id', id).not('document_id', 'is', null).order('uploaded_at');
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

  const { data: activeAreas = [] } = useQuery({
    queryKey: ['active-areas'],
    queryFn: async () => (await supabase.from('areas').select('id, name').eq('active', true).order('name')).data || [],
  });


  useEffect(() => {
    if (!id || !profile) return;
    const channel = supabase.channel(`typing-${id}`);
    channel.on('broadcast', { event: 'typing' }, (payload: any) => {
      if (payload.payload.userId !== profile.id) {
        setTypingUser(payload.payload.name);
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => setTypingUser(null), 3000);
      }
    }).subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [id, profile]);

  const broadcastTyping = () => {
    if (channelRef.current && profile) {
      channelRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId: profile.id, name: profile.name } });
    }
  };

  const groupedDocs = useMemo(() => {
    const groups: Record<string, { areaName: string; docs: any[] }> = {};
    documents.forEach((doc: any) => {
      const areaId = doc.responsible_area_id;
      const areaName = (doc.areas as any)?.name || 'Sem área';
      if (!groups[areaId]) groups[areaId] = { areaName, docs: [] };
      groups[areaId].docs.push(doc);
    });
    return groups;
  }, [documents]);

  const getDocVersions = (docId: string) => {
    return docAttachments.filter((a: any) => a.document_id === docId).sort((a: any, b: any) => new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime());
  };

  const sendComment = async () => {
    if (!comment.trim() || !profile) return;
    setSendingComment(true);
    try {
      await supabase.from('comments').insert({ solicitation_id: id!, user_id: profile.id, message: comment });
      await supabase.from('audit_logs').insert({ solicitation_id: id!, user_id: profile.id, action: 'Comentário adicionado', details: comment });
      const areaIds = [...new Set(documents.map((d: any) => d.responsible_area_id))];
      if (solicitation) {
        const { data: assignments } = await supabase.from('user_group_assignments').select('user_id').in('area_id', areaIds).eq('operation_id', solicitation.operation_id);
        const uniqueUsers = [...new Set((assignments || []).map(a => a.user_id))];
        for (const userId of uniqueUsers) {
          if (userId !== profile.id) {
            await supabase.from('notifications').insert({ user_id: userId, type: 'comentario', message: `Novo comentário em ${solicitation.ticket_id}`, solicitation_id: id! });
          }
        }
        // Send emails to attendees
        const emails = await getAttendeesEmails(areaIds, solicitation.operation_id);
        for (const email of emails) {
          await sendCommentEmail(email, id!, solicitation.ticket_id!, comment, profile.name, 'atendente');
        }
      }
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['comments', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs', id] });
    } finally {
      setSendingComment(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) { toast.error('Informe o motivo'); return; }
    setCancelling(true);
    try {
      await supabase.from('solicitations').update({ status: 'cancelado', cancel_reason: cancelReason }).eq('id', id);
      await supabase.from('audit_logs').insert({ solicitation_id: id!, user_id: profile!.id, action: 'Solicitação cancelada', details: cancelReason });
      const areaIds = [...new Set(documents.map((d: any) => d.responsible_area_id))];
      if (solicitation) {
        const { data: assignments } = await supabase.from('user_group_assignments').select('user_id').in('area_id', areaIds).eq('operation_id', solicitation.operation_id);
        const uniqueUsers = [...new Set((assignments || []).map(a => a.user_id))];
        for (const userId of uniqueUsers) {
          await supabase.from('notifications').insert({ user_id: userId, type: 'cancelamento', message: `Solicitação ${solicitation.ticket_id} foi cancelada`, solicitation_id: id! });
        }
        // Send cancel email
        const emails = await getAttendeesEmails(areaIds, solicitation.operation_id);
        await sendCancelEmail(emails, id!, solicitation.ticket_id!, cancelReason, (solicitation.operations as any)?.name, solicitation.employee_name || '');
      }
      queryClient.invalidateQueries();
      setCancelDialog(false);
      toast.success('Solicitação cancelada');
    } finally {
      setCancelling(false);
    }
  };

  const handleRevision = async () => {
    if (!revisionReason.trim() || !revisionDialog) { toast.error('Informe o motivo'); return; }
    setRevising(true);
    try {
      await supabase.from('documents').update({ status: 'revisao_solicitada', revision_reason: revisionReason }).eq('id', revisionDialog);
      const doc = documents.find((d: any) => d.id === revisionDialog);
      if (doc) {
        await supabase.from('area_conclusions').delete().eq('solicitation_id', id!).eq('area_id', (doc as any).responsible_area_id);
      }
      await supabase.from('solicitations').update({ status: 'em_atendimento', concluded_at: null }).eq('id', id);
      await supabase.from('audit_logs').insert({ solicitation_id: id!, user_id: profile!.id, action: 'Revisão solicitada', details: `Documento: ${(doc as any)?.document_name}. Motivo: ${revisionReason}` });
      if (doc && solicitation) {
        const { data: assignments } = await supabase.from('user_group_assignments').select('user_id').eq('area_id', (doc as any).responsible_area_id).eq('operation_id', solicitation.operation_id);
        for (const a of assignments || []) {
          await supabase.from('notifications').insert({ user_id: a.user_id, type: 'revisao', message: `Revisão solicitada no documento "${(doc as any).document_name}" do ticket ${solicitation.ticket_id}`, solicitation_id: id! });
        }
        // Send revision email
        await sendRevisionEmail((doc as any).responsible_area_id, solicitation.operation_id, id!, solicitation.ticket_id!, (doc as any).document_name, revisionReason, (solicitation.operations as any)?.name, solicitation.employee_name || '');
      }
      queryClient.invalidateQueries();
      setRevisionDialog(null);
      setRevisionReason('');
      toast.success('Revisão solicitada');
    } finally {
      setRevising(false);
    }
  };

  const handleReopen = async () => {
    if (!reopenReason.trim()) { toast.error('Informe o motivo'); return; }
    setReopening(true);
    try {
      await supabase.from('solicitations').update({ status: 'em_atendimento', concluded_at: null }).eq('id', id);
      await supabase.from('area_conclusions').delete().eq('solicitation_id', id!);
      await supabase.from('audit_logs').insert({ solicitation_id: id!, user_id: profile!.id, action: 'Solicitação reaberta', details: `Motivo: ${reopenReason}` });

      const areaIds = [...new Set(documents.map((d: any) => d.responsible_area_id))];
      if (solicitation) {
        const { data: assignments } = await supabase.from('user_group_assignments').select('user_id').in('area_id', areaIds).eq('operation_id', solicitation.operation_id);
        const uniqueUsers = [...new Set((assignments || []).map(a => a.user_id))];
        for (const userId of uniqueUsers) {
          await supabase.from('notifications').insert({ user_id: userId, type: 'reabertura', message: `Solicitação ${solicitation.ticket_id} foi reaberta`, solicitation_id: id! });
        }
        // Send reopen emails per area
        for (const areaId of areaIds) {
          const areaDocs = documents.filter((d: any) => d.responsible_area_id === areaId);
          await sendReopenEmail(areaId, solicitation.operation_id, id!, solicitation.ticket_id!, reopenReason, (solicitation.operations as any)?.name, solicitation.employee_name || '', areaDocs);
        }
      }
      queryClient.invalidateQueries();
      setReopenDialog(false);
      setReopenReason('');
      toast.success('Solicitação reaberta');
    } finally {
      setReopening(false);
    }
  };

  const handleDownloadZip = async () => {
    setZipping(true);
    try {
      const zip = new JSZip();
      const allFiles: { name: string; url: string }[] = [];

      documents.forEach((doc: any) => {
        if (doc.file_url) allFiles.push({ name: `documentos/${doc.document_name}${getFileExtFromUrl(doc.file_url)}`, url: doc.file_url });
      });
      attachments.forEach((a: any) => {
        allFiles.push({ name: `anexos/${a.file_name}`, url: a.file_url });
      });
      docAttachments.forEach((a: any) => {
        allFiles.push({ name: `versoes/${a.file_name}`, url: a.file_url });
      });

      for (const file of allFiles) {
        try {
          const url = file.url.includes('/storage/v1/object/public/') ? file.url : file.url.replace('/object/sign/', '/object/public/').split('?')[0];
          const response = await fetch(url);
          if (response.ok) {
            const blob = await response.blob();
            zip.file(file.name, blob);
          }
        } catch (err) {
          console.error('Failed to fetch file:', file.name, err);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${solicitation?.ticket_id || 'documentos'}_documentos.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('ZIP baixado com sucesso!');
    } catch (err) {
      toast.error('Erro ao gerar ZIP');
    } finally {
      setZipping(false);
    }
  };

  const getFileExtFromUrl = (url: string) => {
    const match = url.match(/\.(\w+)(?:\?|$)/);
    return match ? `.${match[1]}` : '';
  };

  const extractStoragePath = (publicUrl: string): string | null => {
    const m = publicUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/solicitations\/([^?]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  };

  const handleDeleteFiles = async () => {
    if (!profile) return;
    setDeletingFiles(true);
    try {
      const paths: string[] = [];
      const allAttIds: string[] = [];
      [...attachments, ...docAttachments].forEach((a: any) => {
        if (a.file_url && !a.deleted_at) {
          const p = extractStoragePath(a.file_url);
          if (p) paths.push(p);
          allAttIds.push(a.id);
        }
      });
      documents.forEach((d: any) => {
        if (d.file_url) {
          const p = extractStoragePath(d.file_url);
          if (p) paths.push(p);
        }
      });
      if (paths.length > 0) {
        await supabase.storage.from('solicitations').remove(paths);
      }
      if (allAttIds.length > 0) {
        await supabase.from('attachments').update({ file_url: null, deleted_at: new Date().toISOString(), deleted_by: profile.id } as any).in('id', allAttIds);
      }
      const docIds = documents.filter((d: any) => d.file_url).map((d: any) => d.id);
      if (docIds.length > 0) {
        await supabase.from('documents').update({ file_url: null }).in('id', docIds);
      }
      await supabase.from('audit_logs').insert({
        solicitation_id: id!,
        user_id: profile.id,
        action: 'Arquivos excluídos',
        details: `${paths.length} arquivo(s) removido(s) do ticket por ${profile.name}`,
      });
      toast.success('Arquivos excluídos com sucesso!');
      setDeleteFilesDialog(false);
      queryClient.invalidateQueries();
    } catch (err: any) {
      toast.error('Erro ao excluir arquivos: ' + err.message);
    } finally {
      setDeletingFiles(false);
    }
  };

  const handleChangeArea = async () => {
    if (!changingAreaDoc || !profile) return;
    setChangingArea(true);
    try {
      const { id: docId, oldAreaId, newAreaId, name } = changingAreaDoc;
      await supabase.from('documents').update({ responsible_area_id: newAreaId, status: 'pendente' }).eq('id', docId);
      // Remove conclusion of old area (since the docs in that area changed)
      await supabase.from('area_conclusions').delete().eq('solicitation_id', id!).eq('area_id', oldAreaId);

      const newAreaName = activeAreas.find((a: any) => a.id === newAreaId)?.name || '';
      const oldAreaName = (documents.find((d: any) => d.id === docId) as any)?.areas?.name || '';

      await supabase.from('audit_logs').insert({
        solicitation_id: id!,
        user_id: profile.id,
        action: 'Área do documento alterada',
        details: `Documento "${name}" movido de "${oldAreaName}" para "${newAreaName}"`,
      });

      // Notify users in the new area
      if (solicitation) {
        const { data: assignments } = await supabase.from('user_group_assignments').select('user_id').eq('area_id', newAreaId).eq('operation_id', solicitation.operation_id);
        for (const a of assignments || []) {
          await supabase.from('notifications').insert({
            user_id: a.user_id,
            type: 'nova_solicitacao',
            message: `Documento "${name}" foi atribuído à sua área no ticket ${solicitation.ticket_id}`,
            solicitation_id: id!,
          });
        }
      }

      toast.success('Área atualizada!');
      setChangingAreaDoc(null);
      queryClient.invalidateQueries();
    } catch (err: any) {
      toast.error('Erro ao alterar área: ' + err.message);
    } finally {
      setChangingArea(false);
    }
  };

  const hasActiveFiles = documents.some((d: any) => d.file_url) || attachments.some((a: any) => a.file_url && !a.deleted_at) || docAttachments.some((a: any) => a.file_url && !a.deleted_at);
  const hasFiles = documents.some((d: any) => d.file_url) || attachments.length > 0 || docAttachments.length > 0;

  if (isLoading) return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );

  if (!solicitation) return <div className="p-8 text-center text-muted-foreground">Solicitação não encontrada</div>;

  const deadlineInfo = solicitation.deadline ? getDeadlineInfo(solicitation.deadline) : null;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <Card className="p-4 md:p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/solicitacoes')}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div className="flex flex-wrap gap-2">
            {hasFiles && (
              <Button variant="outline" size="sm" onClick={handleDownloadZip} disabled={zipping}>
                {zipping ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <PackageOpen className="h-4 w-4 mr-1" />} Baixar todos (ZIP)
              </Button>
            )}
            {solicitation.status === 'aberto' && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/nova-solicitacao?editar=${id}`)}>
                <Edit className="h-4 w-4 mr-1" /> Editar
              </Button>
            )}
            {solicitation.status === 'concluido' && (
              <Button variant="outline" size="sm" className="text-warning border-warning hover:bg-warning/10" onClick={() => setReopenDialog(true)}>
                <RotateCcw className="h-4 w-4 mr-1" /> Reabrir
              </Button>
            )}
            {solicitation.status !== 'cancelado' && solicitation.status !== 'concluido' && (
              <Button variant="destructive" size="sm" onClick={() => setCancelDialog(true)}>
                <XCircle className="h-4 w-4 mr-1" /> Cancelar
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Solicitação {solicitation.ticket_id}</h1>
          <StatusBadge status={solicitation.status as any} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
          <div><p className="text-sm text-muted-foreground">Operação</p><p className="font-semibold">{(solicitation.operations as any)?.name}</p></div>
          <div><p className="text-sm text-muted-foreground">Nº Processo</p><p className="font-semibold text-sm">{solicitation.process_number || '—'}</p></div>
          <div><p className="text-sm text-muted-foreground">Funcionário</p><p className="font-semibold">{solicitation.employee_name}</p></div>
          <div><p className="text-sm text-muted-foreground">Matrícula</p><p className="font-semibold">{(solicitation as any).employee_registration || '—'}</p></div>
          <div><p className="text-sm text-muted-foreground">Solicitante</p><p className="font-semibold">{(solicitation.profiles as any)?.name}</p></div>
          <div>
            <p className="text-sm text-muted-foreground">Prazo fatal</p>
            {deadlineInfo && <p className={`font-semibold ${deadlineInfo.className}`}>{new Date(solicitation.deadline + 'T00:00:00').toLocaleDateString('pt-BR')} ({deadlineInfo.label})</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(groupedDocs).map(([areaId, { areaName }]) => {
            const concluded = areaConclusions.some((c: any) => c.area_id === areaId);
            return (
              <span key={areaId} className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${concluded ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                {areaName}: {concluded ? '✅ Concluído' : '⏳ Pendente'}
              </span>
            );
          })}
        </div>
        {solicitation.observations && (
          <div className="bg-[hsl(48,100%,96%)] dark:bg-warning/10 border-l-4 border-[hsl(48,96%,53%)] p-3 rounded text-sm">
            <strong>Observações:</strong> {solicitation.observations}
          </div>
        )}
        {solicitation.cancel_reason && (
          <div className="bg-danger/10 text-danger p-3 rounded text-sm mt-2">
            <strong>Motivo do cancelamento:</strong> {solicitation.cancel_reason}
          </div>
        )}
      </Card>

      {/* Solicitation Attachments */}
      {attachments.length > 0 && (
        <Card className="p-4 md:p-6 mb-6">
          <h2 className="text-lg font-semibold text-primary mb-4">Anexos da Solicitação</h2>
          <div className="space-y-2">
            {attachments.map((a: any) => (
              <div key={a.id} className="flex items-center gap-3 p-3 bg-accent rounded-lg flex-wrap">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm flex-1 truncate">{a.file_name}</span>
                <span className="text-xs text-muted-foreground">{(a.profiles as any)?.name} • {new Date(a.uploaded_at).toLocaleDateString('pt-BR')}</span>
                <AttachmentActions fileUrl={a.file_url} fileName={a.file_name} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Documents grouped by area */}
      {Object.entries(groupedDocs).map(([areaId, { areaName, docs }]) => (
        <Card key={areaId} className="p-4 md:p-6 mb-6">
          <h2 className="text-lg font-semibold text-primary mb-4">Documentos — {areaName}</h2>
          {docs.map((doc: any) => {
            const versions = getDocVersions(doc.id);
            const hasVersions = versions.length > 1 || (versions.length > 0 && doc.revision_reason);
            return (
              <div key={doc.id} className="bg-accent rounded-lg p-4 mb-3 border">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-semibold">{doc.document_name}</span>
                  <div className="flex items-center gap-2 flex-wrap">
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
                  <div className="mt-1">
                    <AttachmentActions fileUrl={doc.file_url} fileName={doc.file_name || doc.document_name} compact />
                  </div>
                )}
                {doc.revision_reason && (
                  <div className="bg-status-revision/10 border-l-4 border-status-revision p-2 mt-2 rounded text-sm">
                    <strong>Motivo da revisão:</strong> {doc.revision_reason}
                  </div>
                )}
                {/* Version history */}
                {hasVersions && (
                  <div className="mt-2">
                    <button
                      className="text-xs text-info flex items-center gap-1 hover:underline"
                      onClick={() => setExpandedVersions(prev => ({ ...prev, [doc.id]: !prev[doc.id] }))}
                    >
                      <History className="h-3 w-3" /> Ver histórico de versões ({versions.length} {versions.length === 1 ? 'versão' : 'versões'})
                    </button>
                    {expandedVersions[doc.id] && (
                      <div className="mt-2 space-y-2 pl-4 border-l-2 border-info/30">
                        {versions.map((v: any, idx: number) => (
                          <div key={v.id} className="text-sm">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-foreground">Versão {idx + 1}</span>
                              <span className="text-xs text-muted-foreground">{v.file_name}</span>
                              <span className="text-xs text-muted-foreground">por {(v.profiles as any)?.name} • {new Date(v.uploaded_at).toLocaleString('pt-BR')}</span>
                              <AttachmentActions fileUrl={v.file_url} fileName={v.file_name} compact />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      ))}

      {/* Comments */}
      <Card className="p-4 md:p-6 mb-6">
        <h2 className="text-lg font-semibold text-primary mb-4">Comentários</h2>
        <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
          {comments.map((c: any) => (
            <div key={c.id} className={`p-3 rounded-lg ${(c.profiles as any)?.role === 'juridico' ? 'bg-info/5' : 'bg-accent'}`}>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span className="font-medium">{(c.profiles as any)?.name} ({(c.profiles as any)?.role === 'juridico' ? 'Jurídico' : 'Atendente'})</span>
                <span>{new Date(c.created_at).toLocaleString('pt-BR')}</span>
              </div>
              <p className="text-sm">{c.message}</p>
            </div>
          ))}
          {comments.length === 0 && <p className="text-muted-foreground text-center">Nenhum comentário</p>}
        </div>
        {typingUser && (
          <p className="text-xs text-muted-foreground mb-2 animate-pulse">{typingUser} está digitando...</p>
        )}
        {solicitation.status !== 'cancelado' && solicitation.status !== 'concluido' && (
          <div className="flex gap-2">
            <Textarea value={comment} onChange={(e) => { setComment(e.target.value); broadcastTyping(); }} rows={2} placeholder="Escreva um comentário..." className="flex-1" />
            <Button size="sm" className="self-end" disabled={!comment.trim() || sendingComment} onClick={sendComment}>
              {sendingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1" /> Enviar</>}
            </Button>
          </div>
        )}
      </Card>

      {/* Audit */}
      <Card className="p-4 md:p-6 mb-6">
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-lg font-semibold text-primary cursor-pointer">
            <ChevronDown className={`h-4 w-4 transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
            Histórico de Atividades ({auditLogs.length} registros)
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-2">
            {auditLogs.map((log: any) => (
              <div key={log.id} className="flex gap-3 text-sm p-2 border-b flex-wrap">
                <span className="text-muted-foreground whitespace-nowrap">{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                <div>
                  <span className="font-medium">{log.action}</span>
                  {log.details && <span className="text-muted-foreground"> — {log.details}</span>}
                  <span className="text-xs text-muted-foreground ml-2">por {(log.profiles as any)?.name}</span>
                </div>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialog} onOpenChange={setCancelDialog}>
        <DialogContent className="max-w-[95vw] md:max-w-lg">
          <DialogHeader><DialogTitle>Cancelar solicitação</DialogTitle></DialogHeader>
          <DialogDescription>Tem certeza? Informe o motivo do cancelamento.</DialogDescription>
          <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Motivo do cancelamento *" rows={3} />
          <DialogFooter className="flex-col md:flex-row gap-2">
            <Button variant="outline" onClick={() => setCancelDialog(false)} className="w-full md:w-auto">Voltar</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling} className="w-full md:w-auto">
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revision Dialog */}
      <Dialog open={!!revisionDialog} onOpenChange={() => setRevisionDialog(null)}>
        <DialogContent className="max-w-[95vw] md:max-w-lg">
          <DialogHeader><DialogTitle>Solicitar revisão</DialogTitle></DialogHeader>
          <DialogDescription>Informe o motivo da devolutiva.</DialogDescription>
          <Textarea value={revisionReason} onChange={(e) => setRevisionReason(e.target.value)} placeholder="Motivo da devolutiva *" rows={3} />
          <DialogFooter className="flex-col md:flex-row gap-2">
            <Button variant="outline" onClick={() => setRevisionDialog(null)} className="w-full md:w-auto">Cancelar</Button>
            <Button onClick={handleRevision} disabled={revising} className="w-full md:w-auto">
              {revising ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Solicitar revisão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen Dialog */}
      <Dialog open={reopenDialog} onOpenChange={setReopenDialog}>
        <DialogContent className="max-w-[95vw] md:max-w-lg">
          <DialogHeader><DialogTitle>Reabrir solicitação</DialogTitle></DialogHeader>
          <DialogDescription>Deseja reabrir esta solicitação? Informe o motivo.</DialogDescription>
          <Textarea value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder="Motivo da reabertura *" rows={3} />
          <DialogFooter className="flex-col md:flex-row gap-2">
            <Button variant="outline" onClick={() => setReopenDialog(false)} className="w-full md:w-auto">Cancelar</Button>
            <Button onClick={handleReopen} disabled={reopening} className="w-full md:w-auto">
              {reopening ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Reabrir solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DetalheTicketJuridico;
