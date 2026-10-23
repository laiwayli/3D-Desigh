export type Point = { x: number; y: number };
export type FurnitureKind = 'sofa' | 'chair' | 'table' | 'bed' | 'kitchen' | 'plant' | 'desk' | 'toilet' | 'shower' | 'wardrobe';
export type Furniture = Point & { id: string; kind: FurnitureKind; w: number; d: number; rotation: number };
export type Wall = { id: string; a: Point; b: Point; thickness: number };
export type Room = Point & { name: string; area: number; color: string };
export type Entry = 'left' | 'right' | 'top' | 'bottom';
export type Underlay = { id: string; name: string; src: string; pixelWidth: number; pixelHeight: number; x: number; y: number; width: number; height: number; opacity: number; visible: boolean; calibratedDistance?: number };
export type Plan = { id: string; name: string; width: number; depth: number; wallThickness: number; height: number; entry: Entry; walls: Wall[]; furniture: Furniture[]; rooms: Room[]; exteriorLocked: boolean; underlay?: Underlay };
export const MIN_DIMENSION = 2;
export const MAX_DIMENSION = 60;
export const uid = () => crypto.randomUUID();
export const catalog: Record<FurnitureKind, { name: string; w: number; d: number; group: string }> = {
  sofa: { name: '三人沙發', w: 2.6, d: 0.95, group: '客廳' }, chair: { name: '單人椅', w: 0.8, d: 0.8, group: '客廳' }, table: { name: '餐桌', w: 1.65, d: 0.9, group: '餐廳' }, bed: { name: '雙人床', w: 1.8, d: 2.1, group: '臥室' }, kitchen: { name: '廚房檯面', w: 2.8, d: 0.65, group: '廚房' }, plant: { name: '植栽', w: 0.55, d: 0.55, group: '裝飾' }, desk: { name: '工作桌', w: 1.5, d: 0.65, group: '書房' }, toilet: { name: '馬桶', w: 0.65, d: 0.85, group: '衛浴' }, shower: { name: '淋浴間', w: 1.1, d: 1.1, group: '衛浴' }, wardrobe: { name: '收納櫃', w: 2, d: 0.6, group: '臥室' },
};
export const snap = (n: number) => Math.round(n * 10) / 10;
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export function furnitureBounds(f: Furniture) {
  const a = f.rotation * Math.PI / 180;
  return { w: Math.abs(Math.cos(a)) * f.w + Math.abs(Math.sin(a)) * f.d, d: Math.abs(Math.sin(a)) * f.w + Math.abs(Math.cos(a)) * f.d };
}
export function constrainFurniture(f: Furniture, plan: Pick<Plan, 'width' | 'depth' | 'wallThickness'>): Furniture {
  const bounds = furnitureBounds(f), t = plan.wallThickness / 2 + .04;
  const factor = Math.min(1, (plan.width - 2 * t) / bounds.w, (plan.depth - 2 * t) / bounds.d);
  const b = { w: bounds.w * factor, d: bounds.d * factor };
  return { ...f, w: f.w * factor, d: f.d * factor, x: clamp(f.x, b.w / 2 + t, plan.width - b.w / 2 - t), y: clamp(f.y, b.d / 2 + t, plan.depth - b.d / 2 - t) };
}
export function resizePlanDimensions(plan: Plan, width: number, depth: number): Plan {
  if (plan.exteriorLocked) throw new Error('請先解鎖外牆尺寸');
  if (![width, depth].every(n => Number.isFinite(n) && n >= MIN_DIMENSION && n <= MAX_DIMENSION)) throw new Error('長寬需介於 2–60 公尺');
  const sx = width / plan.width, sy = depth / plan.depth;
  const scale = (p: Point): Point => ({ x: p.x * sx, y: p.y * sy });
  const next: Plan = { ...plan, width, depth, rooms: [], walls: plan.walls.map(w => ({ ...w, a: scale(w.a), b: scale(w.b) })) };
  next.furniture = plan.furniture.map(f => constrainFurniture({ ...f, ...scale(f) }, next));
  // A calibrated drawing is a physical reference: changing the boundary must
  // not stretch its measured scale. Uncalibrated images may be fitted again.
  if (plan.underlay) next.underlay = plan.underlay.calibratedDistance ? plan.underlay : fitUnderlay(plan.underlay, next);
  return next;
}
export function fitUnderlay(underlay: Underlay, plan: Pick<Plan, 'width' | 'depth'>): Underlay {
  const scale = Math.min(plan.width / underlay.pixelWidth, plan.depth / underlay.pixelHeight);
  const width = underlay.pixelWidth * scale, height = underlay.pixelHeight * scale;
  return { ...underlay, width, height, x: (plan.width - width) / 2, y: (plan.depth - height) / 2, calibratedDistance: undefined };
}
export function calibrateUnderlay(underlay: Underlay, a: Point, b: Point, distance: number): Underlay {
  const measured = Math.hypot(b.x - a.x, b.y - a.y);
  if (!Number.isFinite(distance) || distance < .01 || distance > 120 || measured < .01) throw new Error('請選取不同的兩點，並輸入 0.01–120 公尺的已知距離');
  const factor = distance / measured;
  const next = { ...underlay, width: underlay.width * factor, height: underlay.height * factor, x: a.x + (underlay.x - a.x) * factor, y: a.y + (underlay.y - a.y) * factor, calibratedDistance: distance };
  if (next.width > 120 || next.height > 120 || next.width < .02 || next.height < .02 || Math.abs(next.x) > 120 || Math.abs(next.y) > 120) throw new Error('校正後底圖超出範圍，請檢查已知距離與單位');
  return next;
}
export function createPlan(variant = 0, entry: Entry = 'left', width = 12, depth = 9): Plan {
  const transform = (x: number, y: number): Point => {
    let u = x / 12, v = y / 9;
    if (entry === 'right') u = 1 - u;
    if (entry === 'top') [u, v] = [v, u];
    if (entry === 'bottom') [u, v] = [1 - v, 1 - u];
    return { x: u * width, y: v * depth };
  };
  const walls: Wall[] = [], furniture: Furniture[] = [], rooms: Room[] = [];
  const wall = (x: number, y: number, xx: number, yy: number) => walls.push({ id: uid(), a: transform(x, y), b: transform(xx, yy), thickness: .12 });
  const item = (kind: FurnitureKind, x: number, y: number, rotation = 0, w = catalog[kind].w, d = catalog[kind].d) => {
    const angle = entry === 'right' ? -rotation : entry === 'top' ? -90 - rotation : entry === 'bottom' ? 90 - rotation : rotation;
    furniture.push(constrainFurniture({ id: uid(), kind, ...transform(x, y), w: w * Math.min(width / 12, depth / 9), d: d * Math.min(width / 12, depth / 9), rotation: angle }, { width, depth, wallThickness: .24 }));
  };
  const room = (name: string, x: number, y: number, area: number, color: string) => rooms.push({ name, ...transform(x, y), area: area * width * depth / 108, color });
  wall(7.35, 0, 7.35, 3.1); wall(7.35, 4.05, 7.35, 6.5); wall(7.35, 7.45, 7.35, 9);
  wall(7.35, 4.55, 12, 4.55); wall(9.3, 4.55, 9.3, 7); wall(9.3, 7.85, 9.3, 9);
  if (variant !== 1) { wall(0, 5.2, 3.05, 5.2); wall(4.15, 5.2, 7.35, 5.2); }
  if (variant === 2) { wall(4.7, 0, 4.7, 2.5); wall(4.7, 3.4, 4.7, 5.2); }
  item('sofa', variant === 2 ? 2.3 : 3.2, 1.05, 0, variant === 2 ? 2.4 : 3.1);
  item('table', variant === 2 ? 2.3 : 3.2, 2.8, 0, 1.3, .65);
  item('chair', variant === 2 ? .9 : 1.1, 3.25, -12); item('plant', .6, .65); item('plant', 6.8, .65);
  item('bed', 9.7, 2.1, 0, 1.8, 2.1); item('wardrobe', 11.45, 2.2, 90, 2.8, .65);
  item('desk', 8.5, .6, 0, 1.45); item('plant', 11.4, .6);
  item('kitchen', 2.15, 8.55, 0, 3.5); item('kitchen', .45, 5.9, 90, 1);
  item('table', 4.85, 7.1); item('chair', 4.2, 6.25, 0, .5, .5); item('chair', 5.4, 6.25, 0, .5, .5); item('chair', 4.2, 7.9, 0, .5, .5); item('chair', 5.4, 7.9, 0, .5, .5);
  item('desk', 8.3, 8.45); item('wardrobe', 8.25, 5.05, 0, 1.6);
  item('toilet', 10, 5.25); item('shower', 11.3, 8.25); item('kitchen', 11.55, 5.9, 90, 1.4, .55);
  if (variant === 2) { item('desk', 5.9, 1.2, 0, 1.8); item('chair', 5.9, 2.2); room('獨立書房', 5.9, 3.8, 12.5, '#d8e2d5'); }
  room('客廳', variant === 2 ? 2.3 : 3.7, 4.35, variant === 2 ? 22 : 36.5, '#e8e5dc');
  room('主臥室', 9.6, 3.9, 19.8, '#e5dfd7'); room('餐廚空間', 4.65, 5.65, 24, '#e4e8dc'); room('多功能室', 8.3, 6.7, 8, '#e1e7e3'); room('衛浴', 10.65, 7, 10.2, '#dee8e8');
  return { id: uid(), name: ['日光・雙人寓所', '流動・開放生活', '靜謐・居家辦公'][variant], width, depth, wallThickness: .24, height: 2.8, entry, walls, furniture, rooms, exteriorLocked: true };
}
export function entryGeometry(p: Plan) {
  const pos = .78, span = 1.05;
  if (p.entry === 'left' || p.entry === 'right') return { a: { x: p.entry === 'left' ? 0 : p.width, y: p.depth * pos - span / 2 }, b: { x: p.entry === 'left' ? 0 : p.width, y: p.depth * pos + span / 2 } };
  return { a: { x: p.width * (p.entry === 'top' ? pos : 1 - pos) - span / 2, y: p.entry === 'top' ? 0 : p.depth }, b: { x: p.width * (p.entry === 'top' ? pos : 1 - pos) + span / 2, y: p.entry === 'top' ? 0 : p.depth } };
}
export function exteriorSegments(p: Plan): Wall[] {
  const { a, b } = entryGeometry(p), points = [{ x: 0, y: 0 }, { x: p.width, y: 0 }, { x: p.width, y: p.depth }, { x: 0, y: p.depth }];
  const result: Wall[] = [];
  points.forEach((point, i) => {
    const next = points[(i + 1) % 4];
    const on = point.x === next.x ? point.x === a.x && a.x === b.x : point.y === a.y && a.y === b.y;
    if (!on) result.push({ id: `ext-${i}`, a: point, b: next, thickness: p.wallThickness });
    else {
      const ordered = Math.hypot(point.x - a.x, point.y - a.y) < Math.hypot(point.x - b.x, point.y - b.y) ? [a, b] : [b, a];
      result.push({ id: `ext-${i}a`, a: point, b: ordered[0], thickness: p.wallThickness }, { id: `ext-${i}b`, a: ordered[1], b: next, thickness: p.wallThickness });
    }
  });
  return result;
}
export function isPlan(value: unknown): value is Plan {
  if (!value || typeof value !== 'object') return false;
  const p = value as Plan;
  const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  const point = (v: Point) => v && finite(v.x) && finite(v.y);
  const u = p.underlay;
  const validUnderlay = u === undefined || (u && typeof u.id === 'string' && typeof u.name === 'string' && typeof u.src === 'string' && u.src.length <= 2_200_000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(u.src) && [u.pixelWidth, u.pixelHeight, u.width, u.height].every(n => finite(n) && n > 0) && u.width <= 120 && u.height <= 120 && point(u) && Math.abs(u.x) <= 120 && Math.abs(u.y) <= 120 && finite(u.opacity) && u.opacity >= 0 && u.opacity <= 1 && typeof u.visible === 'boolean' && (u.calibratedDistance === undefined || (finite(u.calibratedDistance) && u.calibratedDistance >= .01 && u.calibratedDistance <= 120)));
  return !!validUnderlay && typeof p.id === 'string' && typeof p.name === 'string' && finite(p.width) && p.width >= MIN_DIMENSION && p.width <= MAX_DIMENSION && finite(p.depth) && p.depth >= MIN_DIMENSION && p.depth <= MAX_DIMENSION && finite(p.height) && p.height > 0 && finite(p.wallThickness) && p.wallThickness > 0 && ['left', 'right', 'top', 'bottom'].includes(p.entry) && typeof p.exteriorLocked === 'boolean' && Array.isArray(p.walls) && p.walls.length <= 1000 && p.walls.every(w => w && typeof w.id === 'string' && point(w.a) && point(w.b) && finite(w.thickness) && w.thickness > 0) && Array.isArray(p.furniture) && p.furniture.length <= 1000 && p.furniture.every(f => f && typeof f.id === 'string' && Object.hasOwn(catalog, f.kind) && point(f) && finite(f.w) && f.w > 0 && finite(f.d) && f.d > 0 && finite(f.rotation)) && Array.isArray(p.rooms) && p.rooms.length <= 1000 && p.rooms.every(r => r && typeof r.name === 'string' && point(r) && finite(r.area) && typeof r.color === 'string');
}
