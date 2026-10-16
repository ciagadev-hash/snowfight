# Build the release: dist/index.html (one self-contained file) + og.png + _worker.js, and snowfight-site.zip for Cloudflare Pages.
#   python -I tools/build.py [CA]
import base64, io, pathlib, re, shutil, sys, zipfile, json
from PIL import Image
ROOT = pathlib.Path(__file__).resolve().parent.parent; SITE, DIST = ROOT / 'site', ROOT / 'dist'; DIST.mkdir(exist_ok=True)
def uri(path, size, fmt='WEBP', q=86):
    im = Image.open(path).convert('RGB'); im.thumbnail((size, size), Image.LANCZOS); b = io.BytesIO(); im.save(b, fmt, quality=q); return f'data:image/{fmt.lower()};base64,' + base64.b64encode(b.getvalue()).decode()
h = (SITE / 'index.dev.html').read_text(encoding='utf8')
h = h.replace('__PFP__', uri(SITE / 'pfp.png', 400)).replace('__ICON__', uri(SITE / 'pfp.png', 64, 'PNG'))
game = (SITE / 'game.js').read_text(encoding='utf8')
app = (SITE / 'app.js').read_text(encoding='utf8').replace("import { createArena } from './game.js';\n", '').replace("import { mountTitle } from './title3d.js';\n", '')
game = game.replace('export function createArena', 'function createArena')
# the 3D title shares the module scope with the game, so its duplicate three/RoomEnvironment imports go
title = (SITE / 'title3d.js').read_text(encoding='utf8').replace('export async function mountTitle', 'async function mountTitle')
title = title.replace("import * as THREE from 'three';\n", '').replace("import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';\n", '')
font = 'data:font/ttf;base64,' + base64.b64encode((SITE / 'fonts' / 'fredoka.ttf').read_bytes()).decode()
cfg = {'ca': sys.argv[1] if len(sys.argv) > 1 else '', 'live': False}
h = h.replace('<script type="module" src="app.js"></script>', f'<script>window.SNOWFIGHT={json.dumps(cfg)};window.TITLE_FONT="{font}"</script>\n<script type="module">\n' + game + '\n' + title + '\n' + app + '\n</script>')
(DIST / 'index.html').write_text(h, encoding='utf8', newline='\n')
shutil.copy(SITE / 'og.png', DIST / 'og.png'); shutil.copy(ROOT / 'deploy' / '_worker.js', DIST / '_worker.js')
with zipfile.ZipFile(ROOT / 'snowfight-site.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for f in DIST.iterdir(): z.write(f, f.name)
print('index.html', round(len(h.encode()) / 1024), 'KB')
