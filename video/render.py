# Render video/film.html frame by frame (headless Chromium, SwiftShader) -> video/snowfight-showcase.mp4 with a synthesized track.
#   python -I video/render.py --stills 1 5 10 15 20 26     PNG stills to video/_still_*.png
#   python -I video/render.py                               full film (parallel workers, then encode)
import os, sys, subprocess, pathlib, wave, mimetypes
from concurrent.futures import ProcessPoolExecutor
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'video'; FR = OUT / '_frames'
FPS, DUR, WORKERS = int(os.environ.get('FPS', '60')), float(os.environ.get('DUR', '30')), int(os.environ.get('WORKERS', '4'))
HOST = 'http://snowfight.local/'
CUTS = [.6, 3.2, 8.2, 14.2, 19.2, 23.4, 27.0]

def ffmpeg():
    import imageio_ffmpeg; return imageio_ffmpeg.get_ffmpeg_exe()

def serve(route):
    p = ROOT / route.request.url[len(HOST):].split('?')[0]
    if p.is_file(): route.fulfill(status=200, body=p.read_bytes(), headers={'content-type': mimetypes.guess_type(p.name)[0] or 'application/octet-stream'})
    else: route.fulfill(status=404, body='')

def page(pw):
    b = pw.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 1920, 'height': 1080}); pg.on('pageerror', lambda e: print('pageerror', e))
    pg.route(HOST + '**', serve); pg.goto(HOST + 'video/film.html'); pg.wait_for_function('window.READY === true', timeout=120000); pg.wait_for_timeout(800)
    return b, pg

def chunk(rng):
    from playwright.sync_api import sync_playwright
    a, z = rng
    with sync_playwright() as pw:
        b, pg = page(pw)
        for i in range(a, z):
            pg.evaluate(f'renderAt({i / FPS})'); pg.screenshot(path=str(FR / f'f{i:05d}.jpg'), type='jpeg', quality=94)
            if (i - a) % 120 == 0: print(f'{a}-{z}: {i}', flush=True)
        b.close()

def music(path, dur=DUR, sr=44100, bpm=128.0):
    n = int(dur * sr); out = np.zeros(n); beat = 60 / bpm; rng = np.random.default_rng(3)
    def add(s, sig):
        i = int(s * sr)
        if 0 <= i < n: j = min(n, i + len(sig)); out[i:j] += sig[:j - i]
    def tone(f, d, vol, kind='saw'):
        tt = np.arange(int(d * sr)) / sr; ph = (tt * f) % 1
        s = (2 * ph - 1) if kind == 'saw' else np.sin(2 * np.pi * f * tt)
        return s * vol * np.minimum(1, tt / .01) * np.exp(-tt * 3.2)
    kt = np.arange(int(.3 * sr)) / sr; kick = np.sin(2 * np.pi * (45 + 130 * np.exp(-kt * 28)) * kt) * np.exp(-kt * 8) * .95
    hat = rng.standard_normal(int(.04 * sr)) * np.exp(-np.arange(int(.04 * sr)) / sr * 110) * .09
    clap = rng.standard_normal(int(.12 * sr)) * np.exp(-np.arange(int(.12 * sr)) / sr * 30) * .22
    bass = [43.65, 43.65, 51.91, 38.89]; chord = [[174.6, 220, 261.6], [174.6, 220, 261.6], [207.7, 261.6, 311.1], [155.6, 196, 233.1]]
    b = 0
    while b * beat < dur:
        s = b * beat; bar = int(b // 4) % 4
        if s >= 3.2 and s < 27.0:
            add(s, kick); add(s + beat / 2, hat); add(s + beat / 4 * 3, hat * .6)
            if b % 2: add(s, clap)
            add(s, tone(bass[bar], beat * .9, .2, 'saw'))
            if b % 4 == 0:
                for f in chord[bar]: add(s, tone(f, beat * 3.6, .045, 'saw'))
        b += 1
    add(.6, kick * 1.4); add(.6, rng.standard_normal(int(.6 * sr)) * np.exp(-np.arange(int(.6 * sr)) / sr * 6) * .35)
    for c in CUTS[1:]:
        L = int(.6 * sr); add(c - .6, rng.standard_normal(L) * np.linspace(0, .2, L)); add(c, kick * 1.1)
    for f in [523.3, 659.3, 784.0, 1046.5]: add(27.0, tone(f, 2.5, .08, 'sin'))
    for k in range(12): add(23.4 + k * .08, tone(1046.5 * (1 + k * .06), .25, .05, 'sin'))
    out[int((DUR - 1.2) * sr):] *= np.linspace(1, 0, n - int((DUR - 1.2) * sr))
    pcm = (np.tanh(out * 1.3) * .85 * 32767).astype(np.int16)
    with wave.open(str(path), 'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(pcm.tobytes())

if __name__ == '__main__':
    if '--stills' in sys.argv:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            b, pg = page(pw)
            for s in [float(x) for x in sys.argv[sys.argv.index('--stills') + 1:]]:
                pg.evaluate(f'renderAt({s})'); pg.screenshot(path=str(OUT / f'_still_{s:05.2f}.png'))
            b.close()
        sys.exit()
    FR.mkdir(exist_ok=True); total = int(DUR * FPS); todo = [i for i in range(total) if not (FR / f'f{i:05d}.jpg').exists()]
    if todo:
        a0 = todo[0]; total = todo[-1] + 1; step = (total - a0 + WORKERS - 1) // WORKERS
        with ProcessPoolExecutor(WORKERS) as ex: list(ex.map(chunk, [(a0 + k * step, min(total, a0 + (k + 1) * step)) for k in range(WORKERS)]))
    total = int(DUR * FPS); miss = [i for i in range(total) if not (FR / f'f{i:05d}.jpg').exists()]
    if miss: print('missing frames', miss[:10], len(miss)); sys.exit(1)
    wav = OUT / '_music.wav'; music(wav)
    subprocess.run([ffmpeg(), '-y', '-loglevel', 'error', '-framerate', str(FPS), '-i', str(FR / 'f%05d.jpg'), '-i', str(wav), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'medium',
                    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', str(OUT / 'snowfight-showcase.mp4')], check=True)
    subprocess.run([ffmpeg(), '-y', '-loglevel', 'error', '-i', str(OUT / 'snowfight-showcase.mp4'), '-an', '-c:v', 'copy', str(OUT / 'snowfight-showcase-muted.mp4')], check=True)
    print('done', OUT / 'snowfight-showcase.mp4')
