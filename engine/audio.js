export function createAudio(opts = {}) {
  let context = null;
  let master = null;
  let channels = null;
  let ambientNodes = null;
  let noiseBuffer = null;
  let volume = Math.max(0, Math.min(1, Number(opts.volume ?? 0.35)));
  const random = (min, max) => min + Math.random() * (max - min);

  function ensure() {
    if (context) return context;
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClass) return null;
    context = new AudioContextClass();
    master = context.createGain();
    master.gain.value = volume;
    channels = {
      sfx: context.createGain(),
      ambient: context.createGain(),
      music: context.createGain()
    };
    channels.sfx.gain.value = 1;
    channels.ambient.gain.value = 0.72;
    channels.music.gain.value = 0.45;
    Object.values(channels).forEach(channel => channel.connect(master));
    master.connect(context.destination);
    return context;
  }

  function unlock() {
    const audio = ensure();
    if (audio && audio.state === 'suspended') audio.resume().catch(() => {});
  }

  function getNoiseBuffer(audio) {
    if (noiseBuffer) return noiseBuffer;
    const length = Math.floor(audio.sampleRate * 2.4);
    noiseBuffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.72 + white * 0.28;
      data[i] = last * 0.7;
    }
    return noiseBuffer;
  }

  function envelope(gain, start, duration, peak, attack = 0.008, release = 0.72) {
    const end = start + Math.max(0.025, duration);
    gain.gain.cancelScheduledValues(start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + Math.min(attack, duration * 0.3));
    gain.gain.setValueAtTime(Math.max(0.0002, peak), Math.max(start + attack, end - duration * release));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    return end;
  }

  function tone({ frequency, duration = 0.12, type = 'sine', gain = 0.1, endFrequency, detune = 0, channel = 'sfx', attack = 0.008 }) {
    const audio = ensure();
    if (!audio || !channels[channel]) return;
    const oscillator = audio.createOscillator();
    const amp = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), audio.currentTime);
    oscillator.detune.value = detune;
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), audio.currentTime + duration);
    oscillator.connect(amp);
    amp.connect(channels[channel]);
    const stopAt = envelope(amp, audio.currentTime, duration, gain, attack);
    oscillator.start(audio.currentTime);
    oscillator.stop(stopAt + 0.015);
    oscillator.addEventListener?.('ended', () => { oscillator.disconnect(); amp.disconnect(); }, { once: true });
  }

  function noiseBurst(duration = 0.08, gain = 0.08, filterFrequency = 900, channel = 'sfx', filterType = 'bandpass') {
    const audio = ensure();
    if (!audio || !channels[channel]) return;
    const source = audio.createBufferSource();
    source.buffer = getNoiseBuffer(audio);
    source.playbackRate.value = random(0.82, 1.18);
    const filter = audio.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFrequency;
    filter.Q.value = 0.72;
    const amp = audio.createGain();
    source.connect(filter);
    filter.connect(amp);
    amp.connect(channels[channel]);
    const stopAt = envelope(amp, audio.currentTime, duration, gain, 0.003, 0.84);
    source.start(audio.currentTime, random(0, 0.4), duration);
    source.stop(stopAt + 0.015);
    source.addEventListener?.('ended', () => { source.disconnect(); filter.disconnect(); amp.disconnect(); }, { once: true });
  }

  function startAmbient(type = 'hum') {
    const audio = ensure();
    if (!audio || ambientNodes) return;
    const base = type === 'deep' ? 39 : type === 'water' ? 52 : 58;
    const masterGain = audio.createGain();
    const lowpass = audio.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = type === 'deep' ? 125 : 205;
    masterGain.gain.value = 0.0001;
    lowpass.connect(masterGain);
    masterGain.connect(channels.ambient);

    const oscillators = [];
    [
      { ratio: 1, type: 'sawtooth', gain: 0.72, detune: -4.5 },
      { ratio: 1.006, type: 'sine', gain: 0.44, detune: 3.2 },
      { ratio: 1.49, type: 'triangle', gain: 0.12, detune: -7.1 }
    ].forEach(part => {
      const oscillator = audio.createOscillator();
      const amp = audio.createGain();
      oscillator.type = part.type;
      oscillator.frequency.value = base * part.ratio;
      oscillator.detune.value = part.detune;
      amp.gain.value = part.gain;
      oscillator.connect(amp);
      amp.connect(lowpass);
      oscillator.start();
      oscillators.push({ oscillator, amp });
    });

    const lfo = audio.createOscillator();
    const lfoDepth = audio.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.18;
    lfoDepth.gain.value = 0.012;
    lfo.connect(lfoDepth);
    lfoDepth.connect(masterGain.gain);
    lfo.start();

    const noise = audio.createBufferSource();
    const noiseFilter = audio.createBiquadFilter();
    const noiseGain = audio.createGain();
    noise.buffer = getNoiseBuffer(audio);
    noise.loop = true;
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = type === 'deep' ? 95 : 155;
    noiseGain.gain.value = type === 'water' ? 0.09 : 0.045;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(channels.ambient);
    noise.start();

    masterGain.gain.setTargetAtTime(0.052, audio.currentTime, 0.8);
    ambientNodes = { masterGain, lowpass, oscillators, lfo, lfoDepth, noise, noiseFilter, noiseGain };
  }

  function stopAmbient() {
    if (!ambientNodes || !context) return;
    const nodes = ambientNodes;
    ambientNodes = null;
    const now = context.currentTime;
    nodes.masterGain.gain.cancelScheduledValues(now);
    nodes.masterGain.gain.setTargetAtTime(0.0001, now, 0.18);
    nodes.noiseGain.gain.setTargetAtTime(0.0001, now, 0.12);
    const stopAt = now + 0.7;
    nodes.oscillators.forEach(({ oscillator }) => { try { oscillator.stop(stopAt); } catch {} });
    try { nodes.lfo.stop(stopAt); } catch {}
    try { nodes.noise.stop(stopAt); } catch {}
    globalThis.setTimeout?.(() => {
      nodes.oscillators.forEach(({ oscillator, amp }) => { oscillator.disconnect(); amp.disconnect(); });
      nodes.lfo.disconnect(); nodes.lfoDepth.disconnect();
      nodes.noise.disconnect(); nodes.noiseFilter.disconnect(); nodes.noiseGain.disconnect();
      nodes.lowpass.disconnect(); nodes.masterGain.disconnect();
    }, 850);
  }

  const footstepVariants = {
    carpet: [
      { f: 105, d: 0.075, g: 0.055, filter: 430, rate: 0.96 },
      { f: 132, d: 0.062, g: 0.047, filter: 510, rate: 1.04 },
      { f: 88, d: 0.092, g: 0.061, filter: 360, rate: 0.91 },
      { f: 118, d: 0.068, g: 0.05, filter: 470, rate: 1.08 },
      { f: 96, d: 0.082, g: 0.052, filter: 390, rate: 0.99 }
    ],
    tile: [
      { f: 220, d: 0.055, g: 0.074, filter: 1250, rate: 1.02 },
      { f: 180, d: 0.065, g: 0.082, filter: 970, rate: 0.94 },
      { f: 260, d: 0.048, g: 0.068, filter: 1450, rate: 1.08 },
      { f: 205, d: 0.058, g: 0.078, filter: 1120, rate: 0.98 },
      { f: 240, d: 0.052, g: 0.071, filter: 1320, rate: 1.05 }
    ],
    water: [
      { f: 120, d: 0.14, g: 0.12, filter: 420, rate: 0.9 },
      { f: 92, d: 0.17, g: 0.13, filter: 330, rate: 0.82 },
      { f: 155, d: 0.12, g: 0.11, filter: 560, rate: 1.02 },
      { f: 108, d: 0.16, g: 0.14, filter: 390, rate: 0.94 },
      { f: 138, d: 0.13, g: 0.115, filter: 480, rate: 1.06 }
    ]
  };

  return {
    unlock,
    startAmbient,
    stopAmbient,
    click() {
      tone({ frequency: 920, endFrequency: 690, duration: 0.045, type: 'square', gain: 0.045, attack: 0.002 });
    },
    step(surface = 'carpet') {
      const variants = footstepVariants[surface] || footstepVariants.carpet;
      const variant = variants[Math.floor(Math.random() * variants.length)];
      noiseBurst(variant.d, variant.g, variant.filter, 'sfx', 'lowpass');
      tone({ frequency: variant.f, endFrequency: variant.f * 0.72, duration: variant.d * 0.82, type: 'triangle', gain: variant.g * 0.36, attack: 0.004 });
    },
    take() {
      tone({ frequency: 520, endFrequency: 880, duration: 0.14, type: 'triangle', gain: 0.085 });
      tone({ frequency: 780, endFrequency: 1120, duration: 0.09, type: 'sine', gain: 0.035, attack: 0.004 });
    },
    spray() {
      noiseBurst(0.16, 0.075, 1850, 'sfx', 'highpass');
      tone({ frequency: 740, endFrequency: 510, duration: 0.09, type: 'sine', gain: 0.018, attack: 0.002 });
    },
    arrow() {
      tone({ frequency: 1260, endFrequency: 720, duration: 0.065, type: 'square', gain: 0.045, attack: 0.002 });
      noiseBurst(0.035, 0.024, 2400, 'sfx', 'highpass');
    },
    eat() {
      noiseBurst(0.19, 0.075, 620, 'sfx', 'lowpass');
      tone({ frequency: 145, endFrequency: 92, duration: 0.12, type: 'triangle', gain: 0.035, attack: 0.003 });
    },
    backpack() {
      tone({ frequency: 118, endFrequency: 62, duration: 0.28, type: 'sine', gain: 0.085, attack: 0.025 });
      noiseBurst(0.11, 0.022, 390, 'sfx', 'lowpass');
    },
    note() {
      tone({ frequency: 392, endFrequency: 520, duration: 0.2, type: 'sine', gain: 0.075 });
      noiseBurst(0.09, 0.025, 1650);
    },
    door() {
      tone({ frequency: 185, endFrequency: 72, duration: 0.32, type: 'sawtooth', gain: 0.09 });
      noiseBurst(0.24, 0.09, 280, 'sfx', 'lowpass');
    },
    noclip() {
      tone({ frequency: 310, endFrequency: 1380, duration: 0.22, type: 'sine', gain: 0.07 });
      noiseBurst(0.13, 0.032, 2200);
    },
    die() {
      tone({ frequency: 96, endFrequency: 28, duration: 0.76, type: 'sawtooth', gain: 0.13, attack: 0.025 });
      noiseBurst(0.62, 0.075, 160, 'sfx', 'lowpass');
    },
    win() {
      tone({ frequency: 440, endFrequency: 660, duration: 0.32, type: 'triangle', gain: 0.09 });
      tone({ frequency: 660, endFrequency: 990, duration: 0.42, type: 'sine', gain: 0.075, attack: 0.02 });
      tone({ frequency: 880, duration: 0.25, type: 'sine', gain: 0.035, attack: 0.06 });
    },
    setVolume(value) {
      volume = Math.max(0, Math.min(1, Number(value) || 0));
      if (master && context) master.gain.setTargetAtTime(volume, context.currentTime, 0.04);
    },
    setChannelVolume(channel, value) {
      const audio = ensure();
      if (!audio || !channels[channel]) return;
      channels[channel].gain.setTargetAtTime(Math.max(0, Math.min(1, Number(value) || 0)), audio.currentTime, 0.05);
    },
    dispose() {
      stopAmbient();
      if (context) {
        const audio = context;
        context = null;
        const closed = audio.close?.();
        closed?.catch?.(() => {});
      }
    }
  };
}
