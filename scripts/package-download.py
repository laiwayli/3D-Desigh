from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
from xml.etree import ElementTree

root = Path(__file__).resolve().parent.parent
html = root / "dist-standalone/Planform.html"
if not html.exists():
    raise SystemExit("Run npm run test:standalone before packaging.")
output = root / "downloads/Planform.zip"
output.parent.mkdir(exist_ok=True)
instructions = "Planform 智構 v3 — 43 種家具、98 尺寸款式與精細風格\n\n" + (root / "downloads/README.md").read_text()
with ZipFile(output, "w", ZIP_DEFLATED) as archive:
    archive.write(html, "Planform.html")
    archive.writestr("README.txt", instructions)
    preview = root / "downloads/reference-preview.png"
    if not preview.exists():
        raise SystemExit("Capture and review the current reference model preview before packaging.")
    assert preview.read_bytes().startswith(b"\x89PNG\r\n\x1a\n")
    archive.write(preview, "Same-house-v3-preview.png")
    drawing = root / "downloads/reference-plan.svg"
    ElementTree.fromstring(drawing.read_bytes())
    archive.write(drawing, "Same-house-v3-plan.svg")
    for source, name in [("living-detail-preview.png", "Living-detail-v3.png"), ("style-comparison.png", "Style-comparison-v3.png"), ("furniture-v3-library.png", "Furniture-library-v3.png")]:
        picture = root / "downloads" / source
        assert picture.read_bytes().startswith(b"\x89PNG\r\n\x1a\n")
        archive.write(picture, name)
with ZipFile(output) as archive:
    assert archive.testzip() is None
    assert archive.read("Planform.html") == html.read_bytes()
print(f"Verified download: {output.relative_to(root)} ({output.stat().st_size:,} bytes)")
