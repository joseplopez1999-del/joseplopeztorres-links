/**
 * Voz de cuerda con Web Audio: unos pocos armónicos con ataque seco,
 * filtro que se va cerrando y una reverb generada al vuelo.
 */

type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null = null;
let bus: GainNode | null = null;

function getContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -16;
  compressor.ratio.value = 4;
  compressor.connect(ctx.destination);

  bus = ctx.createGain();
  bus.gain.value = 0.8;
  bus.connect(compressor);

  const length = Math.floor(ctx.sampleRate * 2.4);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  const reverb = ctx.createConvolver();
  reverb.buffer = impulse;
  const wet = ctx.createGain();
  wet.gain.value = 0.3;
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

/** [armónico, ganancia, fracción del sustain] */
const PARTIALS = [
  [1, 1, 1],
  [2, 0.6, 0.8],
  [3, 0.35, 0.6],
  [4, 0.2, 0.45],
  [6, 0.08, 0.3],
] as const;

export function playString(midi: number, velocity: number): void {
  const c = getContext();
  if (!c || !bus) return;
  if (c.state !== 'running') void c.resume();

  const f = 440 * 2 ** ((midi - 69) / 12);
  const t = c.currentTime + 0.005;
  const sustain = 3.2 - Math.min(1, Math.max(0, (f - 200) / 600)) * 0.9;

  const out = c.createGain();
  out.gain.value = 0.14 * velocity;
  const lowpass = c.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(Math.min(f * 14, 12000), t);
  lowpass.frequency.exponentialRampToValueAtTime(Math.max(f * 2.5, 400), t + sustain * 0.6);
  lowpass.connect(out);
  out.connect(bus);

  for (const [harmonic, gain, decay] of PARTIALS) {
    const osc = c.createOscillator();
    osc.frequency.value = f * harmonic * Math.sqrt(1 + 0.0004 * harmonic * harmonic);
    osc.detune.value = (Math.random() - 0.5) * 5;
    const env = c.createGain();
    const peak = gain * velocity;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + 0.002);
    env.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.08 + 0.15 * decay);
    env.gain.exponentialRampToValueAtTime(0.0001, t + sustain * decay);
    osc.connect(env);
    env.connect(lowpass);
    osc.start(t);
    osc.stop(t + sustain * decay + 0.05);
  }
}
