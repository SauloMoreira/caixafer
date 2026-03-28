import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { X, ScanLine, ImagePlus } from 'lucide-react';
import { BarcodeDetector as BarcodeDetectorPolyfill } from 'barcode-detector/ponyfill';

interface BarcodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (value: string) => void;
}

const SUPPORTED_FORMATS = [
  'qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'itf', 'codabar',
] as const;

export default function BarcodeScannerDialog({ open, onOpenChange, onScan }: BarcodeScannerDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const detectorRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);

  const handleResult = useCallback((value: string) => {
    scanningRef.current = false;
    onScan(value);
    toast.success('Código lido com sucesso!');
    onOpenChange(false);
  }, [onScan, onOpenChange]);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const getDetector = useCallback(async () => {
    if (detectorRef.current) return detectorRef.current;
    // Use native if available and reliable (Android Chrome), otherwise polyfill (iOS)
    const hasNative = 'BarcodeDetector' in window;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (hasNative && !isIOS) {
      detectorRef.current = new (window as any).BarcodeDetector({
        formats: [...SUPPORTED_FORMATS],
      });
    } else {
      detectorRef.current = new BarcodeDetectorPolyfill({
        formats: [...SUPPORTED_FORMATS],
      });
    }
    return detectorRef.current;
  }, []);

  const scanFrame = useCallback(async () => {
    if (!scanningRef.current || !videoRef.current) return;
    const video = videoRef.current;
    if (video.readyState < video.HAVE_ENOUGH_DATA) {
      requestAnimationFrame(scanFrame);
      return;
    }
    try {
      const detector = await getDetector();
      const barcodes = await detector.detect(video);
      if (barcodes.length > 0 && barcodes[0].rawValue) {
        handleResult(barcodes[0].rawValue);
        return;
      }
    } catch { /* ignore frame errors */ }
    if (scanningRef.current) {
      requestAnimationFrame(scanFrame);
    }
  }, [handleResult, getDetector]);

  const startCamera = useCallback(async () => {
    setError(null);
    setShowFallback(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;

      // Try to enable continuous autofocus for barcode readability
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities?.() as any;
      if (caps?.focusMode?.includes?.('continuous')) {
        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] });
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      scanningRef.current = true;
      requestAnimationFrame(scanFrame);

      // Show fallback after delay
      setTimeout(() => {
        if (scanningRef.current) setShowFallback(true);
      }, 5000);
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Permissão de câmera necessária para escanear o código.');
      } else {
        setError('Não foi possível acessar a câmera. Tente novamente.');
      }
      setShowFallback(true);
    }
  }, [scanFrame]);

  // Decode from a static image file (fallback)
  const decodeFromFile = useCallback(async (file: File) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; });

    try {
      const detector = await getDetector();
      const barcodes = await detector.detect(img);
      if (barcodes.length > 0 && barcodes[0].rawValue) {
        handleResult(barcodes[0].rawValue);
      } else {
        toast.error('Não foi possível ler o código na imagem. Tente aproximar mais ou usar outra foto.');
      }
    } catch {
      toast.error('Erro ao processar a imagem.');
    } finally {
      URL.revokeObjectURL(url);
    }
  }, [handleResult, getDetector]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) decodeFromFile(file);
  }, [decodeFromFile]);

  useEffect(() => {
    if (open) {
      detectorRef.current = null; // reset detector on open
      startCamera();
    } else {
      stopCamera();
      setShowFallback(false);
      setError(null);
    }
    return stopCamera;
  }, [open, startCamera, stopCamera]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="text-base">Escanear Código</DialogTitle>
        </DialogHeader>

        <div className="relative bg-black aspect-[4/3] w-full">
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
              <p className="text-sm text-white/80">{error}</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                playsInline
                muted
                autoPlay
              />
              {/* Scan guide overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-40 border-2 border-white/50 rounded-xl relative">
                  <ScanLine className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-primary animate-pulse" />
                </div>
              </div>
              <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-white/70">
                Aponte a câmera para o QR Code ou código de barras
              </p>
            </>
          )}
        </div>

        <div className="p-4 pt-2 space-y-2">
          {showFallback && (
            <>
              <p className="text-xs text-muted-foreground text-center">
                Não conseguiu ler? Tire uma foto ou escolha da galeria.
              </p>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="mr-1 h-4 w-4" />
                Foto / Galeria
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
            </>
          )}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            <X className="mr-1 h-4 w-4" />
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
