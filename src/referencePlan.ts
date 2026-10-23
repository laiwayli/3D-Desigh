import { autoFurnish } from './autoFurnish';
import { uid } from './model';
import type { Plan, RoomKind } from './model';

/** A reviewed transcription of the user's supplied drawing, not an image-recognition result. */
export function createReferencePlan(): Plan {
  const L = 1.6, width = L + 7.76, depth = 10.67;
  const p: Plan = {
    id: uid(), name: '原圖重建・三房兩衛', width, depth, wallThickness: .18, height: 2.8, exteriorLocked: true, entry: 'right', entryPosition: .105, style: 'nordic', walls: [], furniture: [], rooms: [],
    outline: [{ x: .25, y: 0 }, { x: width, y: 0 }, { x: width, y: depth }, { x: 0, y: depth }, { x: 0, y: 9.55 }, { x: L, y: 9.55 }, { x: L, y: 2.645 }, { x: .25, y: 2.645 }, { x: 0, y: 2.2 }, { x: 0, y: .3 }],
    reconstruction: { method: 'reference', needsReview: true, dimensions: [
      { label: '主體寬（555 + 221 cm）', metres: 7.76, status: 'read' }, { label: '總深（1067 cm）', metres: 10.67, status: 'read' }, { label: '左次臥寬（267.5 cm）', metres: 2.675, status: 'read' }, { label: '左次臥深（220 cm）', metres: 2.2, status: 'read' }, { label: '左衛浴深（165 cm）', metres: 1.65, status: 'read' }, { label: '主臥寬（377.5 cm）', metres: 3.775, status: 'read' }, { label: '主臥深（332.5 cm）', metres: 3.325, status: 'read' }, { label: '左側陽台外推', metres: L, status: 'estimated' },
    ], notes: ['依本次提供的圖面人工重建，非自動辨識結果。', '主體採 7.76 × 10.67 m；含左側陽台的外框寬約 9.36 m。', '圖上尺寸暫按公分解讀；陽台外推、柱位、右側分區與門洞需核對原始 CAD／現場。', '保留主臥、次臥、書房／客房、廚房與兩間衛浴；家具為可修改的預設建議。'] },
  };
  const wall = (x: number, y: number, xx: number, yy: number, t = .12) => p.walls.push({ id: uid(), a: { x: L + x, y }, b: { x: L + xx, y: yy }, thickness: t });
  wall(0, 0, 0, 1.1, .16); wall(0, 2, 0, 2.645, .16); wall(0, 9.55, 0, 9.8, .16);
  wall(0, 3.495, 2.675, 3.495); wall(2.675, 3.495, 2.675, 3.75); wall(2.675, 4.6, 2.675, 7.345);
  wall(0, 5.695, 1.82, 5.695); wall(2.55, 5.695, 2.675, 5.695); wall(0, 7.345, 2.82, 7.345); wall(3.67, 7.345, 3.775, 7.345);
  wall(3.775, 4.195, 3.775, 4.45); wall(3.775, 5.3, 3.775, 8.9); wall(3.775, 9.75, 3.775, 10.67);
  wall(5.55, 2.42, 7.76, 2.42); wall(5.55, 2.42, 5.55, 3.15); wall(5.55, 4.02, 5.55, 7.795);
  wall(3.775, 4.195, 5.55, 4.195); wall(5.55, 6.12, 6.65, 6.12); wall(7.5, 6.12, 7.76, 6.12);
  wall(3.775, 7.795, 7.76, 7.795); wall(5.55, 7.795, 5.55, 10.67);
  const room = (name: string, kind: RoomKind, x: number, y: number, w: number, d: number) => p.rooms.push({ id: uid(), name, kind, x: L + x + w / 2, y: y + d / 2, area: w * d, color: '#e7e0d0', bounds: { x: L + x, y, w, d } });
  room('客廳', 'living', 0, 0, 5.45, 3.37); room('餐廳', 'dining', 2.8, 1.7, 2.6, 2.5);
  room('次臥／兒童房', 'bedroom', 0, 3.495, 2.675, 2.2); room('客衛浴', 'bathroom', 0, 5.695, 2.675, 1.65);
  room('主臥室', 'master', 0, 7.345, 3.775, 3.325); room('主臥衛浴', 'bathroom', 3.775, 7.795, 1.775, 2.875);
  room('廚房', 'kitchen', 3.775, 4.195, 1.775, 3.6); room('書房／客房', 'study', 5.55, 2.42, 2.21, 3.7);
  room('生活陽台', 'balcony', 5.55, 6.12, 2.21, 1.675); room('設備平台（待核）', 'service', 5.55, 7.795, 2.21, 2.875);
  p.rooms.push({ id: uid(), name: '前陽台（待核）', kind: 'balcony', x: .8, y: 1.3, area: 3.8, color: '#dce4d1', bounds: { x: .2, y: .25, w: 1.2, d: 2.1 } });
  return autoFurnish(p).plan;
}
