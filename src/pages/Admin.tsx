import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { PlusCircle, Trash2, Edit, UserPlus } from 'lucide-react';

const Admin = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // State for dialogs
  const [newOpDialog, setNewOpDialog] = useState(false);
  const [newOpName, setNewOpName] = useState('');
  const [editOpDialog, setEditOpDialog] = useState<any>(null);
  const [editOpName, setEditOpName] = useState('');
  const [newAreaDialog, setNewAreaDialog] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [editAreaDialog, setEditAreaDialog] = useState<any>(null);
  const [editAreaName, setEditAreaName] = useState('');
  const [inviteDialog, setInviteDialog] = useState(false);
  const [addAdminDialog, setAddAdminDialog] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('atendente');
  const [inviteAreaId, setInviteAreaId] = useState('');
  const [inviteOpIds, setInviteOpIds] = useState<string[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [addToGroupDialog, setAddToGroupDialog] = useState(false);
  const [groupFilterOp, setGroupFilterOp] = useState('');
  const [groupFilterArea, setGroupFilterArea] = useState('');
  const [addGroupSearch, setAddGroupSearch] = useState('');
  const [addGroupUserId, setAddGroupUserId] = useState('');

  // Queries
  const { data: operations = [] } = useQuery({
    queryKey: ['admin-operations'],
    queryFn: async () => {
      const { data } = await supabase.from('operations').select('*').order('name');
      return data || [];
    },
  });

  const { data: areas = [] } = useQuery({
    queryKey: ['admin-areas'],
    queryFn: async () => {
      const { data } = await supabase.from('areas').select('*').order('name');
      return data || [];
    },
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ['admin-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').order('name');
      return data || [];
    },
  });

  const { data: allAssignments = [] } = useQuery({
    queryKey: ['admin-assignments'],
    queryFn: async () => {
      const { data } = await supabase.from('user_group_assignments').select('*, profiles(name, email), areas(name), operations(name)');
      return data || [];
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-operations'] });
    queryClient.invalidateQueries({ queryKey: ['admin-areas'] });
    queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
    queryClient.invalidateQueries({ queryKey: ['admin-assignments'] });
  };

  const toggleAdmin = async (p: any) => {
    const admins = allProfiles.filter((pr: any) => pr.is_admin && pr.is_active);
    if (p.is_admin && admins.length <= 1) {
      toast.error('Não é possível remover o último administrador');
      return;
    }
    await supabase.from('profiles').update({ is_admin: !p.is_admin }).eq('id', p.id);
    invalidateAll();
    toast.success(p.is_admin ? 'Permissão de admin removida' : 'Admin adicionado');
  };

  // Operations
  const createOperation = async () => {
    if (!newOpName.trim()) return;
    await supabase.from('operations').insert({ name: newOpName });
    setNewOpDialog(false);
    setNewOpName('');
    invalidateAll();
    toast.success('Operação criada');
  };

  const updateOperation = async () => {
    if (!editOpName.trim() || !editOpDialog) return;
    await supabase.from('operations').update({ name: editOpName }).eq('id', editOpDialog.id);
    setEditOpDialog(null);
    invalidateAll();
    toast.success('Operação atualizada');
  };

  const toggleOpActive = async (op: any) => {
    await supabase.from('operations').update({ active: !op.active }).eq('id', op.id);
    invalidateAll();
  };

  // Areas
  const createArea = async () => {
    if (!newAreaName.trim()) return;
    await supabase.from('areas').insert({ name: newAreaName });
    setNewAreaDialog(false);
    setNewAreaName('');
    invalidateAll();
    toast.success('Área criada');
  };

  const updateArea = async () => {
    if (!editAreaName.trim() || !editAreaDialog) return;
    await supabase.from('areas').update({ name: editAreaName }).eq('id', editAreaDialog.id);
    setEditAreaDialog(null);
    invalidateAll();
    toast.success('Área atualizada');
  };

  const toggleAreaActive = async (area: any) => {
    await supabase.from('areas').update({ active: !area.active }).eq('id', area.id);
    invalidateAll();
  };

  // Users
  const toggleUserActive = async (p: any) => {
    await supabase.from('profiles').update({ is_active: !p.is_active }).eq('id', p.id);
    invalidateAll();
  };

  const removeAssignment = async (assignmentId: string) => {
    await supabase.from('user_group_assignments').delete().eq('id', assignmentId);
    invalidateAll();
    toast.success('Usuário removido do grupo');
  };

  const addToGroup = async () => {
    if (!addGroupUserId || !groupFilterArea || !groupFilterOp) {
      toast.error('Selecione usuário, área e operação');
      return;
    }
    const { error } = await supabase.from('user_group_assignments').insert({
      user_id: addGroupUserId,
      area_id: groupFilterArea,
      operation_id: groupFilterOp,
    });
    if (error) {
      toast.error('Erro: ' + error.message);
      return;
    }
    setAddToGroupDialog(false);
    setAddGroupUserId('');
    invalidateAll();
    toast.success('Usuário adicionado ao grupo');
  };

  const handleInvite = async () => {
    if (!inviteName || !inviteEmail) {
      toast.error('Preencha nome e email');
      return;
    }
    setInviteLoading(true);
    try {
      // Create profile first (trigger will also try, but we want custom data)
      const profileId = crypto.randomUUID();
      const { error: profileError } = await supabase.from('profiles').insert({
        id: profileId,
        user_id: profileId, // temporary, will be updated when user accepts
        name: inviteName,
        email: inviteEmail,
        role: inviteRole,
        is_admin: false,
        is_active: true,
      });
      if (profileError) throw profileError;

      // Create assignments if atendente
      if (inviteRole === 'atendente' && inviteAreaId) {
        for (const opId of inviteOpIds) {
          await supabase.from('user_group_assignments').insert({
            user_id: profileId,
            area_id: inviteAreaId,
            operation_id: opId,
          });
        }
      }

      setInviteDialog(false);
      setInviteName('');
      setInviteEmail('');
      setInviteRole('atendente');
      setInviteAreaId('');
      setInviteOpIds([]);
      invalidateAll();
      toast.success('Usuário convidado com sucesso! O perfil foi criado.');
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
    setInviteLoading(false);
  };

  // Filter assignments by selected group
  const filteredAssignments = allAssignments.filter((a: any) =>
    (!groupFilterOp || a.operation_id === groupFilterOp) &&
    (!groupFilterArea || a.area_id === groupFilterArea)
  );

  const getUserGroups = (userId: string) => {
    const userAssigns = allAssignments.filter((a: any) => a.user_id === userId);
    const groups: Record<string, string[]> = {};
    userAssigns.forEach((a: any) => {
      const areaName = (a.areas as any)?.name || '';
      const opName = (a.operations as any)?.name || '';
      if (!groups[areaName]) groups[areaName] = [];
      groups[areaName].push(opName);
    });
    return Object.entries(groups).map(([area, ops]) => `${area}: ${ops.join(', ')}`).join(' | ');
  };

  const atendentes = allProfiles.filter(p => p.role === 'atendente');
  const filteredAtendentesForAdd = atendentes.filter(p =>
    addGroupSearch ? (p.name.toLowerCase().includes(addGroupSearch.toLowerCase()) || p.email.toLowerCase().includes(addGroupSearch.toLowerCase())) : true
  );

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-6">Administração</h1>

      <Tabs defaultValue="operations">
        <TabsList className="mb-6">
          <TabsTrigger value="operations">Operações</TabsTrigger>
          <TabsTrigger value="areas">Áreas</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="admins">Admins</TabsTrigger>
        </TabsList>

        {/* OPERATIONS TAB */}
        <TabsContent value="operations">
          <Card className="p-6">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-semibold text-primary">Operações</h2>
              <Button size="sm" onClick={() => setNewOpDialog(true)}><PlusCircle className="h-4 w-4 mr-1" /> Nova operação</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operations.map((op: any, i: number) => (
                  <TableRow key={op.id}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{op.name}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded-full ${op.active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                        {op.active ? 'Ativa' : 'Inativa'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditOpDialog(op); setEditOpName(op.name); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Switch checked={op.active} onCheckedChange={() => toggleOpActive(op)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* AREAS TAB */}
        <TabsContent value="areas">
          <Card className="p-6">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-semibold text-primary">Áreas</h2>
              <Button size="sm" onClick={() => setNewAreaDialog(true)}><PlusCircle className="h-4 w-4 mr-1" /> Nova área</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Usuários vinculados</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {areas.map((area: any, i: number) => {
                  const userCount = new Set(allAssignments.filter((a: any) => a.area_id === area.id).map((a: any) => a.user_id)).size;
                  return (
                    <TableRow key={area.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{area.name}</TableCell>
                      <TableCell>{userCount}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded-full ${area.active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                          {area.active ? 'Ativa' : 'Inativa'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => { setEditAreaDialog(area); setEditAreaName(area.name); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Switch checked={area.active} onCheckedChange={() => toggleAreaActive(area)} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* USERS TAB */}
        <TabsContent value="users">
          <Card className="p-6 mb-6">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-semibold text-primary">Filtrar por Grupo</h2>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setAddToGroupDialog(true)} disabled={!groupFilterOp || !groupFilterArea}>
                  <PlusCircle className="h-4 w-4 mr-1" /> Adicionar ao grupo
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Select value={groupFilterOp} onValueChange={setGroupFilterOp}>
                <SelectTrigger><SelectValue placeholder="Selecione operação" /></SelectTrigger>
                <SelectContent>
                  {operations.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={groupFilterArea} onValueChange={setGroupFilterArea}>
                <SelectTrigger><SelectValue placeholder="Selecione área" /></SelectTrigger>
                <SelectContent>
                  {areas.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {groupFilterOp && groupFilterArea && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell>{(a.profiles as any)?.name}</TableCell>
                      <TableCell className="text-muted-foreground">{(a.profiles as any)?.email}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="text-danger" onClick={() => removeAssignment(a.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredAssignments.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Nenhum usuário neste grupo</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-semibold text-primary">Todos os Usuários</h2>
              <Button size="sm" onClick={() => setInviteDialog(true)}><UserPlus className="h-4 w-4 mr-1" /> Convidar usuário</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Grupos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20">Ativo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allProfiles.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{p.email}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded-full ${p.role === 'juridico' ? 'bg-primary/10 text-primary' : 'bg-info/10 text-info'}`}>
                        {p.role === 'juridico' ? 'Jurídico' : 'Atendente'}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{getUserGroups(p.id) || '—'}</TableCell>
                    <TableCell>
                      <span className={`text-xs ${p.is_active ? 'text-success' : 'text-danger'}`}>
                        {p.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Switch checked={p.is_active} onCheckedChange={() => toggleUserActive(p)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="admins">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-primary">Administradores</h2>
              <Button size="sm" onClick={() => setAddAdminDialog(true)}><PlusCircle className="h-4 w-4 mr-1" /> Adicionar admin</Button>
            </div>
            <p className="text-sm text-muted-foreground mb-6">Administradores podem gerenciar operações, áreas, usuários e permissões.</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-20">Admin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allProfiles.filter((p: any) => p.role === 'juridico' && p.is_admin).map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.email}</TableCell>
                    <TableCell>
                      <Switch checked={p.is_admin} onCheckedChange={() => toggleAdmin(p)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Operation Dialog */}
      <Dialog open={newOpDialog} onOpenChange={setNewOpDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Operação</DialogTitle></DialogHeader>
          <Input value={newOpName} onChange={(e) => setNewOpName(e.target.value)} placeholder="Nome da operação" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpDialog(false)}>Cancelar</Button>
            <Button onClick={createOperation}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Operation Dialog */}
      <Dialog open={!!editOpDialog} onOpenChange={() => setEditOpDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Operação</DialogTitle></DialogHeader>
          <Input value={editOpName} onChange={(e) => setEditOpName(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpDialog(null)}>Cancelar</Button>
            <Button onClick={updateOperation}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Area Dialog */}
      <Dialog open={newAreaDialog} onOpenChange={setNewAreaDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Área</DialogTitle></DialogHeader>
          <Input value={newAreaName} onChange={(e) => setNewAreaName(e.target.value)} placeholder="Nome da área" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewAreaDialog(false)}>Cancelar</Button>
            <Button onClick={createArea}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Area Dialog */}
      <Dialog open={!!editAreaDialog} onOpenChange={() => setEditAreaDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Área</DialogTitle></DialogHeader>
          <Input value={editAreaName} onChange={(e) => setEditAreaName(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAreaDialog(null)}>Cancelar</Button>
            <Button onClick={updateArea}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Group Dialog */}
      <Dialog open={addToGroupDialog} onOpenChange={setAddToGroupDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar ao grupo</DialogTitle></DialogHeader>
          <Input value={addGroupSearch} onChange={(e) => setAddGroupSearch(e.target.value)} placeholder="Buscar por nome ou email" />
          <div className="max-h-48 overflow-y-auto space-y-1">
            {filteredAtendentesForAdd.map(p => (
              <div
                key={p.id}
                className={`p-2 rounded cursor-pointer text-sm ${addGroupUserId === p.id ? 'bg-primary/10 text-primary' : 'hover:bg-accent'}`}
                onClick={() => setAddGroupUserId(p.id)}
              >
                {p.name} <span className="text-muted-foreground">({p.email})</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddToGroupDialog(false)}>Cancelar</Button>
            <Button onClick={addToGroup} disabled={!addGroupUserId}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite User Dialog */}
      <Dialog open={inviteDialog} onOpenChange={setInviteDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Convidar Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Nome completo" />
            </div>
            <div>
              <Label>Email *</Label>
              <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@lotsgroup.com" />
            </div>
            <div>
              <Label>Perfil *</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="juridico">Jurídico</SelectItem>
                  <SelectItem value="atendente">Atendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {inviteRole === 'atendente' && (
              <>
                <div>
                  <Label>Área</Label>
                  <Select value={inviteAreaId} onValueChange={setInviteAreaId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {areas.filter((a: any) => a.active).map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Operações</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1 max-h-40 overflow-y-auto">
                    {operations.filter((o: any) => o.active).map((o: any) => (
                      <label key={o.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={inviteOpIds.includes(o.id)}
                          onCheckedChange={(checked) => {
                            setInviteOpIds(prev =>
                              checked ? [...prev, o.id] : prev.filter(id => id !== o.id)
                            );
                          }}
                        />
                        {o.name}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialog(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={inviteLoading}>
              {inviteLoading ? 'Convidando...' : 'Convidar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Admin Dialog */}
      <Dialog open={addAdminDialog} onOpenChange={setAddAdminDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Administrador</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">Selecione um usuário do Jurídico para tornar administrador:</p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {allProfiles.filter((p: any) => p.role === 'juridico' && !p.is_admin).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Todos os usuários do Jurídico já são administradores</p>
            ) : (
              allProfiles.filter((p: any) => p.role === 'juridico' && !p.is_admin).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-accent">
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.email}</p>
                  </div>
                  <Button size="sm" onClick={async () => { await supabase.from('profiles').update({ is_admin: true }).eq('id', p.id); invalidateAll(); setAddAdminDialog(false); toast.success(p.name + ' agora é administrador!'); }}>Tornar admin</Button>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAdminDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
