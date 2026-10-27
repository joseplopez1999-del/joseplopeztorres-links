import { describe, expect, it } from 'vitest';
import {
  centsBetween,
  estimateFrequency,
  renderString,
  triangleModes,
  triangleShape,
} from './stringPhysics';

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const SAMPLE_RATE = 48000;

describe('renderString (Karplus-Strong)', () => {
  it.each([
    ['Do3', 130.81],
    ['La3', 220],
    ['Sol4', 392],
  ])('afina %s a menos de 5 cents', (_name, frequency) => {
    const signal = renderString({
      sampleRate: SAMPLE_RATE,
      frequency,
      seconds: 0.6,
      position: 0.27,
      brightness: 0.5,
      t60: 3,
      excitation: 'pluck',
      random: seeded(7),
    });
    const estimated = estimateFrequency(signal.subarray(4000), SAMPLE_RATE);
    expect(Math.abs(centsBetween(estimated, frequency))).toBeLessThan(5);
  });

  it('se apaga según el t60', () => {
    const signal = renderString({
      sampleRate: SAMPLE_RATE,
      frequency: 220,
      seconds: 1,
      position: 0.3,
      brightness: 0.4,
      t60: 0.25,
      excitation: 'pluck',
      random: seeded(3),
    });
    const peak = (from: number, to: number) =>
      signal.subarray(from, to).reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    expect(peak(0, 2000)).toBeGreaterThan(0.5);
    expect(peak(SAMPLE_RATE * 0.5, SAMPLE_RATE * 0.6)).toBeLessThan(0.01);
  });

  it('nunca satura', () => {
    const signal = renderString({
      sampleRate: SAMPLE_RATE,
      frequency: 98,
      seconds: 0.5,
      position: 0.5,
      brightness: 1,
      t60: 5,
      excitation: 'hammer',
      random: seeded(11),
    });
    expect(signal.every((v) => Math.abs(v) <= 1.0001)).toBe(true);
  });
});

describe('modos de vibración', () => {
  it('la serie de Fourier reconstruye el triángulo de la pulsación', () => {
    const position = 0.3;
    const coeffs = triangleModes(position);
    for (const u of [0.1, 0.3, 0.5, 0.8]) {
      let y = 0;
      coeffs.forEach((c, i) => {
        y += c * Math.sin((i + 1) * Math.PI * u);
      });
      expect(Math.abs(y - triangleShape(u, position))).toBeLessThan(0.06);
    }
  });
});
