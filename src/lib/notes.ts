/**
 * Teoría mínima para el teclado: una octava y un poco (Do4 → Re5).
 * Las teclas blancas son links; las negras solo suenan.
 */

export type KeyColor = 'white' | 'black';

export type PianoNote = {
  midi: number;
  color: KeyColor;
  /** Solfeo, como se dice en clase: Do, Re, Mi… */
  solfege: string;
  /** Posición diatónica desde Do4 (0) — sirve para pintar el pentagrama. */
  step: number;
  sharp: boolean;
};

const SOLFEGE = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'] as const;
/** Semitonos de cada nota natural dentro de la octava. */
const NATURAL_SEMITONES = [0, 2, 4, 5, 7, 9, 11] as const;

export const LOWEST_MIDI = 60; // Do4
export const HIGHEST_MIDI = 74; // Re5

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function describeMidi(midi: number): PianoNote {
  const octaveOffset = Math.floor((midi - LOWEST_MIDI) / 12);
  const semitone = (((midi - LOWEST_MIDI) % 12) + 12) % 12;
  const naturalIndex = NATURAL_SEMITONES.findIndex((s) => s === semitone);
  if (naturalIndex !== -1) {
    return {
      midi,
      color: 'white',
      solfege: SOLFEGE[naturalIndex],
      step: octaveOffset * 7 + naturalIndex,
      sharp: false,
    };
  }
  // Sostenido de la natural inmediatamente inferior.
  const below = NATURAL_SEMITONES.findIndex((s) => s === semitone - 1);
  return {
    midi,
    color: 'black',
    solfege: `${SOLFEGE[below]}♯`,
    step: octaveOffset * 7 + below,
    sharp: true,
  };
}

export const KEYBOARD: PianoNote[] = Array.from(
  { length: HIGHEST_MIDI - LOWEST_MIDI + 1 },
  (_, i) => describeMidi(LOWEST_MIDI + i),
);

export const WHITE_KEYS = KEYBOARD.filter((n) => n.color === 'white');
export const BLACK_KEYS = KEYBOARD.filter((n) => n.color === 'black');

/**
 * Índice de la frontera entre teclas blancas donde cae cada negra
 * (1 = entre la 1ª y la 2ª blanca…). Se usa para posicionarlas en CSS.
 */
export function blackKeyBoundary(midi: number): number {
  return WHITE_KEYS.filter((w) => w.midi < midi).length;
}

/**
 * Para Elisa (Beethoven), solo intervalos: así funciona en cualquier tonalidad.
 * Mi Re♯ Mi Re♯ Mi Si Re Do La → en este teclado entra como La Sol♯ La Sol♯ La Mi Sol Fa Re.
 */
const FUR_ELISE_INTERVALS = [-1, 1, -1, 1, -5, 3, -2, -3] as const;
export const FUR_ELISE_LENGTH = FUR_ELISE_INTERVALS.length + 1;

export function endsWithFurElise(history: readonly number[]): boolean {
  if (history.length < FUR_ELISE_LENGTH) return false;
  const tail = history.slice(-FUR_ELISE_LENGTH);
  return FUR_ELISE_INTERVALS.every((interval, i) => tail[i + 1] - tail[i] === interval);
}
