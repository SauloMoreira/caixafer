interface PrintHtmlDocumentOptions {
  bodyHtml: string;
  styles?: string;
  title: string;
  windowFeatures?: string;
}

async function waitForDocumentImages(doc: Document) {
  const images = Array.from(doc.images);

  await Promise.all(
    images.map((img) => {
      if (img.complete) return Promise.resolve();

      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    })
  );
}

export async function printHtmlDocument({
  bodyHtml,
  styles = '',
  title,
  windowFeatures = 'width=600,height=900',
}: PrintHtmlDocumentOptions) {
  const printWindow = window.open('', '_blank', windowFeatures);
  if (!printWindow) return false;

  const doc = printWindow.document;
  doc.open();
  doc.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>${styles}</style>
      </head>
      <body>${bodyHtml}</body>
    </html>
  `);
  doc.close();

  await waitForDocumentImages(doc);
  await new Promise((resolve) => window.setTimeout(resolve, 120));

  printWindow.focus();
  printWindow.print();
  window.setTimeout(() => printWindow.close(), 300);
  return true;
}