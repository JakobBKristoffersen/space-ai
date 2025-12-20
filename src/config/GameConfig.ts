/**
 * Centralized Game Configuration
 * Contains constants for physics, gameplay balance, and resource settings.
 */

export const GameConfig = {
    // --- Physics ---
    Physics: {
        GRAVITY_CONSTANT: 6.67430e-11, // Standard G (if needed)
        STANDARD_GRAVITY: 9.80665, // g0
        AIR_DENSITY_SEA_LEVEL: 1.225, // kg/m^3
        MIN_ATMOSPHERE_DENSITY: 1e-6, // Cutoff density
    },

    // --- Thermal Physics (Legacy Compatibility) ---
    Thermal: {
        AMBIENT_TEMP_VACUUM: 4,     // Kelvin
        AMBIENT_TEMP_GROUND: 288,   // Kelvin
        HEAT_CAPACITY_GENERIC: 50,  // J/(kg*K) - Gameplay optimized for quick response
        DISSIPATION_W_PER_K: 1000,  // Watts/Kelvin cooling
        K_THERMAL_HEATING: 1.0,     // Heating multiplier
        CRITICAL_SPEED_HEATING: 100,// m/s where significant heating starts
    },

    // --- Gameplay Balance ---
    Gameplay: {
        INITIAL_RESEARCH_POINTS: 0,
        CRASH_SPEED_THRESHOLD_HARD: 10,  // m/s instant death
        CRASH_SPEED_THRESHOLD_SOFT: 5,   // m/s allowed if aligned (landing)
        LANDING_ALIGNMENT_THRESHOLD: -0.8, // Dot product of velocity vs up vector
    },

    // --- System ---
    System: {
        TICK_RATE_MS: 16.66, // ~60 FPS logic
        MAX_TIME_SKIP: 100, // Max physics steps per frame
    }
};
