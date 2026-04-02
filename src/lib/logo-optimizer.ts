/**
 * Company logo optimizer — enhances logos for web/mobile display.
 * Produces an optimized version with improved sharpness, contrast,
 * and proper sizing while preserving the original identity.
 */

const LOGO_MAX_DIMENSION = 512;
const LOGO_THUMB_DIMENSION = 128;
const LOGO_QUALITY = 0.88;

interface LogoVersions {
  optimized: File;
  thumbnail: File;
  isLowQuality: boolean;
}

/**
 * Apply a subtle unsharp-mask (sharpen) to the canvas.
 * Uses a two-pass approach: blur then subtract.
 */
function applySharpen(ctx: CanvasRenderingContext2D, w: number, h: number, amount = 0.3) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const copy = new Uint8ClampedArray(data);

  // Simple 3x3 sharpen kernel applied per-pixel
  const kernel = [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0,
  ];

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let val = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * w + (x + kx)) * 4 + c;
            val += copy[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
          }
        }
        const idx = (y * w + x) * 4 + c;
        // Blend between original and sharpened based on amount
        data[idx] = Math.max(0, Math.min(255, Math.round(copy[idx] * (1 - amount) + val * amount)));
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Apply subtle contrast and brightness adjustment.
 * contrast: 1.0 = no change, >1.0 = more contrast
 * brightness: 0 = no change, >0 = brighter
 */
function applyContrastBrightness(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  contrast = 1.08,
  brightness = 5
) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let val = data[i + c];
      // Apply contrast around midpoint (128)
      val = ((val - 128) * contrast) + 128 + brightness;
      data[i + c] = Math.max(0, Math.min(255, Math.round(val)));
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Detect if the image has very low contrast or is very dark/blurry.
 */
function detectLowQuality(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  let totalBrightness = 0;
  let minBrightness = 255;
  let maxBrightness = 0;
  const pixelCount = w * h;

  // Sample every 4th pixel for performance
  for (let i = 0; i < data.length; i += 16) {
    const brightness = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    totalBrightness += brightness;
    if (brightness < minBrightness) minBrightness = brightness;
    if (brightness > maxBrightness) maxBrightness = brightness;
  }

  const avgBrightness = totalBrightness / (pixelCount / 4);
  const contrastRange = maxBrightness - minBrightness;

  // Very dark or very low contrast
  return avgBrightness < 40 || contrastRange < 30;
}

/**
 * Resize image to fit within maxDimension, preserving aspect ratio.
 */
function resizeToCanvas(
  img: HTMLImageElement,
  maxDimension: number
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; w: number; h: number } {
  let { width, height } = img;

  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height / width) * maxDimension);
      width = maxDimension;
    } else {
      width = Math.round((width / height) * maxDimension);
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  // Enable image smoothing for better downscale quality
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  return { canvas, ctx, w: width, h: height };
}

/**
 * Generate optimized + thumbnail versions of a company logo.
 * Applies subtle sharpening, contrast, and brightness improvements
 * without altering brand colors or identity.
 */
export async function optimizeCompanyLogo(file: File): Promise<LogoVersions> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      try {
        // --- Optimized version (max 512px) ---
        const { canvas: optCanvas, ctx: optCtx, w: optW, h: optH } =
          resizeToCanvas(img, LOGO_MAX_DIMENSION);

        const isLowQuality = detectLowQuality(optCtx, optW, optH);

        // Apply subtle enhancements
        applyContrastBrightness(optCtx, optW, optH, 1.08, 5);
        applySharpen(optCtx, optW, optH, 0.25);

        // --- Thumbnail version (max 128px) ---
        const { canvas: thumbCanvas, ctx: thumbCtx, w: thumbW, h: thumbH } =
          resizeToCanvas(img, LOGO_THUMB_DIMENSION);

        // Slightly stronger sharpen for tiny thumbnail
        applyContrastBrightness(thumbCtx, thumbW, thumbH, 1.10, 8);
        applySharpen(thumbCtx, thumbW, thumbH, 0.35);

        // Convert to blobs
        const toFile = (canvas: HTMLCanvasElement, name: string): Promise<File> =>
          new Promise((res, rej) => {
            canvas.toBlob(
              (blob) => {
                if (!blob) { rej(new Error('Falha ao gerar imagem')); return; }
                res(new File([blob], name, { type: 'image/jpeg' }));
              },
              'image/jpeg',
              LOGO_QUALITY
            );
          });

        Promise.all([
          toFile(optCanvas, 'logo_optimized.jpg'),
          toFile(thumbCanvas, 'logo_thumb.jpg'),
        ])
          .then(([optimized, thumbnail]) => {
            resolve({ optimized, thumbnail, isLowQuality });
          })
          .catch(reject);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Falha ao carregar imagem'));
    };

    img.src = url;
  });
}
