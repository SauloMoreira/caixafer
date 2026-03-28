import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { X, ScanLine, ImagePlus } from 'lucide-react';
import jsQR from 'jsqr';

interface BarcodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (value: string) => void;
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const hasBarcodeDetector = () => 'BarcodeDetector' in window && !isIOS();

export default function BarcodeScannerDialog({ open, onOpenChange, onScan }: BarcodeScannerDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // Scan a single video frame using jsQR (works on iOS)
  const scanFrameJsQR = useCallback(() => {
    if (!scanningRef.current || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.readyState < video.HAVE_ENOUGH_DATA) {
      requestAnimationFrame(scanFrameJsQR);
      return;
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
    if (code?.data) {
      handleResult(code.data);
      return;
    }
    if (scanningRef.current) {
      requestAnimationFrame(scanFrameJsQR);
    }
  }, [handleResult]);

  // Scan using native BarcodeDetector (Android Chrome)
  const scanFrameNative = useCallback(async (detector: any) => {
    if (!scanningRef.current || !videoRef.current) return;
    try {
      const barcodes = await detector.detect(videoRef.current);
      if (barcodes.length > 0 && barcodes[0].rawValue) {
        handleResult(barcodes[0].rawValue);
        return;
      }
    } catch { /* ignore frame errors */ }
    if (scanningRef.current) {
      requestAnimationFrame(() => scanFrameNative(detector));
    }
  }, [handleResult]);

  const startCamera = useCallback(async () => {
    setError(null);
    setShowFallback(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      scanningRef.current = true;

      if (hasBarcodeDetector()) {
        const detector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e'],
        });
        requestAnimationFrame(() => scanFrameNative(detector));
      } else {
        // iOS / unsupported: use jsQR for real-time QR scanning
        requestAnimationFrame(scanFrameJsQR);
        // Show fallback option after a delay for barcodes
        setTimeout(() => {
          if (scanningRef.current) setShowFallback(true);
        }, 4000);
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Permissão de câmera necessária para escanear o código.');
      } else {
        setError('Não foi possível acessar a câmera. Tente novamente.');
      }
      setShowFallback(true);
    }
  }, [scanFrameNative, scanFrameJsQR]);

  // Decode QR from a static image (file/photo fallback)
  const decodeFromFile = useCallback(async (file: File) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) { URL.revokeObjectURL(url); return; }
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });

    if (code?.data) {
      handleResult(code.data);
    } else {
      toast.error('Não foi possível ler o código na imagem. Tente novamente.');
    }
  }, [handleResult]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) decodeFromFile(file);
  }, [decodeFromFile]);

  useEffect(() => {
    if (open) {
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
              {/* Hidden canvas for jsQR frame processing */}
              <canvas ref={canvasRef} className="hidden" />
              {/* Scan guide overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-56 h-56 border-2 border-white/50 rounded-xl relative">
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
