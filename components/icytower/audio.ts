// Fully synthesized, adaptive soundtrack. Nothing is sampled: a lookahead
// scheduler plays a four-chord loop whose layers follow the run — drums arrive
// with the scrolling, hats with the hurry level, a sparkling arpeggio with the
// combo — and every hurry-up nudges the tempo. Combo landings ring bell notes
// that climb the scale, so a long combo plays a rising melody.

const MUTE_KEY = "icytower.muted";
const LOOKAHEAD_S = 0.12;
const SCHEDULER_MS = 25;
const STEPS_PER_BAR = 16;
const BARS = 4;
const ROOT_HZ = 220; // A3

// Am – F – C – G, as semitones from the key root
const PROGRESSION: readonly (readonly number[])[] = [
  [0, 3, 7],
  [-4, 0, 3],
  [3, 7, 10],
  [-2, 2, 5],
];
const BASS_ROOTS = [0, -4, 3, -2];
const PENTATONIC = [0, 3, 5, 7, 10];
const STRATUM_KEYS = [0, 2, -3, 5, -1, 3]; // each stratum shifts the key

const hz = (semitones: number) => ROOT_HZ * Math.pow(2, semitones / 12);

export interface MusicMood {
  level: number; // hurry level (0 before the tower scrolls)
  comboJumps: number;
  stratum: number;
  altitude: number; // 0..1, opens the pad filter as you climb
}

export class TowerAudio {
  muted: boolean;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: number | null = null;
  private nextTime = 0;
  private stepIndex = 0;
  private mood: MusicMood = { level: 0, comboJumps: 0, stratum: 0, altitude: 0 };

  constructor() {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(MUTE_KEY);
    } catch {
      // storage unavailable — fall back to the default
    }
    this.muted = stored === null ? true : stored === "1";
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {
      // storage unavailable — the preference just won't persist
    }
    if (muted) {
      this.stopMusic();
      this.master?.gain.setTargetAtTime(0, this.ctx?.currentTime ?? 0, 0.05);
    } else if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(0.9, this.ctx.currentTime, 0.05);
    }
  }

  setMood(mood: MusicMood): void {
    this.mood = mood;
  }

  /** Lazily builds the graph; must first run inside a user gesture. */
  private audio(): AudioContext | null {
    if (this.muted || typeof AudioContext === "undefined") return null;
    if (!this.ctx) {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 4;
      master.connect(comp).connect(ctx.destination);

      const reverb = ctx.createConvolver();
      reverb.buffer = this.impulse(ctx, 2.6);
      const wet = ctx.createGain();
      wet.gain.value = 0.32;
      reverb.connect(wet).connect(master);

      const music = ctx.createGain();
      music.gain.value = 0.5;
      music.connect(master);
      music.connect(reverb);
      const sfx = ctx.createGain();
      sfx.gain.value = 0.75;
      sfx.connect(master);
      sfx.connect(reverb);

      this.ctx = ctx;
      this.master = master;
      this.music = music;
      this.sfx = sfx;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Decaying stereo noise — a cheap, wide "ice cave" reverb. */
  private impulse(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3.2);
      }
    }
    return buf;
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (!this.noise) {
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buf;
    }
    return this.noise;
  }

  // ---------------------------------------------------------------- voices

  private tone(
    dest: AudioNode,
    at: number,
    freq: number,
    opts: {
      type?: OscillatorType;
      gain?: number;
      attack?: number;
      decay?: number;
      glideTo?: number;
      detune?: number;
    } = {},
  ): void {
    const ctx = this.ctx!;
    const { type = "sine", gain = 0.2, attack = 0.005, decay = 0.2, glideTo, detune = 0 } = opts;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, at + attack + decay);
    osc.detune.value = detune;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    osc.connect(env).connect(dest);
    osc.start(at);
    osc.stop(at + attack + decay + 0.05);
  }

  private hiss(
    dest: AudioNode,
    at: number,
    opts: { gain?: number; decay?: number; type?: BiquadFilterType; freq?: number; sweepTo?: number; q?: number },
  ): void {
    const ctx = this.ctx!;
    const { gain = 0.2, decay = 0.08, type = "highpass", freq = 6000, sweepTo, q = 0.7 } = opts;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(freq, at);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, at + decay);
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    src.connect(filter).connect(env).connect(dest);
    src.start(at, Math.random() * 0.5);
    src.stop(at + decay + 0.02);
  }

  /** FM bell: a sine carrier wobbled by a non-integer-ratio modulator. */
  private bell(dest: AudioNode, at: number, freq: number, gain: number, decay = 1.1): void {
    const ctx = this.ctx!;
    const carrier = ctx.createOscillator();
    carrier.frequency.value = freq;
    const mod = ctx.createOscillator();
    mod.frequency.value = freq * 3.5;
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(freq * 2.2, at);
    modGain.gain.exponentialRampToValueAtTime(1, at + decay);
    mod.connect(modGain).connect(carrier.frequency);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    carrier.connect(env).connect(dest);
    carrier.start(at);
    mod.start(at);
    carrier.stop(at + decay + 0.05);
    mod.stop(at + decay + 0.05);
  }

  // ---------------------------------------------------------------- music

  startMusic(): void {
    const ctx = this.audio();
    if (!ctx || this.timer !== null) return;
    this.music?.gain.cancelScheduledValues(ctx.currentTime);
    this.music?.gain.setTargetAtTime(0.5, ctx.currentTime, 0.1);
    this.nextTime = ctx.currentTime + 0.06;
    this.timer = window.setInterval(() => this.schedule(), SCHEDULER_MS);
  }

  stopMusic(fadeSeconds = 0.15): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    if (this.ctx && this.music) {
      this.music.gain.setTargetAtTime(0.0001, this.ctx.currentTime, fadeSeconds / 3);
    }
  }

  /** Restart the loop from bar one — for a fresh run. */
  resetMusic(): void {
    this.stepIndex = 0;
  }

  private bpm(): number {
    return Math.min(156, 112 + this.mood.level * 5);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD_S) {
      this.playStep(this.stepIndex, this.nextTime);
      this.nextTime += 60 / this.bpm() / 4;
      this.stepIndex = (this.stepIndex + 1) % (STEPS_PER_BAR * BARS);
    }
  }

  private playStep(index: number, at: number): void {
    const out = this.music!;
    const { level, comboJumps, stratum, altitude } = this.mood;
    const key = STRATUM_KEYS[Math.min(stratum, STRATUM_KEYS.length - 1)];
    const bar = Math.floor(index / STEPS_PER_BAR);
    const s = index % STEPS_PER_BAR;
    const chord = PROGRESSION[bar];
    const sixteenth = 60 / this.bpm() / 4;

    // pad: two detuned saws per chord tone through a filter that opens with altitude
    if (s === 0) {
      const ctx = this.ctx!;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 500 + altitude * 2600 + comboJumps * 120;
      filter.Q.value = 0.8;
      filter.connect(out);
      const length = sixteenth * STEPS_PER_BAR;
      for (const note of chord) {
        for (const detune of [-9, 9]) {
          this.tone(filter, at, hz(note + key), {
            type: "sawtooth",
            gain: 0.028,
            attack: length * 0.35,
            decay: length * 0.9,
            detune,
          });
        }
      }
    }

    // bass: driving eighths, octave jump on the off-beat
    if (s % 2 === 0) {
      const root = BASS_ROOTS[bar] + key - 24;
      this.tone(out, at, hz(s % 4 === 2 ? root + 12 : root), {
        type: "triangle",
        gain: level > 0 ? 0.2 : 0.12,
        decay: sixteenth * 1.6,
      });
    }

    // kick on every beat once the tower moves
    if (level >= 1 && s % 4 === 0) {
      this.tone(out, at, 150, { gain: 0.5, decay: 0.16, glideTo: 42 });
    }
    // clap on two and four from hurry level 3
    if (level >= 3 && (s === 4 || s === 12)) {
      this.hiss(out, at, { gain: 0.16, decay: 0.12, type: "bandpass", freq: 1600, q: 0.9 });
    }
    // hats: off-beats from level 2 (or in a combo), straight sixteenths from level 5
    if ((level >= 2 || comboJumps > 0) && (s % 2 === 1 || level >= 5)) {
      this.hiss(out, at, { gain: s % 4 === 2 ? 0.05 : 0.035, decay: 0.035 });
    }

    // combo arpeggio: louder and higher the longer the chain
    if (comboJumps > 0) {
      const octave = 12 * (1 + (Math.floor(s / 3) % 2) + (comboJumps >= 6 ? 1 : 0));
      const note = chord[s % chord.length] + key + octave;
      this.tone(out, at, hz(note), {
        type: "triangle",
        gain: Math.min(0.11, 0.035 + comboJumps * 0.012),
        decay: sixteenth * 1.3,
      });
    }
  }

  // ---------------------------------------------------------------- effects

  jump(power: number, superJump: boolean): void {
    const ctx = this.audio();
    if (!ctx) return;
    const t = ctx.currentTime;
    const base = 260 * (1 + power * 0.9);
    this.tone(this.sfx!, t, base, { type: "triangle", gain: 0.1, decay: 0.12, glideTo: base * 2.1 });
    if (superJump) {
      this.hiss(this.sfx!, t, { gain: 0.12, decay: 0.35, type: "bandpass", freq: 600, sweepTo: 5200, q: 1.4 });
    }
  }

  land(impact: number): void {
    const ctx = this.audio();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(this.sfx!, t, 110, { gain: 0.08 + impact * 0.22, decay: 0.09, glideTo: 48 });
    this.hiss(this.sfx!, t, { gain: 0.05 + impact * 0.12, decay: 0.07, type: "bandpass", freq: 2400, q: 0.6 });
  }

  wall(speed: number): void {
    const ctx = this.audio();
    if (!ctx) return;
    const t = ctx.currentTime;
    const g = Math.min(0.14, speed / 5000);
    this.tone(this.sfx!, t, 1480, { gain: g, decay: 0.18 });
    this.tone(this.sfx!, t, 2217, { gain: g * 0.6, decay: 0.12 });
  }

  /** Each combo landing rings the next note up the pentatonic scale. */
  comboStep(jumps: number): void {
    const ctx = this.audio();
    if (!ctx) return;
    const key = STRATUM_KEYS[Math.min(this.mood.stratum, STRATUM_KEYS.length - 1)];
    const degree = jumps - 1;
    const note = PENTATONIC[degree % 5] + 12 * Math.floor(degree / 5) + 12 + key;
    this.bell(this.sfx!, ctx.currentTime, hz(Math.min(note, 48)), 0.16);
  }

  /** Rising arpeggio — longer and brighter for bigger tiers. */
  comboEnd(tier: number): void {
    const ctx = this.audio();
    if (!ctx || tier < 0) return;
    const t = ctx.currentTime;
    const key = STRATUM_KEYS[Math.min(this.mood.stratum, STRATUM_KEYS.length - 1)];
    const notes = 4 + Math.min(tier, 8);
    for (let i = 0; i < notes; i++) {
      const degree = PENTATONIC[i % 5] + 12 * Math.floor(i / 5) + 12 + key;
      this.tone(this.sfx!, t + i * 0.055, hz(degree), {
        type: i % 2 ? "square" : "triangle",
        gain: 0.06,
        decay: 0.3,
      });
    }
    this.hiss(this.sfx!, t, { gain: 0.08 + tier * 0.015, decay: 0.6 + tier * 0.08, freq: 3000, sweepTo: 12000 });
  }

  hurry(): void {
    const ctx = this.audio();
    if (!ctx) return;
    const t = ctx.currentTime;
    [988, 740, 988, 740].forEach((f, i) => {
      this.tone(this.sfx!, t + i * 0.13, f, { type: "square", gain: 0.05, decay: 0.1 });
    });
  }

  stratum(): void {
    const ctx = this.audio();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.hiss(this.sfx!, t, { gain: 0.18, decay: 1.4, type: "bandpass", freq: 200, sweepTo: 6000, q: 2 });
    const key = STRATUM_KEYS[Math.min(this.mood.stratum, STRATUM_KEYS.length - 1)];
    for (const n of [0, 7, 12, 16]) {
      this.bell(this.sfx!, t + 0.9, hz(n + key + 12), 0.08, 2.4);
    }
  }

  crack(): void {
    const ctx = this.audio();
    if (!ctx) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      this.hiss(this.sfx!, t + i * 0.05, { gain: 0.1, decay: 0.04, type: "highpass", freq: 3500 });
    }
  }

  crumble(): void {
    const ctx = this.audio();
    if (!ctx) return;
    this.hiss(this.sfx!, ctx.currentTime, { gain: 0.2, decay: 0.5, type: "lowpass", freq: 1200, sweepTo: 120 });
  }

  ghostPassed(): void {
    const ctx = this.audio();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.bell(this.sfx!, t, hz(19), 0.1, 0.8);
    this.bell(this.sfx!, t + 0.12, hz(24), 0.1, 1.2);
  }

  gameOver(): void {
    this.stopMusic(0.6);
    const ctx = this.audio();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(this.sfx!, t, 440, { type: "sawtooth", gain: 0.12, attack: 0.01, decay: 1.1, glideTo: 55 });
    this.hiss(this.sfx!, t, { gain: 0.12, decay: 1.2, type: "lowpass", freq: 4000, sweepTo: 80 });
  }

  dispose(): void {
    this.stopMusic();
    void this.ctx?.close();
    this.ctx = null;
    this.master = this.music = this.sfx = null;
  }
}
