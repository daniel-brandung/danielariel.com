const MUTE_KEY = "moorhuhn.muted";

export class Sfx {
  muted: boolean;
  private ctx: AudioContext | null = null;
  private noise: AudioBuffer | null = null;

  constructor() {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(MUTE_KEY);
    } catch {
      // storage unavailable — fall back to default
    }
    this.muted = stored === null ? true : stored === "1";
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {
      // storage unavailable — preference just won't persist
    }
  }

  private audio(): AudioContext | null {
    if (this.muted || typeof AudioContext === "undefined") return null;
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noise) {
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buf;
    }
    return this.noise;
  }

  private click(ctx: AudioContext, at: number, freq: number): void {
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.04);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.05);
  }

  /** Shotgun blast: filtered noise burst with a fast decay. */
  shot(): void {
    const ctx = this.audio();
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(3000, t);
    filter.frequency.exponentialRampToValueAtTime(220, t + 0.16);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t);
  }

  /** Dry click for firing on an empty chamber. */
  empty(): void {
    const ctx = this.audio();
    if (!ctx) return;
    this.click(ctx, ctx.currentTime, 1100);
  }

  /** Click… clack — the second lands just before the 0.6 s reload completes. */
  reload(): void {
    const ctx = this.audio();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.click(ctx, t, 520);
    this.click(ctx, t + 0.45, 380);
  }

  /** Pitch-bent squawk for a hit. */
  squawk(): void {
    const ctx = this.audio();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(620, t);
    osc.frequency.exponentialRampToValueAtTime(240, t + 0.22);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.26);
  }

  /** Three ascending notes at round end. */
  jingle(): void {
    const ctx = this.audio();
    if (!ctx) return;
    const t = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.15, t + i * 0.13);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.13 + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t + i * 0.13);
      osc.stop(t + i * 0.13 + 0.32);
    });
  }

  /** Rising ding when the combo multiplier climbs; pitch scales with the multiplier. */
  combo(multiplier: number): void {
    const ctx = this.audio();
    if (!ctx) return;
    const t = ctx.currentTime;
    const base = 440 * Math.pow(1.25, Math.min(4, multiplier));
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 1.5, t + 0.09);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  /** Golden-chicken fanfare: fast bright four-note arpeggio. */
  fanfare(): void {
    const ctx = this.audio();
    if (!ctx) return;
    const t = ctx.currentTime;
    [659.25, 830.61, 987.77, 1318.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.09, t + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t + i * 0.07);
      osc.stop(t + i * 0.07 + 0.24);
    });
  }
}
