import { describe, expect, it } from 'vitest';
import { autoFurnish, furnitureCollides } from './autoFurnish';
import { furnitureBounds, isPlan, planArea } from './model';
import type { Furniture, Room } from './model';
import { createReferencePlan } from './referencePlan';

function inRoom(item: Furniture, room: Room) {
  const r = room.bounds!, b = furnitureBounds(item);
  return item.x - b.w / 2 >= r.x - 1e-8 && item.x + b.w / 2 <= r.x + r.w + 1e-8
    && item.y - b.d / 2 >= r.y - 1e-8 && item.y + b.d / 2 <= r.y + r.d + 1e-8;
}

describe('same-home reference transcription', () => {
  it('uses the measured main body and keeps conflicting dimension chains as observations', () => {
    const p = createReferencePlan();
    expect(isPlan(p)).toBe(true);
    expect(p.width).toBe(7.76); expect(p.depth).toBe(10.67);
    expect(p.exteriorLocked).toBe(true);
    expect(p.reconstruction?.needsReview).toBe(true);
    const dimensions = p.reconstruction!.dimensions;
    for (const [label, value] of [['上方尺寸鏈・175', 1.75], ['下方尺寸鏈・177.5', 1.775], ['上方尺寸鏈・223.5', 2.235], ['下方尺寸鏈・221', 2.21]] as const) {
      expect(dimensions.find(d => d.label.startsWith(label))).toMatchObject({ metres: value, status: 'read' });
    }
    expect(dimensions.every(d => d.label.includes('尺寸鏈'))).toBe(true);
    expect(p.reconstruction!.notes.join('\n')).toContain('不是房間室內淨長寬');
    expect(p.rooms.every(r => r.areaEstimated)).toBe(true);
    // No invented 1.6 m left projection, or rain cover turned into an interior room.
    expect(p.outline?.every(q => q.x >= 0 && q.x <= 7.76)).toBe(true);
    expect(p.rooms.filter(r => r.kind === 'balcony')).toHaveLength(1);
    expect(p.reconstruction!.notes.join('\n')).toContain('外推寬與曲線尺寸不明');
  });

  it('retains source-room identities while following the main 3D proposal for their uses', () => {
    const p = createReferencePlan();
    const child = p.rooms.find(r => r.sourceName === '臥室（一）')!;
    const study = p.rooms.find(r => r.sourceName === '臥室（二）')!;
    const living = p.rooms.find(r => r.kind === 'living')!;
    const kitchen = p.rooms.find(r => r.kind === 'kitchen')!;
    const master = p.rooms.find(r => r.kind === 'master')!;
    const balcony = p.rooms.find(r => r.kind === 'balcony')!;
    expect(child).toMatchObject({ kind: 'bedroom', furnishing: 'bunk' });
    expect(study).toMatchObject({ kind: 'study', furnishing: 'couple-work' });
    expect(child.x).toBeLessThan(kitchen.x); expect(kitchen.x).toBeLessThan(study.x);
    expect(living.y).toBeLessThan(child.y); expect(child.y).toBeLessThan(master.y);
    expect(study.y).toBeLessThan(balcony.y);
    expect(p.rooms.filter(r => r.kind === 'bathroom')).toHaveLength(2);
    expect(p.entry).toBe('right'); expect(p.entryPosition).toBeLessThan(.2);
    expect(p.reconstruction!.notes.join('\n')).toContain('與主 3D 相反');
  });

  it('keeps the unknown X region out of usable area and furnishing', () => {
    const p = createReferencePlan();
    const excluded = p.excludedAreas!;
    expect(excluded).toHaveLength(1);
    expect(excluded[0]).toMatchObject({ kind: 'unknown' });
    expect(excluded[0].name).toContain('用途');
    expect(p.rooms.some(r => r.name.includes('設備平台'))).toBe(false);
    expect(planArea(p)).toBeLessThan(p.width * p.depth);
    for (const plan of [p, autoFurnish(p).plan]) for (const f of plan.furniture) {
      const b = furnitureBounds(f);
      for (const e of excluded) {
        const overlaps = f.x + b.w / 2 > e.x && f.x - b.w / 2 < e.x + e.w
          && f.y + b.d / 2 > e.y && f.y - b.d / 2 < e.y + e.d;
        expect(overlaps, `${f.kind} overlaps the unknown region`).toBe(false);
      }
    }
    expect(p.columns!.length).toBeGreaterThan(0);
    expect(p.columns!.every(c => c.status === 'estimated')).toBe(true);
  });

  it('provides a bunk and two-person workspace that can be regenerated without moving the building', () => {
    const p = createReferencePlan();
    const child = p.rooms.find(r => r.furnishing === 'bunk')!;
    const study = p.rooms.find(r => r.furnishing === 'couple-work')!;
    expect(p.furniture.filter(f => f.kind === 'bunkBed' && inRoom(f, child))).toHaveLength(1);
    expect(p.furniture.filter(f => f.kind === 'doubleDesk' && inRoom(f, study))).toHaveLength(1);
    expect(p.furniture.filter(f => f.kind === 'chair' && inRoom(f, study))).toHaveLength(2);
    for (const [i, f] of p.furniture.entries()) {
      expect(furnitureCollides(f, p, p.furniture.slice(0, i)), `${f.kind} at ${f.x}, ${f.y}`).toBe(false);
    }
    const regenerated = autoFurnish(p).plan;
    expect(regenerated.walls).toEqual(p.walls);
    expect(regenerated.columns).toEqual(p.columns);
    expect(regenerated.excludedAreas).toEqual(p.excludedAreas);
    const withoutIds = (items: Furniture[]) => items.map(({ id: _, ...f }) => f);
    expect(withoutIds(regenerated.furniture)).toEqual(withoutIds(p.furniture));
  });
});
