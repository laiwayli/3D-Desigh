import { catalog, clamp } from './model';
import type { Furniture, FurnitureFinish } from './model';
import './furnitureAppearance.css';

const finishes: { id: FurnitureFinish; name: string }[] = [
  { id: 'style', name: '跟隨整體風格' }, { id: 'wood', name: '實木／木皮' }, { id: 'fabric', name: '織布' }, { id: 'leather', name: '皮革' }, { id: 'stone', name: '石材' }, { id: 'metal', name: '金屬' },
];
export function FurnitureAppearance({ item, roomHeight, onChange }: { item: Furniture; roomHeight: number; onChange: (next: Furniture) => void }) {
  const isDesk = ['desk', 'doubleDesk', 'table', 'roundTable', 'coffeeTable', 'sideTable'].includes(item.kind);
  const isCounter = ['kitchen', 'kitchenIsland', 'vanity'].includes(item.kind);
  return <section className="furniture-appearance" aria-label="家具外觀設定">
    <label>{isDesk ? "桌面高度" : isCounter ? "檯面高度" : item.kind === "pendant" ? "燈罩高度" : "家具總高"}<div className="input-unit"><input aria-label="家具高度" type="number" min=".01" max={Math.min(roomHeight, 5)} step=".01" value={item.h ?? catalog[item.kind].h} onChange={e => { const h = Number(e.target.value); if (h > 0) onChange({ ...item, h: clamp(h, .01, Math.min(roomHeight, 5)) }); }}/><span>m</span></div></label>
    <label>表面材質<select aria-label="家具表面材質" value={item.finish || 'style'} onChange={e => onChange({ ...item, finish: e.target.value as FurnitureFinish })}>{finishes.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
    <div className="furniture-color-row"><label>自訂主色<input aria-label="家具主色" type="color" value={item.color || '#d2b58c'} onChange={e => onChange({ ...item, color: e.target.value })}/></label><button className="text-button" onClick={() => onChange({ ...item, color: undefined, finish: 'style' })}>跟隨風格配色</button></div>
    <p>單獨調整高度、表面和主色。桌／檯面高度以主體為準，螢幕、鏡面與龍頭另計；吊燈依層高懸掛。</p>
  </section>;
}
