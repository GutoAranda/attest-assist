import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { StatusBadge, getDeadlineInfo } from '@/components/StatusBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronDown, Upload, Send, FileText, Download, Loader2, History } from 'lucide-react';
import { toast } from 'sonner';
import { buildStoragePublicUrl, openStorageFile } from '@/lib/storage';
import { AttachmentActions } from '@/components/FilePreviewDialog';
import { sendCommentEmail, sendConclusionEmail } from '@/lib/email';

const DetalheTicketAtendente = () => {
  const { id } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [docStates, setDocStates] = useState<Record<string, { status: string; observations: string; file?: File }>>({});
  const [concluding, setConcluding] = useState(false);
  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>({});

  // Typing indicator
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>();
  const channelRef = useRef<any>(null);

  const { data: myAssignments = [] } = useQuery({
    queryKey: ['my-assignments', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase.from('user_group_assignments').select('area_id, operation_id').eq('user_id', profile.id);
      return data || [];
    },
    enabled: !!profile,
  });

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

  const { data: allDocuments = [] } = useQuery({
    queryKey: ['documents', id],
    queryFn: async () => {
      const { data } = await supabase.from('documents').select('*, areas(name)').eq('solicitation_id', id).order('created_at');
      return data || [];
    },
  });

  // Single query for all attachments, split client-side (saves 1 round-trip)
  const { data: allAttachments = [] } = useQuery({
    queryKey: ['all-attachments', id],
    queryFn: async () => {
      const { data } = await supabase.from('attachments').select('*, profiles(name)').eq('solicitation_id', id).order('uploaded_at');
      return data || [];
    },
  });

  const attachments = useMemo(
    () => allAttachments.filter((a: any) => !a.document_id),
    [allAttachments]
  );
  const docAttachments = useMemo(
    () => allAttachments.filter((a: any) => !!a.document_id),
    [allAttachments]
  );

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

  const { data: areas = [] } = useQuery({
    queryKey: ['all-areas'],
    queryFn: async () => {
      const { data } = await supabase.from('areas').select('*');
      return data || [];
    },
  });

  // Realtime typing
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

  const myDocs = allDocuments.filter((d: any) =>
    myAssignments.some(a => a.area_id === d.responsible_area_id && a.operation_id === solicitation?.operation_id)
  );

  const statusOrder: Record<string, number> = { pendente: 0, revisao_solicitada: 1, em_busca: 2, inexistente: 3, enviado: 4 };
  const sortedDocs = [...myDocs].sort((a: any, b: any) => (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0));

  const getDocState = (docId: string, currentDoc: any) => {
    return docStates[docId] || { status: currentDoc.status, observations: currentDoc.observations || '' };
  };

  const updateDocState = (docId: string, field: string, value: any) => {
    setDocStates(prev => ({
      ...prev,
      [docId]: { ...getDocState(docId, {}), ...prev[docId], [field]: value }
    }));
  };

  const getDocVersions = (docId: string) => {
    return docAttachments.filter((a: any) => a.document_id === docId).sort((a: any, b: any) => new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime());
  };

  const saveDocChanges = async (doc: any) => {
    const state = docStates[doc.id];
    if (!state) return;

    try {
      let fileUrl = doc.file_url;

      if (state.file) {
        const path = `${id}/${doc.id}/${Date.now()}_${state.file.name}`;
        const { error: upErr } = await supabase.storage.from('solicitations').upload(path, state.file);
        if (upErr) throw upErr;
        fileUrl = buildStoragePublicUrl('solicitations', path);

        await supabase.from('attachments').insert({
          solicitation_id: id!,
          document_id: doc.id,
          file_name: state.file.name,
          file_url: fileUrl,
          uploaded_by: profile!.id,
        });
      }

      await supabase.from('documents').update({
        status: state.status,
        observations: state.observations || null,
        file_url: state.status === 'enviado' ? fileUrl : doc.file_url,
        revision_reason: state.status !== 'revisao_solicitada' ? null : doc.revision_reason,
      }).eq('id', doc.id);

      if (solicitation?.status === 'aberto') {
        await supabase.from('solicitations').update({ status: 'em_atendimento' }).eq('id', id);
      }

      await supabase.from('audit_logs').insert({
        solicitation_id: id!,
        user_id: profile!.id,
        action: `Documento atualizado`,
        details: `${doc.document_name}: status alterado para ${state.status}`,
      });

      queryClient.invalidateQueries({ queryKey: ['documents', id] });
      queryClient.invalidateQueries({ queryKey: ['doc-attachments', id] });
      queryClient.invalidateQueries({ queryKey: ['solicitation', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs', id] });
      toast.success('Documento atualizado!');
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
  };

  const sendCommentFn = async () => {
    if (!comment.trim() || !profile) return;
    setSendingComment(true);
    try {
      await supabase.from('comments').insert({ solicitation_id: id!, user_id: profile.id, message: comment });
      await supabase.from('audit_logs').insert({ solicitation_id: id!, user_id: profile.id, action: 'Comentário adicionado', details: comment });
      if (solicitation?.requester_id && solicitation.requester_id !== profile.id) {
        await supabase.from('notifications').insert({ user_id: solicitation.requester_id, type: 'comentario', message: `Novo comentário em ${solicitation.ticket_id}`, solicitation_id: id! });
        // Email to requester
        const requesterEmail = (solicitation.profiles as any)?.email;
        if (requesterEmail) {
          await sendCommentEmail(requesterEmail, id!, solicitation.ticket_id!, comment, profile.name, 'juridico');
        }
      }
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['comments', id] });
      queryClient.invalidateQueries({ queryKey: ['audit-logs', id] });
      toast.success('Comentário enviado!');
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setSendingComment(false);
    }
  };

  const handleConclude = async () => {
    for (const doc of sortedDocs) {
      const state = docStates[doc.id] || { status: doc.status, observations: doc.observations };
      if (state.status === 'enviado' && !doc.file_url && !docStates[doc.id]?.file) {
        toast.error(`Documento "${doc.document_name}" marcado como Enviado precisa ter um arquivo anexado`);
        return;
      }
      if (state.status === 'em_busca') {
        toast.error(`Documento "${doc.document_name}" não pode estar "Em busca" para concluir`);
        return;
      }
      if (state.status === 'inexistente' && !state.observations) {
        toast.error(`Documento "${doc.document_name}" marcado como Inexistente precisa ter observações`);
        return;
      }
    }

    setConcluding(true);
    try {
      for (const doc of sortedDocs) {
        if (docStates[doc.id]) await saveDocChanges(doc);
      }

      const myAreaIds = [...new Set(myAssignments.map(a => a.area_id))];
      for (const areaId of myAreaIds) {
        await supabase.from('area_conclusions').upsert({
          solicitation_id: id!,
          area_id: areaId,
          concluded_by: profile!.id,
        }, { onConflict: 'solicitation_id,area_id' });
      }

      const involvedAreaIds = [...new Set(allDocuments.map((d: any) => d.responsible_area_id))];
      const { data: conclusions } = await supabase.from('area_conclusions').select('area_id').eq('solicitation_id', id!);
      const concludedAreaIds = new Set((conclusions || []).map((c: any) => c.area_id));
      const allConcluded = involvedAreaIds.every(a => concludedAreaIds.has(a));

      const newStatus = allConcluded ? 'concluido' : 'parcialmente_concluido';
      await supabase.from('solicitations').update({
        status: newStatus,
        ...(allConcluded ? { concluded_at: new Date().toISOString() } : {}),
      }).eq('id', id);

      await supabase.from('audit_logs').insert({
        solicitation_id: id!,
        user_id: profile!.id,
        action: allConcluded ? 'Solicitação concluída' : 'Área concluída parcialmente',
        details: `Concluído por ${profile!.name}`,
      });

      if (allConcluded && solicitation?.requester_id) {
        await supabase.from('notifications').insert({
          user_id: solicitation.requester_id,
          type: 'conclusao',
          message: `Solicitação ${solicitation.ticket_id} foi concluída`,
          solicitation_id: id!,
        });
        // Send conclusion email
        const requesterEmail = (solicitation.profiles as any)?.email;
        if (requesterEmail) {
          await sendConclusionEmail(requesterEmail, id!, solicitation.ticket_id!, allDocuments.map((d: any) => ({ document_name: d.document_name, status: d.status })));
        }
      }

      queryClient.invalidateQueries();
      toast.success('Sua parte foi concluída!');
      navigate('/minhas-solicitacoes');
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setConcluding(false);
    }
  };

  if (isLoading) return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );

  if (!solicitation) return <div className="p-8 text-center text-muted-foreground">Solicitação não encontrada</div>;

  const deadlineInfo = solicitation.deadline ? getDeadlineInfo(solicitation.deadline) : null;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <Card className="p-4 md:p-6 mb-6">
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate('/minhas-solicitacoes')}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Solicitação {solicitation.ticket_id}</h1>
          <StatusBadge status={solicitation.status as any} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div><p className="text-sm text-muted-foreground">Operação</p><p className="font-semibold">{(solicitation.operations as any)?.name}</p></div>
          <div><p className="text-sm text-muted-foreground">Nº Processo</p><p className="font-semibold text-sm">{solicitation.process_number || '—'}</p></div>
          <div><p className="text-sm text-muted-foreground">Funcionário</p><p className="font-semibold">{solicitation.employee_name}</p></div>
          <div><p className="text-sm text-muted-foreground">Matrícula</p><p className="font-semibold">{(solicitation as any).employee_registration || '—'}</p></div>
          <div><p className="text-sm text-muted-foreground">Solicitante</p><p className="font-semibold">{(solicitation.profiles as any)?.name}</p></div>
          <div>
            <p className="text-sm text-muted-foreground">Prazo fatal</p>
            {deadlineInfo && (
              <p className={`font-semibold ${deadlineInfo.className}`}>
                {new Date(solicitation.deadline + 'T00:00:00').toLocaleDateString('pt-BR')} ({deadlineInfo.label})
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {areas.filter((a: any) => allDocuments.some((d: any) => d.responsible_area_id === a.id)).map((area: any) => {
            const concluded = areaConclusions.some((c: any) => c.area_id === area.id);
            return (
              <span key={area.id} className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${concluded ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                {area.name}: {concluded ? '✅ Concluído' : '⏳ Pendente'}
              </span>
            );
          })}
        </div>
        {solicitation.observations && (
          <div className="bg-[hsl(48,100%,96%)] dark:bg-warning/10 border-l-4 border-[hsl(48,96%,53%)] p-3 rounded text-sm mt-4">
            <strong>Observações:</strong> {solicitation.observations}
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

      {/* Documents */}
      <Card className="p-4 md:p-6 mb-6">
        <h2 className="text-lg font-semibold text-primary mb-4">Documentos Solicitados</h2>
        {sortedDocs.map((doc: any) => {
          const currentStatus = docStates[doc.id]?.status || doc.status;
          const versions = getDocVersions(doc.id);
          const hasVersions = versions.length > 1 || (versions.length > 0 && doc.revision_reason);

          return (
            <div key={doc.id} className="bg-card rounded-lg p-4 md:p-5 mb-4 border border-border-strong">
              <h3 className="font-semibold text-foreground mb-3">{doc.document_name}</h3>

              {doc.revision_reason && (doc.status === 'revisao_solicitada' || currentStatus === 'revisao_solicitada') && (
                <div className="bg-status-revision/10 border-l-4 border-status-revision p-4 mb-3 rounded">
                  <p className="text-sm font-semibold text-status-revision">Motivo da devolutiva:</p>
                  <p className="text-sm text-foreground">{doc.revision_reason}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Status *</label>
                  <Select value={currentStatus} onValueChange={(v) => updateDocState(doc.id, 'status', v)}>
                    <SelectTrigger className={
                      currentStatus === 'enviado' ? 'bg-success/5 border-success/30 text-success' :
                      currentStatus === 'inexistente' ? 'bg-danger/10 border-danger text-danger' :
                      'bg-muted border-border text-muted-foreground'
                    }>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enviado">Enviado</SelectItem>
                      <SelectItem value="em_busca">Em busca</SelectItem>
                      <SelectItem value="inexistente">Inexistente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {currentStatus === 'enviado' && (
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">Arquivo *</label>
                    <label className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-success/5 bg-success/5">
                      <Upload className="h-4 w-4 text-success" />
                      <span className="text-sm truncate">
                        {docStates[doc.id]?.file?.name || (doc.file_url ? 'Arquivo enviado ✓' : 'Selecionar arquivo')}
                      </span>
                      <input type="file" className="hidden" onChange={(e) => {
                        if (e.target.files?.[0]) updateDocState(doc.id, 'file', e.target.files[0]);
                      }} />
                    </label>
                    {doc.file_url && (
                      <div className="mt-1">
                        <AttachmentActions fileUrl={doc.file_url} fileName={doc.file_name || doc.document_name} compact />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-3">
                <label className="text-sm text-muted-foreground mb-1 block">
                  Observações {currentStatus === 'inexistente' ? '*' : '(opcional)'}
                </label>
                <Textarea
                  value={docStates[doc.id]?.observations ?? doc.observations ?? ''}
                  onChange={(e) => updateDocState(doc.id, 'observations', e.target.value)}
                  rows={2}
                  placeholder={currentStatus === 'inexistente' ? 'Explique por que o documento é inexistente (obrigatório)' : 'Observações'}
                  className={currentStatus === 'inexistente' && !(docStates[doc.id]?.observations || doc.observations) ? 'border-danger' : ''}
                />
              </div>

              {/* Version history */}
              {hasVersions && (
                <div className="mt-2">
                  <button
                    className="text-xs text-info flex items-center gap-1 hover:underline"
                    onClick={() => setExpandedVersions(prev => ({ ...prev, [doc.id]: !prev[doc.id] }))}
                  >
                    <History className="h-3 w-3" /> Ver histórico de versões ({versions.length})
                  </button>
                  {expandedVersions[doc.id] && (
                    <div className="mt-2 space-y-2 pl-4 border-l-2 border-info/30">
                      {versions.map((v: any, idx: number) => (
                        <div key={v.id} className="text-sm flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">Versão {idx + 1}</span>
                          <span className="text-xs text-muted-foreground">{v.file_name}</span>
                          <span className="text-xs text-muted-foreground">por {(v.profiles as any)?.name} • {new Date(v.uploaded_at).toLocaleString('pt-BR')}</span>
                          <AttachmentActions fileUrl={v.file_url} fileName={v.file_name} compact />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {docStates[doc.id] && (
                <div className="mt-3 flex justify-end">
                  <Button size="sm" onClick={() => saveDocChanges(doc)}>Salvar alterações</Button>
                </div>
              )}
            </div>
          );
        })}
      </Card>

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
              <p className="text-sm text-foreground">{c.message}</p>
            </div>
          ))}
          {comments.length === 0 && <p className="text-muted-foreground text-center">Nenhum comentário</p>}
        </div>
        {typingUser && (
          <p className="text-xs text-muted-foreground mb-2 animate-pulse">{typingUser} está digitando...</p>
        )}
        <div className="flex gap-2">
          <Textarea value={comment} onChange={(e) => { setComment(e.target.value); broadcastTyping(); }} rows={2} placeholder="Escreva um comentário..." className="flex-1" />
          <Button size="sm" className="self-end" disabled={!comment.trim() || sendingComment} onClick={sendCommentFn}>
            {sendingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1" /> Enviar</>}
          </Button>
        </div>
      </Card>

      {/* Audit History */}
      <Card className="p-4 md:p-6 mb-6">
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-lg font-semibold text-primary cursor-pointer">
            <ChevronDown className={`h-4 w-4 transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
            Histórico de Atividades ({auditLogs.length} registros)
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <div className="space-y-2">
              {auditLogs.map((log: any) => (
                <div key={log.id} className="flex gap-3 text-sm p-2 border-b flex-wrap">
                  <span className="text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('pt-BR')}
                  </span>
                  <div>
                    <span className="font-medium">{log.action}</span>
                    {log.details && <span className="text-muted-foreground"> — {log.details}</span>}
                    <span className="text-muted-foreground ml-1">({(log.profiles as any)?.name})</span>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Footer */}
      <div className="flex flex-col md:flex-row justify-end gap-3 mt-6">
        <Button variant="outline" onClick={() => navigate('/minhas-solicitacoes')} className="w-full md:w-auto">Voltar</Button>
        <Button onClick={handleConclude} disabled={concluding} className="w-full md:w-auto">
          {concluding ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Concluindo...</> : 'Concluir'}
        </Button>
      </div>
    </div>
  );
};

export default DetalheTicketAtendente;
