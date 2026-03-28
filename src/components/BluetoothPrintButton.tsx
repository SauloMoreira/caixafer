import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bluetooth, BluetoothOff, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  isBluetoothSupported,
  connectPrinter,
  getConnectedPrinterName,
  disconnectPrinter,
} from '@/lib/bluetooth-printer';

interface Props {
  onPrint: () => Promise<void>;
  label?: string;
  className?: string;
}

export default function BluetoothPrintButton({ onPrint, label = 'Bluetooth', className }: Props) {
  const [printing, setPrinting] = useState(false);
  const [connected, setConnected] = useState(false);

  const supported = isBluetoothSupported();

  if (!supported) return null;

  const handleClick = async () => {
    try {
      setPrinting(true);

      // Connect if not connected
      const currentName = getConnectedPrinterName();
      if (!currentName) {
        const name = await connectPrinter();
        setConnected(true);
        toast.success(`Conectado: ${name}`);
      }

      await onPrint();
      toast.success('Impresso com sucesso!');
    } catch (err: any) {
      if (err?.name === 'NotFoundError' || err?.message?.includes('cancelled')) {
        // User cancelled the device picker
        return;
      }
      console.error('Bluetooth print error:', err);
      toast.error(err?.message || 'Erro ao imprimir via Bluetooth');
      // Reset connection on error
      await disconnectPrinter();
      setConnected(false);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleClick}
      disabled={printing}
      className={`h-12 flex-col gap-1 ${className || ''}`}
    >
      {printing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : connected ? (
        <Check className="h-4 w-4 text-income" />
      ) : (
        <Bluetooth className="h-4 w-4" />
      )}
      <span className="text-[10px]">{label}</span>
    </Button>
  );
}
