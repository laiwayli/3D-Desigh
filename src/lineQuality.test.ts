import { describe, expect, it } from 'vitest';
import { assessWallLines } from './reconstructImage';
import type { LineRun } from './reconstructImage';

function grid(size: number): LineRun[] {
  return Array.from({ length: size }, (_, i) => (['h', 'v'] as const).map(axis => ({ axis, position: 20 + i * 20, start: 10, end: 890, thickness: 6, samples: 6 }))).flat();
}

describe('candidate line quality', () => {
  it('allows a simple room grid without claiming architectural accuracy', () => {
    const quality = assessWallLines(grid(3), 900, 900);
    expect(quality).toMatchObject({ horizontal: 3, vertical: 3, total: 6 });
    expect(quality.blockingReason).toBeUndefined();
  });
  it('rejects dense intersecting linework rather than silently taking the strongest lines', () => {
    expect(assessWallLines(grid(22), 900, 900).blockingReason).toContain('候選線過於密集');
    expect(assessWallLines(grid(45), 900, 900).blockingReason).toContain('90 段');
  });
  it('reports insufficient evidence for blank and single-direction drawings', () => {
    expect(assessWallLines([], 900, 900).blockingReason).toContain('尚未找到足夠的牆線');
    expect(assessWallLines(grid(3).filter(l => l.axis === 'h'), 900, 900).blockingReason).toContain('尚未找到足夠的牆線');
  });
});
