import { Check, Layers3, Palette, X } from 'lucide-react';
import { interiorStyles } from './interiorStyles';
import type { StyleId } from './interiorStyles';
import { StyleRoomPreview, useStyleRoomPreviews } from './StyleRoomPreview';
import './stylePreview.css';

export function StylePicker({ selected = 'nordic', onSelect, onClose }: { selected?: StyleId; onSelect: (id: StyleId) => void; onClose: () => void }) {
  const { previews, completed, status } = useStyleRoomPreviews(selected);
  return <div className="modal-backdrop" onClick={onClose}><section className="modal style-modal style-model-gallery" role="dialog" aria-modal="true" aria-labelledby="style-title" onClick={e => e.stopPropagation()}>
    <button className="icon-button modal-close" onClick={onClose} aria-label="關閉風格選擇"><X size={20}/></button>
    <div className="modal-eyebrow"><Palette size={15}/>ONE ROOM, TEN DISTINCT STYLES</div>
    <h2 id="style-title">看見造型，也看見材質。</h2>
    <p className="modal-intro">以同一間客廳、同一組家具與相同視角比較十種風格。套用後會調整家具造型、表面材質與光線，保留原本的格局、位置與尺寸。</p>
    <div className="style-preview-explainer"><Layers3 size={16}/><span>沙發扶手與椅腳、桌腳、櫃門、織品及燈具都有對應造型。</span><small role="status">{status === 'unavailable' ? '此裝置無法繪製縮圖；仍可選擇風格。' : completed === interiorStyles.length ? '10 種實際模型預覽已備妥' : `實際模型預覽 ${completed} / ${interiorStyles.length}`}</small></div>
    <div className="style-gallery">{interiorStyles.map(s => <button key={s.id} className={`style-choice ${s.id === selected ? 'selected' : ''}`} aria-pressed={s.id === selected} onClick={() => onSelect(s.id)}>
      <div className="style-preview-wrap"><StyleRoomPreview style={s} src={previews[s.id]} unavailable={status === 'unavailable'}/><span className="style-selection-dot">{s.id === selected && <Check size={13}/>}</span></div>
      <div className="style-choice-text"><span>{s.english}</span><strong>{s.name}</strong><p>{s.description}</p>
        <div className="style-feature-pills">{s.features.slice(0, 3).map(feature => <i key={feature}>{feature}</i>)}</div>
        <div className="style-material-notes">{s.materialSummary.join(' · ')}</div>
        <div className="style-color-dots">{[s.wall, s.wood, s.fabric, s.accent, s.metal].map((color, i) => <i key={i} style={{ background: color }}/>)}</div>
      </div>
    </button>)}</div>
    <p className="style-footer-note">縮圖由本程式的家具模型直接繪製，用於比較風格；你的住宅格局仍以工作區中的模型為準。</p>
  </section></div>;
}
