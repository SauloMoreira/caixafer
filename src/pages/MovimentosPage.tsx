import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, formatDateTime, todayISO, ENTRY_CATEGORIES, PAYMENT_METHODS, DOCUMENT_TYPES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, TrendingUp, TrendingDown, Trash2, Edit } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';
import CriticalActionDialog from '@/components/CriticalActionDialog';

type CashEntry = Database['public']['Tables']['cash_entries']['Row'];
type EntryType = Database['public']['Enums']['entry_type'];
type PaymentMethod = Database['public']['Enums']['payment_method'];
type DocumentType = Database['public']['Enums']['document_type'];

export default function MovimentosPage() {
  const { profile, isAdmin } = useAuth();
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [filterDate, setFilterDate] = useState(todayISO());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [entryType, setEntryType] = useState<EntryType>('income');
  const [category, setCategory] = useState('venda');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [documentType, setDocumentType] = useState<DocumentType>('sem_documento');
  const [documentRef, setDocumentRef] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => { fetchEntries(); }, [filterDate, profile]);

  const fetchEntries = async () => {
    if (!profile) return;
    setLoading(true);
    let query = supabase.from('cash_entries').select('*').eq('business_date', filterDate).order('created_at', { ascending: false });
    if (!isAdmin) query = query.eq('created_by', profile.id);
    const { data } = await query;
    setEntries(data || []);
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!profile || !amount) return;
    const { error } = await supabase.from('cash_entries').insert({
      entry_type: entryType,
      category,
      description: description || null,
      business_date: todayISO(),
      amount: Number(amount),
      payment_method: paymentMethod,
      document_type: documentType,
      document_reference: documentRef || null,
      notes: notes || null,
      created_by: profile.id,
    });
    if (error) {
      toast.error('Erro: ' + error.message);
    } else {
      toast.success('Movimento registrado!');
      setDialogOpen(false);
      resetForm();
      fetchEntries();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('cash_entries').delete().eq('id', id);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Removido!'); fetchEntries(); }
  };

  const resetForm = () => {
    setEntryType('income'); setCategory('venda'); setDescription('');
    setAmount(''); setPaymentMethod('pix'); setDocumentType('sem_documento');
    setDocumentRef(''); setNotes('');
  };

  const canEdit = (entry: CashEntry) => isAdmin || (entry.created_by === profile?.id && entry.business_date === todayISO());
  const totals = entries.reduce((acc, e) => {
    if (e.entry_type === 'income') acc.income += Number(e.amount);
    else acc.expense += Number(e.amount);
    return acc;
  }, { income: 0, expense: 0 });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Movimentos</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1 h-4 w-4" />Novo</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Novo Movimento</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button variant={entryType === 'income' ? 'default' : 'outline'} className="h-12" onClick={() => setEntryType('income')}>
                  <TrendingUp className="mr-1 h-4 w-4" />Entrada
                </Button>
                <Button variant={entryType === 'expense' ? 'destructive' : 'outline'} className="h-12" onClick={() => setEntryType('expense')}>
                  <TrendingDown className="mr-1 h-4 w-4" />Saída
                </Button>
              </div>
              <div><Label>Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                  <SelectContent>{ENTRY_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Descrição</Label><Input value={description} onChange={e => setDescription(e.target.value)} className="h-12" /></div>
              <div><Label>Valor (R$)</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="h-12" placeholder="0,00" /></div>
              <div><Label>Forma de Pagamento</Label>
                <Select value={paymentMethod} onValueChange={v => setPaymentMethod(v as PaymentMethod)}>
                  <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Tipo de Documento</Label>
                <Select value={documentType} onValueChange={v => setDocumentType(v as DocumentType)}>
                  <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                  <SelectContent>{DOCUMENT_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Referência do Documento</Label><Input value={documentRef} onChange={e => setDocumentRef(e.target.value)} className="h-12" /></div>
              <div><Label>Observações</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
              <Button className="h-12 w-full" onClick={handleSubmit}>Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="h-12 max-w-xs" />

      <div className="grid grid-cols-3 gap-2">
        <div className="stat-card">
          <p className="text-xs text-muted-foreground">Entradas</p>
          <p className="financial-value text-income">{formatCurrency(totals.income)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground">Saídas</p>
          <p className="financial-value text-expense">{formatCurrency(totals.expense)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground">Saldo</p>
          <p className={`financial-value ${totals.income - totals.expense >= 0 ? 'financial-positive' : 'financial-negative'}`}>
            {formatCurrency(totals.income - totals.expense)}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : entries.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">Nenhum movimento encontrado</p>
      ) : (
        <div className="space-y-2">
          {entries.map(entry => (
            <Card key={entry.id}>
              <CardContent className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${entry.entry_type === 'income' ? 'bg-income/10' : 'bg-expense/10'}`}>
                    {entry.entry_type === 'income' ? <TrendingUp className="h-4 w-4 text-income" /> : <TrendingDown className="h-4 w-4 text-expense" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{entry.description || entry.category}</p>
                    <p className="text-xs text-muted-foreground">{entry.category} • {formatDateTime(entry.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className={`financial-value text-sm ${entry.entry_type === 'income' ? 'financial-positive' : 'financial-negative'}`}>
                    {entry.entry_type === 'expense' ? '-' : '+'}{formatCurrency(Number(entry.amount))}
                  </p>
                  {canEdit(entry) && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(entry.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
