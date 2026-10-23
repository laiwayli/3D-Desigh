import { useRef } from 'react';
import type { PointerEvent } from 'react';
import type { RasterPlan } from './floorplanImport';
import type { Crop } from './reconstructImage';
import type { Plan } from './model';

export function PlanCropPreview({ image, crop, onChange, disabled = false }: { image: RasterPlan; crop: Crop; onChange: (crop: Crop) => void; disabled?: boolean }) {
  const svg = useRef<SVGSVGElement>(null), start = useRef<{ x: number; y: number } | null>(null);
  const point = (e: PointerEvent) => { const matrix = svg.current!.getScreenCTM(); if (!matrix) return { x: 0, y: 0 }; const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse()); return { x: Math.max(0, Math.min(1, p.x / image.pixelWidth)), y: Math.max(0, Math.min(1, p.y / image.pixelHeight)) }; };
  const update = (e: PointerEvent) => { if (!start.current) return; const p = point(e), a = start.current, w = Math.abs(p.x - a.x), h = Math.abs(p.y - a.y); if (w > .04 && h > .04) onChange({ x: Math.min(a.x, p.x), y: Math.min(a.y, p.y), w, h }); };
  const { pixelWidth: w, pixelHeight: h } = image;
  return <svg className="crop-preview" data-testid="crop-preview" ref={svg} viewBox={`0 0 ${w} ${h}`} aria-label="拖曳框選建築範圍" onPointerDown={e => { if (disabled) return; start.current = point(e); e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={update} onPointerUp={e => { update(e); start.current = null; }} onPointerCancel={() => { start.current = null; }}>
    <image href={image.src} width={w} height={h}/><path d={`M0,0 H${w} V${h} H0 Z M${crop.x * w},${crop.y * h} h${crop.w * w} v${crop.h * h} h${-crop.w * w} Z`} fill="#19251570" fillRule="evenodd" pointerEvents="none"/><rect x={crop.x * w} y={crop.y * h} width={crop.w * w} height={crop.h * h} fill="none" stroke="#8da56c" strokeWidth={Math.max(w, h) * .004} strokeDasharray={`${w * .012} ${w * .007}`} pointerEvents="none"/>
  </svg>;
}

/** Show candidates on their real pixel source rather than a detached generated plan. */
export function ReconstructionOverlayPreview({ plan, showCandidates = true }: { plan: Plan; showCandidates?: boolean }) {
  return <svg className="reconstruction-preview" data-testid="reconstruction-preview" viewBox={`0 0 ${plan.width} ${plan.depth}`} aria-label="原圖與候選牆線疊圖">
    {plan.underlay && <image data-testid="reconstruction-source" href={plan.underlay.src} width={plan.width} height={plan.depth} preserveAspectRatio="none"/>}
    {showCandidates && <g data-testid="candidate-wall-overlay" fill="none" stroke="#00a7aa" strokeLinecap="round">
      {plan.walls.map(w => <line key={w.id} x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y} strokeWidth="3" vectorEffect="non-scaling-stroke" opacity=".85"/>)}
      <rect x="0" y="0" width={plan.width} height={plan.depth} stroke="#d46a36" strokeWidth="3" strokeDasharray="8 5" vectorEffect="non-scaling-stroke"/>
    </g>}
  </svg>;
}
