export function createAudio(opts = {}) {
  let ctx = null, master = null, hum = null, humGain = null, noise = null;
  function ensure() {
    if (ctx) return ctx;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = opts.volume ?? 0.35;
    master.connect(ctx.destination);
    return ctx;
  }
  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  }
  function startAmbient(type) {
    const c = ensure();
    if (!c || hum) return;
    hum = c.createOscillator();
    humGain = c.createGain();
    const filter = c.createBiquadFilter();
    hum.type = 'sawtooth';
    hum.frequency.value = type === 'deep' ? 45 : 62;
    filter.type = 'lowpass';
    filter.frequency.value = 180;
    humGain.gain.value = 0.06;
    hum.connect(filter);
    filter.connect(humGain);
    humGain.connect(master);
    hum.start();
  }
  function stopAmbient() {
    if (hum) { try { hum.stop(); } catch (e) {} hum.disconnect(); hum = null; }
    if (humGain) { humGain.disconnect(); humGain = null; }
  }
  function makeNoise(c) {
    if (noise) return noise;
    const len = Math.floor(c.sampleRate * 0.2);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    noise = buf;
    return buf;
  }
  function burst(freq, dur, type = 'sine', gain = 0.12) {
    const c = ensure();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.connect(g);
    g.connect(master);
    const t = c.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t);
    o.stop(t + dur);
  }
  function noiseBurst(dur = 0.08, gain = 0.08, filterFreq = 900) {
    const c = ensure();
    if (!c) return;
    const src = c.createBufferSource();
    src.buffer = makeNoise(c);
    const g = c.createGain();
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = filterFreq;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    const t = c.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.start(t);
    src.stop(t + dur);
  }
  return {
    unlock,
    startAmbient,
    stopAmbient,
    click: () => burst(880, 0.05, 'square', 0.06),
    step: (surface) => noiseBurst(0.07, surface === 'water' ? 0.12 : 0.07, surface === 'water' ? 500 : 900),
    take: () => burst(520, 0.12, 'triangle', 0.09),
    note: () => burst(392, 0.18, 'sine', 0.08),
    door: () => burst(180, 0.25, 'sawtooth', 0.10),
    noclip: () => burst(1200, 0.18, 'sine', 0.07),
    die: () => burst(80, 0.5, 'sawtooth', 0.14),
    win: () => burst(660, 0.35, 'triangle', 0.10),
    setVolume(v) { if (master) master.gain.value = Math.max(0, Math.min(1, v)); }
  };
}
