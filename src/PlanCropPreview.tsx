import { useRef } from 'react';
import type { PointerEvent } from 'react';
import type { RasterPlan } from './floorplanImport';
import type { Crop } from './reconstructImage';

export function PlanCropPreview({ image, crop, onChange }: { image: RasterPlan; crop: Crop; onChange: (crop: Crop) => void }) {
  const svg = useRef<SVGSVGElement>(null), start = useRef<{ x: number; y: number } | null>(null);
  const point = (e: PointerEvent) => { const matrix = svg.current!.getScreenCTM(); if (!matrix) return { x: 0, y: 0 }; const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse()); return { x: Math.max(0, Math.min(1, p.x / image.pixelWidth)), y: Math.max(0, Math.min(1, p.y / image.pixelHeight)) }; };
  const update = (e: PointerEvent) => { if (!start.current) return; const p = point(e), a = start.current, w = Math.abs(p.x - a.x), h = Math.abs(p.y - a.y); if (w > .04 && h > .04) onChange({ x: Math.min(a.x, p.x), y: Math.min(a.y, p.y), w, h }); };
  const { pixelWidth: w, pixelHeight: h } = image;
  return <svg className="crop-preview" data-testid="crop-preview" ref={svg} viewBox={`0 0 ${w} ${h}`} aria-label="拖曳框選建築範圍" onPointerDown={e => { start.current = point(e); e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={update} onPointerUp={e => { update(e); start.current = null; }} onPointerCancel={() => { start.current = null; }}>
    <image href={image.src} width={w} height={h}/><path d={`M0,0 H${w} V${h} H0 Z M${crop.x * w},${crop.y * h} h${crop.w * w} v${crop.h * h} h${-crop.w * w} Z`} fill="#19251570" fillRule="evenodd" pointerEvents="none"/><rect x={crop.x * w} y={crop.y * h} width={crop.w * w} height={crop.h * h} fill="none" stroke="#8da56c" strokeWidth={Math.max(w, h) * .004} strokeDasharray={`${w * .012} ${w * .007}`} pointerEvents="none"/>
  </svg>;
}
