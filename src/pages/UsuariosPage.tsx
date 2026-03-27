import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Users, Shield, UserCheck } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type AppRole = Database['public']['Enums']['app_role'];

export default function UsuariosPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<AppRole>('cashier');
  const [isActive, setIsActive] = useState(true);

  // New user fields
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    if (data) setUsers(data);
  };

  const openEdit = (u: Profile) => {
    setEditing(u); setFullName(u.full_name); setRole(u.role); setIsActive(u.is_active); setDialogOpen(true);
  };

  const openNew = () => {
    setEditing(null); setFullName(''); setRole('cashier'); setIsActive(true); setNewEmail(''); setNewPassword(''); setDialogOpen(true);
  };

  const handleSave = async () => {
    if (editing) {
      const { error } = await supabase.from('profiles').update({ full_name: fullName, role, is_active: isActive }).eq('id', editing.id);
      if (error) toast.error(error.message);
      else { toast.success('Atualizado!'); setDialogOpen(false); fetchUsers(); }
    } else {
      // Create new user via signup
      const { data, error } = await supabase.auth.signUp({
        email: newEmail, password: newPassword,
        options: { data: { full_name: fullName } },
      });
      if (error) toast.error(error.message);
      else {
        // Update role if admin
        if (data.user && role === 'admin') {
          await supabase.from('profiles').update({ role: 'admin' }).eq('id', data.user.id);
        }
        toast.success('Usuário criado!');
        setDialogOpen(false);
        fetchUsers();
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Usuários</h1>
        <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" />Novo</Button>
      </div>

      <div className="space-y-2">
        {users.map(u => (
          <Card key={u.id} className="cursor-pointer hover:border-primary/30 transition-all" onClick={() => openEdit(u)}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${u.role === 'admin' ? 'bg-primary/10' : 'bg-muted'}`}>
                  {u.role === 'admin' ? <Shield className="h-5 w-5 text-primary" /> : <UserCheck className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div>
                  <p className="text-sm font-medium">{u.full_name}</p>
                  <p className="text-xs text-muted-foreground">{u.role === 'admin' ? 'Administrador' : 'Caixa'}{!u.is_active ? ' • Inativo' : ''}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {!editing && (
              <>
                <div><Label>E-mail</Label><Input value={newEmail} onChange={e => setNewEmail(e.target.value)} className="h-12" type="email" /></div>
                <div><Label>Senha</Label><Input value={newPassword} onChange={e => setNewPassword(e.target.value)} className="h-12" type="password" /></div>
              </>
            )}
            <div><Label>Nome Completo</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} className="h-12" /></div>
            <div><Label>Perfil</Label>
              <Select value={role} onValueChange={v => setRole(v as AppRole)}>
                <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="cashier">Caixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <Button className="h-12 w-full" onClick={handleSave}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
