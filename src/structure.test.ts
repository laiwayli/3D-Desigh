import { describe, expect, it } from 'vitest';
import { furnitureCollides, findRooms } from './autoFurnish';
import { createPlan, isPlan, planArea, resizePlanDimensions } from './model';
import type { ExcludedArea } from './model';

const excluded = (x: number, y: number, w: number, d: number): ExcludedArea => ({ id: crypto.randomUUID(), name: '用途待核', kind: 'unknown', x, y, w, d });
describe('structural obstacles and unknown areas', () => {
  it('subtracts the union of excluded regions only inside the footprint', () => {
    const p = { ...createPlan(), width: 10, depth: 10, walls: [], excludedAreas: [excluded(8, 8, 4, 4), excluded(7, 7, 2, 2)] };
    expect(planArea(p)).toBe(93); // 4 + 4 minus their 1m² overlap, clipped at the exterior.
    expect(planArea({ ...p, outline: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }] })).toBe(50);
  });
  it('prevents automatic furniture and room finding from treating unknown regions as usable floor', () => {
    const p = { ...createPlan(), walls: [], columns: [{ id: 'column', x: 3, y: 3, w: 1, d: 1, status: 'estimated' as const }], excludedAreas: [excluded(6, 0, 6, 9)] };
    const bed = { id: 'bed', kind: 'bed' as const, x: 3, y: 3, w: 1.8, d: 2.1, rotation: 0 };
    expect(furnitureCollides(bed, p, [])).toBe(true);
    expect(furnitureCollides({ ...bed, x: 8, y: 5 }, p, [])).toBe(true);
    expect(findRooms(p).every(r => r.x < 6)).toBe(true);
  });
  it('retains structural masks through JSON and resizes them with the model', () => {
    const p = { ...createPlan(), exteriorLocked: false, columns: [{ id: 'column', x: 3, y: 3, w: .6, d: .8, status: 'read' as const }], excludedAreas: [excluded(10, 7, 2, 2)] };
    expect(isPlan(JSON.parse(JSON.stringify(p)))).toBe(true);
    const resized = resizePlanDimensions(p, 24, 18);
    expect(resized.columns![0]).toMatchObject({ x: 6, y: 6, w: 1.2, d: 1.6, status: 'estimated' });
    expect(resized.excludedAreas![0]).toMatchObject({ x: 20, y: 14, w: 4, d: 4 });
    expect(isPlan({ ...p, columns: [{ ...p.columns[0], w: -1 }] })).toBe(false);
    expect(isPlan({ ...p, rooms: [{ ...p.rooms[0], furnishing: 'made-up' }] })).toBe(false);
  });
});
