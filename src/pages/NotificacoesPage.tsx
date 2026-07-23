import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDate } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Heart, Search, User, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

interface VolunteerOverdue {
  volunteer_id: string;
  full_name: string;
  avatar_url: string | null;
  total_open: number;
  charge_count: number;
  oldest_date: string;
  has_unread_notif: boolean;
  last_notif_date: string | null;
}

export default function NotificacoesPage() {
  const { profile } = useAuth();
  const [data, setData] = useState<VolunteerOverdue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'amount' | 'date'>('amount');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);

    // Refresh notifications first
    await supabase.rpc('refresh_spr_notifications');

    // Get all charges > 30 days open/partial
    const { data: charges } = await supabase
      .from('spr_fiado_charges')
      .select('volunteer_id, amount, business_date, status, spr_volunteers(full_name, avatar_url)')
      .in('status', ['open', 'partial']);

    if (!charges) { setLoading(false); return; }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = `${thirtyDaysAgo.getFullYear()}-${String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(thirtyDaysAgo.getDate()).padStart(2, '0')}`;

    const overdueCharges = charges.filter(c => c.business_date < cutoff);

    // Group by volunteer
    const grouped: Record<string, VolunteerOverdue> = {};
    overdueCharges.forEach((c: any) => {
      const vid = c.volunteer_id;
      if (!grouped[vid]) {
        grouped[vid] = {
          volunteer_id: vid,
          full_name: c.spr_volunteers?.full_name || 'Desconhecido',
          avatar_url: c.spr_volunteers?.avatar_url || null,
          total_open: 0,
          charge_count: 0,
          oldest_date: c.business_date,
          has_unread_notif: false,
          last_notif_date: null,
        };
      }
      grouped[vid].total_open += Number(c.amount);
      grouped[vid].charge_count += 1;
      if (c.business_date < grouped[vid].oldest_date) {
        grouped[vid].oldest_date = c.business_date;
      }
    });

    // Get notification status for these volunteers
    const volunteerIds = Object.keys(grouped);
    if (volunteerIds.length > 0 && profile) {
      const { data: notifs } = await supabase
        .from('notifications')
        .select('volunteer_id, is_read, created_at')
        .eq('type', 'spr_over_30_days')
        .in('volunteer_id', volunteerIds)
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      notifs?.forEach((n: any) => {
        if (grouped[n.volunteer_id]) {
          if (!n.is_read) grouped[n.volunteer_id].has_unread_notif = true;
          if (!grouped[n.volunteer_id].last_notif_date) {
            grouped[n.volunteer_id].last_notif_date = n.created_at;
          }
        }
      });
    }

    setData(Object.values(grouped));
    setLoading(false);
  };

  const filtered = data
    .filter(v => !search || v.full_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'amount') return b.total_open - a.total_open;
      return a.oldest_date.localeCompare(b.oldest_date);
    });

  const totalOverdue = data.reduce((s, v) => s + v.total_open, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Heart className="h-5 w-5 text-primary" />
          Acompanhamento SPR
        </h1>
        <p className="text-sm text-muted-foreground">Voluntários com saldo em aberto há mais de 30 dias</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="stat-card">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-warning" />
              <span className="text-xs text-muted-foreground">Voluntários</span>
            </div>
            <p className="financial-value text-xl text-warning">{data.length}</p>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-expense" />
              <span className="text-xs text-muted-foreground">Total em Aberto</span>
            </div>
            <p className="financial-value text-xl text-expense">{formatCurrency(totalOverdue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar voluntário..." value={search} onChange={e => setSearch(e.target.value)} className="h-10 pl-9" />
        </div>
        <Select value={sortBy} onValueChange={v => setSortBy(v as 'amount' | 'date')}>
          <SelectTrigger className="h-10 w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="amount">Maior valor em aberto</SelectItem>
            <SelectItem value="date">Lançamento mais antigo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-income/40 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum voluntário com saldo em aberto há mais de 30 dias. 🎉</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map(v => {
            const daysSinceOldest = Math.floor((Date.now() - new Date(v.oldest_date).getTime()) / (1000 * 60 * 60 * 24));
            return (
              <Card key={v.volunteer_id} className="hover:border-primary/20 transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {v.avatar_url ? (
                      <img src={v.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 shrink-0">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold truncate">{v.full_name}</p>
                        <p className="financial-value text-sm text-expense shrink-0">{formatCurrency(v.total_open)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {v.charge_count} lançamento{v.charge_count > 1 ? 's' : ''} • desde {formatDate(v.oldest_date)}
                        </span>
                        <Badge variant="secondary" className="text-[10px] bg-warning/10 text-warning border-0">
                          {daysSinceOldest} dias
                        </Badge>
                        {v.has_unread_notif ? (
                          <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-0">
                            Notificação pendente
                          </Badge>
                        ) : v.last_notif_date ? (
                          <Badge variant="outline" className="text-[10px]">
                            Lido
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
