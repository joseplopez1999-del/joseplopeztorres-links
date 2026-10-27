import { describe, expect, it } from 'vitest';
import {
  BLACK_KEYS,
  WHITE_KEYS,
  blackKeyBoundary,
  describeMidi,
  endsWithFurElise,
  midiToFrequency,
} from './notes';

describe('notes', () => {
  it('cubre Do4 → Re5 con 9 blancas y 6 negras', () => {
    expect(WHITE_KEYS.map((n) => n.solfege)).toEqual([
      'Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si', 'Do', 'Re',
    ]);
    expect(BLACK_KEYS.map((n) => n.solfege)).toEqual([
      'Do♯', 'Re♯', 'Fa♯', 'Sol♯', 'La♯', 'Do♯',
    ]);
  });

  it('coloca cada negra entre sus dos blancas', () => {
    expect(BLACK_KEYS.map((n) => blackKeyBoundary(n.midi))).toEqual([1, 2, 4, 5, 6, 8]);
  });

  it('calcula la posición en el pentagrama', () => {
    expect(describeMidi(60).step).toBe(0);
    expect(describeMidi(72).step).toBe(7);
    expect(describeMidi(68)).toMatchObject({ step: 4, sharp: true });
  });

  it('afina La4 a 440 Hz', () => {
    expect(midiToFrequency(69)).toBe(440);
  });

  it('reconoce Para Elisa en cualquier tonalidad', () => {
    const inThisKeyboard = [69, 68, 69, 68, 69, 64, 67, 65, 62];
    expect(endsWithFurElise(inThisKeyboard)).toBe(true);
    expect(endsWithFurElise([60, 62, ...inThisKeyboard.map((m) => m + 2)])).toBe(true);
    expect(endsWithFurElise(inThisKeyboard.slice(0, -1))).toBe(false);
    expect(endsWithFurElise([69, 68, 69, 68, 69, 64, 67, 65, 60])).toBe(false);
  });
});
