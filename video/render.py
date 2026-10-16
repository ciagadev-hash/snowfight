# Render the SnowPump showcase (video/film.html) frame by frame in headless Chromium, add the synthesized soundtrack, encode MP4.
#   python -I video/render.py                     16:9 film  -> video/snowpump-showcase.mp4 (+ -muted.mp4)
#   python -I video/render.py --vertical          9:16 cut   -> video/snowpump-showcase-vertical.mp4
#   python -I video/render.py --stills 0.3 8.7    PNG stills -> video/_still_*.png
#   python -I video/render.py --gpu --max          max quality: renders at 2x (3840x2160), then a supersampled 1080p film + a 4K master
# Options: --workers N (parallel browsers, default 4), --gpu (use the graphics card instead of SwiftShader: much faster where it works),
#          --fresh (throw away frames from an older render).
# Needs: pip install playwright numpy imageio-ffmpeg  and  python -m playwright install chromium
import os, sys, json, hashlib, shutil, subprocess, pathlib, mimetypes, time
from concurrent.futures import ProcessPoolExecutor

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'video'
HOST = 'http://snowpump.local/'
ARGS = sys.argv[1:]
VERT = '--vertical' in ARGS
GPU = '--gpu' in ARGS
SS = 2 if '--max' in ARGS else 1                   # supersampling: page rendered at 2x device pixels
WORKERS = int(ARGS[ARGS.index('--workers') + 1]) if '--workers' in ARGS else int(os.environ.get('WORKERS', '4'))
W, H = (1080, 1920) if VERT else (1920, 1080)
FPS = 60
FR = OUT / (('_frames916' if VERT else '_frames') + ('_x2' if SS > 1 else ''))
NAME = 'snowpump-showcase-vertical' if VERT else 'snowpump-showcase'
SOURCES = ['video/film.html', 'video/shots.js', 'site/world.js', 'site/sim.js']

def ffmpeg():
    import imageio_ffmpeg; return imageio_ffmpeg.get_ffmpeg_exe()

def serve(route):
    p = ROOT / route.request.url[len(HOST):].split('?')[0]
    # explicit types: on Windows the registry can map .js to text/plain, which breaks ES modules
    ct = {'.js': 'text/javascript', '.html': 'text/html', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json'}.get(p.suffix.lower()) or mimetypes.guess_type(p.name)[0] or 'application/octet-stream'
    if p.is_file(): route.fulfill(status=200, body=p.read_bytes(), headers={'content-type': ct})
    else: route.fulfill(status=404, body='')

def page(pw):
    args = ['--ignore-gpu-blocklist'] + ([] if GPU else ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    exe = os.environ.get('CHROME') or None
    b = pw.chromium.launch(args=args, executable_path=exe)
    pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=SS)
    pg.on('pageerror', lambda e: print('pageerror', e, flush=True))
    pg.route(HOST + '**', serve)
    pg.goto(HOST + 'video/film.html' + ('?ar=916' if VERT else ''))
    pg.wait_for_function('window.READY === true', timeout=180000); pg.wait_for_timeout(500)
    return b, pg

def chunk(rng):
    from playwright.sync_api import sync_playwright
    a, z = rng
    with sync_playwright() as pw:
        b, pg = page(pw); t0 = time.time()
        for i in range(a, z):
            f = FR / f'f{i:05d}.jpg'
            if f.exists(): continue
            pg.evaluate(f'renderAt({i / FPS})'); pg.screenshot(path=str(f), type='jpeg', quality=96 if SS > 1 else 95)
            if (i - a) % 60 == 0: print(f'  frames {a}-{z}: at {i}  ({(time.time() - t0) / max(1, i - a + 1):.2f}s/frame)', flush=True)
        b.close()

def source_hash():
    h = hashlib.sha1()
    for s in SOURCES: h.update((ROOT / s).read_bytes())
    return h.hexdigest()[:16] + ('v' if VERT else 'h') + str(SS)

if __name__ == '__main__':
    from playwright.sync_api import sync_playwright
    if '--stills' in ARGS:
        ts = [float(x) for x in ARGS[ARGS.index('--stills') + 1:] if not x.startswith('--')]
        with sync_playwright() as pw:
            b, pg = page(pw)
            for s in ts: pg.evaluate(f'renderAt({s})'); pg.screenshot(path=str(OUT / f'_still_{s:05.2f}{"_v" if VERT else ""}.png')); print('still', s)
            b.close()
        sys.exit()
    FR.mkdir(exist_ok=True)
    stamp = FR / '.source'
    if '--fresh' in ARGS or not stamp.exists() or stamp.read_text() != source_hash():
        shutil.rmtree(FR); FR.mkdir(); stamp.write_text(source_hash())
    with sync_playwright() as pw:
        b, pg = page(pw); info = pg.evaluate('collectEvents()'); b.close()
    total = min(int(round(info['dur'] * FPS)), int(os.environ.get('MAXF', 10 ** 9))); print(f'{NAME}: {total} frames at {W}x{H}, {WORKERS} workers{" (GPU)" if GPU else ""}', flush=True)
    todo = [i for i in range(total) if not (FR / f'f{i:05d}.jpg').exists()]
    if todo:
        a0, z0 = todo[0], todo[-1] + 1; step = (z0 - a0 + WORKERS - 1) // WORKERS
        with ProcessPoolExecutor(WORKERS) as ex: list(ex.map(chunk, [(a0 + k * step, min(z0, a0 + (k + 1) * step)) for k in range(WORKERS)]))
    miss = [i for i in range(total) if not (FR / f'f{i:05d}.jpg').exists()]
    if miss: print('missing frames', miss[:10], len(miss)); sys.exit(1)
    sys.path.insert(0, str(OUT)); import soundtrack
    wav = OUT / '_soundtrack.wav'; soundtrack.build(info, wav); print('soundtrack ok', flush=True)
    mp4 = OUT / f'{NAME}.mp4'
    enc = lambda out, extra, crf: subprocess.run([ffmpeg(), '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', str(FR / 'f%05d.jpg'), '-i', str(wav), *extra, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', str(crf), '-preset', 'slow',
                    '-profile:v', 'high', '-tune', 'animation', '-threads', '2', '-c:a', 'aac', '-b:a', '320k' if SS > 1 else '256k', '-shortest', '-movflags', '+faststart', str(out)], check=True)
    if SS > 1:   # supersampled 1080p for posting, plus the 4K master
        enc(mp4, ['-vf', f'scale={W}:{H}:flags=lanczos'], 15); print('1080p ok', flush=True)
        enc(OUT / f'{NAME}-4k.mp4', [], 17); print('4k ok', flush=True)
    else: enc(mp4, [], 18)
    subprocess.run([ffmpeg(), '-y', '-loglevel', 'error', '-i', str(mp4), '-an', '-c:v', 'copy', str(OUT / f'{NAME}-muted.mp4')], check=True)
    print('done', mp4)
