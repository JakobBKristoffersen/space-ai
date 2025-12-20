
// Mock CelestialBody for testing
const MockEarth = {
    id: "earth",
    name: "Earth",
    mu: 3.986e14, // m^3/s^2
    radiusMeters: 6371000,
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 }
};

// Simple test runner since we don't have vitest installed yet
// This allows verifying via `ts-node` or similar if needed, 
// but primarily serves as the test file structure.

import { PhysicsMath } from "./PhysicsMath";

export function runPhysicsTests() {
    let passed = 0;
    let failed = 0;

    const assertClose = (actual: number, expected: number, tol = 1e-3, msg = "") => {
        if (Math.abs(actual - expected) > tol) {
            console.error(`[FAIL] ${msg}: Expected ${expected}, got ${actual}`);
            failed++;
        } else {
            // console.log(`[PASS] ${msg}`);
            passed++;
        }
    };

    console.log("--- Running PhysicsMath Tests ---");

    // Test 1: Circular Orbit at 100km altitude
    {
        const alt = 100000;
        const r = MockEarth.radiusMeters + alt;
        const v = Math.sqrt(MockEarth.mu / r); // Circular velocity

        const rPos = { x: r, y: 0 };
        const rVel = { x: 0, y: v };

        const els = PhysicsMath.calculateOrbitalElements(rPos, rVel, MockEarth as any);

        if (!els) {
            console.error("[FAIL] Circular orbit returned undefined elements");
            failed++;
        } else {
            assertClose(els.a, r, 1.0, "Semi-major axis should equal radius");
            assertClose(els.e, 0, 1e-5, "Eccentricity should be 0");
        }
    }

    // Test 2: Thermal Decay
    {
        // One step decay
        // T_new = T_eq + (T_old - T_eq) * exp(-dt / tau)
        // Let T_old = 1000, T_ambient = 300, Dissipation = 10, Mass = 100 => Tau = 10
        // T_eq = 300 (no flux)
        // dt = 10 (one tau) => decay to 1/e ~ 36.8% of difference
        // Expected = 300 + (700 * 0.367879) = 300 + 257.51 = 557.51

        const T = PhysicsMath.updateTemperature(1000, 0, 100, 10, 300, 10);
        assertClose(T, 557.515, 0.1, "Thermal decay calculation");
    }

    console.log(`--- Tests Complete: ${passed} Passed, ${failed} Failed ---`);
    if (failed > 0) throw new Error("Physics Tests Failed");
}

// Auto-run if executed directly (requires ts-node)
runPhysicsTests();
