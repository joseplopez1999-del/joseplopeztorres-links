/**
 * Sintetizador de piano con Web Audio, sin samples: unos pocos armónicos
 * algo inarmónicos (como una cuerda real), un golpe de martillo con ruido
 * filtrado y una reverb generada al vuelo.
 */

type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null = null;
let input: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function createImpulse(c: AudioContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.floor(c.sampleRate * seconds);
  const impulse = c.createBuffer(2, length, c.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
    }
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
  compressor.threshold.value = -14;
  compressor.ratio.value = 4;
  compressor.connect(ctx.destination);

  input = ctx.createGain();
  input.gain.value = 0.8;
  input.connect(compressor);

  const reverb = ctx.createConvolver();
  reverb.buffer = createImpulse(ctx, 2.2, 3);
  const wet = ctx.createGain();
  wet.gain.value = 0.28;
  input.connect(reverb);
  reverb.connect(wet);
  wet.connect(compressor);

  noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
  const noise = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;

  return ctx;
}

/** Llamar dentro de un gesto del usuario: iOS no deja sonar nada hasta entonces. */
export function unlockAudio(): void {
  const c = getContext();
  if (c && c.state !== 'running') void c.resume();
}

const PARTIALS = [
  { harmonic: 1, gain: 1, decay: 1 },
  { harmonic: 2, gain: 0.45, decay: 0.75 },
  { harmonic: 3, gain: 0.22, decay: 0.55 },
  { harmonic: 4, gain: 0.12, decay: 0.4 },
  { harmonic: 5, gain: 0.06, decay: 0.3 },
  { harmonic: 6, gain: 0.03, decay: 0.25 },
] as const;

const INHARMONICITY = 0.0004;

export function playPianoNote(frequency: number, velocity = 0.85): void {
  const c = getContext();
  if (!c || !input) return;
  if (c.state !== 'running') void c.resume();

  const t = c.currentTime + 0.004;
  // Las notas graves se sostienen más, como en un piano de verdad.
  const sustain = 2.6 - Math.min(1, (frequency - 260) / 400) * 0.8;

  const voice = c.createGain();
  voice.gain.value = 0.2 * velocity;

  const tone = c.createBiquadFilter();
  tone.type = 'lowpass';
  tone.Q.value = 0.6;
  tone.frequency.setValueAtTime(Math.min(frequency * 14, 12000), t);
  tone.frequency.exponentialRampToValueAtTime(Math.max(frequency * 2.5, 500), t + sustain * 0.6);
  tone.connect(voice);
  voice.connect(input);

  for (const p of PARTIALS) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value =
      frequency * p.harmonic * Math.sqrt(1 + INHARMONICITY * p.harmonic * p.harmonic);
    // Dos cuerdas levemente desafinadas por nota → ese "chorus" natural.
    osc.detune.value = (Math.random() - 0.5) * 4;

    const env = c.createGain();
    const peak = p.gain * velocity;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + 0.005);
    env.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.08 + 0.15 * p.decay);
    env.gain.exponentialRampToValueAtTime(0.0001, t + sustain * p.decay);

    osc.connect(env);
    env.connect(tone);
    osc.start(t);
    osc.stop(t + sustain * p.decay + 0.05);
  }

  if (noiseBuffer) {
    const hammer = c.createBufferSource();
    hammer.buffer = noiseBuffer;
    const band = c.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = Math.min(frequency * 5, 6000);
    band.Q.value = 1.2;
    const hammerEnv = c.createGain();
    hammerEnv.gain.setValueAtTime(0.35 * velocity, t);
    hammerEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    hammer.connect(band);
    band.connect(hammerEnv);
    hammerEnv.connect(voice);
    hammer.start(t);
  }
}
