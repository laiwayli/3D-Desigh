import { describe, expect, it } from 'vitest';
import { catalog, furnitureGroups, furnitureVariants, searchFurniture } from './furnitureCatalog';
import type { FurnitureKind } from './furnitureCatalog';

describe('furniture catalogue and physical size variants', () => {
  it('preserves saved kinds and offers distinct useful sizes for every type', () => {
    const kinds = Object.keys(catalog) as FurnitureKind[];
    expect(kinds).toHaveLength(43); expect(furnitureVariants.length).toBeGreaterThanOrEqual(86);
    const previous = ['sofa', 'chair', 'table', 'bed', 'bunkBed', 'doubleDesk', 'kitchen', 'plant', 'desk', 'toilet', 'shower', 'wardrobe', 'tv'];
    previous.forEach(kind => expect(kinds).toContain(kind));
    expect(new Set(furnitureVariants.map(v => v.id)).size).toBe(furnitureVariants.length);
    for (const kind of kinds) {
      const variants = furnitureVariants.filter(v => v.kind === kind);
      expect(variants.length, kind).toBeGreaterThanOrEqual(2);
      expect(new Set(variants.map(v => `${v.w}/${v.d}/${v.h}`)).size, kind).toBe(variants.length);
      expect(furnitureGroups).toContain(catalog[kind].group);
      for (const v of variants) for (const d of [v.w, v.d, v.h]) expect(Number.isFinite(d) && d > 0 && d <= 4, v.id).toBe(true);
    }
  });
  it('uses physically consistent footprints for round furniture and thin soft furnishings', () => {
    for (const v of furnitureVariants.filter(v => v.kind === 'roundTable')) expect(v.w).toBe(v.d);
    expect(furnitureVariants.filter(v => v.kind === 'rug').every(v => v.h < .05)).toBe(true);
    expect(furnitureVariants.filter(v => v.kind === 'curtain').every(v => v.d < .2 && v.h > 2)).toBe(true);
    expect(furnitureVariants.filter(v => v.kind === 'bunkBed').every(v => v.h >= 1.8)).toBe(true);
  });
  it('searches Chinese names, English kinds and use tags while respecting category', () => {
    expect(searchFurniture('沙發')).toEqual(expect.arrayContaining(['sofa', 'loveseat', 'sectionalSofa']));
    expect(searchFurniture('wfh')).toEqual(expect.arrayContaining(['doubleDesk', 'desk', 'officeChair']));
    expect(searchFurniture('小宅', '臥室')).toContain('crib');
    expect(searchFurniture('沙發', '廚房')).toEqual([]);
    expect(searchFurniture('沒有這種家具')).toEqual([]);
    expect(searchFurniture('  ', '全部')).toHaveLength(43);
  });
});
