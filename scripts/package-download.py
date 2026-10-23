from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
from xml.etree import ElementTree

root = Path(__file__).resolve().parent.parent
html = root / "dist-standalone/Planform.html"
if not html.exists():
    raise SystemExit("Run npm run test:standalone before packaging.")
output = root / "downloads/Planform.zip"
output.parent.mkdir(exist_ok=True)
instructions = "Planform 智構 v2 — 同戶圖面核對、家具預設與 10 種風格\n\n" + (root / "downloads/README.md").read_text()
with ZipFile(output, "w", ZIP_DEFLATED) as archive:
    archive.write(html, "Planform.html")
    archive.writestr("README.txt", instructions)
    preview = root / "downloads/reference-preview.png"
    if not preview.exists():
        raise SystemExit("Capture and review the current reference model preview before packaging.")
    assert preview.read_bytes().startswith(b"\x89PNG\r\n\x1a\n")
    archive.write(preview, "Same-house-v2-preview.png")
    drawing = root / "downloads/reference-plan.svg"
    ElementTree.fromstring(drawing.read_bytes())
    archive.write(drawing, "Same-house-v2-plan.svg")
with ZipFile(output) as archive:
    assert archive.testzip() is None
    assert archive.read("Planform.html") == html.read_bytes()
print(f"Verified download: {output.relative_to(root)} ({output.stat().st_size:,} bytes)")
