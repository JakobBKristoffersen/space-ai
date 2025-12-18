import React, { useEffect, useRef } from "react";
import { Box, Center } from "@chakra-ui/react";

// --- Orbital helpers (primary body approximation) ---
function computeOrbit(primary: any, rocket: any) {
    if (!primary || !rocket) return null;
    const rx = rocket.position?.x ?? 0;
    const ry = rocket.position?.y ?? 0;
    const vx = rocket.velocity?.x ?? 0;
    const vy = rocket.velocity?.y ?? 0;
    const rvec = { x: rx - primary.position.x, y: ry - primary.position.y };
    const vvec = { x: vx, y: vy };

    const r = Math.hypot(rvec.x, rvec.y);
    const v2 = vvec.x * vvec.x + vvec.y * vvec.y;
    const mu = primary.surfaceGravity * primary.radiusMeters * primary.radiusMeters; // since g0 = mu/R^2
    if (!(mu > 0) || r <= 0) return null;
    const eps = 0.5 * v2 - mu / r; // specific orbital energy
    // Eccentricity vector: e = ( (v^2 - mu/r) r - (r·v) v ) / mu
    const rv = rvec.x * vvec.x + rvec.y * vvec.y;
    const ex = ((v2 - mu / r) * rvec.x - rv * vvec.x) / mu;
    const ey = ((v2 - mu / r) * rvec.y - rv * vvec.y) / mu;
    const e = Math.hypot(ex, ey);
    let a = Number.NaN;
    if (eps < 0) a = -mu / (2 * eps); // ellipse

    const argPeri = Math.atan2(ey, ex); // orientation of periapsis in world frame

    if (isFinite(a) && e < 1 && a > 0) {
        const rp = a * (1 - e);
        const ra = a * (1 + e);
        const peAlt = rp - primary.radiusMeters;
        const apAlt = ra - primary.radiusMeters;
        return { a, e, argPeri, apAlt, peAlt };
    }
    return { a: Number.NaN, e, argPeri, apAlt: Number.NaN, peAlt: Number.NaN };
}

interface MinimapPanelProps {
    envSnap: any;
    className?: string;
    width?: number | string;
    height?: number | string;
}

export function MinimapPanel({ envSnap, width = "100%", height = "100%" }: MinimapPanelProps) {
    const miniRef = useRef<HTMLCanvasElement | null>(null);
    const miniBoundsRef = useRef<{ bounds: { minX: number; maxX: number; minY: number; maxY: number }; sig: string } | null>(null);

    useEffect(() => {
        const canvas = miniRef.current;
        if (!canvas || !envSnap) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Handle resizing if needed, but for now rely on prop or CSS
        const w = canvas.width = canvas.clientWidth || 280;
        const h = canvas.height = canvas.clientHeight || 280;
        ctx.clearRect(0, 0, w, h);

        const primary = envSnap.bodies.find((b: any) => b.id === envSnap.primaryId);
        if (!primary) return;

        let maxDist = 0;
        for (const b of envSnap.bodies) {
            const dx = b.position.x - primary.position.x;
            const dy = b.position.y - primary.position.y;
            const dist = Math.hypot(dx, dy) + b.radiusMeters;
            if (dist > maxDist) maxDist = dist;
        }
        // Include all rockets
        const rockets = Array.isArray((envSnap as any).rockets) ? (envSnap as any).rockets : [envSnap.rocket];
        for (const r of rockets) {
            if (!r) continue;
            const dx = r.position.x - primary.position.x;
            const dy = r.position.y - primary.position.y;
            const dist = Math.hypot(dx, dy) + primary.radiusMeters * 0.1;
            if (dist > maxDist) maxDist = dist;
        }
        maxDist = Math.max(maxDist, primary.radiusMeters * 2);

        // Add padding
        maxDist *= 1.1;

        const bounds = { minX: -maxDist, maxX: maxDist, minY: -maxDist, maxY: maxDist };
        const worldW = Math.max(1, bounds.maxX - bounds.minX);
        const worldH = Math.max(1, bounds.maxY - bounds.minY);
        const scale = Math.min((w - 4) / worldW, (h - 4) / worldH);
        const ox = (w - worldW * scale) / 2;
        const oy = (h - worldH * scale) / 2;
        const toMini = (x: number, y: number) => ({
            x: ox + (x - bounds.minX) * scale,
            y: h - (oy + (y - bounds.minY) * scale),
        });

        // backdrop
        ctx.fillStyle = "rgba(0,0,0,0.9)";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

        // Bodies
        for (const b of envSnap.bodies) {
            const p = toMini(b.position.x, b.position.y);
            const R = Math.max(1, b.radiusMeters * scale);
            ctx.beginPath();
            ctx.fillStyle = b.id === envSnap.primaryId ? (b.color || "#2e5d2e") : (b.color || "#888");
            ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
            ctx.fill();

            // Draw SOI if defined (and not primary)
            if (b.soiRadius && b.soiRadius > 0) {
                const rSOI = b.soiRadius * scale;
                if (rSOI > R + 1) { // Only drawn if visible outside body
                    ctx.save();
                    ctx.beginPath();
                    ctx.setLineDash([2, 3]);
                    ctx.strokeStyle = "rgba(255,255,200,0.3)"; // Faint yellow
                    ctx.lineWidth = 1;
                    ctx.arc(p.x, p.y, rSOI, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                }
            }
        }

        // Atmosphere cutoff circle (if defined) drawn around the primary
        try {
            const cutoffAlt = (typeof envSnap.atmosphereCutoffAltitudeMeters === 'number')
                ? Math.max(0, Number(envSnap.atmosphereCutoffAltitudeMeters))
                : (primary.atmosphereScaleHeightMeters ? Math.max(0, primary.atmosphereScaleHeightMeters * 7) : 0);
            if (cutoffAlt > 0) {
                const pc = toMini(primary.position.x, primary.position.y);
                const Rc = (primary.radiusMeters + cutoffAlt) * scale;
                if (isFinite(Rc) && Rc > 1) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.setLineDash([4, 3]);
                    // Use a subtle blue matching atmosphere
                    const base = primary.atmosphereColor || "rgba(80,160,255,1)";
                    // Simple alpha override regardless of input format
                    const stroke = base.startsWith("rgba(") ? base.replace(/rgba\(([^)]+),\s*([\d.]+)\)/, "rgba($1,0.35)") : "rgba(80,160,255,0.35)";
                    ctx.strokeStyle = stroke;
                    ctx.lineWidth = 1;
                    ctx.arc(pc.x, pc.y, Rc, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                }
            }
        } catch {
        }

        const rocketSnap = envSnap.rocket;
        // Predicted elliptical trajectory around the body with strongest gravity (SOI) if bound
        try {
            const soiId = (rocketSnap as any)?.soiBodyId ?? envSnap.primaryId;
            const baseBody = envSnap.bodies.find((b: any) => b.id === soiId) ?? primary;
            const orb = computeOrbit(baseBody, envSnap.rocket);
            if (orb && isFinite(orb.a) && orb.e < 1 && orb.a > 0) {
                const a = orb.a;
                const b = a * Math.sqrt(Math.max(0, 1 - orb.e * orb.e));
                const cosW = Math.cos(orb.argPeri);
                const sinW = Math.sin(orb.argPeri);
                ctx.strokeStyle = "rgba(0,200,255,0.6)";
                ctx.lineWidth = 1;
                ctx.beginPath();
                const steps = 180;
                for (let i = 0; i <= steps; i++) {
                    const E = (i / steps) * Math.PI * 2;
                    // Ellipse in orbital frame (focus at origin): r(E) = a(cosE - e), y = b sinE, then rotate by argPeri
                    const x_orb = a * (Math.cos(E) - orb.e);
                    const y_orb = b * Math.sin(E);
                    const xw = x_orb * cosW - y_orb * sinW + baseBody.position.x;
                    const yw = x_orb * sinW + y_orb * cosW + baseBody.position.y;
                    const p2 = toMini(xw, yw);
                    if (i === 0) ctx.moveTo(p2.x, p2.y); else ctx.lineTo(p2.x, p2.y);
                }
                ctx.stroke();
            }
        } catch {
        }

        // Draw connection line to base if connected
        try {
            const r = envSnap.rocket;
            if (r && (r.commsInRange || (r.commState?.connected))) {
                const baseBody = envSnap.bodies.find((b: any) => b.id === envSnap.primaryId) ?? primary;
                // Base is roughly at (0, R) relative to primary center in world space (initial launch pos)
                // Actually launch happens at (0, R).
                // Base coordinates in world space:
                const bx = baseBody.position.x;
                const by = baseBody.position.y + baseBody.radiusMeters;

                const pRocket = toMini(r.position.x, r.position.y);
                const pBase = toMini(bx, by);

                ctx.save();
                ctx.beginPath();
                ctx.setLineDash([2, 4]); // Dotted
                ctx.strokeStyle = "#48bb78"; // Green-400
                ctx.lineWidth = 1.5;
                ctx.moveTo(pBase.x, pBase.y);
                ctx.lineTo(pRocket.x, pRocket.y);
                ctx.stroke();

                // Draw small base icon/dot
                ctx.fillStyle = "#48bb78";
                ctx.beginPath();
                ctx.arc(pBase.x, pBase.y, 2.5, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            }
        } catch { }

        const rocketsDraw = Array.isArray((envSnap as any).rockets) ? (envSnap as any).rockets : [envSnap.rocket];
        const activeIdxMM = Number((envSnap as any).activeRocketIndex ?? 0) | 0;
        for (let i = 0; i < rocketsDraw.length; i++) {
            const rr = rocketsDraw[i];
            if (!rr) continue;
            const p = toMini(rr.position.x, rr.position.y);
            ctx.fillStyle = i === activeIdxMM ? "#ffcc00" : "#cccccc";
            ctx.beginPath();
            ctx.arc(p.x, p.y, i === activeIdxMM ? 3 : 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }, [envSnap]); // re-run when snapshot updates

    return (
        <Center bg="black" p={2} width={width} height={height}>
            <canvas ref={miniRef} style={{ width: '100%', height: '100%' }} />
        </Center>
    );
}
