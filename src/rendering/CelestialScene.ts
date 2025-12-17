/**
 * CelestialScene renders a simple 2D view of a primary planet, a moon, atmosphere, a base, and the rocket.
 * It also draws a minimap to show the whole system.
 */
import { RenderContext, SceneLike } from "./Renderer";
import type { EnvironmentSnapshot } from "../simulation/Environment";
import { drawAtmosphereGlow } from "./sceneParts/atmosphere";
import { updateTrail, drawTrail } from "./sceneParts/trail";
import { drawRocket as drawRocketHelper } from "./sceneParts/rockets";
import { drawStarField } from "./sceneParts/stars";

export interface SceneStateProvider<T> {
  get(): T;
}

export interface CelestialSceneOptions {
  provider: SceneStateProvider<EnvironmentSnapshot>;
}

export class CelestialScene implements SceneLike {

  // Engine-on trail state (world-space positions with timestamps)
  private thrustTrail: { x: number; y: number; t: number }[] = [];
  private lastTrailX: number | null = null;
  private lastTrailY: number | null = null;
  private readonly maxTrailAgeSec = 12; // seconds to keep in trail
  private readonly trailMinSpacingMeters = 80; // add a point only if moved this far

  constructor(private readonly opts: CelestialSceneOptions) { }



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
    // World-to-screen mapping with rocket-centered camera (or primary body if no rocket).
    // World-to-screen mapping with rocket-centered camera (or Base if no rocket).
    let camX = primary.position.x;
    let camY = primary.position.y;
    if (snap.rocket) {
      camX = snap.rocket.position.x;
      camY = snap.rocket.position.y;
    } else if (Array.isArray((snap as any).structures)) {
      const base = (snap as any).structures.find((s: any) => s.id === "base");
      if (base) {
        camX = base.position.x;
        camY = base.position.y;
      }
    }
    const toScreen = (x: number, y: number) => ({
      x: (x - camX) * pxPerMeter + width * 0.5,
      y: height * 0.5 - (y - camY) * pxPerMeter,
    });

    // Draw Stars (background layer)
    drawStarField(ctx, toScreen, width, height);

    // Update engine-on trail (store world positions while engines burn)
    const nowT = snap.timeSeconds;
    if (snap.rocket) {
      const burning = (snap.rocket.fuelConsumptionKgPerS ?? 0) > 1e-3;
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
    drawAtmosphereGlow(ctx, snap, pxPerMeter, toScreen);

    // Draw Atmosphere Limit Line
    if (primary && (primary.atmosphereScaleHeightMeters ?? 0) > 0 && (snap as any).atmosphereCutoffAltitudeMeters) {
      const center = toScreen(primary.position.x, primary.position.y);
      const Rcutoff = (primary.radiusMeters + Number((snap as any).atmosphereCutoffAltitudeMeters)) * pxPerMeter;
      ctx.strokeStyle = "rgba(135, 206, 235, 0.3)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 10]);
      ctx.beginPath();
      ctx.arc(center.x, center.y, Rcutoff, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw primary planet disk
    {
      const center = toScreen(primary.position.x, primary.position.y);
      const R = primary.radiusMeters * pxPerMeter;

      if ((primary as any).terrain) {
        // Draw segments
        const terrain = (primary as any).terrain as { type: string; color: string; startRad: number; endRad: number }[];
        for (const seg of terrain) {
          ctx.fillStyle = seg.color;
          ctx.beginPath();
          ctx.moveTo(center.x, center.y);
          // Arc angles are clockwise from +X. 
          // Our terrain definition is 0..2PI.
          // Canvas arc takes start/end angles.
          // Note: Canvas Y is down, but our world Y is up. The toScreen transform handles position, 
          // but for drawing arcs we should be careful about orientation or just draw standard and let it be rotated.
          // Actually, we are just drawing a circle at center (x,y). 
          // The angles in standard Math.atan2 are counter-clockwise from +X in standard math, 
          // but Canvas arc is clockwise from +X? No, Canvas arc is clockwise (positive angle).
          // Math.atan2(y, x) is CCW from +X. 
          // Wait, standard canvas arc(..., startAngle, endAngle) treats angle as CW from +X on screen?
          // Actually, usually in computer graphics Y is down, so +angle is CW.
          // In our world, Y is up, so +angle would be CCW.
          // The terrain segments are defined 0..2PI. Let's just draw them directly mapping rads.
          // If they appear flipped, it's just visual.
          // The terrain segments are defined 0..2PI in World (Y-up, CCW).
          // Canvas Y is down, so a World Angle 'a' maps to Screen Angle '-a'.
          // To draw the segment [start, end] (World), we draw [-start, -end] (Screen) Counter-Clockwise.
          ctx.arc(center.x, center.y, R, -seg.startRad, -seg.endRad, true);
          ctx.lineTo(center.x, center.y);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = primary.color || "#2e5d2e";
        ctx.beginPath();
        ctx.arc(center.x, center.y, R, 0, Math.PI * 2);
        ctx.fill();
      }

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
      if (snap.rocket) {
        const burning = (snap.rocket.fuelConsumptionKgPerS ?? 0) > 1e-3;
        drawRocketHelper(ctx, snap.timeSeconds, snap.rocket as any, toScreen, snap.destroyed ? "#444" : "#e74c3c", burning);
      }
    }


  }
  //

}
