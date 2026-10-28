/**
 * Pinta las cuerdas en un canvas y las hace vibrar. No sabe nada de React:
 * el componente le dice dónde está cada cuerda y cuándo se pulsa.
 */

type StringState = { y: number; amp: number; phase: number };

const LEFT = 26;
const RIGHT_GAP = 14;
const COPPER_STRINGS = 3;

export class HarpEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly g: CanvasRenderingContext2D;
  private readonly strings: StringState[];
  private width = 0;
  private height = 0;
  private dpr = 1;
  private raf = 0;
  private last = 0;

  constructor(canvas: HTMLCanvasElement, count: number) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d')!;
    this.strings = Array.from({ length: count }, () => ({ y: 0, amp: 0, phase: 0 }));
  }

  stringY(i: number) {
    return this.strings[i].y;
  }

  layout(width: number, height: number, ys: number[]) {
    this.width = width;
    this.height = height;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    ys.forEach((y, i) => (this.strings[i].y = y));
    this.draw();
  }

  /** `velocity` 0–1: cuánto se abre la vibración. */
  pluck(i: number, velocity: number) {
    this.strings[i].amp = Math.min(12, 4 + velocity * 9);
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private tick = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    let alive = false;
    this.strings.forEach((s, i) => {
      if (s.amp < 0.05) {
        s.amp = 0;
        return;
      }
      alive = true;
      s.phase += dt * (38 + i * 6);
      s.amp *= Math.exp(-dt * 2.4);
    });
    this.draw();
    this.raf = alive ? requestAnimationFrame(this.tick) : 0;
  };

  private draw() {
    const { g, width, height, dpr } = this;
    if (!width) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, height);
    const right = width - RIGHT_GAP;
    const span = right - LEFT;

    this.strings.forEach((s, i) => {
      const copper = i < COPPER_STRINGS;
      const thick = copper ? 3.4 - i * 0.4 : 2 - (i - COPPER_STRINGS) * 0.15;

      // Clavija y puente
      g.fillStyle = '#1a120b';
      g.beginPath();
      g.arc(LEFT - 8, s.y, 5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255, 240, 220, 0.35)';
      g.beginPath();
      g.arc(LEFT - 9, s.y - 1.5, 1.6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#3a2a18';
      g.fillRect(right - 2, s.y - 6, 4, 12);

      g.beginPath();
      for (let x = 0; x <= span; x += 4) {
        const u = x / span;
        const d =
          s.amp *
          (Math.sin(Math.PI * u) * Math.cos(s.phase) +
            0.35 * Math.sin(2 * Math.PI * u) * Math.cos(s.phase * 2.1));
        if (x === 0) g.moveTo(LEFT + x, s.y + d);
        else g.lineTo(LEFT + x, s.y + d);
      }
      g.lineWidth = thick;
      g.strokeStyle = copper ? '#c9824a' : '#d8dde0';
      g.shadowColor =
        s.amp > 0.5 ? (copper ? 'rgba(232, 150, 80, 0.7)' : 'rgba(220, 235, 255, 0.6)') : 'transparent';
      g.shadowBlur = Math.min(14, s.amp * 2);
      g.stroke();
      g.shadowBlur = 0;
      if (copper) {
        // Entorchado: el hilo de cobre enrollado sobre el alma de acero.
        g.setLineDash([1.2, 2.2]);
        g.lineWidth = thick * 0.45;
        g.strokeStyle = 'rgba(60, 30, 10, 0.6)';
        g.stroke();
        g.setLineDash([]);
      }
    });
  }
}
