import { autoFurnish, findRooms } from './autoFurnish';
import { clamp, uid } from './model';
import type { Plan, Wall } from './model';
import type { RasterPlan } from './floorplanImport';
import type { StyleId } from './interiorStyles';

export type Crop = { x: number; y: number; w: number; h: number };
export type LineRun = { axis: 'h' | 'v'; position: number; start: number; end: number; thickness: number; samples: number };
export type ReconstructionSettings = { width: number; depth: number; crop: Crop; style?: StyleId };
export type LineQuality = { horizontal: number; vertical: number; total: number; warnings: string[]; blockingReason?: string };

/** This flags line clutter, not architectural correctness or OCR confidence. */
export function assessWallLines(lines: LineRun[], width: number, height: number): LineQuality {
  const horizontal = lines.filter(l => l.axis === 'h'), vertical = lines.filter(l => l.axis === 'v');
  const quality: LineQuality = { horizontal: horizontal.length, vertical: vertical.length, total: lines.length, warnings: [] };
  if (horizontal.length < 2 || vertical.length < 2) {
    quality.blockingReason = '尚未找到足夠的牆線。請框選建築外框、排除尺寸線與標題，或換成較清晰的正面掃描圖。';
    return quality;
  }
  let crossings = 0;
  for (const h of horizontal) for (const v of vertical) if (v.position >= h.start && v.position <= h.end && h.position >= v.start && h.position <= v.end) crossings++;
  const crossingRatio = crossings / (horizontal.length * vertical.length);
  const shortFraction = lines.filter(l => l.end - l.start < Math.max(width, height) * .18).length / lines.length;
  if (lines.length > 80 || (lines.length > 30 && crossingRatio > .42) || (lines.length > 45 && shortFraction > .7)) {
    quality.blockingReason = `候選線過於密集（${lines.length} 段），可能包含尺寸線、電路符號或剖面線。請縮小框選到建築本體，或改用「僅匯入描圖底圖」，避免把雜訊當成牆。`;
  } else if (lines.length > 30 || shortFraction > .55) {
    quality.warnings.push('短線或候選線較多，可能混入文字、尺寸線與設備符號，請逐區比對疊圖。');
  }
  return quality;
}

/** Adaptive local threshold tolerates shaded paper; this detects linework, not room semantics. */
export function extractWallLines(rgba: Uint8ClampedArray, width: number, height: number): LineRun[] {
  const gray = new Uint8Array(width * height), integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < width; x++) { const i = y * width + x, j = i * 4; gray[i] = Math.round(.299 * rgba[j] + .587 * rgba[j + 1] + .114 * rgba[j + 2]); sum += gray[i]; integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1] + sum; }
  }
  const ink = new Uint8Array(width * height), radius = Math.max(10, Math.round(Math.min(width, height) * .025));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const x0 = Math.max(0, x - radius), x1 = Math.min(width, x + radius + 1), y0 = Math.max(0, y - radius), y1 = Math.min(height, y + radius + 1), stride = width + 1;
    const mean = (integral[y1 * stride + x1] - integral[y0 * stride + x1] - integral[y1 * stride + x0] + integral[y0 * stride + x0]) / ((x1 - x0) * (y1 - y0));
    ink[y * width + x] = gray[y * width + x] < 20 || gray[y * width + x] < mean - 10 ? 1 : 0;
  }
  const raw: LineRun[] = [];
  const scan = (axis: 'h' | 'v') => {
    const n = axis === 'h' ? height : width, length = axis === 'h' ? width : height, minimum = Math.max(18, length * .075);
    for (let pos = 0; pos < n; pos++) {
      let start = -1, last = -1;
      for (let k = 0; k <= length + 2; k++) {
        const hit = k < length && ink[axis === 'h' ? pos * width + k : k * width + pos];
        if (hit) { if (start < 0) start = k; last = k; }
        if (start >= 0 && (k - last > 2 || k === length + 2)) { if (last - start >= minimum) raw.push({ axis, position: pos, start, end: last, thickness: 1, samples: 1 }); start = -1; }
      }
    }
  };
  scan('h'); scan('v');
  const tolerance = Math.max(3, Math.min(18, Math.min(width, height) * .018)), merged: LineRun[] = [];
  for (const line of raw.sort((a, b) => a.position - b.position)) {
    const group = merged.find(g => g.axis === line.axis && Math.abs(g.position - line.position) <= tolerance && Math.min(g.end, line.end) - Math.max(g.start, line.start) > Math.min(g.end - g.start, line.end - line.start) * .35);
    if (!group) merged.push({ ...line });
    else { group.thickness = Math.max(group.thickness, Math.abs(group.position - line.position) * 2); group.position = (group.position * group.samples + line.position) / (group.samples + 1); group.samples++; group.start = Math.min(group.start, line.start); group.end = Math.max(group.end, line.end); }
  }
  return merged.filter(g => g.samples >= 2 && g.end - g.start > Math.max(width, height) * .055).sort((a, b) => (b.end - b.start) * b.samples - (a.end - a.start) * a.samples);
}

export async function reconstructImage(image: RasterPlan, settings: ReconstructionSettings): Promise<Plan> {
  if (![settings.width, settings.depth].every(v => Number.isFinite(v) && v >= 2 && v <= 60)) throw new Error('請確認建築主體的寬與深，需介於 2–60 公尺');
  const source = new Image(); source.src = image.src; await source.decode();
  const crop = settings.crop, sx = clamp(crop.x, 0, 1) * source.naturalWidth, sy = clamp(crop.y, 0, 1) * source.naturalHeight;
  const sw = Math.min(crop.w * source.naturalWidth, source.naturalWidth - sx), sh = Math.min(crop.h * source.naturalHeight, source.naturalHeight - sy);
  if (sw < 30 || sh < 30) throw new Error('框選範圍太小，請框選完整建築範圍');
  const scale = Math.min(1, 900 / Math.max(sw, sh)), canvas = document.createElement('canvas'); canvas.width = Math.round(sw * scale); canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  await new Promise<void>(r => requestAnimationFrame(() => r()));
  const lines = extractWallLines(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
  const quality = assessWallLines(lines, canvas.width, canvas.height);
  if (quality.blockingReason) throw new Error(quality.blockingReason);
  const xs = lines.flatMap(l => l.axis === 'h' ? [l.start, l.end] : [l.position]), ys = lines.flatMap(l => l.axis === 'v' ? [l.start, l.end] : [l.position]);
  const left = Math.max(0, Math.min(...xs)), top = Math.max(0, Math.min(...ys)), right = Math.min(canvas.width, Math.max(...xs)), bottom = Math.min(canvas.height, Math.max(...ys));
  const width = settings.width, depth = settings.depth, pxw = right - left, pxh = bottom - top;
  if (pxw < 30 || pxh < 30) throw new Error('辨識範圍不完整，請重新框選');
  const walls: Wall[] = [];
  for (const line of lines) {
    if (line.axis === 'h') {
      const y = (line.position - top) / pxh * depth; if (y < .22 || y > depth - .22) continue;
      walls.push({ id: uid(), a: { x: clamp((line.start - left) / pxw * width, .08, width - .08), y }, b: { x: clamp((line.end - left) / pxw * width, .08, width - .08), y }, thickness: clamp(line.thickness / pxh * depth, .08, .24) });
    } else {
      const x = (line.position - left) / pxw * width; if (x < .22 || x > width - .22) continue;
      walls.push({ id: uid(), a: { x, y: clamp((line.start - top) / pxh * depth, .08, depth - .08) }, b: { x, y: clamp((line.end - top) / pxh * depth, .08, depth - .08) }, thickness: clamp(line.thickness / pxw * width, .08, .24) });
    }
  }
  const drawing = document.createElement('canvas'); drawing.width = Math.round(pxw); drawing.height = Math.round(pxh); drawing.getContext('2d')!.drawImage(canvas, left, top, pxw, pxh, 0, 0, drawing.width, drawing.height);
  let plan: Plan = { id: uid(), name: `${image.name.slice(0, 25)}・重建草稿`, width, depth, wallThickness: .18, height: 2.8, exteriorLocked: true, entry: 'right', entryPosition: .12, style: settings.style || 'nordic', walls, rooms: [], furniture: [], underlay: { id: uid(), name: image.name, src: drawing.toDataURL('image/jpeg', .88), pixelWidth: drawing.width, pixelHeight: drawing.height, x: 0, y: 0, width, height: depth, calibratedDistance: width, opacity: .25, visible: true }, reconstruction: { method: 'image-lines', needsReview: true, dimensions: [{ label: '使用者確認的主體寬', metres: width, status: 'read' }, { label: '使用者確認的主體深', metres: depth, status: 'read' }], notes: [`線條摘要：水平 ${quality.horizontal}／垂直 ${quality.vertical}，共 ${quality.total} 段候選；不代表已確認的牆數。`, ...quality.warnings, '依線條對比辨識水平與垂直牆線，結果為待校對草稿。', '比例依使用者確認的尺寸設定，未以 OCR 自動確定標註。', '不讀取房名文字，不理解電路符號，也不會校正斜拍照片的透視變形。', '外牆採辨識範圍的矩形近似；斜牆、曲牆、柱、門窗與外推需核對。', '房間用途以面積推測，請在空間清單修改用途後重新配置家具。'] } };
  plan.rooms = findRooms(plan);
  if (!plan.rooms.length) plan.reconstruction!.notes.push('尚未找到封閉房間。請在 2D 修正牆面後，使用「重算房間並配置家具」。');
  const result = autoFurnish(plan); plan = result.plan;
  plan.reconstruction!.notes.push(...result.skipped.slice(0, 8));
  return plan;
}
