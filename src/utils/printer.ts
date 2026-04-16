/**
 * RawBT direct printing utility
 *
 * RawBT is an Android app that exposes a URI scheme:
 *   rawbt:base64,<base64_escpos_bytes>
 *
 * Triggering this URI opens RawBT directly and prints without any
 * picker / dialog. Works only on Android with RawBT installed.
 * On other platforms we fall back to window.print() of plain text.
 */

import { toast } from 'sonner';

const ESC = 0x1b;
const GS = 0x1d;

// ─── ESC/POS encoding ────────────────────────────────────────────

/**
 * Convert text lines to ESC/POS byte stream.
 * Structure: ESC @ (init) → content → ESC d 3 (feed) → GS V 1 (cut)
 */
export function textToEscPos(lines: string[]): Uint8Array {
  // Replace accented chars for better thermal compatibility
  const sanitize = (text: string) =>
    text
      .replace(/[ãâáàä]/g, 'a').replace(/[ÃÂÁÀÄ]/g, 'A')
      .replace(/[éêèë]/g, 'e').replace(/[ÉÊÈË]/g, 'E')
      .replace(/[íîìï]/g, 'i').replace(/[ÍÎÌÏ]/g, 'I')
      .replace(/[óôòöõ]/g, 'o').replace(/[ÓÔÒÖÕ]/g, 'O')
      .replace(/[úûùü]/g, 'u').replace(/[ÚÛÙÜ]/g, 'U')
      .replace(/ç/g, 'c').replace(/Ç/g, 'C')
      .replace(/💚/g, '<3');

  const body = lines.map(sanitize).join('\n') + '\n';
  const encoder = new TextEncoder();
  const bodyBytes = encoder.encode(body);

  const init = [ESC, 0x40];                  // ESC @  → initialize
  const feed = [ESC, 0x64, 0x03];            // ESC d 3 → feed 3 lines
  const cut = [GS, 0x56, 0x01];              // GS V 1 → partial cut

  const total = init.length + bodyBytes.length + feed.length + cut.length;
  const buf = new Uint8Array(total);
  let off = 0;
  buf.set(init, off); off += init.length;
  buf.set(bodyBytes, off); off += bodyBytes.length;
  buf.set(feed, off); off += feed.length;
  buf.set(cut, off);
  return buf;
}

/** Convert Uint8Array to Base64 (browser-safe). */
export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunkSize)),
    );
  }
  return btoa(binary);
}

// ─── Triggers ────────────────────────────────────────────────────

/** Fire RawBT URI scheme. No dialog, no delay. */
export function printViaRawBT(base64Data: string): void {
  window.location.href = `rawbt:base64,${base64Data}`;
}

/** Browser-native fallback for non-Android environments. */
export function printFallback(lines: string[]): void {
  const w = window.open('', '_blank', 'width=400,height=700');
  if (!w) return;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Impressao</title>
    <style>
      body { margin:0; padding:8mm; font-family:'Courier New',monospace; font-size:11px; line-height:1.5; color:#000; white-space:pre; }
      @media print { @page { size: 80mm auto; margin: 0; } body { padding: 4mm; } }
    </style></head><body>${lines.map(l => l.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))).join('\n')}</body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
  window.setTimeout(() => w.close(), 300);
}

const isAndroid = () =>
  typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

/**
 * Main entry. Tries RawBT on Android, falls back to window.print otherwise.
 * Wrapped in try/catch — surfaces a friendly toast on failure.
 */
export function printReceipt(lines: string[]): void {
  try {
    if (isAndroid()) {
      const bytes = textToEscPos(lines);
      const base64 = uint8ToBase64(bytes);
      printViaRawBT(base64);
      return;
    }
    printFallback(lines);
  } catch (err) {
    console.error('[printer] failed:', err);
    toast.error('Impressora não encontrada. Verifique se o RawBT está instalado.');
  }
}
