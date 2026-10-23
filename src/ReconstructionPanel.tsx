import { Armchair, CheckCheck, Columns3, RotateCw, WandSparkles } from 'lucide-react';
import { roomKinds } from './autoFurnish';
import type { Plan, RoomKind } from './model';
import { ReferenceReview } from './ReferenceReview';
import './referenceReview.css';

type Furnishing = 'bunk' | 'couple-work';
type Props = {
  plan: Plan;
  onRecalculate: () => void;
  onFurnish: () => void;
  onRoomKind: (index: number, kind: RoomKind) => void;
  onRoomFurnishing?: (index: number, furnishing: Furnishing | undefined) => void;
  onReviewed: () => void;
};

export function ReconstructionPanel({ plan, onRecalculate, onFurnish, onRoomKind, onRoomFurnishing, onReviewed }: Props) {
  const reconstruction = plan.reconstruction;
  if (!reconstruction) return null;
  const reference = reconstruction.method === 'reference';
  const columns = plan.columns || [], excluded = plan.excludedAreas || [];
  const dimensions = reconstruction.dimensions;
  const depthIndex = dimensions.findIndex(d => /總深|深度|主體深|主體總深/.test(d.label));
  const primaryIndices = dimensions.length ? [0, ...(depthIndex > 0 ? [depthIndex] : dimensions.length > 1 ? [1] : [])] : [];
  const primaryDimensions = dimensions.filter((_, i) => primaryIndices.includes(i));
  const otherDimensions = dimensions.filter((_, i) => !primaryIndices.includes(i));
  const dimensionRow = (d: (typeof dimensions)[number], i: number) => <div key={`${d.label}-${i}`}><span>{d.label}</span><strong>{d.metres.toFixed(3)} m<small>{d.status === 'read' ? reference ? '圖上讀值・非淨尺寸' : '使用者輸入值' : '估算・待核'}</small></strong></div>;
  return <div className="reconstruction-panel quick-review">
    <div className="section-title"><span>重建與家具配置</span><WandSparkles size={14}/></div>
    <div className={`review-badge ${reconstruction.needsReview ? '' : 'checked'}`}>{reconstruction.needsReview ? '辨識／重建草稿・請核對尺寸' : '已由使用者核對'}</div>
    {reference && <ReferenceReview plan={plan}/>}

    <section className="review-step" aria-label="核對尺寸">
      <h3><span>1</span>核對尺寸</h3>
      <div className="dimension-transcription">{primaryDimensions.map(dimensionRow)}</div>
      {otherDimensions.length > 0 && <details><summary>查看其餘 {otherDimensions.length} 項尺寸</summary><div className="dimension-transcription">{otherDimensions.map(dimensionRow)}</div></details>}
      <p className="review-note">{reference ? '尺寸鏈用來定位建築；牆厚、柱位與房間淨尺寸需分別核對。' : '總寬深需與框選的主體範圍一致；房間用途由你核對。'}</p>
    </section>

    <section className="review-step" aria-label="核對結構">
      <h3><span>2</span>核對結構</h3>
      <div className="structure-review-summary"><Columns3 size={14}/><span>{columns.length ? `${columns.length} 處柱位` : '檢查柱位與門洞'}{columns.some(c => c.status === 'estimated') && <small>含估測・待核</small>}</span><strong>{excluded.length ? `${excluded.length} 處排除區` : '核對外框與入口'}</strong></div>
      {excluded.length > 0 && <p className="review-note excluded-review-note">{excluded.map(a => a.name).join('、')}：保留標記，不配置家具，不計入室內可用面積。</p>}
      <details><summary>重建依據與待核對項目</summary><ul>{reconstruction.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></details>
    </section>

    <section className="review-step" aria-label="核對空間用途與家具">
      <h3><span>3</span>用途與家具</h3>
      <details className="room-review-details" open={!reference}>
        <summary>調整 {plan.rooms.length} 個空間的用途／家具</summary>
        <div className="room-kind-editors">
          {plan.rooms.map((r, i) => <div className="room-review-editor" key={r.id || i}>
            <div className="room-review-name"><strong>{r.name}</strong>{r.sourceName && r.sourceName !== r.name && <small>原圖：{r.sourceName}</small>}</div>
            <label><span>空間用途</span><select aria-label={`${r.name}用途`} value={r.kind || 'bedroom'} onChange={e => onRoomKind(i, e.target.value as RoomKind)}>{roomKinds.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}</select></label>
            {onRoomFurnishing && ['bedroom', 'master', 'study'].includes(r.kind || '') && <label><span>預設家具</span><select aria-label={`${r.name}家具方案`} value={r.furnishing || ''} onChange={e => onRoomFurnishing(i, e.target.value ? e.target.value as Furnishing : undefined)}><option value="">一般配置</option>{r.kind === 'study' ? <option value="couple-work">雙人工作位</option> : <option value="bunk">上下舖</option>}</select></label>}
          </div>)}
        </div>
      </details>
      <button className="button full-width" onClick={onFurnish}><Armchair size={13}/>依空間用途重新配置家具</button>
      <p className="review-note">變更家具方案後按上方按鈕套用；會取代目前家具，可復原。放不下的家具會略過。</p>
      <details className="recalculate-review"><summary>隔間已修改？</summary><p className="review-note">重算會重新推測房間用途，原有房名與家具方案需再次核對。</p><button className="button full-width secondary" onClick={onRecalculate}><RotateCw size={12}/>重算房間並配置家具</button></details>
    </section>
    {reconstruction.needsReview && <button className="text-button mark-reviewed" onClick={onReviewed}><CheckCheck size={12}/>我已核對尺寸、門洞與空間用途</button>}
  </div>;
}
