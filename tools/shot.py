# Render pages of the PSApad folder to PNG with headless Chromium (SwiftShader WebGL).
#   [TRANSPARENT=1] python -I tools/shot.py "brand/logo.html?m=card&s=1000" out.png [W H]
import os, sys, mimetypes, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
HOST = 'http://psapad.local/'

def serve(route):
    p = ROOT / route.request.url[len(HOST):].split('?')[0]
    if p.is_file():
        route.fulfill(status=200, body=p.read_bytes(), headers={'content-type': mimetypes.guess_type(p.name)[0] or 'application/octet-stream', 'access-control-allow-origin': '*'})
    else:
        route.fulfill(status=404, body='not found')

def main():
    page_url, out = sys.argv[1], sys.argv[2]
    w = int(sys.argv[3]) if len(sys.argv) > 3 else 1000
    h = int(sys.argv[4]) if len(sys.argv) > 4 else w
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=float(os.environ.get('DSF', '1')))   # DSF=2: 2x output
        pg.on('console', lambda m: print('console:', m.text) if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: print('pageerror:', e))
        pg.route(HOST + '**', serve)
        pg.goto(HOST + page_url)
        if os.environ.get('WAIT'): pg.wait_for_timeout(int(os.environ['WAIT']))
        else: pg.wait_for_function("document.body && document.body.dataset.ready === '1'", timeout=180000)
        if os.environ.get('SCROLL'): pg.evaluate(f"document.querySelector('{os.environ['SCROLL']}').scrollIntoView()"); pg.wait_for_timeout(2500)
        pg.wait_for_timeout(300)
        pg.screenshot(path=out, omit_background=bool(os.environ.get('TRANSPARENT')))
        b.close()
    print('ok', out)

main()
