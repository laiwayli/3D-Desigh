import { useEffect, useRef, useState } from 'react';
import { ArrowRight, FileImage, FileUp, LoaderCircle, X } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { readImagePlan, readPdfPlan, renderPdfPlan } from './floorplanImport';
import type { RasterPlan } from './floorplanImport';

export function FloorplanImport({ onClose, onApply }: { onClose: () => void; onApply: (image: RasterPlan, clearInterior: boolean) => void }) {
  const [image, setImage] = useState<RasterPlan | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [clear, setClear] = useState(true);
  const [pages, setPages] = useState(0), [pageNumber, setPageNumber] = useState(1), [annotations, setAnnotations] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null), pdf = useRef<PDFDocumentProxy | null>(null), serial = useRef(0), name = useRef('');
  useEffect(() => () => { serial.current++; void pdf.current?.loadingTask.destroy(); }, []);
  const selectFile = async (file?: File) => {
    if (!file) return;
    const generation = ++serial.current;
    setBusy(true); setError(''); setImage(null); setPages(0); setPageNumber(1); setAnnotations([]);
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
    const generation = ++serial.current; setPageNumber(n); setBusy(true); setError(''); setImage(null);
    try { const result = await renderPdfPlan(pdf.current, n, name.current); if (generation === serial.current) { setImage(result.image); setAnnotations(result.annotations); } }
    catch { if (generation === serial.current) setError('此頁無法繪製，請選擇其他頁面或轉存圖片'); }
    finally { if (generation === serial.current) setBusy(false); }
  };
  return <div className="modal-backdrop" onClick={onClose}><section role="dialog" aria-modal="true" aria-labelledby="import-title" className="modal floorplan-import-modal" onClick={e => e.stopPropagation()}>
    <button className="icon-button modal-close" aria-label="關閉匯入平面圖" onClick={onClose}><X size={20}/></button>
    <div className="modal-eyebrow"><FileImage size={15}/>BRING YOUR SPACE IN</div><h2 id="import-title">從你的平面圖，開始設計。</h2><p className="modal-intro">匯入圖片或 PDF 作為描圖底圖，再以圖上確切的尺寸校正比例。檔案只在此瀏覽器處理。</p>
    <input ref={input} type="file" hidden accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf" aria-label="選擇平面圖檔案" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; void selectFile(file); }}/>
    <div className={`floorplan-dropzone ${image ? 'has-image' : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void selectFile(e.dataTransfer.files[0]); }}>
      {image ? <img src={image.src} alt="匯入平面圖預覽"/> : <><FileUp size={32} strokeWidth={1.2}/><strong>{busy ? '正在讀取圖面…' : '拖曳圖面到這裡，或選擇檔案'}</strong><span>PNG · JPG · WebP · PDF / 最大 15 MB</span></>}
      {busy && <div className="import-loading"><LoaderCircle size={23}/>正在建立清晰底圖…</div>}
    </div>
    <div className="import-file-row"><button className="button" onClick={() => input.current?.click()} disabled={busy}><FileUp size={14}/>{image ? '更換檔案' : '選擇檔案'}</button>{image && <span title={image.name}>{image.name}<small>{image.pixelWidth} × {image.pixelHeight} px</small></span>}{pages > 0 && <label>PDF 頁面<select aria-label="PDF 頁面" disabled={busy} value={pageNumber} onChange={e => void selectPage(+e.target.value)}>{Array.from({ length: pages }, (_, i) => <option key={i} value={i + 1}>第 {i + 1} / {pages} 頁</option>)}</select></label>}</div>
    {error && <p className="import-error" role="alert">{error}</p>}
    {annotations.length > 0 && <div className="pdf-annotations"><strong>PDF 可讀取的數值標註</strong><div>{annotations.map((s, i) => <span key={i}>{s}</span>)}</div><small>可能包含標號或其他數值；請確認尺寸線位置與原圖單位後再校正。</small></div>}
    <label className="import-clear"><input type="checkbox" checked={clear} onChange={e => setClear(e.target.checked)}/><span>清空目前的室內隔間與家具，從原圖開始描繪<small>保留外牆尺寸；可用「復原」找回原配置。</small></span></label>
    <div className="import-workflow"><strong>依圖面尺寸模擬</strong><p>匯入 → 點選一條尺寸線的兩端 → 輸入標註值（mm／cm／m）→ 校正比例 → 描牆與配置家具。底圖不會自動轉成牆面或 3D。</p></div>
    <div className="modal-bottom"><span className="import-bottom-note">建議選用最長且清楚的尺寸線，減少點選誤差。</span><button className="button generate-button" disabled={!image || busy} onClick={() => image && onApply(image, clear)}>匯入並校正比例<ArrowRight size={15}/></button></div>
  </section></div>;
}

export function CalibrationDialog({ measured, onClose, onApply }: { measured: number; onClose: () => void; onApply: (metres: number) => void }) {
  const [value, setValue] = useState(''), [unit, setUnit] = useState('mm');
  const metres = Number(value) * (unit === 'mm' ? .001 : unit === 'cm' ? .01 : 1);
  return <div className="modal-backdrop" onClick={onClose}><form className="modal calibration-modal" role="dialog" aria-modal="true" aria-labelledby="calibration-title" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); if (value && metres >= .01 && metres <= 120) onApply(metres); }}>
    <button type="button" className="icon-button modal-close" aria-label="取消比例校正" onClick={onClose}><X size={20}/></button><div className="modal-eyebrow">DIMENSION, NOT GUESSWORK</div><h2 id="calibration-title">以圖上的標註尺寸為準。</h2><p className="modal-intro">輸入剛才選取兩點之間的實際距離。例如圖上標示 3600 mm，請輸入 3600 並選擇 mm。</p><label className="field-label" htmlFor="known-distance">圖面標註的已知距離</label><div className="calibration-input"><input id="known-distance" aria-label="已知距離" type="number" step="any" min=".01" required value={value} placeholder="例如 3600" onChange={e => setValue(e.target.value)}/><select aria-label="尺寸單位" value={unit} onChange={e => setUnit(e.target.value)}><option value="mm">mm 毫米</option><option value="cm">cm 公分</option><option value="m">m 公尺</option></select></div><p className="calibration-conversion">{value && metres > 0 ? `換算為 ${metres.toFixed(3)} m` : '請依原圖單位輸入，不預設圖片的印刷比例。'}<span>目前兩點距離：{measured.toFixed(3)} m</span></p><p className="section-description">此操作只校正底圖，保留已繪製牆面與家具。完成後請依總尺寸調整外牆，再沿底圖描繪。</p><button className="button generate-button full-width" type="submit" disabled={!value || !Number.isFinite(metres) || metres < .01 || metres > 120}>套用標註尺寸<ArrowRight size={15}/></button>
  </form></div>;
}
