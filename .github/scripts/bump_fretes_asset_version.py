from pathlib import Path

path = Path("pages/fretes.html")
text = path.read_text(encoding="utf-8")

old = '<script src="../assets/js/fretes.js?v=11"></script>'
new = '<script src="../assets/js/fretes.js?v=12"></script>'

if new in text:
    print("fretes.html already uses v=12")
elif old in text:
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print("fretes.html updated to fretes.js?v=12")
else:
    raise SystemExit("Expected fretes.js?v=11 script tag not found")
