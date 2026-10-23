import type { RasterPlan } from './floorplanImport';

/** Rotate the actual raster, so crop coordinates and later tracing stay aligned. */
export async function rotateRasterPlan(image: RasterPlan, direction: 1 | -1): Promise<RasterPlan> {
  const source = new Image(); source.src = image.src; await source.decode();
  const canvas = document.createElement('canvas');
  canvas.width = source.naturalHeight; canvas.height = source.naturalWidth;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('瀏覽器無法旋轉圖片');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(direction * Math.PI / 2);
  ctx.drawImage(source, -source.naturalWidth / 2, -source.naturalHeight / 2);
  // Match import limits: a rotated high-resolution photo must still fit saved plans.
  let current = canvas;
  for (let attempt = 0; attempt < 5; attempt++) {
    const src = current.toDataURL('image/jpeg', .88);
    if (src.length <= 1_800_000) return { ...image, src, pixelWidth: current.width, pixelHeight: current.height };
    const reduced = document.createElement('canvas');
    reduced.width = Math.max(1, Math.round(current.width * .75)); reduced.height = Math.max(1, Math.round(current.height * .75));
    const reducedContext = reduced.getContext('2d');
    if (!reducedContext) throw new Error('瀏覽器無法壓縮旋轉圖片');
    reducedContext.drawImage(current, 0, 0, reduced.width, reduced.height); current = reduced;
  }
  throw new Error('旋轉後圖片過大，請先縮小原圖再匯入');
}
