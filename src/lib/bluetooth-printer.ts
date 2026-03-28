/**
 * ESC/POS Bluetooth Thermal Printer (80mm)
 * Uses Web Bluetooth API for direct printing without browser dialog.
 */

const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

// Common BLE serial service/characteristic UUIDs for thermal printers
const PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Common thermal printer service
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Generic serial
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC transparent UART
];

const PRINTER_CHAR_UUIDS = [
  '00002af1-0000-1000-8000-00805f9b34fb', // Common write characteristic
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f', // Generic serial write
  '49535343-8841-43f4-a8d4-ecbe34729bb3', // ISSC transparent UART TX
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedDevice: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedCharacteristic: any = null;

export function isBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

export function getConnectedPrinterName(): string | null {
  return cachedDevice?.name || null;
}

export async function disconnectPrinter(): Promise<void> {
  if (cachedDevice?.gatt?.connected) {
    cachedDevice.gatt.disconnect();
  }
  cachedDevice = null;
  cachedCharacteristic = null;
}

export async function connectPrinter(): Promise<string> {
  if (!isBluetoothSupported()) {
    throw new Error('Web Bluetooth não é suportado neste navegador. Use Chrome no Android.');
  }

  // If already connected, reuse
  if (cachedDevice?.gatt?.connected && cachedCharacteristic) {
    return cachedDevice.name || 'Impressora';
  }

  // Request device – accept any device with known printer services or by name prefix
  const device = await navigator.bluetooth.requestDevice({
    filters: [
      { namePrefix: 'Printer' },
      { namePrefix: 'BlueTooth' },
      { namePrefix: 'BT-' },
      { namePrefix: 'MTP' },
      { namePrefix: 'MPT' },
      { namePrefix: 'POS' },
      { namePrefix: 'GS-' },
      { namePrefix: 'GoldenSky' },
      { namePrefix: 'Gprinter' },
      { namePrefix: 'EPSON' },
      { namePrefix: 'TSP' },
      { namePrefix: 'RPP' },
      { namePrefix: 'InnerPrinter' },
      { namePrefix: 'Xprinter' },
    ],
    optionalServices: PRINTER_SERVICE_UUIDS,
  });

  if (!device) throw new Error('Nenhuma impressora selecionada.');

  device.addEventListener('gattserverdisconnected', () => {
    cachedCharacteristic = null;
  });

  const server = await device.gatt!.connect();

  // Find the writable characteristic
  let writeChar: BluetoothRemoteGATTCharacteristic | null = null;

  for (const serviceUuid of PRINTER_SERVICE_UUIDS) {
    try {
      const service = await server.getPrimaryService(serviceUuid);
      for (const charUuid of PRINTER_CHAR_UUIDS) {
        try {
          const char = await service.getCharacteristic(charUuid);
          if (char.properties.write || char.properties.writeWithoutResponse) {
            writeChar = char;
            break;
          }
        } catch { /* try next */ }
      }
      if (writeChar) break;
      // Fallback: iterate all characteristics
      const chars = await service.getCharacteristics();
      for (const char of chars) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          writeChar = char;
          break;
        }
      }
      if (writeChar) break;
    } catch { /* try next service */ }
  }

  if (!writeChar) {
    // Last resort: try all services
    const services = await server.getPrimaryServices();
    for (const service of services) {
      const chars = await service.getCharacteristics();
      for (const char of chars) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          writeChar = char;
          break;
        }
      }
      if (writeChar) break;
    }
  }

  if (!writeChar) {
    device.gatt!.disconnect();
    throw new Error('Impressora conectada, mas não foi possível encontrar a interface de escrita. Verifique se a impressora é compatível com ESC/POS.');
  }

  cachedDevice = device;
  cachedCharacteristic = writeChar;
  return device.name || 'Impressora';
}

// Send data in chunks (BLE has MTU limits, typically 20-512 bytes)
async function sendData(data: Uint8Array): Promise<void> {
  if (!cachedCharacteristic) throw new Error('Impressora não conectada.');

  const CHUNK_SIZE = 100; // safe for most BLE printers
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.slice(i, i + CHUNK_SIZE);
    if (cachedCharacteristic.properties.writeWithoutResponse) {
      await cachedCharacteristic.writeValueWithoutResponse(chunk);
    } else {
      await cachedCharacteristic.writeValue(chunk);
    }
    // Small delay between chunks
    if (i + CHUNK_SIZE < data.length) {
      await new Promise(r => setTimeout(r, 30));
    }
  }
}

// ─── ESC/POS Command Builders ───────────────────────────────────

const encoder = new TextEncoder();

function encodeText(text: string): Uint8Array {
  // ESC/POS uses Code Page 860 (Portuguese) but UTF-8 works for basic chars
  // Replace special chars for thermal printer compatibility
  const mapped = text
    .replace(/ã/g, 'a').replace(/Ã/g, 'A')
    .replace(/á/g, 'a').replace(/Á/g, 'A')
    .replace(/â/g, 'a').replace(/Â/g, 'A')
    .replace(/à/g, 'a').replace(/À/g, 'A')
    .replace(/é/g, 'e').replace(/É/g, 'E')
    .replace(/ê/g, 'e').replace(/Ê/g, 'E')
    .replace(/í/g, 'i').replace(/Í/g, 'I')
    .replace(/ó/g, 'o').replace(/Ó/g, 'O')
    .replace(/ô/g, 'o').replace(/Ô/g, 'O')
    .replace(/ú/g, 'u').replace(/Ú/g, 'U')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ç/g, 'c').replace(/Ç/g, 'C')
    .replace(/ñ/g, 'n').replace(/Ñ/g, 'N')
    .replace(/💚/g, '<3')
    .replace(/[^\x20-\x7E\n]/g, '');
  return encoder.encode(mapped);
}

function cmd(...bytes: number[]): Uint8Array {
  return new Uint8Array(bytes);
}

// Initialize printer
const CMD_INIT = cmd(ESC, 0x40);
// Center align
const CMD_CENTER = cmd(ESC, 0x61, 1);
// Left align
const CMD_LEFT = cmd(ESC, 0x61, 0);
// Bold on
const CMD_BOLD_ON = cmd(ESC, 0x45, 1);
// Bold off
const CMD_BOLD_OFF = cmd(ESC, 0x45, 0);
// Double height+width on
const CMD_DOUBLE_ON = cmd(ESC, 0x21, 0x30);
// Normal size
const CMD_NORMAL = cmd(ESC, 0x21, 0x00);
// Line feed
const CMD_LF = cmd(LF);
// Cut paper (partial cut)
const CMD_CUT = cmd(GS, 0x56, 1);
// Feed and cut
const CMD_FEED_CUT = cmd(ESC, 0x64, 4, GS, 0x56, 1);

const LINE_WIDTH = 48; // characters per line for 80mm printer

function line(char = '-'): Uint8Array {
  return encodeText(char.repeat(LINE_WIDTH) + '\n');
}

function dashedLine(): Uint8Array {
  return line('-');
}

function padLine(left: string, right: string): string {
  const space = LINE_WIDTH - left.length - right.length;
  return left + ' '.repeat(Math.max(1, space)) + right + '\n';
}

function centerText(text: string): string {
  const pad = Math.max(0, Math.floor((LINE_WIDTH - text.length) / 2));
  return ' '.repeat(pad) + text + '\n';
}

// ─── Public print functions ─────────────────────────────────────

export interface ReceiptPrintData {
  saleNumber: number;
  createdAt: string;
  operatorName: string;
  items: { name: string; quantity: number; unitPrice: number; lineTotal: number }[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  paymentLabel: string;
  notes?: string | null;
}

export async function printReceipt(data: ReceiptPrintData): Promise<void> {
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDate = (d: string) => new Date(d).toLocaleString('pt-BR');

  const parts: Uint8Array[] = [
    CMD_INIT,
    CMD_CENTER,
    CMD_DOUBLE_ON,
    encodeText('CANTINA DA FER\n'),
    CMD_NORMAL,
    encodeText('Caixa da FER - Sistema de Gestao\n'),
    CMD_LEFT,
    dashedLine(),
    encodeText(padLine('Pedido:', `#${data.saleNumber}`)),
    encodeText(padLine('Data:', fmtDate(data.createdAt))),
    encodeText(padLine('Operador:', data.operatorName)),
    dashedLine(),
    // Column headers
    CMD_BOLD_ON,
    encodeText('ITEM                QTD   UNIT.    TOTAL\n'),
    CMD_BOLD_OFF,
    encodeText('.'.repeat(LINE_WIDTH) + '\n'),
  ];

  // Items
  for (const item of data.items) {
    const name = item.name.length > 18 ? item.name.substring(0, 18) : item.name.padEnd(18);
    const qty = String(item.quantity).padStart(3);
    const unit = fmt(item.unitPrice).padStart(9);
    const total = fmt(item.lineTotal).padStart(9);
    parts.push(encodeText(`${name} ${qty} ${unit} ${total}\n`));
  }

  parts.push(dashedLine());
  parts.push(encodeText(padLine('Subtotal:', fmt(data.subtotal))));

  if (data.discount > 0) {
    parts.push(encodeText(padLine('Desconto:', `-${fmt(data.discount)}`)));
  }

  parts.push(encodeText('.'.repeat(LINE_WIDTH) + '\n'));
  parts.push(CMD_BOLD_ON);
  parts.push(CMD_DOUBLE_ON);
  parts.push(encodeText(padLine('TOTAL:', fmt(data.total))));
  parts.push(CMD_NORMAL);
  parts.push(CMD_BOLD_OFF);

  parts.push(encodeText(padLine('Pagamento:', data.paymentLabel)));
  parts.push(dashedLine());

  // Footer
  parts.push(CMD_CENTER);
  parts.push(CMD_BOLD_ON);
  parts.push(encodeText('Obrigado pela preferencia! <3\n'));
  parts.push(CMD_BOLD_OFF);
  parts.push(encodeText('Cantina da FER\n'));
  parts.push(encodeText('Todos os direitos reservados\n'));
  parts.push(CMD_LEFT);

  // Feed and cut
  parts.push(CMD_FEED_CUT);

  // Merge all
  const totalLength = parts.reduce((s, p) => s + p.length, 0);
  const buffer = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    buffer.set(part, offset);
    offset += part.length;
  }

  await sendData(buffer);
}

export interface ClosingPrintData {
  date: string;
  operatorName: string;
  openingBalance: number;
  sales: number;
  income: number;
  expense: number;
  expectedBalance: number;
  countedBalance?: number | null;
  difference?: number | null;
  salesByMethod?: Record<string, { label: string; value: number }>;
  notes?: string;
  version?: number;
  status: string;
}

export async function printClosing(data: ClosingPrintData): Promise<void> {
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('pt-BR'); } catch { return d; }
  };

  const parts: Uint8Array[] = [
    CMD_INIT,
    CMD_CENTER,
    CMD_DOUBLE_ON,
    encodeText('CANTINA DA FER\n'),
    CMD_NORMAL,
    CMD_BOLD_ON,
    encodeText('FECHAMENTO DE CAIXA\n'),
    CMD_BOLD_OFF,
    CMD_LEFT,
    dashedLine(),
    encodeText(padLine('Data:', fmtDate(data.date))),
    encodeText(padLine('Operador:', data.operatorName)),
    encodeText(padLine('Status:', data.status === 'closed' ? 'FECHADO' : 'ABERTO')),
  ];

  if (data.version && data.version > 1) {
    parts.push(encodeText(padLine('Versao:', `v${data.version}`)));
  }

  parts.push(dashedLine());

  parts.push(CMD_BOLD_ON);
  parts.push(encodeText(centerText('RESUMO FINANCEIRO')));
  parts.push(CMD_BOLD_OFF);
  parts.push(CMD_LF);

  parts.push(encodeText(padLine('Saldo Inicial:', fmt(data.openingBalance))));
  parts.push(encodeText(padLine('(+) Vendas:', fmt(data.sales))));
  parts.push(encodeText(padLine('(+) Entradas:', fmt(data.income))));
  parts.push(encodeText(padLine('(-) Saidas:', fmt(data.expense))));
  parts.push(dashedLine());

  parts.push(CMD_BOLD_ON);
  parts.push(encodeText(padLine('Saldo Esperado:', fmt(data.expectedBalance))));
  parts.push(CMD_BOLD_OFF);

  if (data.countedBalance != null) {
    parts.push(encodeText(padLine('Saldo Contado:', fmt(data.countedBalance))));
  }
  if (data.difference != null) {
    parts.push(CMD_BOLD_ON);
    parts.push(encodeText(padLine('Diferenca:', fmt(data.difference))));
    parts.push(CMD_BOLD_OFF);
  }

  // Sales by method
  if (data.salesByMethod && Object.keys(data.salesByMethod).length > 0) {
    parts.push(dashedLine());
    parts.push(CMD_BOLD_ON);
    parts.push(encodeText(centerText('VENDAS POR FORMA DE PGTO')));
    parts.push(CMD_BOLD_OFF);
    parts.push(CMD_LF);
    for (const [, pm] of Object.entries(data.salesByMethod)) {
      if (pm.value > 0) {
        parts.push(encodeText(padLine(pm.label + ':', fmt(pm.value))));
      }
    }
  }

  if (data.notes) {
    parts.push(dashedLine());
    parts.push(encodeText('Obs: ' + data.notes + '\n'));
  }

  parts.push(dashedLine());
  parts.push(CMD_CENTER);
  parts.push(encodeText('Cantina da FER\n'));
  parts.push(encodeText(new Date().toLocaleString('pt-BR') + '\n'));
  parts.push(CMD_LEFT);
  parts.push(CMD_FEED_CUT);

  const totalLength = parts.reduce((s, p) => s + p.length, 0);
  const buffer = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    buffer.set(part, offset);
    offset += part.length;
  }

  await sendData(buffer);
}
