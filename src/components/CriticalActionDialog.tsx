import { useState, ReactNode } from 'react';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

export interface CriticalActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  details?: { label: string; value: string }[];
  summary?: { label: string; value: string }[];
  severity?: 'warning' | 'danger';
  confirmLabel?: string;
  confirmText?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  children?: ReactNode;
}

export default function CriticalActionDialog({
  open, onOpenChange, title, description, details, summary, severity = 'warning',
  confirmLabel = 'Confirmar', confirmText, loading, onConfirm, children,
}: CriticalActionDialogProps) {
  const [typed, setTyped] = useState('');
  const isDanger = severity === 'danger';
  const needsTyping = !!confirmText;
  const canConfirm = !needsTyping || typed.toUpperCase() === confirmText?.toUpperCase();
  const infoItems = details || summary;

  const handleConfirm = async () => {
    await onConfirm();
    setTyped('');
  };

  return (
    <AlertDialog open={open} onOpenChange={v => { if (!v) setTyped(''); onOpenChange(v); }}>
      <AlertDialogContent className="max-w-sm sm:max-w-lg max-h-[90dvh] overflow-y-auto">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${isDanger ? 'bg-destructive/10' : 'bg-amber-100 dark:bg-amber-900/20'}`}>
              {isDanger ? <ShieldAlert className="h-5 w-5 text-destructive" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}
            </div>
            <AlertDialogTitle className="text-base">{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-sm mt-2">{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {infoItems && infoItems.length > 0 && (
          <div className="rounded-lg border bg-muted/50 p-3 space-y-1.5 text-sm">
            {infoItems.map((d, i) => (
              <div key={i} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{d.label}</span>
                <span className="font-medium text-right">{d.value}</span>
              </div>
            ))}
          </div>
        )}

        {children}

        {needsTyping && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Digite <span className="font-bold text-foreground">{confirmText}</span> para confirmar:
            </p>
            <Input
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder={confirmText}
              className="h-10"
              autoFocus
            />
          </div>
        )}

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <Button
            variant={isDanger ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={!canConfirm || loading}
          >
            {loading ? 'Processando...' : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}