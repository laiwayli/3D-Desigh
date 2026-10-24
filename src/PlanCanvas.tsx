import { useRef } from 'react';
import type { PointerEvent } from 'react';
import { FurnitureShape } from './FurnitureShape';
import { entryGeometry, exteriorSegments } from './model';
import type { Plan, Point } from './model';

export type Display = { grid: boolean; dimensions: boolean; furniture: boolean; hatch: boolean; labels: boolean };
export function PlanDrawing({ plan, display, selected, interactive = false, onFurniture, onWall }: { plan: Plan; display: Display; selected?: string | null; interactive?: boolean; onFurniture?: (id: string, e: PointerEvent<SVGGElement>) => void; onWall?: (id: string, e: PointerEvent<SVGLineElement>) => void }) {
  const { width: w, depth: d } = plan, door = entryGeometry(plan);
  const walls = exteriorSegments(plan);
  const entryX = (door.a.x + door.b.x) / 2, entryY = (door.a.y + door.b.y) / 2;
  const isSide = plan.entry === 'left' || plan.entry === 'right';
  const dx = plan.entry === 'left' ? 1 : plan.entry === 'right' ? -1 : 0, dy = plan.entry === 'top' ? 1 : plan.entry === 'bottom' ? -1 : 0;
  const outline = plan.outline || [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: d }, { x: 0, y: d }];
  const floorPath = `M${outline.map(p => `${p.x},${p.y}`).join(' L')} Z` + (plan.excludedAreas || []).map(a => ` M${a.x},${a.y} h${a.w} v${a.d} h${-a.w} Z`).join('');
  return <>
    <defs>
      <pattern id={`hatch-${plan.id}`} patternUnits="userSpaceOnUse" width=".095" height=".095" patternTransform="rotate(45)"><rect width=".095" height=".095" fill="#e6e6df"/><line x1="0" y1="0" x2="0" y2=".095" stroke="#7c8276" strokeWidth=".018"/></pattern>
      <pattern id={`floor-${plan.id}`} patternUnits="userSpaceOnUse" width=".48" height=".48"><rect width=".48" height=".48" fill="#fbfaf5"/><path d="M.48 0 H0 V.48" fill="none" stroke="#eae9e0" strokeWidth=".008"/></pattern>
      <pattern id={`excluded-${plan.id}`} patternUnits="userSpaceOnUse" width=".2" height=".2" patternTransform="rotate(45)"><rect width=".2" height=".2" fill="#fffefa"/><path d="M0 0 V.2" stroke="#bfb9ad" strokeWidth=".012"/></pattern>
      <clipPath id={`footprint-${plan.id}`}><polygon points={outline.map(p => `${p.x},${p.y}`).join(' ')}/></clipPath>
      <filter id={`shadow-${plan.id}`} x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx=".04" dy=".09" stdDeviation=".12" floodOpacity=".09"/></filter>
    </defs>
    <path d={floorPath} clipPath={`url(#footprint-${plan.id})`} fillRule="evenodd" fill={`url(#floor-${plan.id})`} filter={`url(#shadow-${plan.id})`}/>
    {plan.underlay?.visible && <image data-testid="floorplan-underlay" href={plan.underlay.src} x={plan.underlay.x} y={plan.underlay.y} width={plan.underlay.width} height={plan.underlay.height} opacity={plan.underlay.opacity} preserveAspectRatio="none" pointerEvents="none"/>}
    {(plan.excludedAreas || []).map(a => <g key={a.id} data-testid="excluded-area" pointerEvents="none"><rect x={a.x} y={a.y} width={a.w} height={a.d} fill={`url(#excluded-${plan.id})`} stroke="#a79e8c" strokeWidth=".025" strokeDasharray=".1 .06"/><path d={`M${a.x},${a.y} l${a.w},${a.d} M${a.x + a.w},${a.y} l${-a.w},${a.d}`} fill="none" stroke="#aaa18f" strokeWidth=".018"/>{display.labels && <g transform={`translate(${a.x + a.w / 2} ${a.y + a.d / 2})`} textAnchor="middle"><rect x={-Math.min(a.w * .48, 1.3)} y="-.17" width={Math.min(a.w * .96, 2.6)} height=".5" fill="#fffefa" opacity=".95"/><text fontSize=".14" fill="#8c7b62">{a.name}</text><text y=".22" fontSize=".105" fill="#a3947f">不配置家具・不計入地板</text></g>}</g>)}
    <g stroke="#565d51" strokeLinecap="square">{[...walls, ...plan.walls].map(wall => <g key={wall.id}>
      <line x1={wall.a.x} y1={wall.a.y} x2={wall.b.x} y2={wall.b.y} strokeWidth={wall.thickness + .035}/>
      <line x1={wall.a.x} y1={wall.a.y} x2={wall.b.x} y2={wall.b.y} stroke={selected === wall.id ? '#829b7d' : display.hatch ? `url(#hatch-${plan.id})` : '#d0d4c8'} strokeWidth={wall.thickness}/>
      {interactive && !wall.id.startsWith('ext-') && <line className="wall-hit" x1={wall.a.x} y1={wall.a.y} x2={wall.b.x} y2={wall.b.y} stroke="transparent" strokeWidth=".26" onPointerDown={e => onWall?.(wall.id, e)}/>}
    </g>)}</g>
    {(plan.columns || []).map(c => <g key={c.id} data-testid="structural-column" pointerEvents="none"><title>{c.status === 'estimated' ? '柱位與尺寸為圖面估定，待核對' : '柱位'}</title><rect x={c.x - c.w / 2} y={c.y - c.d / 2} width={c.w} height={c.d} fill={display.hatch ? `url(#hatch-${plan.id})` : '#74786e'} stroke="#41473e" strokeWidth=".045"/>{display.labels && c.status === 'estimated' && <text x={c.x} y={c.y + .04} textAnchor="middle" fontSize=".105" fill="#454b40">柱*</text>}</g>)}
    {!plan.reconstruction && <g stroke="#97b7b0" strokeWidth=".1" fill="none">
      <path d={`M${w * .12},0 H${w * .4} ${plan.entry !== 'top' ? `M${w * .66},0 H${w * .87}` : ''} M${w},${d * .15} V${d * .35} ${plan.entry !== 'bottom' ? `M${w * .25},${d} H${w * .52}` : ''}`}/>
    </g>}
    <g fill="none" stroke="#8a9880" strokeWidth=".018">
      {isSide ? <><path d={`M${door.a.x},${door.a.y} h${dx * 1.05}`}/><path d={`M${door.b.x},${door.b.y} A1.05,1.05 0 0 ${dx === 1 ? 0 : 1} ${door.a.x + dx * 1.05},${door.a.y}`} strokeDasharray=".045 .03"/></> : <><path d={`M${door.a.x},${door.a.y} v${dy * 1.05}`}/><path d={`M${door.b.x},${door.b.y} A1.05,1.05 0 0 ${dy === 1 ? 1 : 0} ${door.a.x},${door.a.y + dy * 1.05}`} strokeDasharray=".045 .03"/></>}
    </g>
    {display.furniture && [...plan.furniture].sort((a, b) => Number(b.kind === 'rug') - Number(a.kind === 'rug')).map(f => <g key={f.id} className={interactive ? 'furniture-hit' : ''} onPointerDown={e => onFurniture?.(f.id, e)}><FurnitureShape f={f} selected={selected === f.id}/></g>)}
    {display.labels && plan.rooms.map((room, i) => <g key={i} transform={`translate(${room.x} ${room.y})`} textAnchor="middle" pointerEvents="none"><title>{room.sourceName ? `原始圖：${room.sourceName}` : room.name}</title><text className="room-label" y="0" fontSize=".19" fill="#666e60">{room.name}</text><text y=".28" fontSize=".125" fill="#9b9e91" letterSpacing=".01">{room.areaEstimated ? '約 ' : ''}{room.area.toFixed(1)} m²</text></g>)}
    {display.labels && plan.reconstruction?.method === 'reference' && <g data-testid="reference-missing-balcony" pointerEvents="none" textAnchor="middle"><rect x="-1.64" y=".79" width="1.42" height=".82" rx=".06" fill="#f8f4e9" stroke="#b8aa8e" strokeWidth=".012"/><text x="-.93" y="1.01" fontSize=".12" fill="#7d6c51">主體草模</text><text x="-.93" y="1.23" fontSize=".102" fill="#8c7c61">左上外凸陽台尺寸待核</text><text x="-.93" y="1.44" fontSize=".105" fill="#8c7c61">尚未建入</text><path d="M-.22,1.2 H-.06" stroke="#b8aa8e" strokeWidth=".018" fill="none"/></g>}
    <g transform={`translate(${entryX - dx * .63} ${entryY - dy * .63})`} fill="#688362" textAnchor="middle"><circle r=".21" fill="#e8efdf"/><path d={isSide ? `M${-dx * .08},-.07 L${dx * .04},0 L${-dx * .08},.07` : `M-.07,${-dy * .08} L0,${dy * .04} L.07,${-dy * .08}`} stroke="#698260" strokeWidth=".026" fill="none"/><text y=".48" fontSize=".13" letterSpacing=".03">入口</text></g>
    {display.dimensions && <g fill="#8f9587" stroke="#a3aa9b" strokeWidth=".012" textAnchor="middle">
      <path d={`M0,-.35 V-.87 M${w},-.35 V-.87 M0,-.7 H${w} M-.09,-.61 L.09,-.79 M${w - .09},-.61 L${w + .09},-.79`}/><rect x={w / 2 - .62} y="-.84" width="1.24" height=".28" fill="#f4f5ef" stroke="none"/><text x={w / 2} y="-.65" fontSize=".17" stroke="none">{(w * 1000).toLocaleString()} mm</text>
      <path d={`M${w + .35},0 H${w + .87} M${w + .35},${d} H${w + .87} M${w + .7},0 V${d} M${w + .61},.09 L${w + .79},-.09 M${w + .61},${d + .09} L${w + .79},${d - .09}`}/><g transform={`translate(${w + .7},${d / 2}) rotate(90)`}><rect x="-.62" y="-.14" width="1.24" height=".28" fill="#f4f5ef" stroke="none"/><text y=".06" fontSize=".17" stroke="none">{(d * 1000).toLocaleString()} mm</text></g>
    </g>}
  </>;
}
export function PlanCanvas({ plan, display, selected, tool, zoom, pan, preview, onPointDown, onMove, onUp, onFurniture, onWall }: { plan: Plan; display: Display; selected: string | null; tool: string; zoom: number; pan: Point; preview: { a: Point; b: Point } | null; onPointDown: (point: Point, e: PointerEvent<SVGSVGElement>) => void; onMove: (point: Point, e: PointerEvent<SVGSVGElement>) => void; onUp: () => void; onFurniture: (id: string, point: Point, e: PointerEvent<SVGGElement>) => void; onWall: (id: string, point: Point, e: PointerEvent<SVGLineElement | SVGCircleElement>, endpoint?: 'a' | 'b') => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const point = (e: PointerEvent) => {
    const svg = svgRef.current!, matrix = svg.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse()); return { x: p.x, y: p.y };
  };
  const vw = (plan.width + 3.5) / zoom, vh = (plan.depth + 3) / zoom;
  return <svg ref={svgRef} data-testid="plan-canvas" className={`plan-canvas tool-${tool}`} viewBox={`${(plan.width - vw) / 2 + pan.x} ${(plan.depth - vh) / 2 + pan.y} ${vw} ${vh}`} onPointerDown={e => onPointDown(point(e), e)} onPointerMove={e => onMove(point(e), e)} onPointerUp={onUp} onPointerCancel={onUp} aria-label="互動式平面圖編輯器">
    <PlanDrawing plan={plan} display={display} selected={selected} interactive onFurniture={(id, e) => onFurniture(id, point(e), e)} onWall={(id, e) => onWall(id, point(e), e)}/>
    {tool === 'select' && plan.walls.filter(w => w.id === selected).map(w => <g key={w.id}>{(['a', 'b'] as const).map(end => <circle key={end} cx={w[end].x} cy={w[end].y} r=".09" fill="white" stroke="#6f8e5d" strokeWidth=".035" className="wall-endpoint" onPointerDown={e => onWall(w.id, point(e), e, end)}/>)}</g>)}
    {preview && <g pointerEvents="none" stroke="#63845b"><line x1={preview.a.x} y1={preview.a.y} x2={preview.b.x} y2={preview.b.y} strokeWidth={plan.wallThickness} opacity=".55"/><circle cx={preview.a.x} cy={preview.a.y} r=".07" fill="#63845b"/><circle cx={preview.b.x} cy={preview.b.y} r=".07" fill="#63845b"/><text x={(preview.a.x + preview.b.x) / 2} y={(preview.a.y + preview.b.y) / 2 - .22} textAnchor="middle" stroke="none" fill="#63845b" fontSize=".18">{Math.hypot(preview.a.x - preview.b.x, preview.a.y - preview.b.y).toFixed(2)} m</text></g>}
  </svg>;
}
