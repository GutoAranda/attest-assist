import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, PlusCircle, Trash2, FileText, Loader2, GripVertical } from 'lucide-react';
import BulkDocumentImport from '@/components/BulkDocumentImport';
import { toast } from 'sonner';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { buildStoragePublicUrl } from '@/lib/storage';
import { sendNewSolicitationEmail } from '@/lib/email';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FileDropzone } from '@/components/FileDropzone';
import { MAX_FILE_BYTES, validateFileSize } from '@/lib/files';

interface DocumentRow {
  name: string;
  area_id: string;
}

interface SortableDocProps {
  id: string;
  index: number;
  doc: DocumentRow;
  areas: any[];
  onUpdate: (idx: number, field: keyof DocumentRow, value: string) => void;
  onRemove: (idx: number) => void;
  canRemove: boolean;
}

const SortableDocumentRow = ({ id, index, doc, areas, onUpdate, onRemove, canRemove }: SortableDocProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3">
      <button type="button" className="cursor-grab text-muted-foreground hover:text-foreground" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-muted-foreground text-sm w-6">{index + 1}</span>
      <Input value={doc.name} onChange={(e) => onUpdate(index, 'name', e.target.value)} placeholder="Nome do documento" className="flex-1" />
      <Select value={doc.area_id} onValueChange={(v) => onUpdate(index, 'area_id', v)}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Responsável" /></SelectTrigger>
        <SelectContent>
          {areas.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <button onClick={() => onRemove(index)} disabled={!canRemove} className="text-danger hover:text-danger/80 disabled:opacity-30">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
};

const isMissingDuplicateRpc = (error: { code?: string; message?: string } | null) => {
  if (!error) return false;
  return error.code === 'PGRST202' || error.message?.includes('Could not find the function');
};

const NovaSolicitacao = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [operationId, setOperationId] = useState('');
  const [processNumber, setProcessNumber] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [employeeRegistration, setEmployeeRegistration] = useState('');
  const [deadline, setDeadline] = useState<Date>();
  const [observations, setObservations] = useState('');
  const [documents, setDocuments] = useState<DocumentRow[]>([{ name: '', area_id: '' }]);
  const [files, setFiles] = useState<File[]>([]);
  const isSavingRef = useRef(false);
  const [duplicateDialog, setDuplicateDialog] = useState<string | null>(null);
  const [employeeDuplicateDialog, setEmployeeDuplicateDialog] = useState<{ tickets: { ticket_id: string; process_number: string }[] } | null>(null);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: operations = [] } = useQuery({
    queryKey: ['operations'],
    queryFn: async () => {
      const { data } = await supabase.from('operations').select('*').order('active', { ascending: false }).order('name');
      return data || [];
    },
  });

  const { data: areas = [] } = useQuery({
    queryKey: ['areas-active'],
    queryFn: async () => {
      const { data } = await supabase.from('areas').select('*').eq('active', true).order('name');
      return data || [];
    },
  });

  const checkDuplicate = async () => {
    const trimmedProcessNumber = processNumber.trim();
    if (!trimmedProcessNumber) return;

    const { data, error } = await supabase.rpc('check_duplicate_process', {
      p_number: trimmedProcessNumber,
      p_exclude_id: null,
    });

    let result = data;

    if (error && isMissingDuplicateRpc(error)) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('solicitations')
        .select('ticket_id')
        .eq('process_number', trimmedProcessNumber)
        .limit(1);

      if (fallbackError) {
        toast.error('Não foi possível validar a duplicidade do processo.');
        return;
      }
      result = fallbackData;
    } else if (error) {
      toast.error('Não foi possível validar a duplicidade do processo.');
      return;
    }

    if (result && result.length > 0) {
      setDuplicateDialog(result[0].ticket_id!);
    }
  };

  const checkEmployeeDuplicate = async () => {
    const trimmedEmployeeName = employeeName.trim();
    if (!trimmedEmployeeName) return;

    const { data, error } = await supabase.rpc('check_duplicate_employee', {
      p_name: trimmedEmployeeName,
      p_exclude_id: null,
    });

    let result = data;

    if (error && isMissingDuplicateRpc(error)) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('solicitations')
        .select('ticket_id, process_number')
        .ilike('employee_name', trimmedEmployeeName)
        .limit(5);

      if (fallbackError) {
        toast.error('Não foi possível validar a duplicidade do funcionário.');
        return;
      }
      result = fallbackData;
    } else if (error) {
      toast.error('Não foi possível validar a duplicidade do funcionário.');
      return;
    }

    if (result && result.length > 0) {
      setEmployeeDuplicateDialog({ tickets: result as any });
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const documentIds = documents.map((_, i) => `doc-${i}`);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = parseInt(String(active.id).replace('doc-', ''));
      const newIndex = parseInt(String(over.id).replace('doc-', ''));
      setDocuments(arrayMove(documents, oldIndex, newIndex));
    }
  };

  const addDocument = () => setDocuments([...documents, { name: '', area_id: '' }]);
  const removeDocument = (idx: number) => {
    if (documents.length <= 1) return;
    setDocuments(documents.filter((_, i) => i !== idx));
  };
  const updateDocument = (idx: number, field: keyof DocumentRow, value: string) => {
    const updated = [...documents];
    updated[idx] = { ...updated[idx], [field]: value };
    setDocuments(updated);
  };

  const removeFile = (idx: number) => setFiles(files.filter((_, i) => i !== idx));

  const validate = () => {
    if (!operationId) { toast.error('Selecione a operação'); return false; }
    if (!processNumber) { toast.error('Informe o número do processo'); return false; }
    if (!employeeName) { toast.error('Informe o nome do funcionário'); return false; }
    if (!deadline) { toast.error('Selecione o prazo fatal'); return false; }
    const validDocs = documents.filter(d => d.name && d.area_id);
    if (validDocs.length === 0) { toast.error('Adicione pelo menos 1 documento com nome e responsável'); return false; }
    return true;
  };

  const save = async () => {
    if (isSavingRef.current) return;
    if (!validate()) return;
    if (!profile) return;

    isSavingRef.current = true;
    setSaving(true);
    const toastId = toast.loading('Enviando solicitação...');

    try {
      const validDocs = documents.filter(d => d.name && d.area_id);

      let ticketId: string;
      const { data: tid, error: tidErr } = await supabase.rpc('generate_operation_ticket_id', { op_id: operationId });
      if (tidErr) {
        const { data: fallback } = await supabase.rpc('generate_ticket_id');
        ticketId = fallback as string;
      } else {
        ticketId = tid as string;
      }

      const newId = crypto.randomUUID();
      const solData = {
        id: newId,
        ticket_id: ticketId,
        operation_id: operationId,
        process_number: processNumber.trim() || null,
        employee_name: employeeName.trim() || null,
        employee_registration: employeeRegistration.trim() || null,
        requester_id: profile.id,
        observations: observations.trim() || null,
        status: 'aberto',
        deadline: deadline ? format(deadline, 'yyyy-MM-dd') : null,
      };

      const { error: solErr } = await supabase.from('solicitations').insert([solData]);
      if (solErr) throw solErr;

      const solId = newId;

      const { error: docInsertErr } = await supabase.from('documents').insert(
        validDocs.map(d => ({
          solicitation_id: solId,
          document_name: d.name,
          responsible_area_id: d.area_id,
          status: 'pendente' as const,
        }))
      );
      if (docInsertErr) throw docInsertErr;

      // Upload arquivos em paralelo com Promise.allSettled (não bloquear se um falhar)
      const uploadResults = await Promise.allSettled(
        files.map(async (file) => {
          const path = `${solId}/${Date.now()}_${file.name}`;
          const { error: upErr } = await supabase.storage.from('solicitations').upload(path, file);
          if (upErr) throw new Error(`${file.name}: ${upErr.message}`);
          return { file, path };
        })
      );
      const successfulUploads = uploadResults
        .filter((r): r is PromiseFulfilledResult<{ file: File; path: string }> => r.status === 'fulfilled')
        .map((r) => r.value);
      const failedUploads = uploadResults.filter((r) => r.status === 'rejected');
      failedUploads.forEach((r: any) => toast.error('Erro no upload: ' + (r.reason?.message || 'desconhecido')));

      if (successfulUploads.length > 0) {
        const { error: attErr } = await supabase.from('attachments').insert(
          successfulUploads.map(({ file, path }) => ({
            solicitation_id: solId,
            file_name: file.name,
            file_url: buildStoragePublicUrl('solicitations', path),
            uploaded_by: profile.id,
          }))
        );
        if (attErr) console.error('[NovaSolicitacao] attachments insert failed', attErr);
      }

      await supabase.from('audit_logs').insert({
        solicitation_id: solId,
        user_id: profile.id,
        action: 'Solicitação criada',
        details: `Ticket ${ticketId} criado por ${profile.name}`,
      });

      // BATCH user_group_assignments em UMA query (era N+1 com 5-25 queries em série)
      const areaIds = [...new Set(validDocs.map((d) => d.area_id))];
      const { data: allAssignments } = await supabase
        .from('user_group_assignments')
        .select('user_id, area_id')
        .in('area_id', areaIds)
        .eq('operation_id', operationId);

      const allUserIds = [...new Set((allAssignments || []).map((a: any) => a.user_id))];
      if (allUserIds.length > 0) {
        const notificationInserts = allUserIds.map((userId) => ({
          user_id: userId,
          type: 'nova_solicitacao' as const,
          message: `Nova solicitação ${ticketId} recebida`,
          solicitation_id: solId,
        }));
        const { error: notifErr } = await supabase.from('notifications').insert(notificationInserts);
        if (notifErr) console.error('[NovaSolicitacao] notifications insert failed', notifErr);
      }

      // Enviar emails em paralelo com Promise.allSettled (não bloquear UX se um falhar)
      const areaDocsMap: Record<string, { name: string }[]> = {};
      for (const doc of validDocs) {
        if (!areaDocsMap[doc.area_id]) areaDocsMap[doc.area_id] = [];
        areaDocsMap[doc.area_id].push({ name: doc.name });
      }
      const opName = operations.find((o: any) => o.id === operationId)?.name || '';
      const emailPromises = Object.entries(areaDocsMap).map(([areaId, areaDocs]) => {
        const areaName = areas.find((a: any) => a.id === areaId)?.name || '';
        return sendNewSolicitationEmail(
          areaId, areaName, operationId, solId, ticketId, opName,
          employeeName, employeeRegistration, processNumber,
          deadline ? format(deadline, 'yyyy-MM-dd') : '', observations, areaDocs
        );
      });
      const emailResults = await Promise.allSettled(emailPromises);
      const failedEmails = emailResults.filter((r) => r.status === 'rejected');
      if (failedEmails.length > 0) {
        console.warn(`[NovaSolicitacao] ${failedEmails.length} email(s) failed`, failedEmails);
      }

      queryClient.invalidateQueries({ queryKey: ['solicitations'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });

      toast.dismiss(toastId);
      toast.success('Solicitação criada!');
      navigate(`/solicitacoes/${solId}`);
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      isSavingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Nova Solicitação</h1>

      <Card className="p-8 max-w-4xl mx-auto">
        <h2 className="text-lg font-semibold text-primary mb-4 border-b pb-2">Informações do Processo</h2>
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <Label>Operação *</Label>
            <Select value={operationId} onValueChange={setOperationId}>
              <SelectTrigger><SelectValue placeholder="Selecione a operação" /></SelectTrigger>
              <SelectContent>
                {operations.filter((o: any) => o.active).map((o: any) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
                {operations.some((o: any) => !o.active) && (
                  <>
                    <div className="px-2 py-1 text-xs text-muted-foreground border-t mt-1">Inativas</div>
                    {operations.filter((o: any) => !o.active).map((o: any) => (
                      <SelectItem key={o.id} value={o.id}>
                        <span className="text-muted-foreground">{o.name} (Inativa)</span>
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Número do processo *</Label>
            <Input value={processNumber} onChange={(e) => setProcessNumber(e.target.value)} onBlur={checkDuplicate} placeholder="Ex.: 0001234-56.20.25.8.26.0100" />
          </div>
          <div>
            <Label>Funcionário *</Label>
            <Input value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} onBlur={checkEmployeeDuplicate} placeholder="Nome do colaborador" />
          </div>
          <div>
            <Label>Matrícula</Label>
            <Input value={employeeRegistration} onChange={(e) => setEmployeeRegistration(e.target.value)} placeholder="Matrícula (opcional)" />
          </div>
          <div>
            <Label>Solicitante</Label>
            <Input value={profile?.name || ''} disabled className="bg-muted" />
          </div>
          <div>
            <Label>Prazo fatal *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !deadline && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {deadline ? format(deadline, "dd/MM/yyyy") : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={deadline} onSelect={setDeadline} disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))} locale={ptBR} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="mb-6">
          <Label>Observações</Label>
          <Textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={3} placeholder="Observações gerais sobre a solicitação (opcional)" />
        </div>


        <h2 className="text-lg font-semibold text-primary mb-4 border-b pb-2">Anexos <span className="text-xs font-normal text-muted-foreground">(máx. 250MB por arquivo)</span></h2>
        <FileDropzone
          multiple
          className="mb-4"
          onFiles={(dropped) => {
            const accepted: File[] = [];
            for (const f of dropped) {
              if (validateFileSize(f, MAX_FILE_BYTES)) accepted.push(f);
              else toast.error(`${f.name} excede o limite de 250MB`);
            }
            if (accepted.length) setFiles((prev) => [...prev, ...accepted]);
          }}
        />
        {files.length > 0 && (
          <div className="space-y-2 mb-6">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 p-2 bg-accent rounded">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm flex-1">{f.name}</span>
                <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</span>
                <button onClick={() => removeFile(i)} className="text-danger hover:text-danger/80"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}

        <h2 className="text-lg font-semibold text-primary mb-4 border-b pb-2">Documentos Solicitados</h2>

        <BulkDocumentImport
          areas={areas}
          onImport={(newDocs) => {
            setDocuments(prev => {
              const filtered = prev.filter(d => d.name && d.area_id);
              return [...filtered, ...newDocs];
            });
          }}
        />

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={documentIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-3 mb-4">
              {documents.map((doc, i) => (
                <SortableDocumentRow
                  key={`doc-${i}`}
                  id={`doc-${i}`}
                  index={i}
                  doc={doc}
                  areas={areas}
                  onUpdate={updateDocument}
                  onRemove={removeDocument}
                  canRemove={documents.length > 1}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <Button variant="ghost" size="sm" className="text-primary hover:bg-info/5" onClick={addDocument}>
          <PlusCircle className="h-4 w-4 mr-1" /> Adicionar documento
        </Button>

        <div className="flex justify-end gap-3 mt-8 pt-6 border-t">
          <Button variant="outline" className="text-muted-foreground" onClick={() => setCancelDialog(true)}>Cancelar</Button>
          <Button className="bg-accent text-accent-foreground hover:bg-accent-hover" onClick={save} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Enviando...</> : 'Enviar solicitação'}
          </Button>
        </div>
      </Card>

      {/* Duplicate process dialog */}
      <Dialog open={!!duplicateDialog} onOpenChange={() => setDuplicateDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Processo duplicado</DialogTitle></DialogHeader>
          <DialogDescription>Já existe o ticket <strong>{duplicateDialog}</strong> para este número de processo. Deseja continuar?</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDuplicateDialog(null); setProcessNumber(''); }}>Cancelar</Button>
            <Button onClick={() => setDuplicateDialog(null)}>Sim, continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate employee dialog */}
      <Dialog open={!!employeeDuplicateDialog} onOpenChange={() => setEmployeeDuplicateDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Funcionário com solicitações existentes</DialogTitle></DialogHeader>
          <DialogDescription>
            Já existem solicitações para este funcionário:
          </DialogDescription>
          <ul className="list-disc pl-6 text-sm space-y-1">
            {employeeDuplicateDialog?.tickets.map((t, i) => (
              <li key={i}>{t.ticket_id} — Processo: {t.process_number || '—'}</li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">Deseja continuar?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEmployeeDuplicateDialog(null); setEmployeeName(''); }}>Cancelar</Button>
            <Button onClick={() => setEmployeeDuplicateDialog(null)}>Sim, continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelDialog} onOpenChange={setCancelDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancelar solicitação?</DialogTitle></DialogHeader>
          <DialogDescription>Dados não salvos serão perdidos.</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog(false)}>Ficar</Button>
            <Button variant="destructive" onClick={() => navigate('/dashboard')}>Sair</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NovaSolicitacao;
