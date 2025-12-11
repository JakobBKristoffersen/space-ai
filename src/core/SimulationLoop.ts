/**
 * Core deterministic simulation loop.
 * - Advances the simulation in fixed-size ticks for determinism.
 * - Exposes a decoupled render callback at a lower frequency.
 * - Does NOT contain any physics or rendering logic itself.
 *
 * Separation of concerns:
 * - Simulation systems subscribe to onTick and update their state.
 * - Rendering systems subscribe to onRender and read state to draw.
 */
export type TickListener = (dtSeconds: number, tickIndex: number) => void;
export type RenderListener = (alpha: number, nowMs: number) => void;

export interface SimulationLoopOptions {
  /** Fixed simulation step size in seconds (e.g., 1/120 for 120 Hz). */
  fixedDt: number;
  /** Target render rate in Hz (e.g., 30). Rendering may be throttled to this. */
  targetRenderHz: number;
  /** Optional: start paused. */
  startPaused?: boolean;
}

export class SimulationLoop {
  private readonly fixedDt: number;
  private readonly targetRenderIntervalMs: number;
  private accumulatedTime = 0;
  private lastTimeMs = 0;
  private rafId: number | null = null;
  private running = false;
  private tickIndex = 0;

  private tickListeners: Set<TickListener> = new Set();
  private renderListeners: Set<RenderListener> = new Set();
  private lastRenderTimeMs = 0;

  constructor(opts: SimulationLoopOptions) {
    this.fixedDt = opts.fixedDt;
    this.targetRenderIntervalMs = 1000 / Math.max(1, opts.targetRenderHz);
    if (!opts.startPaused) {
      this.start();
    }
  }

  /** Subscribe to fixed-tick updates. */
  onTick(listener: TickListener): () => void {
    this.tickListeners.add(listener);
    return () => this.tickListeners.delete(listener);
  }

  /** Subscribe to render updates (decoupled, throttled). */
  onRender(listener: RenderListener): () => void {
    this.renderListeners.add(listener);
    return () => this.renderListeners.delete(listener);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimeMs = performance.now();
    this.lastRenderTimeMs = this.lastTimeMs;
    const loop = () => {
      if (!this.running) return;
      const now = performance.now();
      let frameTime = now - this.lastTimeMs;
      if (frameTime > 1000) frameTime = 1000; // avoid spiral of death after tab sleep
      this.lastTimeMs = now;

      // Accumulate time and step the fixed simulation.
      this.accumulatedTime += frameTime / 1000;
      const maxSteps = 240; // safety to avoid too many catch-up steps
      let steps = 0;
      while (this.accumulatedTime >= this.fixedDt && steps < maxSteps) {
        this.tickListeners.forEach(l => l(this.fixedDt, this.tickIndex));
        this.accumulatedTime -= this.fixedDt;
        this.tickIndex++;
        steps++;
      }

      // Interpolation factor for rendering between ticks.
      const alpha = this.accumulatedTime / this.fixedDt;

      // Throttle rendering.
      if (now - this.lastRenderTimeMs >= this.targetRenderIntervalMs) {
        this.renderListeners.forEach(l => l(alpha, now));
        this.lastRenderTimeMs = now;
      }

      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  pause(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  /**
   * Advances the simulation by a fixed number of ticks synchronously.
   * Useful for deterministic tests without requestAnimationFrame.
   */
  stepTicks(ticks: number): void {
    for (let i = 0; i < ticks; i++) {
      this.tickListeners.forEach(l => l(this.fixedDt, this.tickIndex));
      this.tickIndex++;
    }
  }
}
