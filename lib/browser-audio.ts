export const CROSSFADE_OPTIONS = [0, 2, 4, 6, 8, 12] as const;

type Channel = {
  source: MediaElementAudioSourceNode;
  level: GainNode;
  fade: GainNode;
  meter: AnalyserNode;
  samples: Float32Array<ArrayBuffer>;
  meanSquare: number;
  observed: number;
  lastSample: number;
};

const amplitude = (db: number) => 10 ** (db / 20);

export class BrowserAudio {
  private channels = new WeakMap<HTMLAudioElement, Channel>();
  private output: GainNode;
  private headroom: GainNode;
  private filters: BiquadFilterNode[];

  constructor(private context: AudioContext, frequencies: number[]) {
    this.output = context.createGain();
    this.headroom = context.createGain();
    this.filters = frequencies.map(frequency => {
      const filter = context.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = Math.min(frequency, context.sampleRate * 0.49);
      filter.Q.value = 1.4;
      return filter;
    });
    let previous: AudioNode = this.headroom;
    for (const filter of this.filters) {
      previous.connect(filter);
      previous = filter;
    }
    previous.connect(this.output);
    this.output.connect(context.destination);
  }

  attach(audio: HTMLAudioElement) {
    if (this.channels.has(audio)) return;
    const ctx = this.context;
    const source = ctx.createMediaElementSource(audio);
    const meter = ctx.createAnalyser();
    const level = ctx.createGain();
    const fade = ctx.createGain();
    meter.fftSize = 2048;
    source.connect(meter);
    meter.connect(level);
    level.connect(fade);
    fade.connect(this.headroom);
    this.channels.set(audio, {
      source, meter, level, fade, samples: new Float32Array(meter.fftSize),
      meanSquare: 0, observed: 0, lastSample: -Infinity,
    });
  }

  wake() {
    if (this.context.state !== 'running') void this.context.resume().catch(() => {});
  }

  detach(audio: HTMLAudioElement) {
    const channel = this.channels.get(audio);
    if (!channel) return;
    channel.source.disconnect();
    channel.meter.disconnect();
    channel.level.disconnect();
    channel.fade.disconnect();
    this.channels.delete(audio);
  }

  setVolume(value: number) {
    this.output.gain.setTargetAtTime(value, this.context.currentTime, 0.025);
  }

  setEqualizer(values: number[]) {
    const now = this.context.currentTime;
    this.filters.forEach((filter, i) => filter.gain.setTargetAtTime(values[i], now, 0.03));
    const boost = Math.max(0, ...values);
    this.headroom.gain.setTargetAtTime(amplitude(boost ? -boost - 2 : 0), now, 0.04);
  }

  setFade(audio: HTMLAudioElement, from: number, to = from, seconds = 0) {
    const gain = this.channels.get(audio)?.fade.gain;
    if (!gain) return;
    const now = this.context.currentTime;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(from, now);
    if (seconds > 0) gain.linearRampToValueAtTime(to, now + seconds);
  }

  resetLevel(audio: HTMLAudioElement) {
    const channel = this.channels.get(audio);
    if (!channel) return;
    channel.meanSquare = 0;
    channel.observed = 0;
    channel.lastSample = -Infinity;
    const now = this.context.currentTime;
    channel.level.gain.cancelScheduledValues(now);
    channel.level.gain.setValueAtTime(1, now);
  }

  measureLevel(audio: HTMLAudioElement) {
    const channel = this.channels.get(audio);
    const now = this.context.currentTime;
    if (!channel || audio.paused || audio.seeking || audio.readyState < 3 || now - channel.lastSample < 0.18) return;
    channel.lastSample = now;
    channel.meter.getFloatTimeDomainData(channel.samples);
    let sum = 0;
    let peak = 0;
    for (const sample of channel.samples) {
      sum += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
    }
    const power = sum / channel.samples.length;
    if (power < 0.0004) return;
    // Ignore silence and use a slowly changing average, so individual beats do not move the gain.
    channel.observed++;
    const weight = 1 / Math.min(channel.observed, 32);
    channel.meanSquare += weight * (power - channel.meanSquare);
    if (channel.observed < 5) return;
    const adjustment = Math.min(5, Math.max(-12, -19 - 10 * Math.log10(channel.meanSquare)));
    const gain = Math.min(amplitude(adjustment), 0.98 / peak);
    channel.level.gain.setTargetAtTime(gain, now, 1.4);
  }
}
