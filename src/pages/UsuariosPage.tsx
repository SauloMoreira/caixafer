import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Shield, UserCheck, Clock, XCircle, UserX, Search, User, Pencil, Heart } from 'lucide-react';
import CriticalActionDialog from '@/components/CriticalActionDialog';

interface UserProfile {
  id: string;
  full_name: string;
  role: 'admin' | 'cashier' | 'volunteer';
  phone: string | null;
  address: string | null;
  email: string | null;
  avatar_url: string | null;
  is_active: boolean;
  approval_status: string;
  approved_by: string | null;
  approved_at: string | null;
  volunteer_id: string | null;
  created_at: string;
}

interface Volunteer {
  id: string;
  full_name: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Clock }> = {
  pending_approval: { label: 'Pendente', variant: 'secondary', icon: Clock },
  approved: { label: 'Aprovado', variant: 'default', icon: UserCheck },
  rejected: { label: 'Rejeitado', variant: 'destructive', icon: XCircle },
};

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  cashier: 'Caixa',
  volunteer: 'Voluntário',
};

export default function UsuariosPage() {
  const { profile: currentUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [criticalAction, setCriticalAction] = useState<{
    type: 'deactivate' | 'reject' | 'role_change';
    userId: string;
    userName: string;
    newRole?: string;
  } | null>(null);

  useEffect(() => { fetchUsers(); fetchVolunteers(); }, []);

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) setUsers(data as unknown as UserProfile[]);
  };

  const fetchVolunteers = async () => {
    const { data } = await supabase.from('spr_volunteers').select('id, full_name').eq('is_active', true).order('full_name');
    if (data) setVolunteers(data);
  };

  const handleApprove = async (userId: string) => {
    const { error } = await supabase.from('profiles').update({
      approval_status: 'approved',
      is_active: true,
      approved_by: currentUser!.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any).eq('id', userId);
    if (error) toast.error(error.message);
    else { toast.success('Usuário aprovado!'); fetchUsers(); setDialogOpen(false); }
  };

  const handleReject = async (userId: string) => {
    const u = users.find(u => u.id === userId);
    setCriticalAction({ type: 'reject', userId, userName: u?.full_name || '' });
  };

  const doReject = async (userId: string) => {
    const { error } = await supabase.from('profiles').update({
      approval_status: 'rejected',
      is_active: false,
      updated_at: new Date().toISOString(),
    } as any).eq('id', userId);
    if (error) toast.error(error.message);
    else { toast.success('Usuário rejeitado.'); fetchUsers(); setDialogOpen(false); }
  };

  const handleToggleActive = async (userId: string, active: boolean) => {
    if (!active) {
      // Requires confirmation for deactivation
      const u = users.find(u => u.id === userId);
      setCriticalAction({ type: 'deactivate', userId, userName: u?.full_name || '' });
      return;
    }
    await doToggleActive(userId, active);
  };

  const doToggleActive = async (userId: string, active: boolean) => {
    const { error } = await supabase.from('profiles').update({
      is_active: active,
      updated_at: new Date().toISOString(),
    } as any).eq('id', userId);
    if (error) toast.error(error.message);
    else { toast.success(active ? 'Usuário reativado!' : 'Usuário desativado.'); fetchUsers(); setDialogOpen(false); }
  };

  const handleChangeRole = async (userId: string, role: 'admin' | 'cashier' | 'volunteer') => {
    const u = users.find(u => u.id === userId);
    setCriticalAction({ type: 'role_change', userId, userName: u?.full_name || '', newRole: role });
  };

  const doChangeRole = async (userId: string, role: string) => {
    const updateData: any = { role, updated_at: new Date().toISOString() };
    if (role !== 'volunteer') {
      updateData.volunteer_id = null;
    }
    const { error } = await supabase.from('profiles').update(updateData).eq('id', userId);
    if (error) toast.error(error.message);
    else {
      toast.success('Perfil atualizado!');
      fetchUsers();
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, role: role as any, volunteer_id: role !== 'volunteer' ? null : prev.volunteer_id } : null);
      }
    }
  };

  const handleLinkVolunteer = async (userId: string, volunteerId: string | null) => {
    const { error } = await supabase.from('profiles').update({
      volunteer_id: volunteerId,
      updated_at: new Date().toISOString(),
    } as any).eq('id', userId);
    if (error) toast.error(error.message);
    else {
      toast.success('Vínculo atualizado!');
      fetchUsers();
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, volunteer_id: volunteerId } : null);
      }
    }
  };

  const filtered = users.filter(u => {
    if (filterStatus !== 'all' && u.approval_status !== filterStatus) return false;
    if (filterRole !== 'all' && u.role !== filterRole) return false;
    if (search && !u.full_name.toLowerCase().includes(search.toLowerCase()) && !u.email?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openDetail = (u: UserProfile) => {
    setSelectedUser(u);
    setDialogOpen(true);
  };

  const pendingCount = users.filter(u => u.approval_status === 'pending_approval').length;

  const getRoleIcon = (role: string) => {
    if (role === 'admin') return <Shield className="h-5 w-5 text-primary" />;
    if (role === 'volunteer') return <Heart className="h-5 w-5 text-primary" />;
    return <User className="h-5 w-5 text-muted-foreground" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Usuários</h1>
          {pendingCount > 0 && (
            <p className="text-sm text-warning font-medium">{pendingCount} pendente{pendingCount > 1 ? 's' : ''} de aprovação</p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou e-mail..." value={search} onChange={e => setSearch(e.target.value)} className="h-10 pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-10 w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending_approval">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="rejected">Rejeitados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="h-10 w-full sm:w-36"><SelectValue placeholder="Perfil" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="cashier">Caixa</SelectItem>
            <SelectItem value="volunteer">Voluntário</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* User list */}
      <div className="space-y-2">
        {filtered.map(u => {
          const sc = statusConfig[u.approval_status] || statusConfig.pending_approval;
          return (
            <Card key={u.id} className="cursor-pointer hover:border-primary/30 transition-all" onClick={() => openDetail(u)}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 min-w-0">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${u.role === 'admin' ? 'bg-primary/10' : 'bg-muted'}`}>
                      {getRoleIcon(u.role)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{u.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email} • {roleLabels[u.role] || u.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={sc.variant} className="text-[10px]">{sc.label}</Badge>
                  {!u.is_active && u.approval_status === 'approved' && (
                    <Badge variant="outline" className="text-[10px]">Inativo</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">Nenhum usuário encontrado.</p>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Detalhes do Usuário</DialogTitle></DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {selectedUser.avatar_url ? (
                  <img src={selectedUser.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <User className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-semibold">{selectedUser.full_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant={statusConfig[selectedUser.approval_status]?.variant || 'secondary'}>
                      {statusConfig[selectedUser.approval_status]?.label || selectedUser.approval_status}
                    </Badge>
                    {!selectedUser.is_active && <Badge variant="outline">Inativo</Badge>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Celular:</span><p>{selectedUser.phone || '—'}</p></div>
                <div><span className="text-muted-foreground">Endereço:</span><p className="truncate">{selectedUser.address || '—'}</p></div>
                <div><span className="text-muted-foreground">Cadastro:</span><p>{new Date(selectedUser.created_at).toLocaleDateString('pt-BR')}</p></div>
                <div>
                  <span className="text-muted-foreground">Perfil:</span>
                  {selectedUser.id !== currentUser?.id ? (
                    <Select value={selectedUser.role} onValueChange={v => handleChangeRole(selectedUser.id, v as 'admin' | 'cashier' | 'volunteer')}>
                      <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="cashier">Caixa</SelectItem>
                        <SelectItem value="volunteer">Voluntário</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p>{roleLabels[selectedUser.role] || selectedUser.role}</p>
                  )}
                </div>
              </div>

              {/* Volunteer linking */}
              {selectedUser.role === 'volunteer' && selectedUser.id !== currentUser?.id && (
                <div className="rounded-xl border p-3 space-y-2 bg-primary/5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Heart className="h-3.5 w-3.5 text-primary" />
                    Vincular ao Voluntário SPR
                  </Label>
                  <Select
                    value={selectedUser.volunteer_id || 'none'}
                    onValueChange={v => handleLinkVolunteer(selectedUser.id, v === 'none' ? null : v)}
                  >
                    <SelectTrigger className="h-9"><SelectValue placeholder="Selecione o voluntário" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem vínculo</SelectItem>
                      {volunteers.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!selectedUser.volunteer_id && (
                    <p className="text-[10px] text-warning">⚠️ Voluntário sem vínculo não terá acesso ao Meu SPR</p>
                  )}
                </div>
              )}

              {/* Actions */}
              {selectedUser.id !== currentUser?.id && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => { setDialogOpen(false); navigate(`/perfil?user=${selectedUser.id}`); }} className="gap-1.5">
                    <Pencil className="h-4 w-4" /> Editar Perfil
                  </Button>
                  {selectedUser.approval_status === 'pending_approval' && (
                    <>
                      <Button size="sm" onClick={() => handleApprove(selectedUser.id)} className="gap-1.5">
                        <UserCheck className="h-4 w-4" /> Aprovar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleReject(selectedUser.id)} className="gap-1.5">
                        <XCircle className="h-4 w-4" /> Rejeitar
                      </Button>
                    </>
                  )}
                  {selectedUser.approval_status === 'rejected' && (
                    <Button size="sm" onClick={() => handleApprove(selectedUser.id)} className="gap-1.5">
                      <UserCheck className="h-4 w-4" /> Aprovar
                    </Button>
                  )}
                  {selectedUser.approval_status === 'approved' && (
                    selectedUser.is_active ? (
                      <Button size="sm" variant="outline" onClick={() => handleToggleActive(selectedUser.id, false)} className="gap-1.5">
                        <UserX className="h-4 w-4" /> Desativar
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => handleToggleActive(selectedUser.id, true)} className="gap-1.5">
                        <UserCheck className="h-4 w-4" /> Reativar
                      </Button>
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
