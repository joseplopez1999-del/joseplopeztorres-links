/**
 * Física de una cuerda ideal, sin dependencias del navegador (se testea con Vitest).
 *
 * - Sonido: Karplus-Strong. Una línea de retardo del largo de la cuerda que se
 *   va filtrando a sí misma. La forma inicial importa: pulsar en un punto deja
 *   un triángulo, golpear con el martillo deja un bulto estrecho.
 * - Imagen: la serie de Fourier de ese mismo triángulo. Cada modo vibra a n·f
 *   y muere antes cuanto más agudo, así que la cuerda arranca en pico y acaba
 *   en una onda suave (el "movimiento de Helmholtz", a cámara lenta).
 */

export type Excitation = 'pluck' | 'hammer';

export type RenderOptions = {
  sampleRate: number;
  frequency: number;
  seconds: number;
  /** Punto de la cuerda donde se pulsa, 0–1. */
  position: number;
  /** 0 = dedo blando y oscuro, 1 = uña brillante. */
  brightness: number;
  /** Segundos hasta caer 60 dB. */
  t60: number;
  excitation: Excitation;
  random?: () => number;
};

export function renderString({
  sampleRate,
  frequency,
  seconds,
  position,
  brightness,
  t60,
  excitation,
  random = Math.random,
}: RenderOptions): Float32Array {
  const out = new Float32Array(Math.floor(sampleRate * seconds));

  // El filtro de promedio añade medio sample de retardo; el all-pass ajusta el decimal.
  const period = sampleRate / frequency - 0.5;
  const length = Math.max(2, Math.floor(period));
  const frac = period - length;
  const allpass = (1 - frac) / (1 + frac);

  const line = new Float32Array(length);
  const peak = Math.min(length - 1, Math.max(1, Math.round(position * length)));
  const noise = excitation === 'pluck' ? 0.1 + 0.25 * brightness : 0.35;
  const width = Math.max(2, length * 0.07);
  for (let i = 0; i < length; i++) {
    const shape =
      excitation === 'pluck'
        ? i <= peak
          ? i / peak
          : (length - i) / (length - peak)
        : Math.abs(i - peak) < width
          ? 0.5 + 0.5 * Math.cos((Math.PI * (i - peak)) / width)
          : 0;
    line[i] = shape + (random() * 2 - 1) * noise;
  }
  // Dedo blando = excitación más suave.
  const smooth = 0.65 - 0.55 * brightness;
  for (let i = 1; i < length; i++) line[i] = line[i] * (1 - smooth) + line[i - 1] * smooth;
  const mean = line.reduce((sum, v) => sum + v, 0) / length;
  let max = 0;
  for (let i = 0; i < length; i++) {
    line[i] -= mean;
    max = Math.max(max, Math.abs(line[i]));
  }
  if (max > 0) for (let i = 0; i < length; i++) line[i] /= max;

  const decay = Math.pow(0.001, 1 / (frequency * t60));
  const stretch = 0.5 - 0.3 * brightness; // menos promedio = más armónicos vivos
  let index = 0;
  let previous = 0;
  let apIn = 0;
  let apOut = 0;
  for (let n = 0; n < out.length; n++) {
    const current = line[index];
    out[n] = current;
    const filtered = decay * ((1 - stretch) * current + stretch * previous);
    previous = current;
    const shifted = allpass * filtered + apIn - allpass * apOut;
    apIn = filtered;
    apOut = shifted;
    line[index] = shifted;
    index = (index + 1) % length;
  }
  return out;
}

/** Tono fundamental por autocorrelación. Solo se usa en los tests. */
export function estimateFrequency(signal: Float32Array, sampleRate: number, min = 60, max = 1200): number {
  const from = Math.floor(sampleRate / max);
  const to = Math.ceil(sampleRate / min);
  const window = Math.min(signal.length - to, 4096);
  let best = from;
  let bestScore = -Infinity;
  const scores: number[] = [];
  for (let lag = from; lag <= to; lag++) {
    let score = 0;
    for (let i = 0; i < window; i++) score += signal[i] * signal[i + lag];
    scores[lag] = score;
    if (score > bestScore) {
      bestScore = score;
      best = lag;
    }
  }
  // Interpolación parabólica para afinar por debajo del sample.
  const a = scores[best - 1] ?? bestScore;
  const c = scores[best + 1] ?? bestScore;
  const shift = (a - c) / (2 * (a - 2 * bestScore + c) || 1);
  return sampleRate / (best + shift);
}

export const VISUAL_MODES = 16;

/** Coeficientes de Fourier de un triángulo de altura 1 con el pico en `position`. */
export function triangleModes(position: number, modes = VISUAL_MODES): Float32Array {
  const p = Math.min(0.97, Math.max(0.03, position));
  const coeffs = new Float32Array(modes);
  for (let n = 1; n <= modes; n++) {
    coeffs[n - 1] = (2 * Math.sin(n * Math.PI * p)) / (n * n * Math.PI * Math.PI * p * (1 - p));
  }
  return coeffs;
}

export function triangleShape(u: number, position: number): number {
  const p = Math.min(0.97, Math.max(0.03, position));
  return u <= p ? u / p : (1 - u) / (1 - p);
}

export function centsBetween(a: number, b: number): number {
  return 1200 * Math.log2(a / b);
}
