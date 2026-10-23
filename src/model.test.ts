import { describe, expect, it } from 'vitest';
import { calibrateUnderlay, constrainFurniture, createPlan, entryGeometry, exteriorSegments, fitUnderlay, furnitureBounds, isPlan, resizePlanDimensions } from './model';
import type { Entry, Underlay } from './model';

describe('layout generation', () => {
  for (const entry of ['left', 'right', 'top', 'bottom'] as Entry[]) {
    for (const variant of [0, 1, 2]) {
      it(`preserves a 12 × 9 shell with a usable opening: ${entry}, variant ${variant}`, () => {
        const plan = createPlan(variant, entry);
        expect(isPlan(plan)).toBe(true);
        expect(plan.width).toBe(12); expect(plan.depth).toBe(9);
        const segments = exteriorSegments(plan);
        const length = segments.reduce((sum, s) => sum + Math.hypot(s.a.x - s.b.x, s.a.y - s.b.y), 0);
        expect(length).toBeCloseTo(42 - 1.05);
        const opening = entryGeometry(plan);
        expect(Math.hypot(opening.a.x - opening.b.x, opening.a.y - opening.b.y)).toBeCloseTo(1.05);
        plan.furniture.forEach(f => {
          const b = furnitureBounds(f);
          expect(f.x - b.w / 2).toBeGreaterThanOrEqual(plan.wallThickness / 2);
          expect(f.y - b.d / 2).toBeGreaterThanOrEqual(plan.wallThickness / 2);
          expect(f.x + b.w / 2).toBeLessThanOrEqual(plan.width - plan.wallThickness / 2);
          expect(f.y + b.d / 2).toBeLessThanOrEqual(plan.depth - plan.wallThickness / 2);
        });
        expect(plan.rooms.reduce((sum, r) => sum + r.area, 0)).toBeLessThan(plan.width * plan.depth);
      });
    }
  }
  it('generates distinct partitions for all three proposals', () => {
    expect(new Set([0, 1, 2].map(i => createPlan(i).walls.length)).size).toBe(3);
  });
  it('mirrors the interior and entry together without changing the exterior', () => {
    const left = createPlan(0, 'left'), right = createPlan(0, 'right');
    expect(right.walls[0].a.x).toBeCloseTo(left.width - left.walls[0].a.x);
    expect(right.walls[0].a.y).toBe(left.walls[0].a.y);
    expect(entryGeometry(right).a.x).toBe(12);
  });
  it('maps the original entry and nearby kitchen onto the chosen top or bottom boundary', () => {
    const source = createPlan(0, 'left');
    const top = createPlan(0, 'top'), bottom = createPlan(0, 'bottom');
    const originalEntry = entryGeometry(source);
    expect(entryGeometry(top).a.y).toBe(0);
    expect(entryGeometry(bottom).a.y).toBe(source.depth);
    const originalCenter = (originalEntry.a.y + originalEntry.b.y) / 2;
    expect((entryGeometry(top).a.x + entryGeometry(top).b.x) / 2).toBeCloseTo(originalCenter / source.depth * source.width);
    expect((entryGeometry(bottom).a.x + entryGeometry(bottom).b.x) / 2).toBeCloseTo((1 - originalCenter / source.depth) * source.width);
    expect(top.walls[0].a.y).toBeCloseTo(source.walls[0].a.x / source.width * source.depth);
    expect(bottom.walls[0].a.y).toBeCloseTo((1 - source.walls[0].a.x / source.width) * source.depth);
  });
  it('honors custom boundary dimensions', () => {
    const p = createPlan(2, 'bottom', 16, 11);
    expect(isPlan(p)).toBe(true);
    expect(exteriorSegments(p).reduce((n, w) => n + Math.hypot(w.a.x - w.b.x, w.a.y - w.b.y), 0)).toBeCloseTo(54 - 1.05);
    expect(p.walls.every(w => [w.a, w.b].every(q => q.x >= 0 && q.x <= 16 && q.y >= 0 && q.y <= 11))).toBe(true);
  });
});

describe('dimensions and calibrated drawings', () => {
  const underlay: Underlay = { id: 'drawing', name: 'floor.png', src: 'data:image/png;base64,AAAA', pixelWidth: 600, pixelHeight: 400, x: 0, y: 0, width: 12, height: 8, visible: true, opacity: .7 };
  it('requires an explicit unlock and accepts exact dimensions without changing physical furniture size', () => {
    const p = createPlan(); expect(() => resizePlanDimensions(p, 3.625, 4.5)).toThrow('解鎖');
    const next = resizePlanDimensions({ ...p, exteriorLocked: false }, 14.625, 10.125);
    expect(next.width).toBe(14.625); expect(next.depth).toBe(10.125);
    expect(next.walls[0].a.x).toBeCloseTo(p.walls[0].a.x * 14.625 / 12);
    expect(next.furniture[0].x).toBeCloseTo(p.furniture[0].x * 14.625 / 12);
    expect(next.furniture[0].w).toBe(p.furniture[0].w);
    expect(next.rooms).toEqual([]);
    expect(isPlan(next)).toBe(true);
    expect(() => resizePlanDimensions({ ...p, exteriorLocked: false }, 0, 8)).toThrow();
  });
  it('fits a picture with its aspect ratio intact', () => {
    const u = fitUnderlay(underlay, { width: 12, depth: 9 });
    expect(u.width).toBe(12); expect(u.height).toBe(8); expect(u.y).toBe(.5);
  });
  it('uses the stated length to scale around the first picked point exactly', () => {
    const a = { x: 1, y: 1 }, b = { x: 5, y: 1 }, u = calibrateUnderlay(underlay, a, b, 3.6);
    expect(u.width).toBeCloseTo(10.8); expect(u.height).toBeCloseTo(7.2); expect(u.x).toBeCloseTo(.1); expect(u.y).toBeCloseTo(.1);
    expect((a.x - u.x) / u.width).toBeCloseTo((a.x - underlay.x) / underlay.width);
    expect(u.calibratedDistance).toBe(3.6);
    expect(() => calibrateUnderlay(underlay, a, a, 3)).toThrow();
    expect(() => calibrateUnderlay(underlay, a, b, NaN)).toThrow();
  });
  it('keeps imported images through JSON restoration and rejects external image URLs', () => {
    expect(isPlan({ ...createPlan(), underlay })).toBe(true);
    expect(isPlan({ ...createPlan(), underlay: { ...underlay, src: 'https://external.example/image.png' } })).toBe(false);
    expect(isPlan({ ...createPlan(), underlay: { ...underlay, width: Infinity } })).toBe(false);
  });
  it('preserves measured drawing scale when the exterior dimensions change', () => {
    const p = { ...createPlan(), exteriorLocked: false, underlay: { ...underlay, calibratedDistance: 3.6 } };
    const next = resizePlanDimensions(p, 18, 9);
    expect(next.underlay?.width).toBe(12); expect(next.underlay?.height).toBe(8); expect(next.underlay?.calibratedDistance).toBe(3.6);
  });
});

describe('editing and restoration safety', () => {
  it('keeps a rotated, oversized furniture block inside the exterior', () => {
    const p = createPlan(), f = constrainFurniture({ id: 'big', kind: 'sofa', x: -10, y: 30, w: 20, d: 8, rotation: 45 }, p), b = furnitureBounds(f);
    expect(f.w).toBeLessThan(20);
    expect(f.x - b.w / 2).toBeGreaterThanOrEqual(p.wallThickness / 2);
    expect(f.y + b.d / 2).toBeLessThanOrEqual(p.depth - p.wallThickness / 2);
  });
  it('accepts serialized plans and rejects malformed stored data', () => {
    expect(isPlan(JSON.parse(JSON.stringify(createPlan())))).toBe(true);
    expect(isPlan(null)).toBe(false);
    expect(isPlan({ ...createPlan(), width: -1 })).toBe(false);
    expect(isPlan({ ...createPlan(), furniture: [{ kind: 'unknown' }] })).toBe(false);
    expect(isPlan({ ...createPlan(), walls: [{ a: { x: NaN, y: 0 } }] })).toBe(false);
    expect(isPlan({ ...createPlan(), walls: [null] })).toBe(false);
  });
});
