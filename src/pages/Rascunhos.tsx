import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';

const Rascunhos = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);

  const { data: drafts = [], isLoading } = useQuery({
    queryKey: ['drafts', profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase
        .from('solicitations')
        .select('*, operations(name)')
        .eq('status', 'rascunho')
        .eq('requester_id', profile.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!profile,
  });

  const deleteDraft = async (id: string) => {
    await supabase.from('solicitations').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['drafts'] });
    setDeleteDialog(null);
    toast.success('Rascunho excluído');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-6">Rascunhos</h1>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : drafts.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Nenhum rascunho salvo</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {drafts.map((d: any) => (
            <Card key={d.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">{(d.operations as any)?.name || 'Sem operação'}</p>
                <p className="text-sm text-muted-foreground">
                  {d.employee_name || 'Sem funcionário'} • Processo: {d.process_number || '—'} • {new Date(d.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate(`/nova-solicitacao?editar=${d.id}`)}>
                  <Edit className="h-4 w-4 mr-1" /> Editar
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setDeleteDialog(d.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir rascunho</DialogTitle></DialogHeader>
          <DialogDescription>Tem certeza? Esta ação não pode ser desfeita.</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteDialog && deleteDraft(deleteDialog)}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Rascunhos;
