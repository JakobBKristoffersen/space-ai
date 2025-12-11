/**
 * Renderer is a decoupled view layer facade.
 * - It does NOT perform any physics or mutate simulation state.
 * - It renders at its own cadence (hooked via SimulationLoop.onRender).
 * - Internally it can use any rendering tech (Canvas2D, PixiJS, Phaser). Here we keep it generic.
 */

export interface RenderContext {
  /** Interpolation factor between last and next physics tick [0,1). */
  alpha: number;
  /** Monotonic timestamp in ms, from performance.now(). */
  nowMs: number;
  /** Drawing surface; for stub we pass a CanvasRenderingContext2D when available. */
  ctx?: CanvasRenderingContext2D;
}

export interface SceneLike {
  /** Called once when attached to the renderer. */
  onAttach(): void;
  /** Called every render frame to draw content; must be pure from renderer POV. */
  render(context: RenderContext): void;
  /** Called when detached. */
  onDetach(): void;
}

export interface RendererOptions {
  /** Optional canvas 2D context for immediate mode drawings. */
  ctx?: CanvasRenderingContext2D;
}

export class Renderer {
  private scene: SceneLike | null = null;
  private ctx?: CanvasRenderingContext2D;

  constructor(opts?: RendererOptions) {
    this.ctx = opts?.ctx;
  }

  attachScene(scene: SceneLike): void {
    if (this.scene) this.scene.onDetach();
    this.scene = scene;
    this.scene.onAttach();
  }

  detachScene(): void {
    if (this.scene) {
      this.scene.onDetach();
      this.scene = null;
    }
  }

  /**
   * Called by the SimulationLoop's onRender callback.
   */
  render(alpha: number, nowMs: number): void {
    if (!this.scene) return;
    const context: RenderContext = { alpha, nowMs, ctx: this.ctx };
    // TODO: Clear canvas if ctx present.
    this.scene.render(context);
  }
}
