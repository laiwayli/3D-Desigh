import type { PDFDocumentProxy } from 'pdfjs-dist';

export type RasterPlan = { src: string; pixelWidth: number; pixelHeight: number; name: string };
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

function rasterize(source: CanvasImageSource, width: number, height: number, name: string): RasterPlan {
  if (width <= 0 || height <= 0 || width * height > 120_000_000) throw new Error('圖片尺寸過大或無法讀取，請縮小後再匯入');
  let scale = Math.min(1, 2400 / Math.max(width, height));
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('瀏覽器無法建立圖片預覽');
  let src = '';
  for (let i = 0; i < 5; i++) {
    canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    src = canvas.toDataURL('image/jpeg', .88);
    if (src.length <= 1_800_000) return { src, pixelWidth: canvas.width, pixelHeight: canvas.height, name };
    scale *= .75;
  }
  throw new Error('無法壓縮此圖片，請使用較小的檔案');
}

export async function readImagePlan(file: File): Promise<RasterPlan> {
  if (file.size > MAX_FILE_BYTES) throw new Error('檔案需小於 15 MB');
  const image = new Image(), url = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('無法讀取圖片，請確認是 PNG、JPG 或 WebP')); image.src = url; });
    return rasterize(image, image.naturalWidth, image.naturalHeight, file.name);
  } finally { URL.revokeObjectURL(url); }
}

let workerURL: string | undefined;
export async function readPdfPlan(file: File): Promise<PDFDocumentProxy> {
  if (file.size > MAX_FILE_BYTES) throw new Error('檔案需小於 15 MB');
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.mjs?raw')]);
  // Embed the official PDF.js worker so the portable HTML has no CDN dependency.
  workerURL ??= URL.createObjectURL(new Blob([worker.default], { type: 'text/javascript' }));
  pdfjs.GlobalWorkerOptions.workerSrc = workerURL;
  const loading = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: true, useWasm: false, isImageDecoderSupported: false });
  loading.onPassword = () => { void loading.destroy(); };
  try { return await loading.promise; }
  catch { throw new Error('無法讀取 PDF。請先移除密碼，或將需要的頁面轉存為 PNG／JPG'); }
}

export async function renderPdfPlan(pdf: PDFDocumentProxy, pageNumber: number, filename: string): Promise<{ image: RasterPlan; annotations: string[] }> {
  const page = await pdf.getPage(pageNumber), original = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(3, 2400 / Math.max(original.width, original.height)) });
  const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('瀏覽器無法繪製 PDF');
  await page.render({ canvasContext: ctx, canvas, viewport, background: '#ffffff' }).promise;
  const text = await page.getTextContent();
  const annotations = [...new Set(text.items.flatMap(item => {
    if (!('str' in item)) return [];
    const s = item.str.trim();
    return /^(?:\d{1,3}(?:,\d{3})+|\d{2,6}|\d{1,3}\.\d{1,3})\s*(?:mm|cm|m|公尺|公分|毫米)?$/i.test(s) ? [s] : [];
  }))].slice(0, 24);
  return { image: rasterize(canvas, canvas.width, canvas.height, `${filename} · 第 ${pageNumber} 頁`), annotations };
}
