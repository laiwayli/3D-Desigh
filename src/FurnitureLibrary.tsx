import { useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { FurnitureShape } from './FurnitureShape';
import { catalog, furnitureGroups, furnitureVariants, searchFurniture } from './furnitureCatalog';
import type { FurnitureKind, FurnitureVariant } from './furnitureCatalog';
import './furnitureLibrary.css';

const cm = (metres: number) => Number((metres * 100).toFixed(1));

export function FurnitureLibrary({ onAdd }: { onAdd: (item: FurnitureVariant) => void }) {
  const [query, setQuery] = useState(''), [group, setGroup] = useState('全部');
  const [selectedVariants, setSelectedVariants] = useState<Partial<Record<FurnitureKind, string>>>({});
  const kinds = searchFurniture(query, group);
  const matchingVariants = furnitureVariants.filter(v => kinds.includes(v.kind));
  return <section className="furniture-library" aria-label="家具圖塊庫">
    <div className="section-title"><span>家具圖塊庫</span><span className="tiny-label">{Object.keys(catalog).length} TYPES</span></div>
    <p className="section-description">依用途挑選家具與常見尺寸。點選圖塊加入，之後可拖曳、旋轉或修改尺寸。</p>
    <label className="furniture-search"><Search size={14}/><input aria-label="搜尋家具" type="search" value={query} placeholder="搜尋家具、WFH、小宅…" onChange={e => setQuery(e.target.value)}/>{query && <button type="button" aria-label="清除家具搜尋" onClick={() => setQuery('')}><X size={13}/></button>}</label>
    <div className="furniture-categories" role="group" aria-label="家具分類">{['全部', ...furnitureGroups].map(name => <button key={name} type="button" aria-pressed={group === name} className={group === name ? 'active' : ''} onClick={() => setGroup(name)}>{name}</button>)}</div>
    <p className="furniture-result-count" role="status">{kinds.length} 種家具 · {matchingVariants.length} 個尺寸款式<span>寬 × 深 × 高（cm）</span></p>
    <div className="furniture-library-grid">{kinds.map(kind => {
      const entry = catalog[kind], options = furnitureVariants.filter(v => v.kind === kind);
      const variant = options.find(v => v.id === selectedVariants[kind]) || options[0];
      const extent = Math.max(variant.w, variant.d) + .3;
      return <article key={kind} className="furniture-library-card" data-furniture-kind={kind}>
        <button type="button" className="furniture-library-add" aria-label={entry.name} title={`加入${entry.name}：${variant.name}`} onClick={() => onAdd(variant)}>
          <div className="furniture-library-preview"><svg viewBox={`${-extent / 2} ${-extent / 2} ${extent} ${extent}`} role="img" aria-label={`${entry.name} CAD 平面圖`}><FurnitureShape f={{ id: kind, kind, x: 0, y: 0, rotation: 0, w: variant.w, d: variant.d }}/></svg><span><Plus size={12}/></span></div>
          <strong>{entry.name}</strong><small>{entry.group}</small>
        </button>
        <select aria-label={`${entry.name}尺寸款式`} value={variant.id} onChange={e => setSelectedVariants(old => ({ ...old, [kind]: e.target.value }))}>{options.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
        <div className="furniture-library-dimensions">{cm(variant.w)} × {cm(variant.d)} × {cm(variant.h)}</div>
      </article>;
    })}</div>
    {!kinds.length && <div className="furniture-library-empty"><Search size={24}/><strong>找不到符合的家具</strong><p>試試「沙發」「收納」或「小宅」，也可清除分類重新查看。</p><button type="button" className="button" onClick={() => { setQuery(''); setGroup('全部'); }}>顯示所有家具</button></div>}
    <p className="furniture-library-note">尺寸為常見家具預設，非品牌商品規格。加入後可修改寬、深、高與材質。</p>
  </section>;
}
