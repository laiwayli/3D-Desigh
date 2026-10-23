import { autoFurnish } from './autoFurnish';
import { uid } from './model';
import type { Plan, Room, RoomKind } from './model';

/** Manual transcription of the supplied drawings; all geometry still needs review. */
export function createReferencePlan(): Plan {
  const width = 7.76, depth = 10.67;
  const p: Plan = {
    id: uid(), name: '同戶原圖重建・兒童房與雙人書房', width, depth,
    wallThickness: .18, height: 2.8, exteriorLocked: true,
    entry: 'right', entryPosition: .105, style: 'nordic',
    walls: [], furniture: [], rooms: [],
    outline: [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: depth }, { x: 0, y: depth }],
    // Approximate inward footprints of the two visible right-side solid blocks.
    // Their portions outside the measured main body cannot be sized from this photo.
    columns: [
      { id: uid(), x: 7.38, y: 3.02, w: .76, d: 1.12, status: 'estimated' },
      { id: uid(), x: 7.38, y: 10.08, w: .76, d: 1.18, status: 'estimated' },
    ],
    excludedAreas: [
      { id: uid(), name: '右下 X 區・用途與邊界待核', kind: 'unknown', x: 5.55, y: 7.795, w: 2.21, d: 2.875 },
    ],
    reconstruction: {
      method: 'reference', needsReview: true,
      dimensions: [
        { label: '主體寬・上方尺寸鏈（600 + 154.5 + 21.5 cm）', metres: 7.76, status: 'read' },
        { label: '主體寬・下方尺寸鏈（555 + 221 cm）', metres: 7.76, status: 'read' },
        { label: '總深・外側尺寸鏈（1067 cm）', metres: 10.67, status: 'read' },
        { label: '上方尺寸鏈・267.5 cm', metres: 2.675, status: 'read' },
        { label: '上方尺寸鏈・110 cm', metres: 1.10, status: 'read' },
        { label: '上方尺寸鏈・175 cm', metres: 1.75, status: 'read' },
        { label: '上方尺寸鏈・223.5 cm', metres: 2.235, status: 'read' },
        { label: '下方尺寸鏈・377.5 cm', metres: 3.775, status: 'read' },
        { label: '下方尺寸鏈・177.5 cm', metres: 1.775, status: 'read' },
        { label: '下方尺寸鏈・221 cm', metres: 2.21, status: 'read' },
        { label: '左側尺寸鏈・349.5 cm', metres: 3.495, status: 'read' },
        { label: '左側尺寸鏈・220 cm', metres: 2.20, status: 'read' },
        { label: '左側尺寸鏈・165 cm', metres: 1.65, status: 'read' },
        { label: '左側尺寸鏈・332.5 cm', metres: 3.325, status: 'read' },
        { label: '右側尺寸鏈・419.5 cm', metres: 4.195, status: 'read' },
        { label: '右側尺寸鏈・360 cm', metres: 3.60, status: 'read' },
        { label: '右側尺寸鏈・287.5 cm', metres: 2.875, status: 'read' },
      ],
      notes: [
        '兩張圖為同一戶的原始平面與設計示意；此版是人工轉錄，尚未完成結構及尺寸核對。',
        '圖上數值暫按公分解讀；7.76 × 10.67 m 是主體尺寸鏈包絡，不是房間室內淨長寬、實際室內面積或權狀面積。',
        '上方 175／223.5 cm 與下方 177.5／221 cm 分段不同，分別保留；未把它們強行當成同一組牆心或淨尺寸。',
        '牆線、門洞、房間範圍與右下 X 區邊界依照片比例估測，仍需原始 CAD 或現場核對；各房間面積僅為配置範圍估算。',
        '主 3D 採左中臥室（一）改上下舖小孩房、右中臥室（二）改雙人 WFH 書房。海報右上小平面的書房／小孩房用途與主 3D 相反，此處依主 3D 提案配置。',
        '左上外凸陽台可確認存在，但外推寬與曲線尺寸不明，暫不硬建；左側標示雨遮的區域不當成室內，也不自行把左下突出處判作陽台。',
        '右下打 X 區未見清楚用途標示，保留為用途待核區，不鋪設室內地板、不配置家具，未稱為設備平台。',
        '右側粗實塊以柱位的主體內側足跡估測呈現；左側粗實塊跨出尚未重建的外凸區，不能據此補造其尺寸。所有柱位仍待核對。',
        '外牆厚 18 cm、內牆厚 12 cm、層高 2.8 m 為可修改預設；家具為設計建議，可重配及手動調整。',
      ],
    },
  };

  // Dimension chains help locate approximate partitions; they do not establish clear widths.
  const wall = (x: number, y: number, xx: number, yy: number) => p.walls.push({ id: uid(), a: { x, y }, b: { x: xx, y: yy }, thickness: .12 });
  wall(0, 3.495, 2.675, 3.495);
  wall(2.675, 3.495, 2.675, 3.75); wall(2.675, 4.6, 2.675, 7.345);
  wall(0, 5.695, 1.82, 5.695); wall(2.55, 5.695, 2.675, 5.695);
  wall(0, 7.345, 2.82, 7.345); wall(3.67, 7.345, 3.775, 7.345);
  wall(3.775, 4.195, 3.775, 4.45); wall(3.775, 5.3, 3.775, 8.9); wall(3.775, 9.75, 3.775, depth);
  wall(5.55, 2.42, width, 2.42); wall(5.55, 2.42, 5.55, 3.15); wall(5.55, 4.02, 5.55, 7.795);
  wall(3.775, 4.195, 5.55, 4.195);
  wall(5.55, 6.12, 6.65, 6.12); wall(7.5, 6.12, width, 6.12);
  wall(3.775, 7.795, width, 7.795); wall(5.55, 7.795, 5.55, depth);

  const room = (name: string, kind: RoomKind, x: number, y: number, w: number, d: number, details: Pick<Room, 'sourceName' | 'furnishing'> = {}) => {
    p.rooms.push({ id: uid(), name, kind, x: x + w / 2, y: y + d / 2, area: w * d, areaEstimated: true, color: '#e7e0d0', bounds: { x, y, w, d }, ...details });
  };
  room('客廳', 'living', 0, 0, 3.65, 3.495, { sourceName: '客廳' });
  room('餐廳', 'dining', 3.775, 0, 1.775, 4.195, { sourceName: '餐廳' });
  room('玄關', 'hall', 5.55, 0, 2.21, 2.42);
  room('小孩房（上下舖）', 'bedroom', 0, 3.495, 2.675, 2.2, { sourceName: '臥室（一）', furnishing: 'bunk' });
  room('客衛浴', 'bathroom', 0, 5.695, 2.675, 1.65);
  room('走道', 'hall', 2.675, 3.495, 1.10, 3.85);
  room('主臥室', 'master', 0, 7.345, 3.775, 3.325, { sourceName: '主臥室' });
  room('主臥衛浴', 'bathroom', 3.775, 7.795, 1.775, 2.875);
  room('廚房', 'kitchen', 3.775, 4.195, 1.775, 3.6, { sourceName: '廚房' });
  room('雙人 WFH 書房', 'study', 5.55, 2.42, 2.21, 3.7, { sourceName: '臥室（二）', furnishing: 'couple-work' });
  room('右側陽台', 'balcony', 5.55, 6.12, 2.21, 1.675, { sourceName: '陽台' });

  return autoFurnish(p).plan;
}
