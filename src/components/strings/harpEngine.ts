import { VISUAL_MODES, triangleModes, triangleShape } from '../../lib/stringPhysics';

export type StringSpec = {
  midi: number;
  frequency: number;
  material: 'copper' | 'steel';
  /** Cuerdas por nota: graves sueltas, medias dobles, agudas triples, como en un piano de cola. */
  unison: 1 | 2 | 3;
  gauge: number;
  t60: number;
};

type Pulse = { amp: number; coeffs: Float32Array; born: number; sympathetic: boolean };

type StringState = {
  y: number;
  omega: number;
  pulses: Pulse[];
  grab: { position: number; d: number } | null;
};

const PIN_GAP = 30;
const BRIDGE_GAP = 22;
const STEP_PX = 4;
const UNISON_SPACING = 2.6;

/**
 * Pinta las cuerdas en un canvas y simula su vibración. No sabe nada de React:
 * el componente le dice dónde está cada cuerda y cuándo se pulsa.
 */
export class HarpEngine {
  private readonly g: CanvasRenderingContext2D;
  private readonly states: StringState[];
  private rows: HTMLElement[] = [];
  private width = 0;
  private height = 0;
  private dpr = 1;
  private sinTable: Float32Array[] = [];
  private points = 0;
  private raf = 0;
  private damped = false;
  private readonly motionScale: number;
  private readonly canvas: HTMLCanvasElement;
  private readonly specs: StringSpec[];

  constructor(canvas: HTMLCanvasElement, specs: StringSpec[]) {
    this.canvas = canvas;
    this.specs = specs;
    this.g = canvas.getContext('2d')!;
    const base = specs[0].frequency;
    this.states = specs.map((s) => ({
      y: 0,
      // Cámara lenta: ~2 vibraciones por segundo, más rápidas en las agudas.
      omega: 2 * Math.PI * 1.7 * Math.sqrt(s.frequency / base),
      pulses: [],
      grab: null,
    }));
    this.motionScale = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0.3 : 1;
  }

  get left() {
    return PIN_GAP;
  }

  get right() {
    return this.width - BRIDGE_GAP;
  }

  stringY(i: number) {
    return this.states[i].y;
  }

  positionAt(x: number) {
    return Math.min(0.95, Math.max(0.05, (x - this.left) / (this.right - this.left)));
  }

  layout(width: number, height: number, ys: number[], rows: HTMLElement[]) {
    this.width = width;
    this.height = height;
    this.rows = rows;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    ys.forEach((y, i) => (this.states[i].y = y));

    const span = Math.max(1, this.right - this.left);
    this.points = Math.ceil(span / STEP_PX) + 1;
    this.sinTable = Array.from({ length: VISUAL_MODES }, (_, m) => {
      const row = new Float32Array(this.points);
      for (let k = 0; k < this.points; k++) {
        row[k] = Math.sin((m + 1) * Math.PI * Math.min(1, (k * STEP_PX) / span));
      }
      return row;
    });
    this.draw();
  }

  setDamped(damped: boolean) {
    this.damped = damped;
    this.wake();
  }

  grab(i: number, position: number, d: number) {
    this.states[i].grab = { position, d };
    this.wake();
  }

  ungrab(i: number) {
    this.states[i].grab = null;
    this.wake();
  }

  /** Suelta la cuerda desde un triángulo de altura `d` (px, con signo). */
  release(i: number, position: number, d: number) {
    const s = this.states[i];
    s.grab = null;
    this.addPulse(s, { amp: d, coeffs: triangleModes(position), born: performance.now(), sympathetic: false });
  }

  /** Vibración que crece sola porque otra cuerda a la octava está sonando. */
  resonate(i: number, amp: number) {
    const coeffs = new Float32Array(VISUAL_MODES);
    coeffs[0] = 1;
    this.addPulse(this.states[i], { amp, coeffs, born: performance.now(), sympathetic: true });
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private addPulse(s: StringState, pulse: Pulse) {
    s.pulses.push(pulse);
    if (s.pulses.length > 4) s.pulses.shift();
    this.wake();
  }

  private wake() {
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  private tick = () => {
    this.raf = 0;
    const alive = this.draw();
    if (alive) this.raf = requestAnimationFrame(this.tick);
  };

  /** Dibuja un fotograma; devuelve si queda algo vibrando. */
  private draw(): boolean {
    const { g, width, height, dpr } = this;
    if (!width) return false;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, height);

    const now = performance.now();
    const base = this.damped ? 9 : 0.8;
    const perMode = this.damped ? 0.25 : 0.035;
    const span = this.right - this.left;
    const offsets = new Float32Array(this.points);
    let alive = false;

    this.drawBridge();

    this.states.forEach((s, i) => {
      offsets.fill(0);
      let energy = 0;

      s.pulses = s.pulses.filter((p) => {
        const age = (now - p.born) / 1000;
        const envelope = p.sympathetic ? (1 - Math.exp(-age * 2.5)) * Math.exp(-base * age) : Math.exp(-base * age);
        if (Math.abs(p.amp) * envelope < 0.15 && (!p.sympathetic || age > 1)) return false;
        for (let m = 0; m < VISUAL_MODES; m++) {
          const c = p.coeffs[m];
          if (c === 0) continue;
          const n = m + 1;
          const modeEnv = p.sympathetic ? envelope : Math.exp(-(base + perMode * n * n) * age);
          const a = p.amp * c * modeEnv * Math.cos(n * s.omega * age) * this.motionScale;
          if (Math.abs(a) < 0.02) continue;
          const table = this.sinTable[m];
          for (let k = 0; k < this.points; k++) offsets[k] += a * table[k];
        }
        energy = Math.max(energy, Math.abs(p.amp) * envelope);
        return true;
      });

      if (s.grab) {
        for (let k = 0; k < this.points; k++) {
          offsets[k] = s.grab.d * triangleShape(Math.min(1, (k * STEP_PX) / span), s.grab.position);
        }
        energy = Math.max(energy, Math.abs(s.grab.d) * 0.6);
      }

      if (s.pulses.length || s.grab) alive = true;
      this.drawString(i, s, offsets, energy);
      this.rows[i]?.style.setProperty('--ring', Math.min(1, energy / 10).toFixed(3));
    });

    return alive;
  }

  private drawBridge() {
    const { g } = this;
    const first = this.states[0].y;
    const last = this.states[this.states.length - 1].y;
    // Puente de arce a la derecha y bloque de clavijas a la izquierda.
    g.fillStyle = '#2b1b10';
    g.fillRect(this.right - 3, first - 16, 8, last - first + 32);
    g.fillStyle = 'rgba(255, 220, 170, 0.08)';
    g.fillRect(this.right - 3, first - 16, 2, last - first + 32);
  }

  private drawString(i: number, s: StringState, offsets: Float32Array, energy: number) {
    const { g } = this;
    const spec = this.specs[i];
    const copper = spec.material === 'copper';
    const lines = spec.unison;

    for (let u = 0; u < lines; u++) {
      const dy = (u - (lines - 1) / 2) * UNISON_SPACING;
      const wobble = 1 + (u - (lines - 1) / 2) * 0.04;

      // Tramo fijo entre la clavija y el primer apoyo.
      const pinX = this.left - 12 - u * 7;
      g.beginPath();
      g.moveTo(pinX, s.y + dy);
      g.lineTo(this.left, s.y + dy);
      g.lineWidth = spec.gauge;
      g.strokeStyle = copper ? '#8a5530' : '#9aa0a4';
      g.stroke();

      g.beginPath();
      for (let k = 0; k < this.points; k++) {
        const x = Math.min(this.right, this.left + k * STEP_PX);
        const y = s.y + dy + offsets[k] * wobble;
        if (k === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.lineCap = 'round';
      g.lineWidth = spec.gauge;
      g.strokeStyle = copper ? '#c9824a' : '#d6dce0';
      if (energy > 0.6) {
        g.shadowColor = copper ? 'rgba(240, 160, 90, 0.75)' : 'rgba(225, 238, 255, 0.7)';
        g.shadowBlur = Math.min(16, energy * 1.6);
      }
      g.stroke();
      g.shadowBlur = 0;
      if (copper) {
        // Entorchado: el hilo de cobre enrollado sobre el alma de acero.
        g.setLineDash([1.1, 2]);
        g.lineWidth = spec.gauge * 0.45;
        g.strokeStyle = 'rgba(70, 35, 12, 0.55)';
        g.stroke();
        g.setLineDash([]);
      }

      // Clavija de afinación y pin del puente.
      this.drawPin(pinX, s.y + dy, lines > 1 ? 3.2 : 4.2);
      g.fillStyle = '#9c8a74';
      g.beginPath();
      g.arc(this.right + 1, s.y + dy, 1.4, 0, Math.PI * 2);
      g.fill();
    }
  }

  private drawPin(x: number, y: number, radius: number) {
    const { g } = this;
    const pin = g.createRadialGradient(x - 1.2, y - 1.2, 0.4, x, y, radius + 1);
    pin.addColorStop(0, '#f2efe8');
    pin.addColorStop(0.45, '#8f8e8a');
    pin.addColorStop(1, '#2a2622');
    g.fillStyle = pin;
    g.beginPath();
    g.arc(x, y, radius, 0, Math.PI * 2);
    g.fill();
  }
}
