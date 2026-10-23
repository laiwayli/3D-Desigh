from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parent.parent
html = root / "dist-standalone/Planform.html"
if not html.exists():
    raise SystemExit("Run npm run test:standalone before packaging.")
output = root / "downloads/Planform.zip"
output.parent.mkdir(exist_ok=True)
instructions = """Planform 智構 — 圖面匯入與尺寸校正版

1. 下載 ZIP 到電腦並解壓縮，以 Chrome 或 Edge 開啟 Planform.html。
2. 調整長寬：空間 → 解鎖調整 → 輸入長寬 → 套用長寬。
3. 匯入原圖：空間 → 匯入圖片／PDF 平面圖，選擇 PNG、JPG、WebP 或 PDF。
4. 依原圖標註校正：點選同一尺寸線兩端，輸入數值並選擇 mm、cm 或 m。
5. 描繪牆面，選取牆面後可精確輸入長度，再配置家具與查看北歐白系 3D。

不需要 Node.js、伺服器或網路。PDF 多頁可選取，檔案僅在本機瀏覽器處理。
底圖不會自動轉成牆面；PNG/JPG 的尺寸數字需自行確認。PDF 讀取到的數值也需核對。
已校正底圖會保留實際比例。請在調整長寬後檢查隔間與底圖是否仍對齊。
重要方案請匯出 JSON 備份，JSON 也包含底圖。
3D 為即時設計示意，圖面仍需專業人員核對。

聊天附件／手機檔案預覽器可能不允許 JavaScript，請下載到電腦後用瀏覽器開啟。
離線版已在拒絕外部請求的隔離頁面驗證；本雲端政策禁止 file://，因此未在此機器直接開檔驗證。
"""
with ZipFile(output, "w", ZIP_DEFLATED) as archive:
    archive.write(html, "Planform.html")
    archive.writestr("README.txt", instructions)
with ZipFile(output) as archive:
    assert archive.testzip() is None
    assert archive.read("Planform.html") == html.read_bytes()
print(f"Verified download: {output.relative_to(root)} ({output.stat().st_size:,} bytes)")
