/**
 * CelestialScene renders a simple 2D view of a primary planet, a moon, atmosphere, a base, and the rocket.
 * It also draws a minimap to show the whole system.
 */
import { RenderContext, SceneLike } from "./Renderer";
import type { EnvironmentSnapshot } from "../simulation/Environment";
import { drawAtmosphereGlow } from "./sceneParts/atmosphere";
import { updateTrail, drawTrail } from "./sceneParts/trail";
import { drawRocket as drawRocketHelper } from "./sceneParts/rockets";

export interface SceneStateProvider<T> {
  get(): T;
}

export interface CelestialSceneOptions {
  provider: SceneStateProvider<EnvironmentSnapshot>;
}

export class CelestialScene implements SceneLike {
  private miniMapBounds?: { minX: number; maxX: number; minY: number; maxY: number };
  // Engine-on trail state (world-space positions with timestamps)
  private thrustTrail: { x: number; y: number; t: number }[] = [];
  private lastTrailX: number | null = null;
  private lastTrailY: number | null = null;
  private readonly maxTrailAgeSec = 12; // seconds to keep in trail
  private readonly trailMinSpacingMeters = 80; // add a point only if moved this far

  constructor(private readonly opts: CelestialSceneOptions) { }

  private initMiniMapBounds(snap: EnvironmentSnapshot): void {
    if (this.miniMapBounds) return;
    const primary = snap.bodies.find(b => b.id === snap.primaryId)!;
    let maxDist = 0;
    // Include all bodies
    for (const b of snap.bodies) {
      const dx = b.position.x - primary.position.x;
      const dy = b.position.y - primary.position.y;
      const dist = Math.hypot(dx, dy) + b.radiusMeters;
      if (dist > maxDist) maxDist = dist;
    }
    // Include rocket position (as a point) with a small margin
    {
      const dx = snap.rocket.position.x - primary.position.x;
      const dy = snap.rocket.position.y - primary.position.y;
      const dist = Math.hypot(dx, dy) + primary.radiusMeters * 0.1; // margin
      if (dist > maxDist) maxDist = dist;
    }
    // Ensure there is always some minimal size
    maxDist = Math.max(maxDist, primary.radiusMeters * 2);
    this.miniMapBounds = { minX: -maxDist, maxX: maxDist, minY: -maxDist, maxY: maxDist };
  }

  onAttach(): void { }
  onDetach(): void { }

  render({ ctx }: RenderContext): void {
    if (!ctx) return;
    const snap = this.opts.provider.get();
    const { width, height } = ctx.canvas;

    // Clear and fill background (space is black)
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    // Find primary and moon
    const primary = snap.bodies.find(b => b.id === snap.primaryId)!;
    const moon = snap.bodies.find(b => b.id !== snap.primaryId);

    // View transform: center around rocket position; set scale so planet curvature is visible.
    // Baseline: planet radius takes ~0.9 * canvas height (nice local curvature)
    // Apply an additional zoom so only a small portion of the surface is visible.
    const viewZoom = 14.5; // tuning knob: higher = planet appears larger in main view
    const planetPxRadius = Math.min(height * 0.45, width * 0.45) * viewZoom;
    const metersPerPx = primary.radiusMeters / planetPxRadius; // m in 1 px
    const pxPerMeter = 1 / metersPerPx;

    // World-to-screen mapping with rocket-centered camera.
    const camX = snap.rocket.position.x;
    const camY = snap.rocket.position.y;
    const toScreen = (x: number, y: number) => ({
      x: (x - camX) * pxPerMeter + width * 0.5,
      y: height * 0.5 - (y - camY) * pxPerMeter,
    });

    // Update engine-on trail (store world positions while engines burn)
    const nowT = snap.timeSeconds;
    const burning = (snap.rocket.fuelConsumptionKgPerS ?? 0) > 1e-3;
    {
      const res = updateTrail(
        this.thrustTrail,
        nowT,
        burning,
        snap.rocket.position.x,
        snap.rocket.position.y,
        this.maxTrailAgeSec,
        this.trailMinSpacingMeters,
        this.lastTrailX,
        this.lastTrailY,
      );
      this.lastTrailX = res.lastX;
      this.lastTrailY = res.lastY;
    }

    // Draw atmosphere glow via helper
    drawAtmosphereGlow(ctx, snap, pxPerMeter, toScreen)

    // Draw primary planet disk
    {
      const center = toScreen(primary.position.x, primary.position.y);
      const R = primary.radiusMeters * pxPerMeter;
      ctx.fillStyle = primary.color || "#2e5d2e";
      ctx.beginPath();
      ctx.arc(center.x, center.y, R, 0, Math.PI * 2);
      ctx.fill();

      // Draw fixed world structures (e.g., Base) anchored on bodies
      if (Array.isArray((snap as any).structures)) {
        for (const s of (snap as any).structures as { id: string; name: string; bodyId: string; position: { x: number; y: number } }[]) {
          const spt = toScreen(s.position.x, s.position.y);
          const bw = Math.max(4, R * 0.015);
          const bh = bw * 0.5;
          // Draw a small outpost marker
          ctx.save();
          ctx.translate(spt.x, spt.y);
          ctx.fillStyle = "#9ea7b3";
          ctx.fillRect(-bw / 2, -bh, bw, bh);
          ctx.fillStyle = "#73808f";
          ctx.fillRect(-bw * 0.35, -bh - bh * 0.4, bw * 0.7, bh * 0.4);
          ctx.restore();
        }
      }
    }

    // Draw moon (big disk) if any
    if (moon) {
      const center = toScreen(moon.position.x, moon.position.y);
      const R = moon.radiusMeters * pxPerMeter;
      ctx.fillStyle = moon.color || "#888";
      ctx.beginPath();
      ctx.arc(center.x, center.y, R, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw thrust trail (engine-on path), behind all ships but above planets
    drawTrail(ctx, this.thrustTrail, toScreen, nowT, this.maxTrailAgeSec)

    // Draw all rockets, focused camera on active rocket.
    {
      const rockets = Array.isArray((snap as any).rockets) ? (snap as any).rockets as any[] : [snap.rocket as any];
      const activeIdx = Number((snap as any).activeRocketIndex ?? 0) | 0;

      // Helper to draw a rocket at position/orientation, with optional plume and color
      const drawRocket = (r: any, color: string, drawPlume: boolean) => {
        const p = toScreen(r.position.x, r.position.y);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(-r.orientationRad);
        // Engine plume
        if (drawPlume) {
          const t = snap.timeSeconds;
          const s = 10;
          const flicker = 0.85 + 0.3 * Math.sin(t * 30 + (r.position.x + r.position.y) * 1e-4);
          const len = s * (1.2 + 0.6 * flicker);
          const base = s * 0.5;
          const half = s * 0.35;
          const grad = ctx.createLinearGradient(-base - len, 0, -base, 0);
          grad.addColorStop(0, "rgba(255,220,120,0)");
          grad.addColorStop(0.2, "rgba(255,200,90,0.35)");
          grad.addColorStop(0.6, "rgba(255,140,60,0.6)");
          grad.addColorStop(1, "rgba(255,100,40,0.9)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(-base, 0);
          ctx.lineTo(-base - len, half);
          ctx.lineTo(-base - len * 0.9, 0);
          ctx.lineTo(-base - len, -half);
          ctx.closePath();
          ctx.fill();
        }
        // Body
        ctx.fillStyle = color;
        ctx.beginPath();
        const s = 10;
        ctx.moveTo(s, 0);
        ctx.lineTo(-s * 0.8, s * 0.6);
        ctx.lineTo(-s * 0.8, -s * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      };

      // Draw non-active rockets first (smaller, gray), so active draws on top
      for (let i = 0; i < rockets.length; i++) {
        if (i === activeIdx) continue;
        const r = rockets[i];
        const burningOther = (Number(r.fuelConsumptionKgPerS ?? 0) > 1e-3);
        drawRocketHelper(ctx, snap.timeSeconds, r, toScreen, "#bbbbbb", burningOther);
      }

      // Draw active rocket with full styling and plume/trail as before
      drawRocketHelper(ctx, snap.timeSeconds, snap.rocket as any, toScreen, snap.destroyed ? "#444" : "#e74c3c", burning);
    }

    // Minimap: top-right corner
    this.drawMiniMap(ctx, snap, width, height);
  }
  //
  private drawMiniMap(ctx: CanvasRenderingContext2D, snap: EnvironmentSnapshot, width: number, height: number) {
    const pad = 8;
    const w = 160;
    const h = 120;
    const x0 = width - w - pad;
    const y0 = pad;

    // Initialize fixed bounds once so the minimap stays still (no panning/zooming)
    this.initMiniMapBounds(snap);
    const bounds = this.miniMapBounds!;
    const worldW = Math.max(1, bounds.maxX - bounds.minX);
    const worldH = Math.max(1, bounds.maxY - bounds.minY);
    const scale = Math.min(w / worldW, h / worldH);
    // Center the world inside the minimap rectangle
    const ox = x0 + (w - worldW * scale) / 2;
    const oy = y0 + (h - worldH * scale) / 2;

    const toMini = (x: number, y: number) => ({
      x: ox + (x - bounds.minX) * scale,
      y: oy + worldH * scale - (y - bounds.minY) * scale,
    });

    // Backdrop
    ctx.save();
    // Use broadly supported RGBA color (avoid 4-digit hex with alpha like "#0008")
    ctx.fillStyle = "rgba(0,0,0,0.9)";
    ctx.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
    // Add a subtle border to ensure the minimap is visible on all backgrounds
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 - 1 + 0.5, y0 - 1 + 0.5, w + 2 - 1, h + 2 - 1);

    // Comm Network Lines
    ctx.lineWidth = 1;
    const findPos = (id: string): { x: number, y: number } | undefined => {
      const b = snap.bodies.find(x => x.id === id);
      if (b) return b.position;
      const s = (snap.structures as any[]).find(x => x.id === id);
      if (s) return s.position;
      const r = (snap as any).rockets?.find((x: any) => x.id === id) ?? ((snap.rocket as any).id === id ? snap.rocket : undefined);
      if (r) return r.position;
      return undefined;
    };

    const rockets = Array.isArray((snap as any).rockets) ? (snap as any).rockets : [snap.rocket];
    for (const r of rockets) {
      if (r.commState?.connected && r.commState.path.length > 1) {
        ctx.strokeStyle = "#00ff00"; // Green for connected
        ctx.beginPath();
        let first = true;
        for (const nodeId of r.commState.path) {
          const pos = findPos(nodeId);
          if (pos) {
            const sc = toMini(pos.x, pos.y);
            if (first) { ctx.moveTo(sc.x, sc.y); first = false; }
            else ctx.lineTo(sc.x, sc.y);
          }
        }
        ctx.stroke();
      } else if (!r.commState?.connected) {
        // Optional: draw red line to nearest? Hard to know nearest here without logic.
        // Just draw a red X on the rocket itself in the loop below?
      }
    }

    // Bodies
    for (const b of snap.bodies) {
      const c = toMini(b.position.x, b.position.y);
      const R = Math.max(1, b.radiusMeters * scale);
      ctx.beginPath();
      ctx.fillStyle = (b.id === snap.primaryId ? (b.color || "#2e5d2e") : (b.color || "#888"));
      ctx.arc(c.x, c.y, R, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rockets (draw all)
    for (const r of rockets) {
      const pos = toMini(r.position.x, r.position.y);
      ctx.fillStyle = r.commState?.connected ? "#00ff00" : "#ff0000"; // Green if connected, Red if not
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
