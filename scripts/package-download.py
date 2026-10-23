from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parent.parent
html = root / "dist-standalone/Planform.html"
if not html.exists():
    raise SystemExit("Run npm run test:standalone before packaging.")
output = root / "downloads/Planform.zip"
output.parent.mkdir(exist_ok=True)
instructions = "Planform 智構 — 平面圖重建、家具預設與 10 種風格\n\n" + (root / "downloads/README.md").read_text()
with ZipFile(output, "w", ZIP_DEFLATED) as archive:
    archive.write(html, "Planform.html")
    archive.writestr("README.txt", instructions)
    proposal = root / "downloads/nordic-proposal.png"
    if proposal.exists():
        archive.write(proposal, "Nordic-proposal-illustration.png")
with ZipFile(output) as archive:
    assert archive.testzip() is None
    assert archive.read("Planform.html") == html.read_bytes()
print(f"Verified download: {output.relative_to(root)} ({output.stat().st_size:,} bytes)")
