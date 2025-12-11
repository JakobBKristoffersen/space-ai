/**
 * Scene: a minimal, decoupled scene that knows how to render a Rocket-like marker.
 * - No physics; reads external state via a provider function.
 * - Safe to run independently of simulation for testing.
 */
import { RenderContext, SceneLike } from "./Renderer";

export interface SceneStateProvider<T> {
  /** Returns the latest snapshot to render. */
  get(): T;
}

export interface RocketLikeSnapshot {
  position: { x: number; y: number };
  orientationRad: number;
}

export interface SimpleSceneOptions<T extends RocketLikeSnapshot> {
  /** Data provider supplying current snapshot to render. */
  provider: SceneStateProvider<T>;
  /** World-to-screen transform. */
  worldToScreen?(x: number, y: number): { x: number; y: number };
}

export class SimpleScene<T extends RocketLikeSnapshot> implements SceneLike {
  constructor(private readonly opts: SimpleSceneOptions<T>) {}

  onAttach(): void {
    // TODO: load sprites/assets if using a real renderer framework.
  }

  onDetach(): void {
    // TODO: clean up assets.
  }

  render({ ctx }: RenderContext): void {
    if (!ctx) return; // nothing to draw to
    const snap = this.opts.provider.get();

    // Canvas dimensions and derived layout
    const { width, height } = ctx.canvas;
    const groundY = Math.round(height * 0.8); // place ground ~2/3 down the canvas

    // World to screen transform
    let p: { x: number; y: number };
    if (this.opts.worldToScreen) {
      p = this.opts.worldToScreen(snap.position.x, snap.position.y);
    } else {
      // Scale roughly with canvas width so visuals remain visible at different sizes
      const baseScale = 0.05; // px per meter at 900px width baseline
      const scale = baseScale * (width / 900);
      const originX = Math.round(width * 0.22); // leave some left margin
      p = { x: snap.position.x * scale + originX, y: groundY - snap.position.y * scale };
    }

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Draw ground
    ctx.strokeStyle = "#555";
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();

    // Draw rocket as a simple triangle
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(snap.orientationRad);
    ctx.fillStyle = "#e74c3c";
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-10, 6);
    ctx.lineTo(-10, -6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
