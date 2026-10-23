import { describe, expect, it } from 'vitest';
import { autoFurnish, findRooms, furnitureCollides } from './autoFurnish';
import { interiorStyles } from './interiorStyles';
import { createReferencePlan } from './referencePlan';
import { createPlan, isPlan, planArea } from './model';
import { extractWallLines } from './reconstructImage';

describe('reference plan rebuilt from the supplied drawing', () => {
  it('uses the transcribed main-body dimensions without inventing a balcony extension', () => {
    const p = createReferencePlan();
    expect(isPlan(p)).toBe(true); expect(p.depth).toBe(10.67);
    expect(p.reconstruction?.dimensions.find(d => d.label.startsWith('主體寬'))?.metres).toBe(7.76);
    expect(p.reconstruction?.needsReview).toBe(true); expect(p.reconstruction?.method).toBe('reference');
    expect(p.width).toBe(7.76); expect(planArea(p)).toBeLessThan(p.width * p.depth);
    expect(p.excludedAreas?.some(a => a.kind === 'unknown')).toBe(true);
  });
  it('places real furniture sizes without intersecting walls or other furniture', () => {
    const p = createReferencePlan();
    expect(p.furniture.length).toBeGreaterThan(14);
    expect(p.furniture.filter(f => f.kind === 'bed')).toHaveLength(1);
    expect(p.furniture.filter(f => f.kind === 'bunkBed')).toHaveLength(1);
    expect(p.furniture.some(f => f.kind === 'doubleDesk')).toBe(true);
    expect(p.furniture.some(f => f.kind === 'tv')).toBe(true);
    p.furniture.forEach((f, i) => expect(furnitureCollides(f, p, p.furniture.slice(0, i)), `${f.kind} at ${f.x}, ${f.y}`).toBe(false));
    const twice = autoFurnish(p).plan;
    expect(twice.walls).toEqual(p.walls);
    expect(twice.furniture.map(({ id: _, ...f }) => f)).toEqual(p.furniture.map(({ id: _, ...f }) => f));
  });
});

describe('local line detection and rooms', () => {
  it('finds wall runs on shaded paper and ignores blank images', () => {
    const w = 400, h = 300, pixels = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, gray = Math.round(160 + x / 5); pixels.set([gray, gray, gray, 255], i); }
    expect(extractWallLines(pixels, w, h)).toHaveLength(0);
    const line = (x0: number, y0: number, x1: number, y1: number) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) pixels.set([25, 25, 25, 255], (y * w + x) * 4); };
    line(30, 25, 370, 31); line(30, 265, 370, 271); line(30, 25, 36, 271); line(364, 25, 370, 271); line(198, 25, 204, 271); line(30, 145, 370, 151);
    const lines = extractWallLines(pixels, w, h);
    expect(lines.filter(l => l.axis === 'h').length).toBeGreaterThanOrEqual(3);
    expect(lines.filter(l => l.axis === 'v').length).toBeGreaterThanOrEqual(3);
    expect(lines.some(l => l.axis === 'v' && Math.abs(l.position - 201) < 5)).toBe(true);
  });
  it('closes external entrance gaps for room finding without modifying editable walls', () => {
    const p = { ...createPlan(), walls: [{ id: 'partition', a: { x: 6, y: 0 }, b: { x: 6, y: 9 }, thickness: .12 }] };
    const rooms = findRooms(p); expect(rooms).toHaveLength(2); expect(p.walls).toHaveLength(1);
    expect(rooms.every(r => r.bounds && r.area > 40)).toBe(true);
  });
});

describe('ten editable interior styles', () => {
  it('provides ten distinct palettes and validates persisted selections', () => {
    expect(interiorStyles).toHaveLength(10); expect(new Set(interiorStyles.map(s => s.id)).size).toBe(10);
    expect(new Set(interiorStyles.map(s => `${s.wall}/${s.floor}/${s.fabric}`)).size).toBe(10);
    for (const style of interiorStyles) expect(isPlan({ ...createReferencePlan(), style: style.id })).toBe(true);
    expect(isPlan({ ...createPlan(), style: 'unknown' })).toBe(false);
    expect(isPlan({ ...createReferencePlan(), outline: [{ x: NaN, y: 0 }] })).toBe(false);
  });
});
