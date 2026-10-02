# Bundle src/ into one self-contained HTML file (Leaflet, CSS and JS inlined).
import re, pathlib
src = pathlib.Path(__file__).parent
html = (src / 'index.html').read_text()
html = re.sub(r'<link rel="stylesheet" href="((?:vendor|css)/[^"]+)">', lambda m: '<style>\n' + (src / m.group(1)).read_text() + '\n</style>', html)
html = re.sub(r'<script src="((?:vendor|js)/[^"]+)"></script>', lambda m: '<script>\n' + (src / m.group(1)).read_text().replace('</script>', '<\\/script>') + '\n</script>', html)
out = pathlib.Path(__file__).parent .parent / "HOP.html"
out.parent.mkdir(exist_ok=True)
out.write_text(html)
print(out, len(html))
