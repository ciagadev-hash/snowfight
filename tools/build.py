# Build the release: dist/index.html (one self-contained file) + og.png + _worker.js, and snowpump-site.zip for Cloudflare Pages.
#   python -I tools/build.py [CA] [--first-in MIN]   links (X, Discord, pump.fun) and the CA live in site/config.json;
#   --first-in sets the FIRST ROUND clock to MIN minutes after the build (UTC), practice rounds until then
# The site's ES modules (sim, world, sfx, game) are inlined as data: URL modules behind the import map, so each keeps its own scope.
import base64, io, pathlib, re, shutil, sys, zipfile, json, datetime
from PIL import Image
ROOT = pathlib.Path(__file__).resolve().parent.parent; SITE, DIST = ROOT / 'site', ROOT / 'dist'; DIST.mkdir(exist_ok=True)
MODULES = ['sim', 'world', 'sfx', 'game']
def uri(path, size, fmt='WEBP', q=86):
    im = Image.open(path).convert('RGB'); im.thumbnail((size, size), Image.LANCZOS); b = io.BytesIO(); im.save(b, fmt, quality=q); return f'data:image/{fmt.lower()};base64,' + base64.b64encode(b.getvalue()).decode()
local = lambda src: re.sub(r"from '\./(\w+)\.js'", lambda m: f"from 'snowpump/{m.group(1)}'", src)
h = (SITE / 'index.dev.html').read_text(encoding='utf8')
h = h.replace('__PFP__', uri(SITE / 'pfp.png', 400)).replace('__ICON__', uri(SITE / 'pfp.png', 64, 'PNG'))
m = re.search(r'<script type="importmap">(.*?)</script>', h, re.S); imap = json.loads(m.group(1))
for name in MODULES: imap['imports'][f'snowpump/{name}'] = 'data:text/javascript;base64,' + base64.b64encode(local((SITE / f'{name}.js').read_text(encoding='utf8')).encode()).decode()
h = h.replace(m.group(0), '<script type="importmap">' + json.dumps(imap, separators=(',', ':')) + '</script>')
cfg = dict(json.loads((SITE / 'config.json').read_text(encoding='utf8')), live=False)   # ca, x, discord, pumpfun links
args = sys.argv[1:]
if '--first-in' in args: i = args.index('--first-in'); at = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=float(args[i + 1]) + 1)).replace(second=0, microsecond=0); cfg['firstRound'] = at.isoformat().replace('+00:00', 'Z'); del args[i:i + 2]; print('FIRST ROUND at', cfg['firstRound'], '(UTC)')
if args: cfg['ca'] = args[0]
app = local((SITE / 'app.js').read_text(encoding='utf8'))
h = h.replace('<script type="module" src="app.js"></script>', f'<script>window.SNOWPUMP={json.dumps(cfg)}</script>\n<script type="module">\n{app}\n</script>')
(DIST / 'index.html').write_text(h, encoding='utf8', newline='\n')
shutil.copy(SITE / 'og.png', DIST / 'og.png'); shutil.copy(ROOT / 'deploy' / '_worker.js', DIST / '_worker.js')
with zipfile.ZipFile(ROOT / 'snowpump-site.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for f in DIST.iterdir(): z.write(f, f.name)
print('index.html', round(len(h.encode()) / 1024), 'KB')
