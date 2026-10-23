import { catalog, exteriorSegments, furnitureBounds, pointInPolygon, uid } from './model';
import type { Furniture, FurnitureKind, Plan, Point, Room, RoomKind } from './model';

export const roomKinds: { id: RoomKind; name: string }[] = [
  { id: 'living', name: '客廳' }, { id: 'dining', name: '餐廳' }, { id: 'master', name: '主臥室' }, { id: 'bedroom', name: '次臥室' }, { id: 'study', name: '書房' }, { id: 'kitchen', name: '廚房' }, { id: 'bathroom', name: '衛浴' }, { id: 'balcony', name: '陽台' }, { id: 'hall', name: '玄關／走道' }, { id: 'service', name: '不配置家具／待核區' },
];
function lineIntersectsRect(a: Point, b: Point, r: { x: number; y: number; w: number; d: number }) {
  let lo = 0, hi = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  for (const [p, q] of [[-dx, a.x - r.x], [dx, r.x + r.w - a.x], [-dy, a.y - r.y], [dy, r.y + r.d - a.y]]) {
    if (Math.abs(p) < 1e-9) { if (q < 0) return false; }
    else { const t = q / p; if (p < 0) lo = Math.max(lo, t); else hi = Math.min(hi, t); if (lo > hi) return false; }
  }
  return true;
}
export function furnitureCollides(f: Furniture, plan: Plan, placed: Furniture[]) {
  const b = furnitureBounds(f), r = { x: f.x - b.w / 2, y: f.y - b.d / 2, w: b.w, d: b.d };
  if (r.x < .05 || r.y < .05 || r.x + r.w > plan.width - .05 || r.y + r.d > plan.depth - .05) return true;
  if (plan.outline && ![{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x, y: r.y + r.d }, { x: r.x + r.w, y: r.y + r.d }].every(p => pointInPolygon(p, plan.outline!))) return true;
  const obstacles = [...(plan.excludedAreas || []), ...(plan.columns || []).map(c => ({ x: c.x - c.w / 2, y: c.y - c.d / 2, w: c.w, d: c.d }))];
  if (obstacles.some(o => r.x < o.x + o.w + .025 && r.x + r.w > o.x - .025 && r.y < o.y + o.d + .025 && r.y + r.d > o.y - .025)) return true;
  if ([...exteriorSegments(plan), ...plan.walls].some(w => {
    const margin = w.thickness / 2 + .025;
    return lineIntersectsRect(w.a, w.b, { x: r.x - margin, y: r.y - margin, w: r.w + margin * 2, d: r.d + margin * 2 });
  })) return true;
  return placed.some(other => { const bb = furnitureBounds(other); return Math.abs(other.x - f.x) < (b.w + bb.w) / 2 + .055 && Math.abs(other.y - f.y) < (b.d + bb.d) / 2 + .055; });
}

export function autoFurnish(plan: Plan): { plan: Plan; skipped: string[] } {
  const furniture: Furniture[] = [], skipped: string[] = [];
  for (const room of plan.rooms) {
    const bounds = room.bounds; if (!bounds || room.kind === 'hall' || room.kind === 'service') continue;
    const { x, y, w: rw, d: rd } = bounds;
    const place = (kind: FurnitureKind, positions: [number, number, number?][], w = catalog[kind].w, d = catalog[kind].d, required = false, accept?: (f: Furniture) => boolean) => {
      for (const [u, v, angle = 0] of positions) {
        const f: Furniture = { id: uid(), kind, x: x + u, y: y + v, rotation: angle, w, d };
        const b = furnitureBounds(f);
        if (u - b.w / 2 < .1 || u + b.w / 2 > rw - .1 || v - b.d / 2 < .1 || v + b.d / 2 > rd - .1 || furnitureCollides(f, plan, furniture) || (accept && !accept(f))) continue;
        furniture.push(f); return f;
      }
      if (required) skipped.push(`${room.name}：${catalog[kind].name}需手動安排`);
    };
    if (room.kind === 'living') {
      place('sofa', [[rw * .42, .7], [rw * .42, rd - .7, 180], [.7, rd / 2, 90]], Math.min(2.7, rw - .5), .92, true);
      place('table', [[rw * .42, 1.9], [rw * .42, rd - 1.9], [1.9, rd / 2]], 1.1, .55);
      place('tv', [[rw * .42, rd - .37], [rw * .42, .37, 180], [rw - .37, rd / 2, 90]], Math.min(1.8, rw - .5), .38);
      place('plant', [[.48, .48], [rw - .48, .48], [rw - .48, rd - .48]], .45, .45);
    } else if ((room.kind === 'bedroom' || room.kind === 'master') && room.furnishing === 'bunk') {
      place('bunkBed', [[rw / 2, .72, 90], [rw / 2, rd - .72, 90], [.72, rd / 2], [rw - .72, rd / 2]], 1.05, 2.1, true);
      place('wardrobe', [[rw / 2, rd - .4], [rw / 2, .4]], Math.min(1.5, rw - .5), .55);
    } else if (room.kind === 'master' || room.kind === 'bedroom') {
      const bw = rw >= 3.1 ? 1.8 : 1.35, bd = 2;
      place('bed', [...(rd < 2.5 ? [[rw / 2, rd / 2] as [number, number]] : []), [rw / 2, 1.2] as [number, number], [rw / 2, rd - 1.2, 180] as [number, number, number], [1.2, rd / 2, 90] as [number, number, number], [rw - 1.2, rd / 2, -90] as [number, number, number]], bw, bd, true);
      place('wardrobe', [[rw / 2, rd - .42], [rw - .42, rd / 2, 90], [.42, rd / 2, 90]], Math.min(1.8, rw - .5), .58);
      if (rw > 3.4) place('plant', [[.4, .45], [rw - .4, .45]], .4, .4);
    } else if (room.kind === 'study' && room.furnishing === 'couple-work') {
      const workChairs = (desk: Furniture): Furniture[] => {
        const a = desk.rotation * Math.PI / 180;
        return [-.5, .5].map(u => ({ id: uid(), kind: 'chair', x: desk.x + Math.cos(a) * u - Math.sin(a) * .83, y: desk.y + Math.sin(a) * u + Math.cos(a) * .83, rotation: desk.rotation, w: .5, d: .52 }));
      };
      const desk = place('doubleDesk', [[rw / 2, .5], [rw - .5, rd / 2, 90], [.5, rd / 2, -90], [rw - .5, rd * .6, 90], [.5, rd * .6, -90], [rw / 2, rd - .5, 180]], 2, .65, true, candidate => {
        const chairs = workChairs(candidate);
        return chairs.every((c, i) => { const b = furnitureBounds(c); return c.x - b.w / 2 >= x + .1 && c.x + b.w / 2 <= x + rw - .1 && c.y - b.d / 2 >= y + .1 && c.y + b.d / 2 <= y + rd - .1 && !furnitureCollides(c, plan, [...furniture, candidate, ...chairs.slice(0, i)]); });
      });
      if (desk) {
        furniture.push(...workChairs(desk));
      }
      place('wardrobe', [[rw / 2, rd - .4], [rw / 2, .4]], Math.min(1.5, rw - .5), .55);
    } else if (room.kind === 'study') {
      place('desk', [[rw / 2, .5], [.5, rd / 2, 90], [rw / 2, rd - .5, 180]], Math.min(1.6, rw - .5), .65, true);
      place('chair', [[rw / 2, 1.3], [1.3, rd / 2, 90], [rw / 2, rd - 1.3, 180]], .58, .6);
      place('wardrobe', [[rw / 2, rd - .4], [rw - .4, rd / 2, 90]], Math.min(1.5, rw - .5), .55);
    } else if (room.kind === 'kitchen') {
      place('kitchen', [[.48, rd / 2, 90], [rw - .48, rd / 2, 90], [rw / 2, .48]], Math.min(2.5, rd - .6), .6, true);
    } else if (room.kind === 'bathroom') {
      place('toilet', [[.55, .66], [rw - .55, .66], [.55, rd - .66, 180]], .62, .78, true);
      place('shower', [[rw - .65, rd - .65], [.65, rd - .65]], 1, 1);
      place('kitchen', [[rw - .4, .66, 90], [.4, rd / 2, 90]], .75, .42);
    } else if (room.kind === 'dining') {
      place('table', [[rw / 2, rd / 2], [rw / 2, rd / 2, 90]], 1.35, .8, true);
      for (const u of [rw / 2 - .42, rw / 2 + .42]) place('chair', [[u, rd / 2 - .83]], .46, .46);
      for (const u of [rw / 2 - .42, rw / 2 + .42]) place('chair', [[u, rd / 2 + .83, 180]], .46, .46);
    } else if (room.kind === 'balcony') place('plant', [[.4, .4], [rw - .4, rd - .4]], .45, .45);
  }
  return { plan: { ...plan, furniture }, skipped };
}

/** Close door-sized gaps for room finding only; actual editable walls retain openings. */
export function findRooms(plan: Plan): Room[] {
  const cell = Math.max(.09, Math.max(plan.width, plan.depth) / 160), nx = Math.ceil(plan.width / cell), ny = Math.ceil(plan.depth / cell);
  const polygon = plan.outline || [{ x: 0, y: 0 }, { x: plan.width, y: 0 }, { x: plan.width, y: plan.depth }, { x: 0, y: plan.depth }];
  const blocked = new Uint8Array(nx * ny), walls = [...polygon.map((a, i) => ({ id: 'room-outline', a, b: polygon[(i + 1) % polygon.length], thickness: plan.wallThickness })), ...plan.walls];
  const roomWalls = [...walls];
  for (let i = 0; i < plan.walls.length; i++) for (let j = i + 1; j < plan.walls.length; j++) {
    const a = plan.walls[i], b = plan.walls[j];
    for (const p of [a.a, a.b]) for (const q of [b.a, b.b]) {
      const aligned = (Math.abs(a.a.x - a.b.x) < .05 && Math.abs(b.a.x - b.b.x) < .05 && Math.abs(p.x - q.x) < .12) || (Math.abs(a.a.y - a.b.y) < .05 && Math.abs(b.a.y - b.b.y) < .05 && Math.abs(p.y - q.y) < .12);
      if (aligned && Math.hypot(p.x - q.x, p.y - q.y) < 1.15) roomWalls.push({ id: 'room-gap', a: p, b: q, thickness: .12 });
    }
  }
  for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
    const p = { x: (ix + .5) * cell, y: (iy + .5) * cell }, r = { x: p.x - cell * .5, y: p.y - cell * .5, w: cell, d: cell };
    const excluded = plan.excludedAreas?.some(a => p.x >= a.x && p.x <= a.x + a.w && p.y >= a.y && p.y <= a.y + a.d), column = plan.columns?.some(c => Math.abs(p.x - c.x) <= c.w / 2 + cell / 2 && Math.abs(p.y - c.y) <= c.d / 2 + cell / 2);
    if (excluded || column || (plan.outline && !pointInPolygon(p, plan.outline)) || roomWalls.some(w => lineIntersectsRect(w.a, w.b, { x: r.x - w.thickness / 2, y: r.y - w.thickness / 2, w: cell + w.thickness, d: cell + w.thickness }))) blocked[iy * nx + ix] = 1;
  }
  const rooms: Room[] = [];
  for (let start = 0; start < blocked.length; start++) {
    if (blocked[start]) continue;
    const queue = [start]; blocked[start] = 2; let minx = nx, miny = ny, maxx = 0, maxy = 0, touchesEdge = false;
    for (let i = 0; i < queue.length; i++) {
      const at = queue[i], x = at % nx, y = Math.floor(at / nx);
      minx = Math.min(minx, x); miny = Math.min(miny, y); maxx = Math.max(maxx, x); maxy = Math.max(maxy, y);
      if (x === 0 || x === nx - 1 || y === 0 || y === ny - 1) touchesEdge = true;
      for (const [xx, yy] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) if (xx >= 0 && xx < nx && yy >= 0 && yy < ny && !blocked[yy * nx + xx]) { blocked[yy * nx + xx] = 2; queue.push(yy * nx + xx); }
    }
    const area = queue.length * cell * cell, w = (maxx - minx + 1) * cell, d = (maxy - miny + 1) * cell;
    if (touchesEdge || area < 1.4 || Math.min(w, d) < .85) continue;
    rooms.push({ id: uid(), name: '空間', kind: 'bedroom', areaEstimated: true, x: (minx + maxx + 1) * cell / 2, y: (miny + maxy + 1) * cell / 2, area, color: '#e6e2d5', bounds: { x: minx * cell, y: miny * cell, w, d } });
  }
  rooms.sort((a, b) => b.area - a.area);
  rooms.forEach((room, i) => { room.kind = i === 0 ? 'living' : room.area < 4.8 ? 'bathroom' : room.area < 7 ? 'study' : i === 1 ? 'master' : 'bedroom'; room.name = `${roomKinds.find(k => k.id === room.kind)!.name} ${i + 1}`; });
  return rooms.slice(0, 24);
}
