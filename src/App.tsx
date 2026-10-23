import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Armchair, ArrowDownToLine, ArrowLeft, ArrowRight, Box, Check, CheckCheck, ChevronDown, ChevronRight, CircleHelp, Copy, DoorOpen, Expand, Eye, FileImage, FileJson, FolderOpen, Grid2X2, Hand, House, Layers, LayoutDashboard, Leaf, LockKeyhole, Minus, MousePointer2, MoveUpRight, PanelLeftClose, PencilRuler, Plus, Redo2, RotateCw, Ruler, Save, ScanLine, Settings2, ShieldCheck, Sparkles, Square, Trash2, Undo2, UnlockKeyhole, X } from 'lucide-react';
import { PlanCanvas, PlanDrawing } from './PlanCanvas';
import type { Display } from './PlanCanvas';
import { FurnitureShape } from './FurnitureShape';
import { catalog, clamp, constrainFurniture, createPlan, isPlan, snap, uid, resizePlanDimensions, fitUnderlay, calibrateUnderlay } from './model';
import type { Entry, FurnitureKind, Plan, Point, Underlay } from './model';
import { FloorplanImport, CalibrationDialog } from './FloorplanImport';
import { WallLengthControl } from './WallLengthControl';
import { UnderlayControls } from './UnderlayControls';
import type { RasterPlan } from './floorplanImport';
import './styles.css';

const Scene3D = lazy(() => import('./Scene3D'));
const STORAGE = 'planform-workspace-v1';
function loadWorkspace(): { plan: Plan; saved: Plan[]; project: string } {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE) || 'null');
    if (raw && isPlan(raw.plan)) return { plan: raw.plan, saved: Array.isArray(raw.saved) ? raw.saved.filter(isPlan).slice(0, 12) : [], project: typeof raw.project === 'string' ? raw.project : '日光寓所・空間提案' };
  } catch { /* Unavailable or invalid browser storage starts a fresh workspace. */ }
  return { plan: createPlan(), saved: [], project: '日光寓所・空間提案' };
}
const entryLabels: Record<Entry, string> = { left: '左側', right: '右側', top: '上側', bottom: '下側' };
const defaultDisplay: Display = { grid: true, dimensions: true, furniture: true, hatch: true, labels: true };
type Drag = { id: string; offset: Point; original: Plan; moved: boolean } | null;
type WallDrag = { id: string; start: Point; original: Plan; moved: boolean; endpoint?: 'a' | 'b' } | null;

function App() {
  const [initial] = useState(loadWorkspace);
  const [plan, setPlan] = useState(initial.plan), [saved, setSaved] = useState(initial.saved), [project, setProject] = useState(initial.project);
  const [view, setView] = useState<'2d' | '3d'>('2d'), [panel, setPanel] = useState<'structure' | 'furniture' | 'plans'>('structure');
  const [tool, setTool] = useState('select'), [selected, setSelected] = useState<string | null>(null);
  const [display, setDisplay] = useState(defaultDisplay), [zoom, setZoom] = useState(1), [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [undo, setUndo] = useState<Plan[]>([]), [redo, setRedo] = useState<Plan[]>([]);
  const [wallStart, setWallStart] = useState<Point | null>(null), [hover, setHover] = useState<Point | null>(null), [drawThickness, setDrawThickness] = useState(.12);
  const [toast, setToast] = useState(''), [modal, setModal] = useState<'generate' | 'help' | 'import' | 'calibrate' | null>(null), [exportOpen, setExportOpen] = useState(false);
  const [candidates, setCandidates] = useState<Plan[]>([]), [candidate, setCandidate] = useState(0), [entry, setEntry] = useState<Entry>(plan.entry);
  const [cutaway, setCutaway] = useState(true), [storageState, setStorageState] = useState<'saving' | 'saved' | 'error'>('saved');
  const [mobilePanel, setMobilePanel] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const [dimensionDraft, setDimensionDraft] = useState({ width: String(plan.width), depth: String(plan.depth) });
  const [dimensionError, setDimensionError] = useState('');
  const [calibrationPoints, setCalibrationPoints] = useState<Point[]>([]);
  const underlayDrag = useRef<{ start: Point; original: Plan; moved: boolean } | null>(null);
  useEffect(() => { setDimensionDraft({ width: String(plan.width), depth: String(plan.depth) }); setDimensionError(''); }, [plan.width, plan.depth]);
  const drag = useRef<Drag>(null), wallDrag = useRef<WallDrag>(null), panDrag = useRef<{ x: number; y: number; pan: Point; scale: number } | null>(null);
  const f = plan.furniture.find(item => item.id === selected), wall = plan.walls.find(item => item.id === selected);
  const notify = (message: string) => setToast(message);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 3500); return () => clearTimeout(id); }, [toast]);
  useEffect(() => {
    try { localStorage.setItem(STORAGE, JSON.stringify({ plan, saved, project })); setStorageState('saved'); } catch { setStorageState('error'); }
  }, [plan, saved, project]);
  const commit = useCallback((next: Plan) => { setUndo(old => [...old.slice(-49), plan]); setRedo([]); setPlan(next); }, [plan]);
  const undoAction = useCallback(() => { if (!undo.length) return; setRedo(r => [...r, plan]); setPlan(undo[undo.length - 1]); setUndo(undo.slice(0, -1)); setSelected(null); setWallStart(null); }, [undo, plan]);
  const redoAction = useCallback(() => { if (!redo.length) return; setUndo(u => [...u, plan]); setPlan(redo[redo.length - 1]); setRedo(redo.slice(0, -1)); setSelected(null); setWallStart(null); }, [redo, plan]);
  const removeSelected = useCallback(() => { if (!selected) return; commit({ ...plan, walls: plan.walls.filter(w => w.id !== selected), furniture: plan.furniture.filter(f => f.id !== selected), rooms: wall ? [] : plan.rooms }); setSelected(null); notify('已刪除選取物件'); }, [selected, commit, plan, wall]);
  const rotateSelected = useCallback(() => { if (!f) return; commit({ ...plan, furniture: plan.furniture.map(item => item.id === f.id ? constrainFurniture({ ...item, rotation: (item.rotation + 90) % 360 }, plan) : item) }); }, [f, plan, commit]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'Escape') { setModal(null); setWallStart(null); setCalibrationPoints([]); setSelected(null); setTool('select'); setExportOpen(false); return; }
      if (modal) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redoAction() : undoAction(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSelected(); }
      else if (e.key.toLowerCase() === 'r') rotateSelected();
      else if (e.key.toLowerCase() === 'v') setTool('select');
      else if (e.key.toLowerCase() === 'w') { setTool('wall'); setView('2d'); }
      else if (e.key.toLowerCase() === 'h') setTool('hand');
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [undoAction, redoAction, removeSelected, rotateSelected, modal]);
  useEffect(() => { setWallStart(null); setHover(null); if (tool !== 'calibrate') setCalibrationPoints([]); }, [tool, view]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, [tabindex="0"]') || []);
    focusable()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusable(), first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', trap); previous?.focus(); };
  }, [modal]);
  const pointIn = (p: Point) => ({ x: snap(clamp(p.x, .1, plan.width - .1)), y: snap(clamp(p.y, .1, plan.depth - .1)) });
  const endPoint = (p: Point, free = false) => { const q = pointIn(p); if (!wallStart || free) return q; return Math.abs(q.x - wallStart.x) > Math.abs(q.y - wallStart.y) ? { x: q.x, y: wallStart.y } : { x: wallStart.x, y: q.y }; };
  const pointDown = (p: Point, e: PointerEvent<SVGSVGElement>) => {
    if (tool === 'hand' || e.button === 1) {
      e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); const matrix = e.currentTarget.getScreenCTM();
      panDrag.current = { x: e.clientX, y: e.clientY, pan, scale: matrix ? 1 / matrix.a : .02 }; return;
    }
    if (e.button !== 0) return;
    if (tool === 'calibrate' && plan.underlay) {
      if (calibrationPoints.length === 0) { setCalibrationPoints([p]); setHover(p); }
      else if (Math.hypot(p.x - calibrationPoints[0].x, p.y - calibrationPoints[0].y) >= .01) { setCalibrationPoints([calibrationPoints[0], p]); setModal('calibrate'); }
      return;
    }
    if (tool === 'underlay' && plan.underlay) { e.currentTarget.setPointerCapture(e.pointerId); underlayDrag.current = { start: p, original: plan, moved: false }; return; }
    if (tool === 'wall') {
      if (!wallStart) { setWallStart(pointIn(p)); setHover(pointIn(p)); }
      else { const end = endPoint(p, e.shiftKey); if (Math.hypot(end.x - wallStart.x, end.y - wallStart.y) < .2) return; commit({ ...plan, rooms: [], walls: [...plan.walls, { id: uid(), a: wallStart, b: end, thickness: drawThickness }] }); setWallStart(null); setHover(null); notify('隔間牆已新增'); }
    } else setSelected(null);
  };
  const onMove = (p: Point, e: PointerEvent<SVGSVGElement>) => {
    if (panDrag.current) { const start = panDrag.current; setPan({ x: start.pan.x - (e.clientX - start.x) * start.scale, y: start.pan.y - (e.clientY - start.y) * start.scale }); }
    else if (drag.current) { const active = drag.current;
      if (!active.moved) { active.moved = true; setUndo(old => [...old.slice(-49), active.original]); setRedo([]); }
      setPlan(old => ({ ...old, furniture: old.furniture.map(f => f.id === active.id ? constrainFurniture({ ...f, x: snap(p.x - active.offset.x), y: snap(p.y - active.offset.y) }, old) : f) }));
    }
    else if (wallDrag.current) {
      const active = wallDrag.current, originalWall = active.original.walls.find(w => w.id === active.id)!;
      if (Math.hypot(p.x - active.start.x, p.y - active.start.y) < .06 && !active.moved) return;
      if (!active.moved) { active.moved = true; setUndo(old => [...old.slice(-49), active.original]); setRedo([]); }
      let a = originalWall.a, b = originalWall.b;
      if (active.endpoint) { if (active.endpoint === 'a') a = pointIn(p); else b = pointIn(p); }
      else { const delta = { x: clamp(snap(p.x - active.start.x), -Math.min(a.x, b.x), plan.width - Math.max(a.x, b.x)), y: clamp(snap(p.y - active.start.y), -Math.min(a.y, b.y), plan.depth - Math.max(a.y, b.y)) }; a = { x: a.x + delta.x, y: a.y + delta.y }; b = { x: b.x + delta.x, y: b.y + delta.y }; }
      if (Math.hypot(a.x - b.x, a.y - b.y) < .2) return;
      setPlan(old => ({ ...old, rooms: [], walls: old.walls.map(w => w.id === active.id ? { ...w, a, b } : w) }));
    }
    else if (underlayDrag.current) {
      const active = underlayDrag.current, u = active.original.underlay!;
      if (!active.moved) { active.moved = true; setUndo(old => [...old.slice(-49), active.original]); setRedo([]); }
      setPlan(old => ({ ...old, underlay: { ...u, x: clamp(u.x + p.x - active.start.x, -120, 120), y: clamp(u.y + p.y - active.start.y, -120, 120) } }));
    }
    else if (tool === 'calibrate') setHover(p);
    else if (tool === 'wall' && wallStart) setHover(endPoint(p, e.shiftKey));
  };
  const furnitureDown = (id: string, p: Point, e: PointerEvent<SVGGElement>) => {
    if (tool !== 'select') return; e.stopPropagation(); setSelected(id);
    const item = plan.furniture.find(f => f.id === id)!;
    drag.current = { id, offset: { x: p.x - item.x, y: p.y - item.y }, original: plan, moved: false };
    e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
  };
  const addFurniture = (kind: FurnitureKind) => { const item = constrainFurniture({ id: uid(), kind, x: plan.width / 2, y: plan.depth / 2, w: catalog[kind].w, d: catalog[kind].d, rotation: 0 }, plan); commit({ ...plan, furniture: [...plan.furniture, item] }); setSelected(item.id); setTool('select'); setView('2d'); setMobilePanel(false); notify(`已加入${catalog[kind].name}，可拖曳調整位置`); };
  const setProperty = (property: 'w' | 'd' | 'rotation', value: number) => { if (!f || !Number.isFinite(value)) return; commit({ ...plan, furniture: plan.furniture.map(item => item.id === f.id ? constrainFurniture({ ...item, [property]: value }, plan) : item) }); };
  const toggleDisplay = (key: keyof Display) => setDisplay(d => ({ ...d, [key]: !d[key] }));
  const openGenerate = () => { setEntry(plan.entry); setCandidates([0, 1, 2].map(i => ({ ...createPlan(i, plan.entry, plan.width, plan.depth), wallThickness: plan.wallThickness, exteriorLocked: plan.exteriorLocked, height: plan.height, underlay: plan.underlay }))); setCandidate(0); setModal('generate'); };
  const changeEntry = (side: Entry) => { setEntry(side); setCandidates([0, 1, 2].map(i => ({ ...createPlan(i, side, plan.width, plan.depth), wallThickness: plan.wallThickness, exteriorLocked: plan.exteriorLocked, height: plan.height, underlay: plan.underlay }))); };
  const applyCandidate = () => { commit(candidates[candidate]); setSelected(null); setWallStart(null); setView('2d'); setModal(null); setMobilePanel(false); setPan({ x: 0, y: 0 }); setZoom(1); notify(`已套用「${candidates[candidate].name}」・入口位於${entryLabels[entry]}`); };
  const savePlan = () => { if (saved.length >= 12) { notify('最多儲存 12 個方案，請先刪除不需要的方案'); setPanel('plans'); return; } const next = { ...structuredClone(plan), id: uid(), name: `${plan.name} ${saved.length + 1}` }; setSaved(old => [...old, next]); notify('方案已保留於此瀏覽器'); };
  const download = (type: 'svg' | 'json') => {
    let data: string, mime: string;
    if (type === 'json') { data = JSON.stringify({ format: 'planform', version: 1, project, plan }, null, 2); mime = 'application/json'; }
    else { data = renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg" viewBox={`-1.5 -1.5 ${plan.width + 3} ${plan.depth + 3}`} width="1400" height={1400 * (plan.depth + 3) / (plan.width + 3)}><rect x="-1.5" y="-1.5" width={plan.width + 3} height={plan.depth + 3} fill="#f4f5ef"/><PlanDrawing plan={plan} display={display}/></svg>); mime = 'image/svg+xml'; }
    const url = URL.createObjectURL(new Blob([data], { type: mime })), link = document.createElement('a'); link.href = url; link.download = `${project || 'Planform'}.${type}`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setExportOpen(false); notify(`${type.toUpperCase()} 已匯出`);
  };
  const importPlan = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw new Error('file too large');
      const data = JSON.parse(await file.text());
      if (data.format !== 'planform' || data.version !== 1 || !isPlan(data.plan)) throw new Error('invalid project');
      commit(data.plan); setSelected(null); setView('2d'); setPan({ x: 0, y: 0 }); setZoom(1); setMobilePanel(false);
      if (typeof data.project === 'string') setProject(data.project.slice(0, 40));
      notify('JSON 專案已載入；可使用復原回到原配置');
    } catch { notify('無法載入檔案，請選擇有效的 Planform JSON 備份（小於 5 MB）'); }
    if (importInput.current) importInput.current.value = '';
  };
  const resizePlan = () => {
    try {
      const next = resizePlanDimensions(plan, Number(dimensionDraft.width), Number(dimensionDraft.depth));
      if (next.width === plan.width && next.depth === plan.depth) return;
      commit(next); setSelected(null); setDimensionError(''); setPan({ x: 0, y: 0 }); setZoom(1); notify('已套用空間長寬，隔間與家具位置同步調整');
    } catch (e) { setDimensionError(e instanceof Error ? e.message : '尺寸無效'); }
  };
  const importFloorplan = (image: RasterPlan, clearInterior: boolean) => {
    const underlay: Underlay = fitUnderlay({ id: uid(), ...image, x: 0, y: 0, width: plan.width, height: plan.depth, opacity: .7, visible: true }, plan);
    commit({ ...plan, underlay, ...(clearInterior ? { walls: [], furniture: [], rooms: [], name: image.name.slice(0, 35) } : {}) });
    setModal(null); setView('2d'); setTool('calibrate'); setCalibrationPoints([]); setSelected(null); setPanel('structure'); setMobilePanel(false); setZoom(1); setPan({ x: 0, y: 0 }); notify('底圖已匯入，請點選尺寸線的兩端以校正比例');
  };
  const applyCalibration = (metres: number) => {
    if (!plan.underlay || calibrationPoints.length !== 2) return;
    try { commit({ ...plan, underlay: calibrateUnderlay(plan.underlay, calibrationPoints[0], calibrationPoints[1], metres) }); setModal(null); setTool('select'); setCalibrationPoints([]); notify(`已依圖面標註 ${metres.toFixed(3)} m 校正底圖比例`); }
    catch (e) { notify(e instanceof Error ? e.message : '校正失敗，請重新選點'); }
  };
  return <div className="app-shell">
    <header className="app-header">
      <a className="brand" href="#" onClick={e => e.preventDefault()} aria-label="Planform 智構"><span className="brand-mark"><Layers size={23} strokeWidth={1.6}/></span><span>planform<span className="brand-cn">智構</span></span></a>
      <div className="project-title"><span className="header-divider"/><input aria-label="專案名稱" value={project} onChange={e => setProject(e.target.value)} maxLength={40}/><span className="project-pill">住宅設計</span></div>
      <div className={`save-status ${storageState === 'error' ? 'error' : ''}`}><span className="status-dot"/>{storageState === 'saving' ? '正在儲存…' : storageState === 'error' ? '儲存失敗，請匯出備份' : '已儲存於此瀏覽器'}</div>
      <button className="icon-button help-top" title="操作說明" onClick={() => setModal('help')}><CircleHelp size={19}/></button>
      <div className="export-wrap"><button className="button button-dark export-button" onClick={() => setExportOpen(!exportOpen)}><ArrowDownToLine size={15}/>匯出圖面<ChevronDown size={13}/></button>{exportOpen && <><div className="menu-dismiss" onClick={() => setExportOpen(false)}/><div className="dropdown export-menu"><button onClick={() => download('svg')}><ScanLine size={16}/><span>SVG 向量平面圖<small>可縮放、列印的向量圖檔</small></span></button><button onClick={() => download('json')}><FileJson size={16}/><span>JSON 專案資料<small>包含牆面、家具與空間設定</small></span></button></div></>}</div>
      <div className="avatar">WL</div>
    </header>

    <div className="workspace-bar"><div className="breadcrumb"><FolderOpen size={14}/><span>我的工作室</span><ChevronRight size={13}/><strong>平面配置</strong></div><div className="view-tabs"><button className={view === '2d' ? 'active' : ''} onClick={() => setView('2d')}><LayoutDashboard size={15}/>2D 平面設計</button><button className={view === '3d' ? 'active' : ''} onClick={() => { setView('3d'); setSelected(null); }}><Box size={15}/>3D 空間預覽<span className="new-tag">LIVE</span></button></div><button className="text-button save-plan-top" onClick={savePlan}><Save size={14}/>儲存方案</button></div>

    <main className="workspace">
      <input ref={importInput} type="file" accept=".json,application/json" aria-label="匯入 JSON 專案" hidden onChange={e => void importPlan(e.target.files?.[0])}/>
      <aside className={`left-sidebar ${mobilePanel ? 'mobile-open' : ''}`}>
        <div className="sidebar-heading"><span>設計工具</span><button className="icon-button" aria-label="收合工具面板" onClick={() => setMobilePanel(false)}><PanelLeftClose size={16}/></button></div>
        <nav className="sidebar-tabs" aria-label="工具分類"><button className={panel === 'structure' ? 'active' : ''} onClick={() => setPanel('structure')}><House size={16}/>空間</button><button className={panel === 'furniture' ? 'active' : ''} onClick={() => setPanel('furniture')}><Armchair size={16}/>家具</button><button className={panel === 'plans' ? 'active' : ''} onClick={() => setPanel('plans')}><Layers size={16}/>方案{saved.length > 0 && <i>{saved.length}</i>}</button></nav>
        <div className="sidebar-scroll">
          {panel === 'structure' && <>
            <div className="section-title"><span>空間設定</span><span className="tiny-label">SPACE</span></div>
            <label className="field-label">空間類型</label><div className="static-select"><span><House size={14}/>住宅空間</span><LockKeyhole size={12}/></div>
            <div className={`dimension-lock-note ${plan.exteriorLocked ? 'locked' : ''}`}><span>{plan.exteriorLocked ? <LockKeyhole size={13}/> : <UnlockKeyhole size={13}/>}<strong>{plan.exteriorLocked ? '外牆尺寸已鎖定' : '可調整空間長寬'}</strong></span><button onClick={() => commit({ ...plan, exteriorLocked: !plan.exteriorLocked })}>{plan.exteriorLocked ? '解鎖調整' : '鎖定尺寸'}</button></div>
            <form className="dimension-form" onSubmit={e => { e.preventDefault(); resizePlan(); }}><div className="field-row"><label>空間寬度<div className="input-unit"><input aria-label="空間寬度" type="number" min="2" max="60" step=".001" required disabled={plan.exteriorLocked} value={dimensionDraft.width} onChange={e => setDimensionDraft(d => ({ ...d, width: e.target.value }))}/><span>m</span></div></label><label>空間深度<div className="input-unit"><input aria-label="空間深度" type="number" min="2" max="60" step=".001" required disabled={plan.exteriorLocked} value={dimensionDraft.depth} onChange={e => setDimensionDraft(d => ({ ...d, depth: e.target.value }))}/><span>m</span></div></label></div><p className="dimension-hint">{plan.exteriorLocked ? '點上方「解鎖調整」即可編輯。生成方案仍會保留設定的外牆尺寸。' : '可輸入 2–60 m，支援小數三位。修改後按「套用長寬」。'}</p><button className="button full-width" type="submit" disabled={plan.exteriorLocked || (Number(dimensionDraft.width) === plan.width && Number(dimensionDraft.depth) === plan.depth)}>套用長寬</button>{plan.underlay?.calibratedDistance && <p className="dimension-hint">已校正的底圖會保留實際比例；調整長寬後請核對隔間位置。</p>}{dimensionError && <p className="import-error" role="alert">{dimensionError}</p>}</form>
            <div className="area-strip"><span>總樓地板面積</span><strong>{(plan.width * plan.depth).toFixed(1)} <small>m²</small></strong></div>
            <div className="section-rule"/>
            <div className="section-title"><span>匯入平面圖</span><FileImage size={14}/></div><button className="button import-floorplan-button" onClick={() => setModal('import')}><FileImage size={15}/>{plan.underlay ? '更換圖片／PDF 底圖' : '匯入圖片／PDF 平面圖'}</button><p className="dimension-hint">PNG、JPG、WebP、PDF。以原圖標註尺寸校正比例，再描繪牆面。</p>
            {plan.underlay && <UnderlayControls underlay={plan.underlay} tool={tool} onChange={u => commit({ ...plan, underlay: u })} onCalibrate={() => { if (!plan.underlay) return; if (!plan.underlay.visible) commit({ ...plan, underlay: { ...plan.underlay, visible: true } }); setTool('calibrate'); setCalibrationPoints([]); setView('2d'); setMobilePanel(false); notify('請點選同一條尺寸線的兩端'); }} onMove={() => { setTool('underlay'); setView('2d'); setMobilePanel(false); }} onFit={() => commit({ ...plan, underlay: fitUnderlay(plan.underlay!, plan) })} onRemove={() => { commit({ ...plan, underlay: undefined }); setTool('select'); setCalibrationPoints([]); }}/>}<div className="section-rule"/>
            <div className="section-title"><span>牆面與結構</span><Square size={13}/></div>
            <div className="label-between"><label className="field-label">外牆厚度</label><strong>{Math.round(plan.wallThickness * 100)} <small>cm</small></strong></div>
            <input className="range" aria-label="外牆厚度" type="range" min=".15" max=".4" step=".01" value={plan.wallThickness} onChange={e => commit({ ...plan, wallThickness: +e.target.value })}/><div className="range-labels"><span>15 cm</span><span>40 cm</span></div>
            <button className="lock-card" onClick={() => commit({ ...plan, exteriorLocked: !plan.exteriorLocked })}>{plan.exteriorLocked ? <LockKeyhole size={16}/> : <UnlockKeyhole size={16}/>}<span><strong>{plan.exteriorLocked ? '固定既有外牆' : '可調整外牆尺寸'}</strong><small>{plan.exteriorLocked ? '生成配置時保留空間邊界' : '空間寬度、深度可編輯'}</small></span><span className={`switch ${plan.exteriorLocked ? 'on' : ''}`} role="switch" aria-checked={plan.exteriorLocked}/></button>
            <button className={`draw-wall-button ${tool === 'wall' ? 'active' : ''}`} onClick={() => { setTool(tool === 'wall' ? 'select' : 'wall'); setView('2d'); }}><PencilRuler size={16}/><span>繪製室內隔間</span><kbd>W</kbd></button>
            <div className="label-between inner-thickness"><label htmlFor="draw-thickness">隔間牆厚</label><div className="small-unit"><input id="draw-thickness" type="number" min="5" max="40" value={Math.round(drawThickness * 100)} onChange={e => setDrawThickness(clamp(+e.target.value, 5, 40) / 100)}/><span>cm</span></div></div>
            <div className="section-rule"/>
            <div className="section-title"><span>入口玄關</span><DoorOpen size={14}/></div><p className="section-description">以入口為起點，重新安排生活動線。</p>
            <div className="entry-selector" role="group" aria-label="入口方向">{(['left', 'top', 'right', 'bottom'] as Entry[]).map(side => <button key={side} className={plan.entry === side ? 'active' : ''} onClick={() => { openGenerate(); changeEntry(side); }}><span className={`direction-icon ${side}`}><DoorOpen size={15}/></span>{entryLabels[side]}</button>)}</div>
            <div className="quiet-note"><ShieldCheck size={13}/><span>外牆不變，生活有更多可能。</span></div>
          </>}
          {panel === 'furniture' && <><div className="section-title"><span>家具圖塊庫</span><span className="tiny-label">10 BLOCKS</span></div><p className="section-description">點選加入圖面，拖曳擺放。選取後可調整尺寸與旋轉。</p><div className="furniture-grid">{(Object.keys(catalog) as FurnitureKind[]).map(kind => <button key={kind} className="catalog-card" onClick={() => addFurniture(kind)}><div className="catalog-preview"><svg viewBox="-2 -1.5 4 3"><FurnitureShape f={{ id: kind, kind, x: 0, y: 0, w: catalog[kind].w, d: catalog[kind].d, rotation: 0 }}/></svg><span><Plus size={13}/></span></div><strong>{catalog[kind].name}</strong><small>{catalog[kind].group} · {(catalog[kind].w * 100).toFixed(0)} × {(catalog[kind].d * 100).toFixed(0)} cm</small></button>)}</div></>}
          {panel === 'plans' && <><div className="section-title"><span>我的配置方案</span><span className="tiny-label">{saved.length} / 12</span></div><p className="section-description">保留喜歡的配置，隨時載入比較。方案儲存於此瀏覽器。</p><button className="button save-current" onClick={savePlan}><Plus size={15}/>保留目前方案</button><button className="text-button import-button" onClick={() => importInput.current?.click()}><FileJson size={13}/>載入 JSON 備份</button>{saved.length === 0 ? <div className="empty-plans"><Layers size={30} strokeWidth={1}/><strong>收藏空間的可能</strong><p>完成一個喜歡的配置後，<br/>點選「保留目前方案」。</p></div> : saved.map(s => <div className="saved-card" key={s.id}><button className="saved-preview" onClick={() => { commit(structuredClone(s)); setSelected(null); setView('2d'); setZoom(1); setPan({ x: 0, y: 0 }); notify('已載入儲存方案'); }}><svg viewBox={`-1 -1 ${s.width + 2} ${s.depth + 2}`}><PlanDrawing plan={s} display={{ ...defaultDisplay, dimensions: false, labels: false }}/></svg></button><div><span><strong>{s.name}</strong><small>{(s.width * s.depth).toFixed(0)} m² · {entryLabels[s.entry]}入口</small></span><button className="icon-button danger" aria-label={`刪除${s.name}`} onClick={() => { setSaved(old => old.filter(p => p.id !== s.id)); notify('已移除儲存方案'); }}><Trash2 size={14}/></button></div></div>)}</>}
        </div>
        <div className="sidebar-footer"><div className="generate-caption"><Sparkles size={14}/><span>讓空間，長出新的可能。</span></div><button className="button generate-button" onClick={openGenerate}><Sparkles size={17}/>生成配置方案<ArrowRight size={16}/></button><span className="footer-hint">3 種空間提案，探索理想生活</span></div>
      </aside>

      <section className={`canvas-area ${display.grid && view === '2d' ? 'show-grid' : ''}`} aria-label="設計工作區">
        <div className="canvas-topline"><div><span className="floor-chip"><Layers size={13}/>1F</span><span className="canvas-title">{plan.name}</span><span className="canvas-tag">{view === '2d' ? '平面配置圖' : '空間模型'}</span></div><div className="canvas-actions"><button className="icon-button mobile-tools" aria-label="開啟工具面板" onClick={() => setMobilePanel(!mobilePanel)}><Settings2 size={17}/></button><button className="icon-button" title="復原 (⌘/Ctrl Z)" aria-label="復原" disabled={!undo.length} onClick={undoAction}><Undo2 size={17}/></button><button className="icon-button" title="重做 (⌘/Ctrl Shift Z)" aria-label="重做" disabled={!redo.length} onClick={redoAction}><Redo2 size={17}/></button><span/><button className="icon-button" title="置中圖面" aria-label="置中圖面" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}><Expand size={17}/></button></div></div>
        <div className="canvas-content">
          {view === '2d' ? <><div className="floating-tools"><button className={tool === 'select' ? 'active' : ''} title="選取 (V)" aria-label="選取工具" onClick={() => setTool('select')}><MousePointer2 size={19}/></button><button className={tool === 'hand' ? 'active' : ''} title="平移 (H)" aria-label="平移工具" onClick={() => setTool('hand')}><Hand size={18}/></button><span/><button className={tool === 'wall' ? 'active' : ''} title="繪製隔間 (W)" aria-label="繪製隔間" onClick={() => setTool('wall')}><PencilRuler size={19}/></button><button title="加入家具" aria-label="加入家具" onClick={() => { setPanel('furniture'); setMobilePanel(true); }}><Armchair size={19}/></button><span/><button className={display.dimensions ? 'muted-active' : ''} title="尺寸標註" aria-label="切換尺寸標註" onClick={() => toggleDisplay('dimensions')}><Ruler size={18}/></button></div>
            <PlanCanvas plan={plan} display={display} selected={selected} tool={tool} zoom={zoom} pan={pan} preview={tool === 'calibrate' && calibrationPoints[0] && hover ? { a: calibrationPoints[0], b: calibrationPoints[1] || hover } : wallStart && hover ? { a: wallStart, b: hover } : null} onPointDown={pointDown} onMove={onMove} onUp={() => { drag.current = null; wallDrag.current = null; underlayDrag.current = null; panDrag.current = null; }} onFurniture={furnitureDown} onWall={(id, p, e, endpoint) => { if (tool !== 'select') return; e.stopPropagation(); setSelected(id); wallDrag.current = { id, start: p, original: plan, moved: false, endpoint }; e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId); }}/>
            <div className="north-indicator"><span>N</span><svg width="19" height="30" viewBox="0 0 19 30"><path d="M9.5 2 L16 26 L9.5 21 L3 26 Z" fill="none" stroke="currentColor"/><path d="M9.5 2 V21 L3 26 Z" fill="currentColor"/></svg></div>
            <div className="mobile-selection">{selected && (f || wall) && <><strong>{f ? catalog[f.kind].name : "室內隔間"}</strong>{f && <><label>寬 <input aria-label="行動版家具寬度" type="number" min=".2" max={plan.width - .5} step=".1" value={f.w} onChange={e => setProperty("w", clamp(+e.target.value, .2, plan.width - .5))}/></label><button onClick={rotateSelected} aria-label="旋轉選取家具"><RotateCw size={15}/></button></>}<button onClick={removeSelected} aria-label="刪除選取物件"><Trash2 size={15}/></button><button onClick={() => setSelected(null)} aria-label="取消選取"><X size={15}/></button></>}</div><div className="drawing-caption"><span>01 / FLOOR PLAN</span><strong>把生活，放進理想的空間。</strong></div>
            {(tool === 'calibrate' || tool === 'underlay') && <div className="tool-instruction"><Ruler size={14}/>{tool === 'underlay' ? '拖曳底圖以對齊牆面' : calibrationPoints.length ? '點選尺寸線另一端' : '點選尺寸線第一個端點'}<span>Esc 結束</span></div>}{tool === 'wall' && <div className="tool-instruction"><PencilRuler size={14}/>{wallStart ? '點選終點完成牆面' : '點選起點開始繪製'}<span>Shift 自由角度 · Esc 取消</span></div>}
          </> : <Suspense fallback={<div className="loading-scene"><Box size={30}/><span>正在建構你的空間…</span></div>}><Scene3D plan={plan} cutaway={cutaway} furniture={display.furniture} labels={display.labels}/></Suspense>}
        </div>
        <div className="canvas-bottomline"><div className="canvas-legend"><span><i className="wall-legend"/>既有外牆</span><span><i className="partition-legend"/>室內隔間</span><span><i className="window-legend"/>窗戶示意</span></div>{view === '2d' ? <div className="zoom-controls"><button aria-label="縮小" onClick={() => setZoom(z => clamp(z - .15, .5, 2.5))}><Minus size={14}/></button><button className="zoom-value" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>{Math.round(zoom * 100)}%<ChevronDown size={10}/></button><button aria-label="放大" onClick={() => setZoom(z => clamp(z + .15, .5, 2.5))}><Plus size={14}/></button><span/><button aria-label="切換格線" className={display.grid ? 'active' : ''} onClick={() => toggleDisplay('grid')}><Grid2X2 size={15}/></button></div> : <span className="model-live"><span className="status-dot"/>與 2D 圖面同步</span>}</div>
      </section>

      <aside className="right-sidebar"><div className="sidebar-heading"><span>{selected ? '物件屬性' : '設計概覽'}</span><Settings2 size={15}/></div><div className="right-scroll">
        {selected && (f || wall) ? <div className="selected-inspector"><div className="inspector-object-icon">{f ? <Armchair size={26} strokeWidth={1.3}/> : <PencilRuler size={26} strokeWidth={1.3}/>}</div><h3>{f ? catalog[f.kind].name : '室內隔間牆'}</h3><span className="selected-badge">已選取物件</span>{f && <><div className="field-row"><label>寬度<div className="input-unit"><input aria-label="家具寬度" type="number" min=".2" max={plan.width - .5} step=".1" value={f.w} onChange={e => setProperty('w', clamp(+e.target.value, .2, plan.width - .5))}/><span>m</span></div></label><label>深度<div className="input-unit"><input aria-label="家具深度" type="number" min=".2" max={plan.depth - .5} step=".1" value={f.d} onChange={e => setProperty('d', clamp(+e.target.value, .2, plan.depth - .5))}/><span>m</span></div></label></div><div className="label-between"><span>旋轉角度</span><button className="button small-button" onClick={rotateSelected}><RotateCw size={13}/>{f.rotation}°</button></div><div className="coordinate-row"><span>X <strong>{f.x.toFixed(1)} m</strong></span><span>Y <strong>{f.y.toFixed(1)} m</strong></span></div><button className="button full-width" onClick={() => { const copied = constrainFurniture({ ...f, id: uid(), x: f.x + .3, y: f.y + .3 }, plan); commit({ ...plan, furniture: [...plan.furniture, copied] }); setSelected(copied.id); }}><Copy size={13}/>複製家具</button></>}{wall && <><WallLengthControl wall={wall} plan={plan} onApply={nextWall => commit({ ...plan, rooms: [], walls: plan.walls.map(w => w.id === nextWall.id ? nextWall : w) })}/><label className="field-label">隔間厚度</label><div className="input-unit"><input aria-label="選取牆面厚度" type="number" min="5" max="40" value={Math.round(wall.thickness * 100)} onChange={e => commit({ ...plan, walls: plan.walls.map(w => w.id === wall.id ? { ...w, thickness: clamp(+e.target.value, 5, 40) / 100 } : w) })}/><span>cm</span></div></>}<button className="button delete-button" onClick={removeSelected}><Trash2 size={14}/>刪除物件<kbd>⌫</kbd></button><button className="text-button deselect-button" onClick={() => setSelected(null)}><ArrowLeft size={12}/>返回設計概覽</button></div> : <>
          <div className="overview-kicker">YOUR SPACE, REIMAGINED</div><h2>理想生活，<br/>從好的配置開始。</h2><p className="overview-intro">每一條線，都是生活的輪廓。</p>
          <div className="area-card"><span>空間總面積<MoveUpRight size={14}/></span><div>{(plan.width * plan.depth).toFixed(1)}<small>m²</small></div><p>約 {(plan.width * plan.depth / 3.305785).toFixed(1)} 坪<span>1F 住宅空間</span></p></div>
          <div className="summary-stats"><div><span>空間分區</span><strong>{plan.rooms.length || '—'}<small>區</small></strong></div><div><span>家具配置</span><strong>{plan.furniture.length}<small>件</small></strong></div><div><span>室內隔間</span><strong>{plan.walls.length}<small>段</small></strong></div></div>
          <div className="section-rule"/><div className="section-title"><span>空間組成</span><span className="tiny-label">ZONES</span></div>
          {plan.rooms.length ? <><div className="room-bar">{plan.rooms.map((r, i) => <span key={i} style={{ flex: r.area, background: ['#8c9c7e', '#b4bda5', '#d3ccb4', '#cad3c3', '#b8cecc'][i % 5] }}/>)}</div><div className="room-list">{plan.rooms.map((r, i) => <div key={i}><span><i style={{ background: ['#8c9c7e', '#b4bda5', '#d3ccb4', '#cad3c3', '#b8cecc'][i % 5] }}/>{r.name}</span><span>{r.area.toFixed(1)}<small> m²</small></span></div>)}</div><p className="area-note">分區面積為範本估算，未含牆體與通道。</p></> : <div className="zone-note">隔間已變更。重新生成範本可取得分區示意；手繪隔間暫不自動計算房間面積。</div>}
        </>}
        <div className="section-rule"/><div className="section-title"><span>{view === '2d' ? '圖面顯示' : '模型設定'}</span><Eye size={14}/></div>
        {(view === '2d' ? [['dimensions', '尺寸標註'], ['furniture', '家具圖塊'], ['hatch', '牆體剖面填充'], ['labels', '空間名稱']] as const : [['furniture', '顯示家具'], ['labels', '空間名稱']] as const).map(([key, label]) => <button className="display-toggle" key={key} onClick={() => toggleDisplay(key)}><span>{label}</span><span className={`switch ${display[key] ? 'on' : ''}`} role="switch" aria-checked={display[key]}/></button>)}
        {view === '3d' && <><div className="nordic-style-card"><strong>北歐簡約白系</strong><small>白色與淺木紋為主，搭配奶茶色、暖光與柔和陰影。</small><div className="style-swatches"><span><i/>純白</span><span><i/>米白</span><span><i/>淺木紋</span><span><i/>奶茶色</span></div></div><button className="display-toggle" onClick={() => setCutaway(!cutaway)}><span>剖切模式</span><span className={`switch ${cutaway ? 'on' : ''}`} role="switch" aria-checked={cutaway}/></button><label className="height-field">樓層高度<div className="small-unit"><input aria-label="樓層高度" type="number" min="2" max="5" step=".1" value={plan.height} onChange={e => commit({ ...plan, height: clamp(+e.target.value, 2, 5) })}/><span>m</span></div></label></>}
        <div className="design-tip"><span><Leaf size={15}/>設計小提醒</span><p>保留至少 90 cm 的主要通道，讓生活動線更從容。</p><small>配置為設計示意，施工前請由專業人員確認。</small></div>
      </div><button className="view-3d-card" onClick={() => setView(view === '2d' ? '3d' : '2d')}><div className="mini-cube"><Box size={28} strokeWidth={1}/></div><span><strong>{view === '2d' ? '走進你的理想空間' : '回到平面，細修設計'}</strong><small>{view === '2d' ? '將平面配置轉換成 3D' : '繼續調整牆面與家具'}</small></span><ArrowRight size={16}/></button></aside>
    </main>
    <footer className="app-footer"><span><span className="status-dot"/>設計工作室已就緒</span><span className="footer-center">{view === '2d' ? '點選選取 · 拖曳移動 · R 旋轉 · Delete 刪除' : '2D 與 3D 共用同一份配置資料'}</span><span>單位：公尺 <i/>格點：100 mm <i/><span className="footer-brand">PLANFORM STUDIO</span></span></footer>
    {toast && <div className="toast" role="status"><CheckCheck size={17}/>{toast}<button aria-label="關閉提示" onClick={() => setToast('')}><X size={13}/></button></div>}

    {modal === 'import' && <FloorplanImport onClose={() => setModal(null)} onApply={importFloorplan}/>}
    {modal === 'calibrate' && calibrationPoints.length === 2 && <CalibrationDialog measured={Math.hypot(calibrationPoints[1].x - calibrationPoints[0].x, calibrationPoints[1].y - calibrationPoints[0].y)} onClose={() => { setModal(null); setCalibrationPoints([]); }} onApply={applyCalibration}/>}
    {(modal === 'generate' || modal === 'help') && <div className="modal-backdrop" onClick={() => setModal(null)}><section role="dialog" aria-modal="true" aria-labelledby="modal-title" className={`modal ${modal === 'generate' ? 'generate-modal' : 'help-modal'}`} onClick={e => e.stopPropagation()}><button className="icon-button modal-close" aria-label="關閉對話框" onClick={() => setModal(null)}><X size={20}/></button>{modal === 'generate' ? <><div className="modal-eyebrow"><Sparkles size={15}/>A NEW WAY TO LIVE</div><h2 id="modal-title">同一個空間，三種生活提案。</h2><p className="modal-intro">保留外牆與空間尺寸，依入口方向重新安排隔間與家具。</p><div className="generation-settings"><span><DoorOpen size={16}/>玄關入口</span><div>{(['left', 'top', 'right', 'bottom'] as Entry[]).map(side => <button key={side} className={entry === side ? 'active' : ''} onClick={() => changeEntry(side)}>{entryLabels[side]}</button>)}</div><span className="preserved-boundary"><LockKeyhole size={12}/>{plan.width} × {plan.depth} m 外牆保留</span></div><div className="candidate-grid">{candidates.map((c, i) => <button key={c.id} className={`candidate-card ${i === candidate ? 'selected' : ''}`} onClick={() => setCandidate(i)}><div className="candidate-preview"><svg viewBox={`-1 -1 ${c.width + 2} ${c.depth + 2}`}><PlanDrawing plan={c} display={{ ...defaultDisplay, dimensions: false, labels: false }}/></svg><span className="candidate-number">0{i + 1}</span><span className="candidate-check">{i === candidate && <Check size={13}/>}</span></div><div className="candidate-info"><span>{['BALANCED LIVING', 'OPEN & CONNECTED', 'WORK & UNWIND'][i]}</span><h3>{c.name}</h3><p>{['公私分明，為日常留一點從容。', '打開客餐廳，讓交流自然發生。', '留一間書房，平衡專注與休息。'][i]}</p><small>{i === 2 ? '獨立書房' : i === 1 ? '開放公領域' : '獨立客餐廳'}<i/> {c.rooms.length} 個空間分區</small></div></button>)}</div><div className="modal-bottom"><p><CircleHelp size={14}/>使用規則範本生成，套用後可自由調整；目前配置可透過復原還原。</p><button className="button generate-button" onClick={applyCandidate}>套用此配置<ArrowRight size={16}/></button></div></> : <><div className="modal-eyebrow"><PencilRuler size={15}/>STUDIO GUIDE</div><h2 id="modal-title">把想像，畫成生活。</h2><p className="modal-intro">從配置範本開始，或親手定義每一個角落。</p><div className="guide-steps"><div><span>01</span><section><strong>選擇空間配置</strong><p>設定入口方向，點選「生成配置方案」，選擇適合你的生活範本。外牆尺寸會保留。</p></section></div><div><span>02</span><section><strong>畫牆、擺放家具</strong><p>按 W，依序點選牆面起點與終點。預設水平／垂直吸附，按住 Shift 可繪製斜牆。選取牆面可拖曳移動，端點可調整長度。家具可從圖塊庫加入並拖曳。</p></section></div><div><span>03</span><section><strong>比較方案，走進 3D</strong><p>保留不同方案後，切換 3D 旋轉查看。SVG 可匯出列印，JSON 可備份並從方案頁載入。</p></section></div></div><div className="shortcut-list"><span><kbd>V</kbd>選取</span><span><kbd>H</kbd>平移</span><span><kbd>W</kbd>畫牆</span><span><kbd>R</kbd>旋轉</span><span><kbd>⌘/Ctrl Z</kbd>復原</span><span><kbd>Esc</kbd>取消</span></div><p className="guide-limit">這是概念設計工具，尚未提供法規、結構、碰撞或無障礙動線檢核。3D 家具為量體示意，外牆窗戶為圖面示意。</p><button className="button generate-button guide-start" onClick={() => setModal(null)}>開始設計<ArrowRight size={15}/></button></>}</section></div>}
  </div>;
}
export default App;
