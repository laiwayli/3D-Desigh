import type { Furniture } from './model';

export function FurnitureShape({ f, selected = false }: { f: Furniture; selected?: boolean }) {
  const { w, d, kind } = f;
  const line = selected ? '#54765c' : '#7a8075';
  const radius = Math.min(w, d) * .12;
  return <g transform={`translate(${f.x} ${f.y}) rotate(${f.rotation})`} stroke={line} strokeWidth=".018" fill="#faf9f3" strokeLinejoin="round">
    {kind === 'plant' ? <g fill="#d6dfca" stroke="#9cae8d"><circle r={w / 2} fill="#f4f4e9"/>{[0, 60, 120, 180, 240, 300].map(a => <ellipse key={a} cx="0" cy={-w * .19} rx={w * .14} ry={w * .25} transform={`rotate(${a})`}/>)}<circle r={w * .09} fill="#9fae8b"/></g> : kind === 'toilet' ? <g><rect x={-w / 2} y={-d / 2} width={w} height={d * .28} rx=".05"/><ellipse cy={d * .13} rx={w * .43} ry={d * .35}/><ellipse cy={d * .13} rx={w * .28} ry={d * .23} fill="#eeeede"/></g> : kind === 'shower' ? <g><rect x={-w / 2} y={-d / 2} width={w} height={d} fill="#ecf1ee"/><path d={`M${-w / 2},${-d / 2} L${w / 2},${d / 2} M${w / 2},${-d / 2} L${-w / 2},${d / 2}`} opacity=".3"/><circle r=".05"/></g> : <>
      <rect x={-w / 2} y={-d / 2} width={w} height={d} rx={kind === 'table' ? radius * 2 : radius} fill={kind === 'kitchen' || kind === 'wardrobe' ? '#eeeade' : kind === 'bed' ? '#ede9df' : '#f8f6ee'}/>
      {kind === 'sofa' && <><rect x={-w / 2 + .12} y={-d / 2 + .09} width={w - .24} height={d * .24} rx=".06" fill="#e5e3d7"/>{[0, 1, 2].map(i => <rect key={i} x={-w / 2 + .19 + i * (w - .38) / 3} y={-d / 2 + d * .37} width={(w - .38) / 3 - .025} height={d * .49} rx=".06" fill="#eeeadd"/>)}<rect x={-w / 2} y={-d / 2 + .08} width=".13" height={d - .12} rx=".04"/><rect x={w / 2 - .13} y={-d / 2 + .08} width=".13" height={d - .12} rx=".04"/></>}
      {kind === 'chair' && <><rect x={-w / 2 + .09} y={-d / 2 + .08} width={w - .18} height={d * .23} rx=".05" fill="#e8e5da"/><path d={`M${-w / 2 + .09},${-d / 2 + .12} V${d / 2 - .08} H${w / 2 - .09} V${-d / 2 + .12}`} fill="none"/></>}
      {kind === 'bed' && <><rect x={-w / 2 + .04} y={-d / 2 + .11} width={w - .08} height={d - .16} rx=".03"/><rect x={-w / 2 + .12} y={-d / 2 + .2} width={w * .36} height={d * .19} rx=".06"/><rect x={w * .02} y={-d / 2 + .2} width={w * .36} height={d * .19} rx=".06"/><path d={`M${-w / 2 + .05},${-d / 2 + d * .42} H${w / 2 - .05} M${-w / 2 + .05},${-d / 2 + d * .49} H${w / 2 - .05}`}/></>}
      {kind === 'kitchen' && <><line x1={-w / 2} y1={d * .25} x2={w / 2} y2={d * .25}/>{[1, 2, 3].map(i => <line key={i} x1={-w / 2 + w * i / 4} y1={-d / 2} x2={-w / 2 + w * i / 4} y2={d / 2}/>)}<rect x={-w * .35} y={-d * .3} width={w * .23} height={d * .49} rx=".05" fill="#e0e5dc"/>{[0, 1].map(i => <circle key={i} cx={w * .22 + i * w * .13} cy={-d * .06} r={d * .14} fill="none"/>)}</>}
      {kind === 'wardrobe' && <>{[1, 2, 3].map(i => <line key={i} x1={-w / 2 + w * i / 4} y1={-d / 2} x2={-w / 2 + w * i / 4} y2={d / 2}/>)}<path d={`M${-w / 2},${d / 2} L${-w / 4},${-d / 2} L0,${d / 2} L${w / 4},${-d / 2} L${w / 2},${d / 2}`} fill="none" opacity=".25"/></>}
      {kind === 'desk' && <><rect x={-w * .23} y={-d * .35} width={w * .46} height={d * .12} rx=".02" fill="#afb9ac"/><rect x={-w * .15} y={-d * .05} width={w * .3} height={d * .24} rx=".02" fill="#e5e5dc"/><circle cx={w * .31} cy="0" r=".05"/></>}
    </>}
    {selected && <rect x={-w / 2 - .08} y={-d / 2 - .08} width={w + .16} height={d + .16} fill="none" stroke="#65816a" strokeWidth=".025" strokeDasharray=".07 .05" rx=".04"/>}
  </g>;
}
