/**
 * Renders an infinite, procedurally generated starfield.
 * Stars are strictly fixed in World Space (XY coordinates).
 * Generation is deterministic based on grid cell coordinates (hashing).
 */

const GRID_SIZE_METERS = 5000; // Size of one star chunk in world units
const STARS_PER_CHUNK = 80;     // Density

// Spectral colors: Blue, White, Yellow, Orange, Red
const STAR_COLORS = [
    "#aabfff", // Blue-ish
    "#cad7ff", // Blue-white
    "#f8f7ff", // White
    "#fff4ea", // Yellow-white
    "#ffd2a1", // Yellow-orange
    "#ffcc6f", // Orange
];

// Fast pseudo-random based on integer inputs (Spatial Hashing)
// Returns value 0..1
function hash2(x: number, y: number) {
    let n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
}

// LCG for deterministic sequence from a seed
class LCG {
    constructor(private seed: number) { }
    next() {
        this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
        return this.seed / 4294967296;
    }
    nextRange(min: number, max: number) {
        return min + this.next() * (max - min);
    }
    pick<T>(arr: T[]): T {
        return arr[Math.floor(this.next() * arr.length)];
    }
}

export function drawStarField(
    ctx: CanvasRenderingContext2D,
    toScreen: (x: number, y: number) => { x: number, y: number },
    width: number,
    height: number
) {
    // 1. Determine World Bounds of the viewport
    // We reverse-map the corners of the screen to find the world rectangle.
    // Screen (0,0) -> World TL
    // Screen (W,H) -> World BR
    // Since toScreen is linear: screenX = (worldX - camX)*scale + W/2
    // worldX = (screenX - W/2)/scale + camX

    // Reverse engineer scale (pxPerMeter) and cam center from the function?
    // The function is a black box closure. 
    // BUT we can probe it.
    const p0 = toScreen(0, 0);
    const p1 = toScreen(1000, 0);
    const pxPerMeter = (p1.x - p0.x) / 1000; // measure how many pixels 1000m takes (approx)
    // Actually, simpler:
    // center of screen is camX, camY (mostly)
    // Let's just solve for World X/Y at corners.

    // We know: screen = (world - cam) * scale + offset
    // world = (screen - offset) / scale + cam
    // This requires knowing cam and scale strictly.
    // We can infer them by passing (0,0) world coord.
    const origin = toScreen(0, 0);
    // pxPerMeter is determined by the celestial scene logic.
    // Let's rely on probing or passing params? Probing is safer if signature is locked.

    // Probe X and Y scale
    const unitX = toScreen(1, 0);
    const unitY = toScreen(0, 1);
    const scaleX = unitX.x - origin.x; // px per meter
    const scaleY = origin.y - unitY.y; // px per meter (inverted Y)

    // If scale is 0 (unlikely), abort
    if (Math.abs(scaleX) < 1e-6) return;

    // Safe 'scale' to use
    const scale = scaleX;

    // Viewport in World Coords
    // Screen X: 0 .. width
    // World X: (0 - origin.x)/scale .. (width - origin.x)/scale
    const minWx = (0 - origin.x) / scale;
    const maxWx = (width - origin.x) / scale;
    const minWy = (height - origin.y) / -scale; // Screen Y increases down, World Y and scale inverted logic? 
    // Wait, toScreen Y = halfH - (y - camY)*scale.
    // 0 = HH - (y - cam)*s => (y-cam)*s = HH => y = cam + HH/s. (Top of screen is +Y relative to cam)
    // H = HH - (y - cam)*s => (y-cam)*s = HH - H = -HH => y = cam - HH/s. (Bot of screen is -Y relative to cam)
    // So Y ranges from (0 - origin.y)/(-scale) to (height - origin.y)/(-scale)?
    // origin.y = HH - (0 - camY)*scale = HH + camY*scale.
    // Let's just use numeric probing for bounds.

    // Probe corners.
    // Actually, simpler: Iterating chunks based on central camera position.
    // Cam World Pos is roughly where screen center is.
    // We can deduce Cam World Pos from origin.
    // origin.x = (0 - camX)*s + W/2 => camX = (W/2 - origin.x)/s
    const cx = (width / 2 - origin.x) / scale;
    const cy = (height / 2 - origin.y) / -scale; // Y logic reversed

    const visibleWidthMeters = width / scale;
    const visibleHeightMeters = height / scale;

    // Grid alignment
    const startGridX = Math.floor((cx - visibleWidthMeters) / GRID_SIZE_METERS);
    const endGridX = Math.floor((cx + visibleWidthMeters) / GRID_SIZE_METERS);
    const startGridY = Math.floor((cy - visibleHeightMeters) / GRID_SIZE_METERS);
    const endGridY = Math.floor((cy + visibleHeightMeters) / GRID_SIZE_METERS);

    // Render loop
    for (let gx = startGridX; gx <= endGridX; gx++) {
        for (let gy = startGridY; gy <= endGridY; gy++) {
            // Seed for this chunk
            // Combine coords into unique integer or seed
            // Use a simple hash wrapper
            // Hashing integers nicely:
            const h = Math.abs((gx * 73856093) ^ (gy * 19349663));

            const rng = new LCG(h); // Deterministic RNG per chunk

            const count = STARS_PER_CHUNK;
            const chunkBaseX = gx * GRID_SIZE_METERS;
            const chunkBaseY = gy * GRID_SIZE_METERS;

            for (let i = 0; i < count; i++) {
                // Pos relative to chunk (0..GRID_SIZE)
                const lx = rng.next() * GRID_SIZE_METERS;
                const ly = rng.next() * GRID_SIZE_METERS;
                const wx = chunkBaseX + lx;
                const wy = chunkBaseY + ly;

                // Color & Size
                const color = rng.pick(STAR_COLORS);
                const size = rng.nextRange(0.5, 2.8); // 0.5 to 2.8px
                const alpha = rng.nextRange(0.2, 0.9);

                // Project
                const p = toScreen(wx, wy);

                // Draw
                // Optimization: Skip strict checking as we only iterate visible chunks, 
                // but some stars in visible chunks might still be off-screen. Canvas clips anyway.
                ctx.globalAlpha = alpha;
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
    ctx.globalAlpha = 1.0;
}
