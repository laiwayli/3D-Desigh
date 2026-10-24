import { describe, expect, it } from 'vitest';
import { createPlan, isPlan } from './model';
import { catalog, furnitureVariants } from './furnitureCatalog';

describe('editable furniture data', () => {
  it('round-trips every catalog kind with its height and individual surface settings', () => {
    const plan = createPlan();
    plan.furniture = Object.keys(catalog).map(kind => {
      const entry = furnitureVariants.find(v => v.kind === kind)!;
      return { id: crypto.randomUUID(), kind: entry.kind, assetId: entry.id, x: 4, y: 4, w: entry.w, d: entry.d, h: entry.h, rotation: 0, color: '#486d87', finish: 'leather' as const };
    });
    const restored = JSON.parse(JSON.stringify(plan));
    expect(isPlan(restored)).toBe(true); expect(restored.furniture).toEqual(plan.furniture);
    expect(isPlan(createPlan())).toBe(true); // Older data has no appearance fields.
  });
  it('rejects malformed appearance data without rejecting existing projects', () => {
    const plan = createPlan(), item = plan.furniture[0];
    for (const extra of [{ h: NaN }, { h: -1 }, { h: 7 }, { color: 'url(external)' }, { color: '#123' }, { finish: 'unknown' }, { assetId: 3 }]) {
      expect(isPlan({ ...plan, furniture: [{ ...item, ...extra }] })).toBe(false);
    }
  });
});
