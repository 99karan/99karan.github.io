import type { VehicleKind } from './state';

/**
 * Procedural sound: every engine note is synthesised, so there is nothing to
 * download. Browsers only allow audio after a user gesture, so `start()` is
 * called from the intro button.
 */

interface Voice {
  base: number;
  range: number;
  type: OscillatorType;
  sub: number;
  cutoff: [number, number];
  noise: number;
  noiseFreq: number;
  chop: number;
  gain: number;
}

const VOICES: Record<VehicleKind, Voice> = {
  car: { base: 38, range: 150, type: 'sawtooth', sub: 0.5, cutoff: [380, 2200], noise: 0.04, noiseFreq: 900, chop: 0, gain: 0.32 },
  bike: { base: 55, range: 290, type: 'square', sub: 0.5, cutoff: [700, 3800], noise: 0.05, noiseFreq: 1600, chop: 0, gain: 0.22 },
  plane: { base: 34, range: 95, type: 'sawtooth', sub: 0.5, cutoff: [300, 1500], noise: 0.25, noiseFreq: 700, chop: 0, gain: 0.3 },
  heli: { base: 28, range: 30, type: 'triangle', sub: 0.5, cutoff: [220, 600], noise: 0.6, noiseFreq: 420, chop: 1, gain: 0.5 },
  boat: { base: 32, range: 120, type: 'sawtooth', sub: 0.5, cutoff: [260, 1400], noise: 0.22, noiseFreq: 500, chop: 0, gain: 0.3 },
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private osc!: OscillatorNode;
  private sub!: OscillatorNode;
  private filter!: BiquadFilterNode;
  private engineGain!: GainNode;
  private noiseFilter!: BiquadFilterNode;
  private noiseGain!: GainNode;
  private chopGain!: GainNode;
  private lfo!: OscillatorNode;
  private lfoDepth!: GainNode;
  private wind!: GainNode;
  private windFilter!: BiquadFilterNode;
  private squeal!: GainNode;
  private noiseBuffer!: AudioBuffer;
  private kind: VehicleKind = 'car';
  private muted = true;

  get ready() {
    return this.ctx !== null;
  }

  start() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);

    // white noise buffer, shared by every noisy voice
    const len = ctx.sampleRate * 2;
    this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    // engine: oscillator + sub-octave → low-pass → chopper → gain
    this.osc = ctx.createOscillator();
    this.sub = ctx.createOscillator();
    this.sub.type = 'sine';
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.value = 3;
    this.engineGain = ctx.createGain();
    this.chopGain = ctx.createGain();
    this.osc.connect(this.filter);
    const subGain = ctx.createGain();
    subGain.gain.value = 0.6;
    this.sub.connect(subGain).connect(this.filter);
    this.filter.connect(this.chopGain).connect(this.engineGain).connect(this.master);

    // noise layer (prop wash, rotor chop, water)
    const noise = this.loopNoise();
    this.noiseFilter = ctx.createBiquadFilter();
    this.noiseFilter.type = 'bandpass';
    this.noiseFilter.Q.value = 0.9;
    this.noiseGain = ctx.createGain();
    noise.connect(this.noiseFilter).connect(this.noiseGain).connect(this.chopGain);

    // rotor chop LFO modulates the chopper's gain
    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfoDepth = ctx.createGain();
    this.lfoDepth.gain.value = 0;
    this.lfo.connect(this.lfoDepth).connect(this.chopGain.gain);
    this.chopGain.gain.value = 1;

    // wind rush with speed
    const windNoise = this.loopNoise();
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 600;
    this.wind = ctx.createGain();
    this.wind.gain.value = 0;
    windNoise.connect(this.windFilter).connect(this.wind).connect(this.master);

    // tyre squeal
    const sq = this.loopNoise();
    const sqf = ctx.createBiquadFilter();
    sqf.type = 'bandpass';
    sqf.frequency.value = 2400;
    sqf.Q.value = 9;
    this.squeal = ctx.createGain();
    this.squeal.gain.value = 0;
    sq.connect(sqf).connect(this.squeal).connect(this.master);

    this.osc.start();
    this.sub.start();
    this.lfo.start();
    this.setVehicle(this.kind);
  }

  private loopNoise() {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    src.start();
    return src;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  setVehicle(kind: VehicleKind) {
    this.kind = kind;
    if (!this.ctx) return;
    const v = VOICES[kind];
    this.osc.type = v.type;
    this.noiseFilter.frequency.value = v.noiseFreq;
    this.lfoDepth.gain.value = v.chop ? 0.85 : 0;
  }

  /** Called every frame with the active vehicle's state. */
  update(rpm: number, speed: number, slip: number) {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const v = VOICES[this.kind];
    const t = ctx.currentTime;
    const f = v.base + rpm * v.range;
    this.osc.frequency.setTargetAtTime(f, t, 0.05);
    this.sub.frequency.setTargetAtTime(f * v.sub, t, 0.05);
    this.filter.frequency.setTargetAtTime(v.cutoff[0] + rpm * (v.cutoff[1] - v.cutoff[0]), t, 0.08);
    this.engineGain.gain.setTargetAtTime(v.gain * (0.35 + rpm * 0.65), t, 0.1);
    this.noiseGain.gain.setTargetAtTime(v.noise * (0.4 + rpm), t, 0.1);
    if (v.chop) this.lfo.frequency.setTargetAtTime(4 + rpm * 18, t, 0.2);
    const s = Math.min(1, Math.abs(speed) / 70);
    this.wind.gain.setTargetAtTime(s * s * 0.35, t, 0.2);
    this.windFilter.frequency.setTargetAtTime(300 + s * 1400, t, 0.2);
    this.squeal.gain.setTargetAtTime(Math.min(0.12, Math.max(0, slip - 3) * 0.015), t, 0.05);
  }

  private envelope(node: AudioNode, gain: number, attack: number, decay: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + attack + decay);
    node.connect(g).connect(this.master);
  }

  private noiseShot(freq: number, q: number, gain: number, decay: number, type: BiquadFilterType = 'lowpass') {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    src.connect(f);
    this.envelope(f, gain, 0.005, decay);
    src.start();
    src.stop(ctx.currentTime + decay + 0.1);
  }

  private tone(freq: number, type: OscillatorType, gain: number, start: number, dur: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    const t0 = ctx.currentTime + start;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.setValueAtTime(gain, t0 + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  play(sound: 'horn' | 'collect' | 'crash' | 'splash' | 'bump' | 'land' | 'switch') {
    if (!this.ctx || this.muted) return;
    switch (sound) {
      case 'horn':
        this.tone(392, 'square', 0.08, 0, 0.45);
        this.tone(494, 'square', 0.07, 0, 0.45);
        break;
      case 'collect':
        [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 'sine', 0.12, i * 0.07, 0.35));
        break;
      case 'crash':
        this.noiseShot(900, 0.5, 0.9, 1.4);
        this.tone(55, 'sine', 0.5, 0, 0.6);
        break;
      case 'splash':
        this.noiseShot(1400, 0.7, 0.5, 0.9, 'bandpass');
        break;
      case 'bump':
        this.tone(70, 'sine', 0.35, 0, 0.18);
        this.noiseShot(400, 0.6, 0.25, 0.15);
        break;
      case 'land':
        this.tone(60, 'sine', 0.4, 0, 0.25);
        this.noiseShot(300, 0.5, 0.25, 0.2);
        break;
      case 'switch':
        this.tone(523, 'triangle', 0.08, 0, 0.12);
        this.tone(784, 'triangle', 0.08, 0.08, 0.16);
        break;
    }
  }
}

export const sound = new SoundEngine();
