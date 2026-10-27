import { renderString, type Excitation } from './stringPhysics';

type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null = null;
let bus: GainNode | null = null;

function createImpulse(c: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(c.sampleRate * seconds);
  const impulse = c.createBuffer(2, length, c.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3.2;
  }
  return impulse;
}

function getContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.ratio.value = 3.5;
  compressor.connect(ctx.destination);

  bus = ctx.createGain();
  bus.gain.value = 0.9;
  bus.connect(compressor);

  // Caja de resonancia: un poco de sala para que no suene a sintetizador seco.
  const reverb = ctx.createConvolver();
  reverb.buffer = createImpulse(ctx, 2.6);
  const wet = ctx.createGain();
  wet.gain.value = 0.32;
  bus.connect(reverb);
  reverb.connect(wet);
  wet.connect(compressor);
  return ctx;
}

/** Llamar dentro de un gesto: iOS no deja sonar nada hasta entonces. */
export function unlockAudio(): void {
  const c = getContext();
  if (c && c.state !== 'running') void c.resume();
}

export type StringSound = {
  frequency: number;
  velocity: number;
  position: number;
  /** -1 (izquierda) a 1 (derecha). */
  pan: number;
  t60: number;
  excitation?: Excitation;
  /** Segundos de subida: >0 para la resonancia simpática, que crece en vez de golpear. */
  swell?: number;
};

export function playString({
  frequency,
  velocity,
  position,
  pan,
  t60,
  excitation = 'pluck',
  swell = 0,
}: StringSound): void {
  const c = getContext();
  if (!c || !bus) return;
  if (c.state !== 'running') void c.resume();

  const seconds = Math.min(6, t60 + 0.3);
  const samples = renderString({
    sampleRate: c.sampleRate,
    frequency,
    seconds,
    position,
    brightness: Math.min(1, 0.25 + velocity * 0.7),
    t60,
    excitation,
  });
  const buffer = c.createBuffer(1, samples.length, c.sampleRate);
  buffer.getChannelData(0).set(samples);

  const source = c.createBufferSource();
  source.buffer = buffer;
  const gain = c.createGain();
  const level = 0.32 * velocity;
  const t = c.currentTime + 0.003;
  if (swell > 0) {
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(level, t + swell);
  } else {
    gain.gain.value = level;
  }
  source.connect(gain);
  if (typeof c.createStereoPanner === 'function') {
    const panner = c.createStereoPanner();
    panner.pan.value = pan;
    gain.connect(panner);
    panner.connect(bus);
  } else {
    gain.connect(bus);
  }
  source.start(t);
}
