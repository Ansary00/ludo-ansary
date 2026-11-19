/**
 * Zero-asset sound engine built on the Web Audio API.
 * Every effect is synthesised in the browser, so there are no audio files to
 * download and no licensing concerns.
 */

type Sfx = 'click' | 'dice' | 'step' | 'capture' | 'home' | 'win' | 'turn' | 'join' | 'leave' | 'error' | 'start';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private enabled = true;
  private musicEnabled = false;
  private unlocked = false;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.stopMusic();
    else if (this.musicEnabled) this.startMusic();
  }

  setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    if (enabled && this.enabled) this.startMusic();
    else this.stopMusic();
  }

  unlock(): void {
    if (this.unlocked) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.unlocked = true;
    if (ctx.state === 'suspended') void ctx.resume();
    if (this.musicEnabled && this.enabled) this.startMusic();
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(
    frequency: number,
    duration: number,
    options: { type?: OscillatorType; gain?: number; delay?: number; slideTo?: number } = {},
  ): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    const { type = 'sine', gain = 0.12, delay = 0, slideTo } = options;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), start + duration);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.02, duration / 4));
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(envelope);
    envelope.connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  private noise(duration: number, gain: number, frequency: number, delay = 0): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    const envelope = ctx.createGain();
    envelope.gain.value = gain;
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.master);
    source.start(ctx.currentTime + delay);
  }

  play(effect: Sfx): void {
    if (!this.enabled) return;
    switch (effect) {
      case 'click':
        this.tone(660, 0.07, { type: 'triangle', gain: 0.07 });
        break;
      case 'step':
        this.tone(440 + Math.random() * 120, 0.06, { type: 'triangle', gain: 0.05 });
        break;
      case 'dice':
        this.noise(0.22, 0.12, 2400);
        this.tone(180, 0.1, { type: 'square', gain: 0.05 });
        this.tone(240, 0.08, { type: 'square', gain: 0.04, delay: 0.09 });
        this.tone(160, 0.08, { type: 'square', gain: 0.035, delay: 0.17 });
        break;
      case 'capture':
        this.tone(320, 0.32, { type: 'sawtooth', gain: 0.1, slideTo: 70 });
        this.noise(0.25, 0.1, 900);
        break;
      case 'home':
        [523.25, 659.25, 783.99].forEach((note, i) => this.tone(note, 0.24, { type: 'triangle', gain: 0.08, delay: i * 0.09 }));
        break;
      case 'win':
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((note, i) =>
          this.tone(note, 0.5, { type: 'triangle', gain: 0.1, delay: i * 0.14 }),
        );
        this.noise(0.5, 0.06, 3000);
        break;
      case 'turn':
        this.tone(880, 0.12, { type: 'sine', gain: 0.06 });
        this.tone(1174.66, 0.16, { type: 'sine', gain: 0.045, delay: 0.1 });
        break;
      case 'join':
        this.tone(587.33, 0.12, { type: 'sine', gain: 0.07 });
        this.tone(783.99, 0.16, { type: 'sine', gain: 0.06, delay: 0.09 });
        break;
      case 'leave':
        this.tone(392, 0.18, { type: 'sine', gain: 0.06, slideTo: 220 });
        break;
      case 'error':
        this.tone(150, 0.22, { type: 'square', gain: 0.06, slideTo: 110 });
        break;
      case 'start':
        [392, 523.25, 659.25].forEach((note, i) => this.tone(note, 0.3, { type: 'sine', gain: 0.07, delay: i * 0.1 }));
        break;
    }
  }

  startMusic(): void {
    if (!this.enabled || !this.musicEnabled || this.musicTimer !== null) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.musicGain = this.musicGain ?? ctx.createGain();
    this.musicGain.gain.value = 0.5;
    this.musicGain.connect(this.master!);
    const chords = [
      [174.61, 220, 261.63, 329.63],
      [130.81, 196, 261.63, 329.63],
      [110, 164.81, 220, 261.63],
      [98, 196, 246.94, 293.66],
    ];
    const playChord = () => {
      if (!this.enabled || !this.musicEnabled) return;
      const chord = chords[this.musicStep % chords.length]!;
      this.musicStep += 1;
      chord.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = index === 0 ? 'sine' : 'triangle';
        osc.frequency.value = freq;
        const now = ctx.currentTime;
        const peak = 0.028 / (index * 0.4 + 1);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(peak, now + 2.2);
        gain.gain.linearRampToValueAtTime(0.0001, now + 7.4);
        osc.connect(gain);
        gain.connect(this.musicGain!);
        osc.start(now);
        osc.stop(now + 7.6);
      });
    };
    playChord();
    this.musicTimer = window.setInterval(playChord, 7000);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.musicGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.4);
    }
  }
}

export const audio = new SoundEngine();
