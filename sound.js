/* PANDEMONKS sound effects: everything is synthesised with Web Audio, no files needed.
   Subtle by default; it only gets stressful when the game does. */

const SFX = (() => {
  let ctx = null;
  let master = null;
  let enabled = true;   // Game Master switch
  let unlocked = false; // the browser needs one click before it plays audio

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp);
    comp.connect(ctx.destination);
    return true;
  }
  function unlock() {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume();
    unlocked = true;
  }
  const ready = () => enabled && unlocked && ctx && ctx.state === 'running';
  const now = () => ctx.currentTime;

  function tone(freq, start, dur, { type = 'sine', vol = 0.3, attack = 0.01, glide = null, filter = null } = {}) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    let node = o;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      o.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(master);
    o.start(start);
    o.stop(start + dur + 0.05);
  }
  function noise(start, dur, { vol = 0.2, type = 'bandpass', freq = 1200, q = 1, sweep = null } = {}) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, start);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, start + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + Math.min(0.03, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(start);
    src.stop(start + dur + 0.05);
  }

  const lib = {
    step() { const t = now(); noise(t, 0.06, { vol: 0.08, freq: 600, q: 2 }); noise(t + 0.16, 0.06, { vol: 0.07, freq: 520, q: 2 }); },
    // the NS station chime (three notes) and a soft rumble
    train() {
      const t = now();
      [[659, 0], [523, 0.32], [784, 0.64]].forEach(([f, d]) => { tone(f, t + d, 0.6, { type: 'sine', vol: 0.18 }); tone(f * 2, t + d, 0.3, { type: 'sine', vol: 0.04 }); });
      noise(t + 0.2, 1.4, { vol: 0.07, type: 'lowpass', freq: 220 });
    },
    whoosh() { noise(now(), 0.35, { vol: 0.12, freq: 400, sweep: 3000, q: 0.8 }); },
    fire() { const t = now(); tone(90, t, 0.25, { type: 'sine', vol: 0.25, glide: 50 }); noise(t, 0.22, { vol: 0.1, freq: 2500, q: 0.6 }); },
    poof() { const t = now(); noise(t, 0.45, { vol: 0.2, freq: 3000, sweep: 300, q: 0.7 }); tone(520, t, 0.25, { type: 'triangle', vol: 0.08, glide: 900 }); },
    escalate() {
      const t = now();
      for (let i = 0; i < 4; i++) { tone(880, t + i * 0.36, 0.18, { type: 'square', vol: 0.09, filter: 2200 }); tone(660, t + i * 0.36 + 0.18, 0.18, { type: 'square', vol: 0.09, filter: 2200 }); }
      tone(55, t, 1.4, { type: 'sawtooth', vol: 0.12, filter: 300 });
    },
    friday() {
      const t = now();
      [[392, 0], [311, 0.35], [233, 0.7]].forEach(([f, d]) => { tone(f, t + d, 0.9, { type: 'sawtooth', vol: 0.11, filter: 1200 }); tone(f / 2, t + d, 0.9, { type: 'sine', vol: 0.12 }); });
      noise(t + 0.7, 1.2, { vol: 0.06, type: 'lowpass', freq: 160 });
    },
    news() { const t = now(); [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.09, 0.22, { type: 'square', vol: 0.07, filter: 3000 })); tone(1046, t + 0.4, 0.5, { type: 'sine', vol: 0.12 }); },
    playbook() { const t = now(); [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, t + i * 0.08, 0.5, { type: 'triangle', vol: 0.14 })); },
    win() { const t = now(); [[523, 0], [659, 0.15], [784, 0.3], [1046, 0.5], [784, 0.75], [1046, 0.95]].forEach(([f, d]) => { tone(f, t + d, 0.5, { type: 'triangle', vol: 0.16 }); tone(f / 2, t + d, 0.5, { type: 'sine', vol: 0.08 }); }); },
    lose() { const t = now(); [[311, 0], [294, 0.45], [277, 0.9], [262, 1.35]].forEach(([f, d], i) => tone(f, t + d, i === 3 ? 1.3 : 0.45, { type: 'sawtooth', vol: 0.12, filter: 900, glide: i === 3 ? 200 : null })); },
    espresso() { const t = now(); noise(t, 0.8, { vol: 0.1, freq: 1800, sweep: 900, q: 3 }); for (let i = 0; i < 5; i++) tone(300 + Math.random() * 300, t + 0.2 + i * 0.1, 0.06, { type: 'sine', vol: 0.06 }); },
    cookie() { const t = now(); tone(300, t, 0.25, { type: 'sine', vol: 0.18, glide: 600 }); tone(600, t + 0.2, 0.3, { type: 'sine', vol: 0.14, glide: 250 }); },
    ding() { const t = now(); tone(1318, t, 0.6, { type: 'sine', vol: 0.12 }); tone(1975, t, 0.3, { type: 'sine', vol: 0.04 }); },
    card() { noise(now(), 0.12, { vol: 0.08, freq: 5000, q: 0.6 }); },
    stamp() { const t = now(); tone(70, t, 0.2, { type: 'sine', vol: 0.3, glide: 40 }); noise(t, 0.12, { vol: 0.12, type: 'lowpass', freq: 900 }); },
    turn() { const t = now(); tone(784, t, 0.35, { type: 'sine', vol: 0.1 }); tone(1046, t + 0.12, 0.45, { type: 'sine', vol: 0.1 }); },
    panel() { noise(now(), 0.08, { vol: 0.07, freq: 3500, q: 0.8 }); },
    relax() { const t = now(); [392, 494, 587].forEach((f, i) => tone(f, t + i * 0.25, 1.2, { type: 'sine', vol: 0.06 })); },
    crash() { const t = now(); tone(400, t, 0.6, { type: 'sawtooth', vol: 0.08, glide: 80, filter: 1500 }); noise(t + 0.1, 0.4, { vol: 0.08, freq: 800, q: 1 }); },
    slide() { noise(now(), 0.2, { vol: 0.06, freq: 2500, sweep: 900, q: 0.7 }); },
    go() { const t = now(); [523, 784, 1046].forEach((f, i) => tone(f, t + i * 0.1, 0.4, { type: 'square', vol: 0.06, filter: 2500 })); },
    // stress layer
    tick(loud) { const t = now(); tone(loud ? 2000 : 1500, t, 0.03, { type: 'square', vol: loud ? 0.06 : 0.025, filter: 4000 }); },
    heartbeat() { const t = now(); tone(60, t, 0.14, { type: 'sine', vol: 0.22, glide: 40 }); tone(55, t + 0.22, 0.16, { type: 'sine', vol: 0.16, glide: 38 }); },
  };

  function play(name, ...args) {
    if (!ready() || !lib[name]) return;
    try { lib[name](...args); } catch (e) { /* never break the game for a sound */ }
  }
  return {
    play, unlock,
    setEnabled(v) { enabled = !!v; },
    get enabled() { return enabled; },
    get unlocked() { return unlocked && ctx && ctx.state === 'running'; },
  };
})();
