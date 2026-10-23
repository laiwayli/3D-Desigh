import { ArrowRight } from 'lucide-react';
import type { Plan } from './model';

export function ReferenceReview({ plan }: { plan: Plan }) {
  const mapped = plan.rooms.filter(r => r.sourceName && r.sourceName !== r.name && (r.kind === 'bedroom' || r.kind === 'study'));
  return <div className="reference-review" data-testid="reference-review">
    <strong>同一戶・原始圖 → 中央 3D 提案</strong>
    <p>建築位置依原始尺寸圖；裝修用途對照海報中央的 3D。</p>
    <div className="reference-room-mapping">{mapped.map((r, i) => <div key={r.id || i}><span>{r.sourceName}</span><ArrowRight size={11}/><strong>{r.name}</strong>{r.furnishing && <small>{r.furnishing === 'bunk' ? '上下舖' : '夫妻雙人 WFH'}</small>}</div>)}</div>
    <details><summary>兩張圖如何對照？</summary><p>海報右上小平面與中央 3D 的書房／小孩房用途有交換。本版採中央 3D 的左中兒童房、右中雙人書房，原始房名另行保留。</p><p>左上陽台的外凸寬度、左側雨遮與右下 X 區不能自行補成室內空間。</p></details>
  </div>;
}
