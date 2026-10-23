import { describe, expect, it } from 'vitest';
import { constrainFurniture, createPlan, entryGeometry, exteriorSegments, furnitureBounds, isPlan } from './model';
import type { Entry } from './model';

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
