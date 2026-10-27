import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUpRight, Volume2, VolumeX } from 'lucide-react';
import { PIANO_LINKS, type LinkAction } from '../../config/links';
import { playString, unlockAudio } from '../../lib/stringAudio';
import { HarpEngine, type StringSpec } from './harpEngine';

type StringsLinksProps = Readonly<{
  onAction: (action: LinkAction) => void;
  /** Con un formulario abierto, el teclado del ordenador no debe sonar. */
  paused?: boolean;
}>;

const mtof = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Pentatónica de Do, de grave (arriba) a agudo (abajo): cualquier rasgueo suena bien. */
const STRINGS: StringSpec[] = [48, 50, 52, 55, 57, 60, 62, 64, 67].map((midi, i) => ({
  midi,
  frequency: mtof(midi),
  material: i < 5 ? 'copper' : 'steel',
  unison: i < 2 ? 1 : i < 5 ? 2 : 3,
  gauge: [3.6, 3.2, 2.3, 2.1, 1.9, 1.5, 1.4, 1.3, 1.2][i],
  t60: 4.6 - i * 0.22,
}));

const NOTE_NAMES = ['Do', 'Re', 'Mi', 'Sol', 'La', 'Do', 'Re', 'Mi', 'Sol'];

/** Cuerdas a la octava: si suena una, la otra vibra sola (resonancia simpática). */
const OCTAVE_PARTNER = STRINGS.map((s) => STRINGS.findIndex((o) => Math.abs(o.midi - s.midi) === 12));

/** Altura de la cuerda dentro de su fila (0 arriba, 1 abajo). */
const STRING_AT = 0.74;
const TAP_SLOP_PX = 8;
const DAMPED_STORAGE_KEY = 'strings-links-damped';

type ActivePointer = {
  id: number;
  x: number;
  y: number;
  t: number;
  startX: number;
  startY: number;
  moved: boolean;
  grabbed: { index: number; dir: 1 | -1 } | null;
  plucked: Set<number>;
};

function readDamped(): boolean {
  try {
    return window.localStorage.getItem(DAMPED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export default function StringsLinks({ onAction, paused = false }: StringsLinksProps) {
  const [damped, setDamped] = useState(readDamped);
  const [glissando, setGlissando] = useState(false);

  const boardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rowRefs = useRef<HTMLElement[]>([]);
  const engineRef = useRef<HarpEngine | null>(null);
  const pointerRef = useRef<ActivePointer | null>(null);
  const suppressClick = useRef(false);
  const dampedRef = useRef(damped);
  const grabPx = useRef(16);

  useLayoutEffect(() => {
    const board = boardRef.current;
    const canvas = canvasRef.current;
    if (!board || !canvas) return;
    const engine = new HarpEngine(canvas, STRINGS);
    engineRef.current = engine;

    const layout = () => {
      const rows = rowRefs.current;
      const ys = rows.map((row) => row.offsetTop + row.offsetHeight * STRING_AT);
      grabPx.current = Math.min(18, (rows[0]?.offsetHeight ?? 48) * 0.34);
      engine.layout(board.clientWidth, board.clientHeight, ys, rows);
    };
    layout();
    const observer = new ResizeObserver(layout);
    observer.observe(board);
    return () => {
      observer.disconnect();
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    dampedRef.current = damped;
    engineRef.current?.setDamped(damped);
    try {
      window.localStorage.setItem(DAMPED_STORAGE_KEY, damped ? '1' : '0');
    } catch {
      /* modo privado */
    }
  }, [damped]);

  // Safari iOS solo desbloquea el audio en un touchend.
  useEffect(() => {
    const unlock = () => unlockAudio();
    document.addEventListener('touchend', unlock, { once: true });
    return () => document.removeEventListener('touchend', unlock);
  }, []);

  useEffect(() => {
    if (!glissando) return;
    const timer = window.setTimeout(() => setGlissando(false), 2600);
    return () => window.clearTimeout(timer);
  }, [glissando]);

  /** Suelta la cuerda: imagen, sonido y la resonancia de su octava. */
  const pluck = useCallback((index: number, position: number, d: number, velocity: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.release(index, position, d);
    navigator.vibrate?.(6);
    if (dampedRef.current) return;

    const spec = STRINGS[index];
    const pan = (index / (STRINGS.length - 1) - 0.5) * 0.7;
    playString({ frequency: spec.frequency, velocity, position, pan, t60: spec.t60 });

    const partner = OCTAVE_PARTNER[index];
    if (partner !== -1) {
      engine.resonate(partner, Math.abs(d) * 0.18);
      playString({
        frequency: STRINGS[partner].frequency,
        velocity: velocity * 0.16,
        position: 0.5,
        pan: -pan,
        t60: STRINGS[partner].t60,
        swell: 0.35,
      });
    }
  }, []);

  /** Martillo: lo que suena al tocar un nombre para abrirlo. */
  const strike = useCallback((index: number, position: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.release(index, position, 7);
    if (dampedRef.current) return;
    const spec = STRINGS[index];
    playString({
      frequency: spec.frequency,
      velocity: 0.6,
      position,
      pan: (index / (STRINGS.length - 1) - 0.5) * 0.7,
      t60: spec.t60,
      excitation: 'hammer',
    });
  }, []);

  /** Un mismo gesto que suelta las 9 cuerdas enciende la placa. */
  const markPlucked = (pointer: ActivePointer, index: number) => {
    pointer.plucked.add(index);
    if (pointer.plucked.size === STRINGS.length) {
      pointer.plucked.clear();
      setGlissando(true);
    }
  };

  const noteCrossings = (pointer: ActivePointer, x: number, y: number, now: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    const grab = grabPx.current;
    const position = engine.positionAt(x);
    const speed = Math.abs(y - pointer.y) / Math.max(1, now - pointer.t); // px/ms
    const lo = Math.min(pointer.y, y);
    const hi = Math.max(pointer.y, y);
    const dir: 1 | -1 = y >= pointer.y ? 1 : -1;

    const crossed = STRINGS.map((_, i) => i).filter((i) => {
      const sy = engine.stringY(i);
      return sy > lo && sy <= hi;
    });
    if (dir === -1) crossed.reverse();

    for (const i of crossed) {
      // Si había otra agarrada, se suelta de golpe al pasar a la siguiente.
      if (pointer.grabbed && pointer.grabbed.index !== i) {
        const g = pointer.grabbed;
        pluck(g.index, position, grab * g.dir, Math.min(1, 0.45 + speed / 2));
        markPlucked(pointer, g.index);
      }
      pointer.grabbed = { index: i, dir };
    }

    if (pointer.grabbed) {
      const { index, dir: grabDir } = pointer.grabbed;
      const d = y - engine.stringY(index);
      if (Math.sign(d) !== grabDir) {
        engine.ungrab(index); // volvió atrás sin soltarla
        pointer.grabbed = null;
      } else if (Math.abs(d) >= grab) {
        pluck(index, position, grab * grabDir, Math.min(1, 0.45 + speed / 2));
        markPlucked(pointer, index);
        pointer.grabbed = null;
      } else {
        engine.grab(index, position, d);
      }
    }
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Sin foco ni arrastre de enlaces con el ratón; el click sigue llegando.
    if (e.pointerType === 'mouse') e.preventDefault();
    unlockAudio();
    const rect = e.currentTarget.getBoundingClientRect();
    pointerRef.current = {
      id: e.pointerId,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      t: performance.now(),
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      grabbed: null,
      plucked: new Set(),
    };
    suppressClick.current = false;
    const target = e.target as Element;
    if (target.hasPointerCapture?.(e.pointerId)) target.releasePointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== e.pointerId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const now = performance.now();
    if (Math.hypot(e.clientX - pointer.startX, e.clientY - pointer.startY) > TAP_SLOP_PX) {
      pointer.moved = true;
    }
    noteCrossings(pointer, x, y, now);
    pointer.x = x;
    pointer.y = y;
    pointer.t = now;
  };

  const endPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== e.pointerId) return;
    pointerRef.current = null;
    const engine = engineRef.current;
    if (pointer.grabbed && engine) {
      const { index } = pointer.grabbed;
      const d = pointer.y - engine.stringY(index);
      if (Math.abs(d) > 2) {
        pluck(index, engine.positionAt(pointer.x), d, Math.min(1, 0.3 + Math.abs(d) / grabPx.current));
        markPlucked(pointer, index);
      } else {
        engine.ungrab(index);
      }
    }
    suppressClick.current = pointer.moved;
  };

  const onRowClick = (index: number, e: ReactMouseEvent) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      e.preventDefault();
      return;
    }
    const engine = engineRef.current;
    const rect = boardRef.current?.getBoundingClientRect();
    const position =
      engine && rect && e.detail !== 0 ? engine.positionAt(e.clientX - rect.left) : 0.3;
    unlockAudio();
    strike(index, position);
    const link = PIANO_LINKS[index];
    if (link.action) {
      e.preventDefault();
      onAction(link.action);
    }
  };

  // Teclado del ordenador: 1–9 pulsan cada cuerda, espacio rasguea todas.
  useEffect(() => {
    if (paused) return;
    const timers: number[] = [];
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (e.target instanceof HTMLElement && e.target !== document.body) {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.key === ' ') return;
      }
      const digit = Number(e.key);
      if (Number.isInteger(digit) && digit >= 1 && digit <= STRINGS.length) {
        unlockAudio();
        pluck(digit - 1, 0.28, 13, 0.75);
      } else if (e.key === ' ') {
        e.preventDefault();
        unlockAudio();
        STRINGS.forEach((_, i) => {
          timers.push(window.setTimeout(() => pluck(i, 0.3, 12, 0.7), i * 45));
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      timers.forEach(window.clearTimeout);
    };
  }, [paused, pluck]);

  return (
    <div className="harp-app">
      <header className="plate" data-glow={glissando}>
        <div className="plate-photo">
          <img src="/foto-josep.jpg" alt="Josep Lopez Torres" width={96} height={96} decoding="async" />
        </div>
        <div className="plate-text">
          <h1 className="plate-name">Josep Lopez Torres</h1>
          <p className="plate-role">AI Implementation Consultant · Pianista</p>
        </div>
        <button
          type="button"
          className="plate-stud"
          onClick={() => setDamped((d) => !d)}
          aria-pressed={damped}
          aria-label={damped ? 'Levantar apagadores y activar el sonido' : 'Bajar apagadores y silenciar'}
          title={damped ? 'Activar sonido' : 'Silenciar'}
        >
          {damped ? <VolumeX size={17} aria-hidden /> : <Volume2 size={17} aria-hidden />}
        </button>
      </header>

      <div
        ref={boardRef}
        className="harp-board"
        data-damped={damped}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onDragStart={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvasRef} className="harp-canvas" aria-hidden />
        <nav className="harp-rows" aria-label="Links">
          {PIANO_LINKS.map((link, i) => {
            const shared = {
              ref: (el: HTMLElement | null) => {
                if (el) rowRefs.current[i] = el;
              },
              className: 'harp-row',
              style: { '--i': i } as CSSProperties,
              draggable: false,
              onClick: (e: ReactMouseEvent) => onRowClick(i, e),
              'aria-label': `${link.label}: ${link.detail}`,
            };
            const content = (
              <>
                <span className="harp-line">
                  <span className="harp-note" aria-hidden>
                    {NOTE_NAMES[i]}
                  </span>
                  <span className="harp-name">{link.label}</span>
                  <span className="harp-detail">{link.detail}</span>
                  <ArrowUpRight className="harp-arrow" size={15} aria-hidden />
                </span>
                <span className="harp-damper" aria-hidden />
              </>
            );
            return link.href ? (
              <a key={link.id} {...shared} href={link.href} target="_blank" rel="noopener noreferrer">
                {content}
              </a>
            ) : (
              <button key={link.id} {...shared} type="button" aria-haspopup="dialog">
                {content}
              </button>
            );
          })}
        </nav>
      </div>

      <p className="harp-hint">
        <span>Desliza el dedo por las cuerdas</span>
        <span aria-hidden>·</span>
        <span>Toca un nombre para abrirlo</span>
        <span className="harp-hint-keys">
          · teclas <kbd>1</kbd>–<kbd>9</kbd> y <kbd>espacio</kbd>
        </span>
      </p>
    </div>
  );
}
