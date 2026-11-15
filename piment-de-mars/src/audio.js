// Sounds synthesized with Web Audio: no files to load.

export let actx = null, muted = false;
export function toggleMute() { muted = !muted; return muted; }
export function audio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } return actx; }
export function tone(f1, f2, dur, type, vol, delay) {
  const a = audio(); if (!a || muted) return;
  const t0 = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
  o.type = type || "sine"; o.frequency.setValueAtTime(f1, t0); o.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t0 + dur);
  g.gain.setValueAtTime(vol || 0.15, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.02);
}
export function noise(dur, freq, vol) {
  const a = audio(); if (!a || muted) return;
  const b = a.createBuffer(1, a.sampleRate * dur, a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.3 ? 1 : 0.3);
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  f.type = "bandpass"; f.frequency.value = freq; g.gain.value = vol || 0.12;
  s.buffer = b; s.connect(f).connect(g).connect(a.destination); s.start();
}
export const SOUNDS = {
  drop: () => { tone(1200, 300, 0.18, "sine", 0.18); },
  siren: () => { for (let k = 0; k < 3; k++) { tone(620, 920, 0.35, "sawtooth", 0.06, k * 0.7); tone(920, 620, 0.35, "sawtooth", 0.06, k * 0.7 + 0.35); } },
  radio: () => { noise(0.35, 1800, 0.12); tone(1400, 1400, 0.08, "square", 0.05, 0.38); tone(1400, 1400, 0.08, "square", 0.05, 0.52); },
  ding: () => { tone(660, 660, 0.25, "triangle", 0.12); tone(880, 880, 0.3, "triangle", 0.1, 0.1); tone(1320, 1320, 0.35, "triangle", 0.08, 0.2); },
  sparkle: () => { [1500, 1900, 2400].forEach((f, i) => tone(f, f * 1.2, 0.12, "sine", 0.06, i * 0.06)); },
  build: () => { tone(200, 180, 0.08, "square", 0.08); tone(260, 240, 0.08, "square", 0.08, 0.12); },
  alert: () => { tone(440, 330, 0.25, "square", 0.07); tone(440, 330, 0.25, "square", 0.07, 0.3); },
  go: () => { tone(440, 880, 0.3, "triangle", 0.1); },
  card: () => { tone(520, 780, 0.2, "triangle", 0.08); }
};
export function play(id) { try { SOUNDS[id] && SOUNDS[id](); } catch (e) { } }

