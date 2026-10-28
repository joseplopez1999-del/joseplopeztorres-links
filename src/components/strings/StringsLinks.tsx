import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { PIANO_LINKS, type LinkAction } from '../../config/links';
import { playString, unlockAudio } from '../../lib/stringAudio';
import { HarpEngine } from './harpEngine';

type StringsLinksProps = Readonly<{
  onAction: (action: LinkAction) => void;
  /** Con un formulario abierto, el teclado del ordenador no debe sonar. */
  paused?: boolean;
}>;

/** Pentatónica de Do, de grave (arriba) a agudo (abajo): cualquier rasgueo suena bien. */
const PITCHES = [48, 50, 52, 55, 57, 60, 62, 64, 67];

/** Altura de la cuerda dentro de su fila (0 arriba, 1 abajo). */
const STRING_AT = 0.72;
const TAP_SLOP_PX = 8;
const MUTED_STORAGE_KEY = 'strings-links-muted';

type ActivePointer = { id: number; y: number; t: number; startX: number; startY: number; moved: boolean };

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export default function StringsLinks({ onAction, paused = false }: StringsLinksProps) {
  const [muted, setMuted] = useState(readMuted);

  const boardRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rowRefs = useRef<HTMLElement[]>([]);
  const engineRef = useRef<HarpEngine | null>(null);
  const pointerRef = useRef<ActivePointer | null>(null);
  const suppressClick = useRef(false);
  const mutedRef = useRef(muted);

  useLayoutEffect(() => {
    const board = boardRef.current;
    const canvas = canvasRef.current;
    if (!board || !canvas) return;
    const engine = new HarpEngine(canvas, PITCHES.length);
    engineRef.current = engine;
    const layout = () => {
      const ys = rowRefs.current.map((row) => row.offsetTop + row.offsetHeight * STRING_AT);
      engine.layout(board.clientWidth, board.clientHeight, ys);
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
    mutedRef.current = muted;
    try {
      window.localStorage.setItem(MUTED_STORAGE_KEY, muted ? '1' : '0');
    } catch {
      /* modo privado */
    }
  }, [muted]);

  // Safari iOS solo desbloquea el audio en un touchend.
  useEffect(() => {
    const unlock = () => unlockAudio();
    document.addEventListener('touchend', unlock, { once: true });
    return () => document.removeEventListener('touchend', unlock);
  }, []);

  const pluck = useCallback((index: number, velocity: number) => {
    engineRef.current?.pluck(index, velocity);
    navigator.vibrate?.(6);
    if (!mutedRef.current) playString(PITCHES[index], 0.45 + velocity * 0.5);
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Sin foco ni arrastre de enlaces con el ratón; el click sigue llegando.
    if (e.pointerType === 'mouse') e.preventDefault();
    unlockAudio();
    const rect = e.currentTarget.getBoundingClientRect();
    pointerRef.current = {
      id: e.pointerId,
      y: e.clientY - rect.top,
      t: performance.now(),
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    suppressClick.current = false;
    const target = e.target as Element;
    if (target.hasPointerCapture?.(e.pointerId)) target.releasePointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    const engine = engineRef.current;
    if (!pointer || pointer.id !== e.pointerId || !engine) return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const now = performance.now();
    if (Math.hypot(e.clientX - pointer.startX, e.clientY - pointer.startY) > TAP_SLOP_PX) {
      pointer.moved = true;
    }
    const lo = Math.min(pointer.y, y);
    const hi = Math.max(pointer.y, y);
    const speed = Math.abs(y - pointer.y) / Math.max(1, now - pointer.t);
    PITCHES.forEach((_, i) => {
      const sy = engine.stringY(i);
      if (sy > lo && sy <= hi) pluck(i, Math.min(1, speed / 1.5));
    });
    pointer.y = y;
    pointer.t = now;
  };

  const endPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== e.pointerId) return;
    pointerRef.current = null;
    suppressClick.current = pointer.moved;
  };

  const onRowClick = (index: number, e: ReactMouseEvent) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      e.preventDefault();
      return;
    }
    unlockAudio();
    pluck(index, 0.6);
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
      if (e.target instanceof HTMLElement && e.target !== document.body) return;
      const digit = Number(e.key);
      if (Number.isInteger(digit) && digit >= 1 && digit <= PITCHES.length) {
        unlockAudio();
        pluck(digit - 1, 0.7);
      } else if (e.key === ' ') {
        e.preventDefault();
        unlockAudio();
        PITCHES.forEach((_, i) => timers.push(window.setTimeout(() => pluck(i, 0.7), i * 45)));
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
      <header className="harp-head">
        <div className="harp-head-text">
          <small>Josep Lopez Torres</small>
          <h1>Dentro del piano</h1>
          <p>Arrastra el dedo por las cuerdas. Toca un nombre para abrirlo.</p>
        </div>
        <button
          type="button"
          className="harp-mute"
          onClick={() => setMuted((m) => !m)}
          aria-pressed={muted}
          aria-label={muted ? 'Activar sonido' : 'Silenciar'}
        >
          {muted ? <VolumeX size={17} aria-hidden /> : <Volume2 size={17} aria-hidden />}
        </button>
      </header>

      <div
        ref={boardRef}
        className="harp-board"
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
              draggable: false,
              onClick: (e: ReactMouseEvent) => onRowClick(i, e),
              'aria-label': `${link.label}: ${link.detail}`,
            };
            const content = (
              <>
                <span className="harp-name">{link.label}</span>
                <span className="harp-detail">{link.detail}</span>
                <span className="harp-arrow" aria-hidden>
                  ↗
                </span>
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
    </div>
  );
}
