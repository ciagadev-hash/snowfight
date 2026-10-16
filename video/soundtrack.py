# SnowPump showcase soundtrack: a 128 BPM bouncy pop track plus sound effects placed on the film's real events.
# Pure numpy synthesis, no samples. build(info, path) writes a 44.1 kHz stereo WAV.
#   info = window.collectEvents() from video/film.html: event times, captions, cuts, the cash-out beat.
import wave
import numpy as np

SR = 44100
rng = np.random.default_rng(7)
NOTE = {n: 440 * 2 ** ((i - 9) / 12) for i, n in enumerate(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])}
def hz(name):  # 'C5', 'G#3'
    n, o = name[:-1], int(name[-1]); return NOTE[n] * 2 ** (o - 4)

def T(d): return np.arange(int(d * SR)) / SR
def noise(d): return rng.standard_normal(int(d * SR))
def band(x, lo, hi, soft=.25):
    """Band-pass white noise through an FFT mask with soft edges."""
    F = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.clip((f - lo * (1 - soft)) / (lo * soft + 1e-9), 0, 1) * np.clip((hi * (1 + soft) - f) / (hi * soft + 1e-9), 0, 1)
    return np.fft.irfft(F * m, len(x))
def sweep_noise(d, f0, f1, width=.6, chunks=24):
    """Noise whose band glides from f0 to f1 (whooshes, risers)."""
    n = int(d * SR); out = np.zeros(n); L = n // chunks + 1; w = np.hanning(2 * L)
    for c in range(chunks * 2):
        a = c * L // 2; b = min(n, a + 2 * L); k = c / (chunks * 2); fc = f0 * (f1 / f0) ** k
        seg = band(noise((b - a) / SR + 1e-4)[:b - a], fc * (1 - width / 2), fc * (1 + width / 2)); out[a:b] += seg * w[:b - a]
    return out / (np.abs(out).max() + 1e-9)
def tone(f, d, shape='sine'):
    t = T(d); ph = 2 * np.pi * np.cumsum(np.broadcast_to(f, t.shape) if np.ndim(f) else np.full(t.shape, f)) / SR
    if shape == 'sine': return np.sin(ph)
    if shape == 'tri': return 2 / np.pi * np.arcsin(np.sin(ph))
    if shape == 'sq': return np.tanh(np.sin(ph) * 4)
def env(n, a=.005, dec=6.0, rel=.02):
    t = np.arange(n) / SR; e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-t * dec); r = int(rel * SR)
    if r and n > r: e[-r:] *= np.linspace(1, 0, r)
    return e

# ---------------- instruments ----------------
def kick():
    t = T(.42); f = 44 + 120 * np.exp(-t * 32); s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6.5)
    click = band(noise(.42), 2000, 8000) * np.exp(-t * 260) * .5; return np.tanh((s + click) * 1.7) * .95
def snare():
    t = T(.3); body = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * .55; nz = band(noise(.3), 1400, 7000) * np.exp(-t * 17) * .9; return np.tanh((body + nz) * 1.3)
def clap():
    t = T(.35); out = np.zeros(len(t)); nz = band(noise(.35), 900, 5000)
    for k, o in enumerate([0, .011, .023]): i = int(o * SR); out[i:] += nz[:len(t) - i] * np.exp(-t[:len(t) - i] * (95 if k < 2 else 13))
    return out * .8
def hat(open_=False):
    d = .26 if open_ else .06; t = T(d); return band(noise(d), 7000, 16000) * np.exp(-t * (11 if open_ else 75)) * (.7 if open_ else 1)
def crash():
    t = T(1.4); return band(noise(1.4), 4000, 14000) * np.exp(-t * 3.2) * .5
def bass(f, d):
    t = T(d); s = np.sin(2 * np.pi * f * t) + .35 * np.sin(4 * np.pi * f * t) + .12 * np.sin(6 * np.pi * f * t)
    return np.tanh(s * 1.4) * env(len(t), .004, 1.5, .03)
def pluck(f, d, bright=1.0):
    t = T(d); s = np.zeros(len(t))
    for k in range(1, 9): s += np.sin(2 * np.pi * f * k * t * (1 + (k - 1) * .0007)) / k * np.exp(-t * (5 + 4.5 * k / bright))
    return s * env(len(t), .003, 2.2, .03)
def pad(freqs, d, dark=False):
    t = T(d); s = np.zeros(len(t))
    for f in freqs:
        for det in (-.0018, 0, .0021):
            for k in range(1, 5 if dark else 8): s += np.sin(2 * np.pi * f * (1 + det) * k * t + k * 1.7) / k ** (1.6 if dark else 1.25)
    e = np.minimum(1, t / .22) * np.minimum(1, (d - t) / .3); return s * e / (len(freqs) * 3)
def bell(f, d=1.4):
    t = T(d); s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * dk) for r, a, dk in [(1, 1, 3.2), (2.76, .45, 5.5), (5.4, .22, 9), (8.93, .1, 13)])
    return s * env(len(t), .002, 0, .05)
def boom(d=1.6):
    t = T(d); f = 30 + 55 * np.exp(-t * 7); return np.tanh(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.6) * 2.2)
def riser(d, f0=300, f1=6000):
    t = T(d); nz = sweep_noise(d, f0, f1, .7); sw = tone(200 * (1200 / 200) ** (t / d), d, 'sine') * .25
    return (nz * .8 + sw) * (t / d) ** 2.2
def whoosh(d=.32, up=True):
    t = T(d); nz = sweep_noise(d, 400 if up else 3500, 3500 if up else 400, .9); return nz * np.sin(np.pi * t / d) ** 1.5
def splash(size=1.0):
    d = .9 + .3 * size; t = T(d); nz = band(noise(d), 120, 2600) * np.minimum(1, t / .008) * np.exp(-t * (5.5 - size)) * 1.2
    hi = band(noise(d), 2500, 9000) * np.exp(-t * 9) * .5; out = nz + hi
    for k in range(int(5 + 3 * size)):
        o = .08 + rng.random() * .45; i = int(o * SR); f = 500 + rng.random() * 900; b = tone(np.linspace(f, f * 1.8, int(.05 * SR)), .05) * env(int(.05 * SR), .002, 30) * .25
        out[i:i + len(b)] += b[:len(out) - i]
    return out
def blip(f):
    d = .1; return (tone(np.linspace(f, f * 1.45, int(d * SR)), d) * .8 + tone(f * 2, d, 'tri') * .2) * env(int(d * SR), .002, 22)
def bonk(s=1.0):
    d = .32; t = T(d); thump = np.sin(2 * np.pi * np.cumsum(70 + 110 * np.exp(-t * 25)) / SR) * np.exp(-t * 11)
    toon = tone(np.linspace(620, 250, len(t)), d) * np.exp(-t * 14) * .45; crack = band(noise(d), 1500, 6000) * np.exp(-t * 35) * .6
    return np.tanh((thump + toon + crack) * (1 + .5 * s))
def thud(s):
    d = .2; t = T(d); return (np.sin(2 * np.pi * np.cumsum(60 + 70 * np.exp(-t * 30)) / SR) * np.exp(-t * 16) + band(noise(d), 200, 1500) * np.exp(-t * 30) * .4) * min(1, s / 14)
def slide(f0, f1, d=.55):
    t = T(d); f = f0 * (f1 / f0) ** (t / d) * (1 + .02 * np.sin(2 * np.pi * 7 * t)); return tone(f, d) * env(len(t), .01, 1.5, .05)
def coin(f=1568):
    return bell(f, .5) * .6 + bell(f * 1.335, .5) * .4

# ---------------- arrangement ----------------
def build(info, path, dur=None, stems=False):
    B = info['beat']; DUR = dur or info['dur']; n = int((DUR + .6) * SR)
    mus = np.zeros((n, 2)); sfx = np.zeros((n, 2)); verb = np.zeros((n, 2)); duck = np.ones(n)
    def put(buf, at, sig, g=1.0, pan=0.0):
        i = int(round(at * SR)); sig = np.asarray(sig) * g
        if i < 0: sig = sig[-i:]; i = 0
        j = min(n, i + len(sig));
        if j <= i: return
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4); buf[i:j, 0] += sig[:j - i] * l * 1.414; buf[i:j, 1] += sig[:j - i] * r * 1.414
    b2t = lambda b: b * B
    CH = [('C', ['C4', 'E4', 'G4'], 'C2'), ('G', ['B3', 'D4', 'G4'], 'G1'), ('Am', ['C4', 'E4', 'A4'], 'A1'), ('F', ['C4', 'F4', 'A4'], 'F1')]
    MEL = [['E5', None, 'G5', None, 'A5', 'G5', 'E5', None], ['D5', None, 'E5', 'D5', 'B4', None, 'G4', None], ['C5', None, 'E5', None, 'A5', None, 'G5', 'E5'], ['F5', 'E5', 'C5', None, 'A4', None, 'C5', None],
           ['E5', 'G5', 'C6', None, 'B5', 'G5', 'E5', None], ['D5', None, 'G5', None, 'B5', 'A5', 'G5', None], ['A5', None, 'C6', 'A5', 'E5', None, 'G5', 'A5'], ['F5', None, 'A5', None, 'C6', 'A5', 'F5', 'E5']]
    K, SN, CL, HC, HO, CR = kick(), snare(), clap(), hat(), hat(True), crash()
    DROP, BREAK, BUILD, CASH = 6, round(info['cuts'][6] / B), 42, 48
    kicks = []
    def section(beat):
        if beat < DROP: return 'intro'
        if BREAK <= beat < 36: return 'break'
        if BUILD <= beat < CASH: return 'build'
        if beat >= 62: return 'tail'
        return 'groove'
    # drums, bass, pads, lead per beat
    for beat in range(64):
        t0 = b2t(beat); sec = section(beat); bar = beat // 4; ch = CH[bar % 4]; inbar = beat % 4
        if sec in ('groove', 'build'):
            put(mus, t0, K, .95); kicks.append(t0)
            if inbar in (1, 3): put(mus, t0, CL, .55, .1); put(mus, t0, SN, .3, -.1)
            for h in range(2): put(mus, t0 + h * B / 2, HC, .07 if h == 0 else .11, .35)
            if sec == 'groove': put(mus, t0 + B / 2, HO, .035, -.3)
        if sec == 'break':
            if inbar in (0,): put(mus, t0, K, .8); kicks.append(t0)
            if inbar == 2: put(mus, t0, SN, .25)
        # bass: pumping 8ths on the root, octave bounce
        if sec in ('groove', 'build', 'break'):
            f = hz(ch[2]) * (2 if ch[2][-1] == '1' else 1)
            for h in range(2): put(mus, t0 + h * B / 2, bass(f * (2 if h else 1) if sec != 'break' else f, B / 2 * .92 if sec != 'break' else B * .95), .42 if sec != 'break' else .5)
        # pad: one chord per bar
        if inbar == 0 and sec != 'tail':
            p = pad([hz(x) for x in ch[1]], 4 * B + .2, dark=sec in ('intro', 'break', 'build'))
            put(mus, t0, p, .2 if sec != 'intro' else .14, -.2); put(verb, t0, p, .25)
        # lead melody over the groove
        if sec == 'groove' and beat >= 10:
            phrase = MEL[(bar % 8)]
            for k in range(2):
                nm = phrase[inbar * 2 + k]
                if nm: pl = pluck(hz(nm), B * .9, 1.2); put(mus, t0 + k * B / 2, pl, .2, .15); put(verb, t0 + k * B / 2, pl, .35); put(verb, t0 + k * B / 2 + B * .75, pl, .12)
    # intro: the hook hit, the slow-motion swell, the riser into the drop
    first_dash_hit = next((e['t'] for e in info['events'] if e['k'] == 'hit' and e.get('dash') and e.get('hero')), .215)
    put(mus, first_dash_hit, boom(1.8), .9); put(mus, first_dash_hit, CR, .5); put(mus, first_dash_hit, SN, .6); put(verb, first_dash_hit, CR, .3)
    drone = (tone(55, 2.2) + tone(55.6, 2.2) * .8 + tone(110.3, 2.2) * .3) * np.minimum(1, T(2.2) / .3) * np.minimum(1, (2.2 - T(2.2)) / .4); put(mus, .3, drone, .22)
    put(mus, b2t(DROP) - 1.25, riser(1.25), .2)
    for k in range(16): put(mus, b2t(DROP) - 1.0 + k / 16, SN, .08 + k * .02)
    put(mus, b2t(DROP), CR, .55); put(mus, b2t(DROP), boom(1.2), .6)
    # logo sting
    lg = info['logo'] + .08; put(mus, lg, boom(1.3), .5)
    for k, nm in enumerate(['C6', 'E6', 'G6', 'C7']): put(mus, lg + k * .07, bell(hz(nm), 1.2), .16, -.3 + k * .2); put(verb, lg + k * .07, bell(hz(nm), 1.2), .3)
    # break: rumble + snare roll into the price drop
    rb = b2t(BREAK); rum = band(noise(b2t(36) - rb), 30, 160) * np.minimum(1, T(b2t(36) - rb) / 1.5); put(mus, rb, rum, .35)
    put(mus, b2t(34), riser(2 * B, 400, 7000), .18)
    for k in range(16): put(mus, b2t(34) + k * B / 8, SN, .07 + k * .025)
    put(mus, b2t(36), CR, .5)
    # build: riser, charging tone, accelerating roll into the cash out
    put(mus, b2t(BUILD), riser(b2t(CASH) - b2t(BUILD), 250, 9000), .17)
    for k in range(24): put(mus, b2t(46) + k * (2 * B) / 24, SN, .06 + k * .02)
    cs = next((e['t'] for e in info['events'] if e['k'] == 'cashstart' and e.get('hero')), b2t(BUILD) + .3); ce = info['cash']
    ct = T(ce - cs); chg = tone(300 * (4 ** (ct / (ce - cs))), ce - cs, 'tri') * (.3 + .7 * ct / (ce - cs)); put(sfx, cs, chg, .07)
    # the cash out
    put(mus, ce, boom(1.8), .9); put(mus, ce, CR, .6); put(verb, ce, CR, .3)
    for k in range(14): nm = ['C6', 'E6', 'G6', 'C7', 'E7', 'G7', 'C7'][k % 7]; put(sfx, ce + .04 + k * .055, coin(hz(nm)), .13, (k % 5 - 2) * .3); put(verb, ce + .04 + k * .055, bell(hz(nm), .6), .2)
    # end: logo slam, CTA pop, the final chord
    put(mus, info['end'] + .1, boom(1.4), .55); put(mus, info['end'] + .1, CR, .35)
    put(sfx, info['end'] + .9, blip(784), .3); put(sfx, info['end'] + 1.15, blip(1046), .25)
    fin = b2t(62); put(mus, fin, K, .9); put(mus, fin, CR, .5)
    for nm in ['C4', 'E4', 'G4', 'C5']: put(mus, fin, pad([hz(nm)], 2.2), .5); put(verb, fin, pad([hz(nm)], 2.2), .4)
    for k, nm in enumerate(['C6', 'G6', 'C7']): put(mus, fin + k * .09, bell(hz(nm), 2), .16)
    # ---------------- sound effects on real events ----------------
    near = lambda d: float(np.clip(1.25 - d / 34, .12, 1))
    last = {}
    combo = 0; lastpile = -9
    PENTA = ['C6', 'D6', 'E6', 'G6', 'A6', 'C7', 'D7', 'E7', 'G7', 'A7']
    for e in info['events']:
        t, k = e['t'], e['k']; d = e.get('d', 30)
        if k == 'hit':
            if e.get('dash') and (e.get('hero') or d < 24):
                if t - last.get('bonk', -1) > .1: put(sfx, t, bonk(min(1, e['s'] / 20)), (.6 if e.get('hero') else .3) * near(d)); last['bonk'] = t
            elif e['s'] > 7 and d < 20 and t - last.get('thud', -1) > .14: put(sfx, t, thud(e['s']), .22 * near(d)); last['thud'] = t
        elif k == 'dash' and (e.get('hero') or d < 18): put(sfx, t - .02, whoosh(.3), (.3 if e.get('hero') else .12) * near(d))
        elif k == 'splash' and d < 70 and t - last.get('splash', -1) > .12: put(sfx, t, splash(min(1.6, .6 + e['r'] * .35)), .42 * near(d)); last['splash'] = t
        elif k == 'fall' and d < 30: put(sfx, t, slide(900, 260), .1 * near(d))
        elif k == 'pile':
            combo = combo + 1 if t - lastpile < .5 else 0; lastpile = t; put(sfx, t, blip(hz(PENTA[min(combo, 9)])), .17)
        elif k == 'land' and d < 25: put(sfx, t, thud(8), .25 * near(d))
    for t in info['caps']: put(sfx, t, boom(.5), .3); put(sfx, t - .05, whoosh(.18), .1)
    for t in info['whips']: put(sfx, t - .16, whoosh(.32), .3)
    for c in info['cuts'][1:]:
        if all(abs(c - w) > .05 for w in info['whips']): put(sfx, c - .2, whoosh(.36, False), .18)
    for i in range(5): put(sfx, info['cuts'][7] + .35 + i * .3, coin(hz(['C6', 'E6', 'G6', 'A6', 'C7'][i])), .2, -.4 + i * .2)
    # ---------------- mix ----------------
    for kt in kicks:
        i0 = int(kt * SR); m = min(n, i0 + int(.3 * SR)) - i0
        if m > 0: duck[i0:i0 + m] = np.minimum(duck[i0:i0 + m], 1 - .55 * np.exp(-np.arange(m) / SR * 9))
    mus *= duck[:, None] * .9 + .1
    ir_t = T(1.6); ir = rng.standard_normal((len(ir_t), 2)) * np.exp(-ir_t * 3.6)[:, None]; ir[:int(.012 * SR)] = 0
    wet = np.stack([np.fft.irfft(np.fft.rfft(verb[:, c], 2 ** 22) * np.fft.rfft(ir[:, c], 2 ** 22), 2 ** 22)[:n] for c in range(2)], 1); wet /= np.abs(wet).max() + 1e-9
    if stems: return mus, sfx, wet
    mix = mus * .75 + sfx * 1.6 + wet * .25
    fade = int(.7 * SR); end = int(DUR * SR); mix[end - fade:end] *= np.linspace(1, 0, fade)[:, None]; mix[end:] = 0
    mix = np.tanh(mix * 1.15); mix /= np.abs(mix).max() + 1e-9; mix *= .93
    pcm = (mix[:end] * 32767).astype(np.int16)
    with wave.open(str(path), 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    return path
