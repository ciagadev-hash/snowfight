// SnowPump sounds: everything is synthesized with WebAudio, no files. Starts on the first user gesture.
export function createSfx() {
  let ac = null, out = null, noiseBuf = null, muted = false;
  try { muted = localStorage.getItem('snowpump.mute') === '1'; } catch (_) { }
  const init = () => {
    if (ac) return ac.state === 'suspended' ? ac.resume() : null;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ac = new AC(); const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; out = ac.createGain(); out.gain.value = muted ? 0 : .55; out.connect(comp); comp.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  };
  const env = (g, t, a, peak, dec) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + dec); };
  const tone = (type, f0, f1, dur, vol, at = 0) => { if (!ac) return; const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur); env(g, t, .005, vol, dur); o.connect(g).connect(out); o.start(t); o.stop(t + dur + .05); };
  const noise = (type, f0, f1, q, dur, vol, at = 0) => { if (!ac) return; const t = ac.currentTime + at, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf; s.loop = true; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); env(g, t, .008, vol, dur); s.connect(f).connect(g).connect(out); s.start(t, Math.random()); s.stop(t + dur + .05); };
  let combo = 0, comboT = 0;
  return {
    init,
    get muted() { return muted; },
    mute(m) { muted = m; try { localStorage.setItem('snowpump.mute', m ? '1' : '0'); } catch (_) { } if (out) out.gain.value = m ? 0 : .55; },
    pile() { if (!ac) return; const now = ac.currentTime; combo = now - comboT < .7 ? Math.min(combo + 1, 12) : 0; comboT = now; const f = 520 * Math.pow(2, combo / 12); tone('sine', f, f * 1.5, .09, .16); tone('triangle', f * 2, 0, .05, .04); },
    bump(s) { const v = Math.min(1, s / 14); tone('sine', 150 + v * 40, 55, .18, .25 + v * .35); noise('lowpass', 900 + v * 1200, 200, 1, .14, .12 + v * .25); },
    dash() { noise('bandpass', 500, 2600, 1.4, .22, .3); tone('sine', 220, 440, .12, .06); },
    shove() { tone('square', 120, 40, .16, .12); noise('lowpass', 2500, 300, .7, .2, .4); },
    splash(near) { const v = near ? 1 : .35; noise('lowpass', 2400, 300, .8, .55, .45 * v); noise('bandpass', 900, 3000, 2, .3, .2 * v, .05); for (let i = 0; i < 4; i++) tone('sine', 500 + i * 160, 900 + i * 200, .06, .05 * v, .12 + i * .07); },
    ko() { [523.3, 659.3, 784, 1046.5].forEach((f, i) => tone('triangle', f, 0, .32, .13, i * .055)); noise('highpass', 3000, 8000, .5, .25, .08); },
    fall() { tone('sine', 700, 120, .7, .22); },
    tick(k) { tone('triangle', 660 + k * 600, 0, .05, .08); },
    cashout() { [784, 988, 1175, 1568, 1976].forEach((f, i) => { tone('sine', f, 0, .4, .14, i * .07); tone('triangle', f * 2, 0, .2, .04, i * .07); }); noise('highpass', 4000, 9000, .5, .5, .07, .1); },
    land() { tone('sine', 180, 60, .14, .2); noise('lowpass', 700, 150, 1, .12, .15); },
    ui() { tone('sine', 880, 1320, .06, .08); },
    warn() { tone('square', 440, 0, .12, .06); tone('square', 440, 0, .12, .06, .18); },
  };
}
