import { useEffect, useState } from 'react';
import type { Plan, Wall } from './model';

export function WallLengthControl({ wall, plan, onApply }: { wall: Wall; plan: Plan; onApply: (wall: Wall) => void }) {
  const length = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y);
  const [value, setValue] = useState(length.toFixed(3)), [error, setError] = useState('');
  useEffect(() => { setValue(length.toFixed(3)); setError(''); }, [wall.id, length]);
  return <form className="wall-length-form" onSubmit={e => {
    e.preventDefault(); const nextLength = Number(value);
    if (!Number.isFinite(nextLength) || nextLength < .2 || nextLength > 85) { setError('牆長需介於 0.2–85 m'); return; }
    const b = { x: wall.a.x + (wall.b.x - wall.a.x) * nextLength / length, y: wall.a.y + (wall.b.y - wall.a.y) * nextLength / length };
    if (b.x < 0 || b.x > plan.width || b.y < 0 || b.y > plan.depth) { setError('此長度會超出外牆，請先移動牆面或調整空間'); return; }
    setError(''); onApply({ ...wall, b });
  }}><label className="field-label">精確牆長（由起點延伸）</label><div className="input-unit"><input aria-label="精確牆長" type="number" step=".001" min=".2" max="85" required value={value} onChange={e => setValue(e.target.value)}/><span>m</span></div><button className="button full-width" type="submit">套用牆長</button>{error && <p className="import-error" role="alert">{error}</p>}</form>;
}
