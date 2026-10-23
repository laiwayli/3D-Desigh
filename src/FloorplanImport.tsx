import { useEffect, useRef, useState } from 'react';
import { ArrowRight, FileImage, FileUp, LoaderCircle, RotateCcw, RotateCw, X } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { readImagePlan, readPdfPlan, renderPdfPlan } from './floorplanImport';
import type { RasterPlan } from './floorplanImport';
import { PlanCropPreview, ReconstructionOverlayPreview } from './PlanCropPreview';
import { PlanDrawing } from './PlanCanvas';
import { reconstructImage } from './reconstructImage';
import type { Crop } from './reconstructImage';
import type { Plan } from './model';
import type { StyleId } from './interiorStyles';
import { rotateRasterPlan } from './imagePreparation';

export function FloorplanImport({ onClose, onApply, onReconstruct, style }: { onClose: () => void; onApply: (image: RasterPlan, clearInterior: boolean) => void; onReconstruct: (plan: Plan) => void; style?: StyleId }) {
  const [image, setImage] = useState<RasterPlan | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [clear, setClear] = useState(true);
  const [pages, setPages] = useState(0), [pageNumber, setPageNumber] = useState(1), [annotations, setAnnotations] = useState<string[]>([]);
  const [mode, setMode] = useState<'auto' | 'underlay'>('auto'), [crop, setCrop] = useState<Crop>({ x: 0, y: 0, w: 1, h: 1 });
  const [width, setWidth] = useState(''), [depth, setDepth] = useState(''), [unit, setUnit] = useState('cm'), [confirmed, setConfirmed] = useState(false), [draft, setDraft] = useState<Plan | null>(null);
  const [preview, setPreview] = useState<'overlay' | 'model'>('overlay'), [showCandidates, setShowCandidates] = useState(true);
  const factor = unit === 'cm' ? .01 : unit === 'mm' ? .001 : 1;
  const dimensionsValid = [Number(width) * factor, Number(depth) * factor].every(n => Number.isFinite(n) && n >= 2 && n <= 60);
  useEffect(() => { setDraft(null); }, [crop, width, depth, unit, image]);
  const input = useRef<HTMLInputElement>(null), pdf = useRef<PDFDocumentProxy | null>(null), serial = useRef(0), name = useRef('');
  useEffect(() => () => { serial.current++; void pdf.current?.loadingTask.destroy(); }, []);
  const selectFile = async (file?: File) => {
    if (!file) return;
    const generation = ++serial.current;
    setBusy(true); setError(''); setImage(null); setPages(0); setPageNumber(1); setAnnotations([]); setDraft(null); setConfirmed(false); setWidth(''); setDepth(''); setPreview('overlay'); setCrop({ x: 0, y: 0, w: 1, h: 1 });
    void pdf.current?.loadingTask.destroy(); pdf.current = null; name.current = file.name;
    try {
      if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
        const document = await readPdfPlan(file);
        if (generation !== serial.current) { void document.loadingTask.destroy(); return; }
        pdf.current = document; setPages(document.numPages);
        const result = await renderPdfPlan(document, 1, file.name);
        if (generation === serial.current) { setImage(result.image); setAnnotations(result.annotations); }
      } else if (/\.(png|jpe?g|webp)$/i.test(file.name) || ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        const result = await readImagePlan(file); if (generation === serial.current) setImage(result);
      } else throw new Error('請選擇 PNG、JPG、WebP 或 PDF 檔案');
    } catch (e) { if (generation === serial.current) setError(e instanceof Error ? e.message : '匯入失敗，請重新選擇檔案'); }
    finally { if (generation === serial.current) setBusy(false); }
  };
  const selectPage = async (n: number) => {
    if (!pdf.current || busy) return;
    const generation = ++serial.current; setPageNumber(n); setBusy(true); setError(''); setImage(null); setConfirmed(false); setDraft(null); setWidth(''); setDepth(''); setCrop({ x: 0, y: 0, w: 1, h: 1 });
    try { const result = await renderPdfPlan(pdf.current, n, name.current); if (generation === serial.current) { setImage(result.image); setAnnotations(result.annotations); } }
    catch { if (generation === serial.current) setError('此頁無法繪製，請選擇其他頁面或轉存圖片'); }
    finally { if (generation === serial.current) setBusy(false); }
  };
  const rotate = async (direction: 1 | -1) => {
    if (!image || busy) return;
    const generation = ++serial.current; setBusy(true); setError('');
    try {
      const rotated = await rotateRasterPlan(image, direction);
      if (generation === serial.current) { setImage(rotated); setDraft(null); setConfirmed(false); setWidth(''); setDepth(''); setCrop({ x: 0, y: 0, w: 1, h: 1 }); }
    } catch (e) { if (generation === serial.current) setError(e instanceof Error ? e.message : '旋轉失敗，請重新讀取圖片'); }
    finally { if (generation === serial.current) setBusy(false); }
  };
  const generate = async () => {
    if (!image || !confirmed || !dimensionsValid) return;
    setBusy(true); setError(''); const generation = ++serial.current;
    try { const result = await reconstructImage(image, { width: Number(width) * factor, depth: Number(depth) * factor, crop, style }); if (generation === serial.current) { setDraft(result); setPreview('overlay'); setShowCandidates(true); } }
    catch (e) { if (generation === serial.current) setError(e instanceof Error ? e.message : '無法重建，請調整框選範圍'); }
    finally { if (generation === serial.current) setBusy(false); }
  };
  return <div className="modal-backdrop" onClick={onClose}><section role="dialog" aria-modal="true" aria-labelledby="import-title" className="modal floorplan-import-modal" onClick={e => e.stopPropagation()}>
    <button className="icon-button modal-close" aria-label="關閉匯入平面圖" onClick={onClose}><X size={20}/></button>
    <div className="modal-eyebrow"><FileImage size={15}/>FROM FLOOR PLAN TO YOUR SPACE</div><h2 id="import-title">從平面圖，重建你的空間。</h2><p className="modal-intro">讀取牆線、建立重建草稿並預設家具，再選擇 10 種室內風格。檔案只在此瀏覽器處理。</p>
    <div className="import-mode-tabs"><button className={mode === 'auto' ? 'active' : ''} onClick={() => setMode('auto')}>辨識牆面與自動配置</button><button className={mode === 'underlay' ? 'active' : ''} onClick={() => setMode('underlay')}>僅匯入描圖底圖</button></div>
    <input ref={input} type="file" hidden accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf" aria-label="選擇平面圖檔案" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void selectFile(file); }}/>
    <div className={`floorplan-dropzone ${image ? 'has-image' : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void selectFile(e.dataTransfer.files[0]); }}>
      {draft && mode === 'auto' ? preview === 'overlay' ? <ReconstructionOverlayPreview plan={draft} showCandidates={showCandidates}/> : <svg className="reconstruction-preview" data-testid="reconstruction-preview" viewBox={`-.6 -.6 ${draft.width + 1.2} ${draft.depth + 1.2}`}><PlanDrawing plan={draft} display={{ grid: false, dimensions: false, furniture: true, hatch: true, labels: true }}/></svg> : image ? mode === 'auto' ? <PlanCropPreview image={image} crop={crop} disabled={busy} onChange={c => { setCrop(c); setConfirmed(false); }}/> : <img src={image.src} alt="匯入平面圖預覽"/> : <><FileUp size={32} strokeWidth={1.2}/><strong>{busy ? '正在讀取圖面…' : '拖曳圖面到這裡，或選擇檔案'}</strong><span>PNG · JPG · WebP · PDF / 最大 15 MB</span></>}
      {busy && <div className="import-loading"><LoaderCircle size={23}/>正在建立清晰底圖…</div>}
    </div>
    <div className="import-file-row"><button className="button" onClick={() => input.current?.click()} disabled={busy}><FileUp size={14}/>{image ? '更換檔案' : '選擇檔案'}</button>{image && <span title={image.name}>{image.name}<small>{image.pixelWidth} × {image.pixelHeight} px</small></span>}{pages > 0 && <label>PDF 頁面<select aria-label="PDF 頁面" disabled={busy} value={pageNumber} onChange={e => void selectPage(+e.target.value)}>{Array.from({ length: pages }, (_, i) => <option key={i} value={i + 1}>第 {i + 1} / {pages} 頁</option>)}</select></label>}</div>
    {image && <div className="import-file-row"><button className="button secondary" disabled={busy} onClick={() => void rotate(-1)}><RotateCcw size={14}/>向左旋轉 90°</button><button className="button secondary" disabled={busy} onClick={() => void rotate(1)}><RotateCw size={14}/>向右旋轉 90°</button><small>先將圖面轉正，再框選主體並填尺寸。</small></div>}
    {draft && mode === 'auto' && <><div className="import-mode-tabs"><button className={preview === 'overlay' ? 'active' : ''} onClick={() => setPreview('overlay')}>原圖疊牆</button><button className={preview === 'model' ? 'active' : ''} onClick={() => setPreview('model')}>家具草稿</button></div>{preview === 'overlay' && <label className="import-clear"><input type="checkbox" checked={showCandidates} onChange={e => setShowCandidates(e.target.checked)}/><span>顯示候選牆線<small>青色：候選隔間；橘色虛線：暫用矩形外框。取消勾選可直接比對原圖。</small></span></label>}<div className="import-workflow" role="status"><strong>判讀摘要</strong><p>{draft.reconstruction?.notes[0]}<br/>{draft.walls.length} 段候選隔間・{draft.rooms.length} 個推測分區・{draft.furniture.length} 件預設家具。請優先檢查外框、柱位、門洞，以及是否把尺寸線當成牆。</p>{draft.reconstruction?.notes.filter(n => n.startsWith('短線')).map(n => <p key={n}>{n}</p>)}</div></>}
    {error && <p className="import-error" role="alert">{error}</p>}
    {mode === 'auto' && image && <><p className="dimension-hint">{draft ? '將候選牆疊回原圖核對；若外框或線段偏移，請重新框選後再辨識。' : '在預覽中拖曳框選建築本體，排除尺寸線、圖例、電路符號與外圍文字。'}<button className="text-button" disabled={busy} onClick={() => { setCrop({ x: 0, y: 0, w: 1, h: 1 }); setDraft(null); setConfirmed(false); }}>重設框選</button></p><div className="reconstruction-dimensions"><label>主體總寬<input aria-label="重建主體總寬" type="number" step="any" placeholder="依此張圖輸入" disabled={busy} value={width} onChange={e => { setWidth(e.target.value); setConfirmed(false); }}/></label><label>主體總深<input aria-label="重建主體總深" type="number" step="any" placeholder="依此張圖輸入" disabled={busy} value={depth} onChange={e => { setDepth(e.target.value); setConfirmed(false); }}/></label><label>單位<select aria-label="重建尺寸單位" disabled={busy} value={unit} onChange={e => { setUnit(e.target.value); setConfirmed(false); }}><option value="cm">cm</option><option value="mm">mm</option><option value="m">m</option></select></label></div><label className="import-clear"><input type="checkbox" checked={confirmed} disabled={!dimensionsValid || busy} onChange={e => setConfirmed(e.target.checked)}/><span>我已依原圖核對總寬、總深與單位<small>請填寫框選範圍對應的實際總尺寸（換算後各 2–60 m），不套用其他房子的尺寸。</small></span></label><p className="reconstruction-caveat">這是直線辨識草稿，不讀房間名稱、不理解電路符號，也不校正斜拍透視。外牆暫用矩形，房間用途依面積推測；柱、門窗、陽台、雨遮與用途未明區須核對。雜訊過多時會拒絕重建，可改用底圖描繪。</p></>}
    {annotations.length > 0 && <div className="pdf-annotations"><strong>PDF 可讀取的數值標註</strong><div>{annotations.map((s, i) => <span key={i}>{s}</span>)}</div><small>可能包含標號或其他數值；請確認尺寸線位置與原圖單位後再校正。</small></div>}
    {mode === 'underlay' && <><label className="import-clear"><input type="checkbox" checked={clear} onChange={e => setClear(e.target.checked)}/><span>清空目前的室內隔間與家具，從原圖開始描繪<small>保留外牆尺寸；可用「復原」找回原配置。</small></span></label><div className="import-workflow"><strong>底圖描繪模式</strong><p>選尺寸線兩端並輸入標註值（mm／cm／m）校正，再手動描牆。此模式不辨識牆面。</p></div></>}
    <div className="modal-bottom"><span className="import-bottom-note">{mode === 'auto' ? '套用重建會建立新格局，可使用復原回到原配置。' : '建議選用最長且清楚的尺寸線，減少點選誤差。'}</span>{mode === 'auto' ? <button className="button generate-button" disabled={!image || busy || !confirmed || !dimensionsValid} onClick={() => draft ? onReconstruct(draft) : void generate()}>{draft ? '套用重建並開啟 3D' : '辨識牆面並配置家具'}<ArrowRight size={15}/></button> : <button className="button generate-button" disabled={!image || busy} onClick={() => image && onApply(image, clear)}>匯入並校正比例<ArrowRight size={15}/></button>}</div>
  </section></div>;
}

export function CalibrationDialog({ measured, onClose, onApply }: { measured: number; onClose: () => void; onApply: (metres: number) => void }) {
  const [value, setValue] = useState(''), [unit, setUnit] = useState('mm');
  const metres = Number(value) * (unit === 'mm' ? .001 : unit === 'cm' ? .01 : 1);
  return <div className="modal-backdrop" onClick={onClose}><form className="modal calibration-modal" role="dialog" aria-modal="true" aria-labelledby="calibration-title" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); if (value && metres >= .01 && metres <= 120) onApply(metres); }}>
    <button type="button" className="icon-button modal-close" aria-label="取消比例校正" onClick={onClose}><X size={20}/></button><div className="modal-eyebrow">DIMENSION, NOT GUESSWORK</div><h2 id="calibration-title">以圖上的標註尺寸為準。</h2><p className="modal-intro">輸入剛才選取兩點之間的實際距離。例如圖上標示 3600 mm，請輸入 3600 並選擇 mm。</p><label className="field-label" htmlFor="known-distance">圖面標註的已知距離</label><div className="calibration-input"><input id="known-distance" aria-label="已知距離" type="number" step="any" min=".01" required value={value} placeholder="例如 3600" onChange={e => setValue(e.target.value)}/><select aria-label="尺寸單位" value={unit} onChange={e => setUnit(e.target.value)}><option value="mm">mm 毫米</option><option value="cm">cm 公分</option><option value="m">m 公尺</option></select></div><p className="calibration-conversion">{value && metres > 0 ? `換算為 ${metres.toFixed(3)} m` : '請依原圖單位輸入，不預設圖片的印刷比例。'}<span>目前兩點距離：{measured.toFixed(3)} m</span></p><p className="section-description">此操作只校正底圖，保留已繪製牆面與家具。完成後請依總尺寸調整外牆，再沿底圖描繪。</p><button className="button generate-button full-width" type="submit" disabled={!value || !Number.isFinite(metres) || metres < .01 || metres > 120}>套用標註尺寸<ArrowRight size={15}/></button>
  </form></div>;
}
