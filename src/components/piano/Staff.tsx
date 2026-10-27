import type { PianoNote } from '../../lib/notes';

export type StaffEntry = { id: number; note: PianoNote };

type StaffProps = Readonly<{ entries: StaffEntry[] }>;

/** Pentagrama de clave de sol: Mi4 en la línea inferior, Fa5 en la superior. */
const STEP_PX = 4;
const BASE_Y = 50; // Do4
const LINE_STEPS = [2, 4, 6, 8, 10];
const FIRST_X = 26;
const SLOT_PX = 24;

const yForStep = (step: number) => BASE_Y - step * STEP_PX;

export default function Staff({ entries }: StaffProps) {
  return (
    <svg
      className="piano-staff"
      viewBox="0 0 240 58"
      preserveAspectRatio="xMinYMid meet"
      role="img"
      aria-label={
        entries.length
          ? `Últimas notas: ${entries.map((e) => e.note.solfege).join(', ')}`
          : 'Pentagrama vacío'
      }
    >
      {LINE_STEPS.map((step) => (
        <line
          key={step}
          x1={0}
          x2={240}
          y1={yForStep(step)}
          y2={yForStep(step)}
          className="piano-staff-line"
        />
      ))}
      {entries.map(({ id, note }, i) => {
        const x = FIRST_X + i * SLOT_PX;
        const y = yForStep(note.step);
        const stemUp = note.step < 6;
        const isLast = i === entries.length - 1;
        return (
          <g key={id} className={isLast ? 'piano-staff-note is-last' : 'piano-staff-note'}>
            {note.step === 0 ? (
              <line x1={x - 8} x2={x + 8} y1={y} y2={y} className="piano-staff-line" />
            ) : null}
            {note.sharp ? (
              <text x={x - 15} y={y + 4} className="piano-staff-sharp">
                ♯
              </text>
            ) : null}
            <ellipse cx={x} cy={y} rx={4.8} ry={3.5} transform={`rotate(-20 ${x} ${y})`} />
            <line
              x1={stemUp ? x + 4.4 : x - 4.4}
              x2={stemUp ? x + 4.4 : x - 4.4}
              y1={y}
              y2={stemUp ? y - 20 : y + 20}
              className="piano-staff-stem"
            />
          </g>
        );
      })}
    </svg>
  );
}
