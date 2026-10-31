// Efectos de sonido sintetizados con WebAudio: no hay archivos que descargar.
const Sfx = {
  ctx: null,
  muted: false,

  // Los navegadores solo permiten audio después de un toque o tecla.
  unlock() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  tone(freq, dur, type = 'square', vol = 0.12, slideTo = null, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },

  noise(dur, vol = 0.3) {
    if (!this.ctx || this.muted) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    src.buffer = buf;
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(this.ctx.destination);
    src.start();
  },

  pickup() { this.tone(660, 0.08); this.tone(990, 0.12, 'square', 0.12, null, 0.07); },
  board() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.16, null, i * 0.08)); },
  miss() { this.tone(330, 0.25, 'square', 0.1, 160); },
  crash() { this.noise(0.45, 0.45); this.tone(140, 0.35, 'sawtooth', 0.15, 40); },
  horn() { this.tone(311, 0.4, 'sawtooth', 0.07); this.tone(392, 0.4, 'sawtooth', 0.06); },
  click() { this.tone(880, 0.05, 'triangle', 0.1); },
  arrive() { [523, 659, 784, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.16, null, i * 0.13)); },
  fail() { [392, 330, 262].forEach((f, i) => this.tone(f, 0.3, 'square', 0.1, null, i * 0.22)); }
};
