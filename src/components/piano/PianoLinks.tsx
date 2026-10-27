import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Volume2, VolumeX } from 'lucide-react';
import { PIANO_LINKS, type LinkAction, type PianoLink } from '../../config/links';
import { DOCK_SOCIAL_HREF } from '../../config/socialLinks';
import {
  BLACK_KEYS,
  WHITE_KEYS,
  blackKeyBoundary,
  describeMidi,
  endsWithFurElise,
  midiToFrequency,
  type PianoNote,
} from '../../lib/notes';
import { playPianoNote, unlockAudio } from '../../lib/pianoAudio';
import Staff, { type StaffEntry } from './Staff';

type PianoLinksProps = Readonly<{
  onAction: (action: LinkAction) => void;
  /** Con un formulario abierto, el teclado del ordenador no debe tocar notas. */
  paused?: boolean;
}>;

type ActivePointer = {
  midi: number | null;
  moved: boolean;
  /** Tecla blanca que ya estaba seleccionada al apoyar el dedo: el segundo toque la abre. */
  armedIndex: number | null;
};

type Floater = { id: number; x: number; y: number; glyph: string };

/** Mapa estilo DAW: fila central = blancas, fila superior = negras. */
const COMPUTER_KEYS: Record<string, number> = {
  a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67,
  y: 68, h: 69, u: 70, j: 71, k: 72, o: 73, l: 74,
};

const MUTED_STORAGE_KEY = 'piano-links-muted';
const STAFF_SIZE = 9;
const HISTORY_SIZE = 16;
const FLOATER_MS = 1100;
const FLOATER_GLYPHS = ['♪', '♫', '♩', '♬'];

const whiteIndexOf = (midi: number) => WHITE_KEYS.findIndex((n) => n.midi === midi);

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function keyAt(clientX: number, clientY: number): HTMLElement | null {
  return document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-midi]') ?? null;
}

function openLink(link: PianoLink, onAction: (action: LinkAction) => void) {
  if (link.action) onAction(link.action);
  else window.open(link.href, '_blank', 'noopener,noreferrer');
}

export default function PianoLinks({ onAction, paused = false }: PianoLinksProps) {
  const [muted, setMuted] = useState(readMuted);
  const [selected, setSelected] = useState<number | null>(null);
  const [pressed, setPressed] = useState<ReadonlySet<number>>(() => new Set());
  const [lastNote, setLastNote] = useState<PianoNote | null>(null);
  const [staff, setStaff] = useState<StaffEntry[]>([]);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [furElise, setFurElise] = useState(false);

  const boardRef = useRef<HTMLDivElement>(null);
  const keyEls = useRef(new Map<number, HTMLElement>());
  const pointers = useRef(new Map<number, ActivePointer>());
  const openArmed = useRef<number | null>(null);
  const selectedRef = useRef<number | null>(null);
  const mutedRef = useRef(muted);
  const history = useRef<number[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    mutedRef.current = muted;
    try {
      window.localStorage.setItem(MUTED_STORAGE_KEY, muted ? '1' : '0');
    } catch {
      /* modo privado: no pasa nada */
    }
  }, [muted]);

  // Safari iOS solo desbloquea el audio en un touchend.
  useEffect(() => {
    const unlock = () => unlockAudio();
    document.addEventListener('touchend', unlock, { once: true });
    return () => document.removeEventListener('touchend', unlock);
  }, []);

  const select = useCallback((index: number) => {
    selectedRef.current = index;
    setSelected(index);
  }, []);

  const setKeyPressed = useCallback((midi: number, isDown: boolean) => {
    setPressed((prev) => {
      if (prev.has(midi) === isDown) return prev;
      const next = new Set(prev);
      if (isDown) next.add(midi);
      else next.delete(midi);
      return next;
    });
  }, []);

  const strike = useCallback(
    (midi: number, at?: { clientX: number; clientY: number }) => {
      if (!mutedRef.current) playPianoNote(midiToFrequency(midi));
      navigator.vibrate?.(8);
      setKeyPressed(midi, true);

      const note = describeMidi(midi);
      setLastNote(note);
      const id = nextId.current++;
      setStaff((prev) => [...prev, { id, note }].slice(-STAFF_SIZE));

      history.current = [...history.current, midi].slice(-HISTORY_SIZE);
      const playedFurElise = endsWithFurElise(history.current);
      if (playedFurElise) history.current = [];
      setFurElise(playedFurElise);

      const board = boardRef.current;
      const keyEl = keyEls.current.get(midi);
      if (board && keyEl) {
        const boardRect = board.getBoundingClientRect();
        const keyRect = keyEl.getBoundingClientRect();
        const x = (at?.clientX ?? keyRect.left + keyRect.width / 2) - boardRect.left;
        const y = (at?.clientY ?? keyRect.top + keyRect.height / 2) - boardRect.top;
        const glyph = FLOATER_GLYPHS[id % FLOATER_GLYPHS.length];
        setFloaters((prev) => [...prev, { id, x, y, glyph }].slice(-12));
        window.setTimeout(() => {
          setFloaters((prev) => prev.filter((f) => f.id !== id));
        }, FLOATER_MS);
      }
    },
    [setKeyPressed],
  );

  // ── Dedo / ratón: tocar, deslizar (glissando) y doble toque para abrir ──

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Sin foco, selección de texto ni arrastre del link; el click sigue llegando.
    e.preventDefault();
    unlockAudio();
    openArmed.current = null;
    const key = keyAt(e.clientX, e.clientY);
    if (!key) return;
    // Sin captura implícita: así el dedo puede pasar de tecla en tecla.
    if (key.hasPointerCapture(e.pointerId)) key.releasePointerCapture(e.pointerId);

    const midi = Number(key.dataset.midi);
    const whiteIndex = whiteIndexOf(midi);
    pointers.current.set(e.pointerId, {
      midi,
      moved: false,
      armedIndex: whiteIndex !== -1 && whiteIndex === selectedRef.current ? whiteIndex : null,
    });
    strike(midi, e);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = pointers.current.get(e.pointerId);
    if (!pointer) return;
    const key = keyAt(e.clientX, e.clientY);
    const midi = key ? Number(key.dataset.midi) : null;
    if (midi === pointer.midi) return;
    if (pointer.midi !== null) setKeyPressed(pointer.midi, false);
    if (midi !== null) strike(midi, e);
    pointer.midi = midi;
    pointer.moved = true;
  };

  const endPointer = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const pointer = pointers.current.get(e.pointerId);
    if (!pointer) return;
    pointers.current.delete(e.pointerId);
    if (pointer.midi === null) return;
    setKeyPressed(pointer.midi, false);
    if (cancelled) return;

    const whiteIndex = whiteIndexOf(pointer.midi);
    if (whiteIndex === -1) return; // las negras solo suenan
    if (!pointer.moved && pointer.armedIndex === whiteIndex) {
      openArmed.current = whiteIndex; // el click que viene justo después abre el link
    } else {
      select(whiteIndex);
    }
  };

  const onKeyClick = (index: number, e: ReactMouseEvent) => {
    const link = PIANO_LINKS[index];
    // detail === 0 → Enter/Espacio o lector de pantalla: abrimos a la primera.
    if (e.detail === 0) {
      strike(WHITE_KEYS[index].midi);
      window.setTimeout(() => setKeyPressed(WHITE_KEYS[index].midi, false), 160);
      select(index);
    } else if (openArmed.current !== index) {
      e.preventDefault();
      return;
    }
    openArmed.current = null;
    if (link.action) {
      e.preventDefault();
      onAction(link.action);
    }
  };

  // ── Teclado del ordenador ──

  useEffect(() => {
    if (paused) return;
    const isTyping = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (e.key === 'Enter' && e.target === document.body && selectedRef.current !== null) {
        openLink(PIANO_LINKS[selectedRef.current], onAction);
        return;
      }
      const midi = COMPUTER_KEYS[e.key.toLowerCase()];
      if (midi === undefined || e.repeat) return;
      unlockAudio();
      strike(midi);
      const whiteIndex = whiteIndexOf(midi);
      if (whiteIndex !== -1) select(whiteIndex);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const midi = COMPUTER_KEYS[e.key.toLowerCase()];
      if (midi !== undefined) setKeyPressed(midi, false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [paused, onAction, strike, select, setKeyPressed]);

  const registerKey = (midi: number) => (el: HTMLElement | null) => {
    if (el) keyEls.current.set(midi, el);
    else keyEls.current.delete(midi);
  };

  // Pantalla: el easter egg manda; una negra recién tocada explica que solo suena; si no, el link elegido.
  const showBlackNote = !furElise && lastNote?.color === 'black';
  const displayNote = showBlackNote || selected === null ? lastNote : WHITE_KEYS[selected];
  let displayLink: PianoLink | null = selected === null ? null : PIANO_LINKS[selected];
  if (furElise) {
    displayLink = { id: 'fur-elise', label: 'Para Elisa', detail: 'Vale, tú también tocas. Mira lo que hago yo.', href: DOCK_SOCIAL_HREF.tiktok };
  } else if (showBlackNote) {
    displayLink = null;
  }
  const idleLabel = showBlackNote ? 'Solo música' : 'Toca una tecla';
  const idleDetail = showBlackNote
    ? 'Las negras no llevan a ningún sitio. Prueba a deslizar el dedo.'
    : 'Las blancas te llevan a algún sitio. Las negras solo suenan.';

  return (
    <div className="piano-app">
      <header className="piano-header">
        <img
          src="/foto-josep.jpg"
          alt="Josep Lopez Torres"
          width={96}
          height={96}
          className="piano-avatar"
          decoding="async"
        />
        <div className="min-w-0 flex-1">
          <h1 className="piano-name">Josep Lopez Torres</h1>
          <p className="piano-role">AI Implementation Consultant · pianista</p>
        </div>
        <button
          type="button"
          className="piano-icon-button"
          onClick={() => setMuted((m) => !m)}
          aria-pressed={muted}
          aria-label={muted ? 'Activar sonido' : 'Silenciar'}
        >
          {muted ? <VolumeX size={18} aria-hidden /> : <Volume2 size={18} aria-hidden />}
        </button>
      </header>

      <section className="piano-display" aria-live="polite">
        <Staff entries={staff} />
        <div className="piano-display-row">
          <span className="piano-display-note" aria-hidden>
            {displayNote?.solfege ?? '♪'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="piano-display-label">{displayLink?.label ?? idleLabel}</p>
            <p className="piano-display-detail">
              {displayLink?.detail ?? idleDetail}
            </p>
          </div>
          {displayLink ? (
            displayLink.href ? (
              <a
                href={displayLink.href}
                target="_blank"
                rel="noopener noreferrer"
                className="piano-open"
              >
                Abrir <ArrowUpRight size={15} aria-hidden />
              </a>
            ) : (
              <button
                type="button"
                className="piano-open"
                onClick={() => displayLink.action && onAction(displayLink.action)}
              >
                Abrir <ArrowUpRight size={15} aria-hidden />
              </button>
            )
          ) : null}
        </div>
      </section>

      <div
        ref={boardRef}
        className="piano-board"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endPointer(e, false)}
        onPointerCancel={(e) => endPointer(e, true)}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      >
        <nav aria-label="Links" className="piano-whites">
          {WHITE_KEYS.map((note, i) => {
            const link = PIANO_LINKS[i];
            const isSelected = selected === i;
            const shared = {
              ref: registerKey(note.midi),
              'data-midi': note.midi,
              'data-pressed': pressed.has(note.midi),
              'data-selected': isSelected,
              className: 'piano-white',
              draggable: false,
              onClick: (e: ReactMouseEvent) => onKeyClick(i, e),
              'aria-label': `${link.label}: ${link.detail}`,
            };
            const content = (
              <span className="piano-white-label">
                <span className="piano-white-solfege" aria-hidden>
                  {note.solfege}
                </span>
                <span className="min-w-0">
                  <span className="piano-white-title">{link.label}</span>
                  <span className="piano-white-detail">
                    {isSelected ? 'Tócala otra vez ↗' : link.detail}
                  </span>
                </span>
              </span>
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

        {BLACK_KEYS.map((note) => (
          <div
            key={note.midi}
            ref={registerKey(note.midi)}
            data-midi={note.midi}
            data-pressed={pressed.has(note.midi)}
            className="piano-black"
            style={{ '--boundary': blackKeyBoundary(note.midi) } as CSSProperties}
            aria-hidden
          />
        ))}

        <div className="piano-felt" aria-hidden />

        {floaters.map((f) => (
          <span
            key={f.id}
            className="piano-floater"
            style={{ left: f.x, top: f.y }}
            aria-hidden
          >
            {f.glyph}
          </span>
        ))}
      </div>

      <p className="piano-kbd-hint">
        También con el teclado: <kbd>A S D F G H J K L</kbd> · negras en <kbd>W E T Y U O</kbd> ·{' '}
        <kbd>Enter</kbd> abre
      </p>
    </div>
  );
}
