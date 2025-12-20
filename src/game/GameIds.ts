/**
 * GameIds.ts
 * 
 * Central constants for all ID strings in the game.
 * Usage of these constants is preferred over raw strings to prevent typos.
 */

export const PartIds = {
    // Engine
    ENGINE_SMALL: "engine.small",
    ENGINE_PRECISION: "engine.precision",
    ENGINE_VACUUM: "engine.vacuum",
    ENGINE_ION: "engine.ion",

    // Fuel
    FUEL_SMALL: "fueltank.small",
    FUEL_MEDIUM: "fueltank.medium",
    FUEL_LARGE: "fueltank.large",

    // Electrical
    BATTERY_SMALL: "battery.small",
    BATTERY_MEDIUM: "battery.medium",
    SOLAR_BASIC: "solar.basic",

    // Control
    CPU_BASIC: "cpu.basic",
    CPU_ADVANCED: "cpu.advanced",
    CPU_ORBITAL: "cpu.orbital",
    RW_SMALL: "rw.small",
    SENSOR_NAV_BASIC: "sensor.nav.basic",
    SENSOR_NAV_ADV: "sensor.nav.adv",

    // Comms
    ANTENNA_SMALL: "antenna.small",
    ANTENNA_MEDIUM: "antenna.medium",
    ANTENNA_RELAY: "antenna.relay",
    ANTENNA_DEEP: "antenna.deep",

    // Payload
    PAYLOAD_SAT_BASIC: "payload.sat.basic",

    // Aero
    CONE_BASIC: "cone.basic",
    FIN_BASIC: "fin.basic",
    PARACHUTE_BASIC: "parachute.basic",
    HEATSHIELD_BASIC: "heatshield.basic",

    // Science / Sensors
    SCIENCE_TEMP: "science.temp",
    SCIENCE_ATMOS: "science.atmos",
    SCIENCE_SURFACE: "science.surface",
    SCIENCE_BIO: "science.bio_sample",
    SENSOR_LIDAR: "sensor.lidar",

    // Structure
    LEG_LANDING_FIXED: "leg.landing.fixed",
} as const;

export const TechIds = {
    START: "tech.start",
    BASIC_ROCKETRY: "tech.basic_rocketry",
    ELECTRICS: "tech.electrics",
    SCIENCE_BASIC: "tech.science_basic",
    GUIDANCE_ADV: "tech.guidance_adv",
    COMMS_BASIC: "tech.comms_basic",
    AERODYNAMICS: "tech.aerodynamics",
    LANDING_SYSTEMS: "tech.landing_systems",
    STAGING: "tech.staging",
    SOLAR_ADV: "tech.solar_adv",
    ORBITAL_SCI: "tech.orbital_sci",
    PROPULSION_VAC: "tech.propulsion_vac",
    COMMS_RELAY: "tech.comms_relay",
    ION_PROPULSION: "tech.ion",
} as const;

export const ApiFeatures = {
    CONTROL_THROTTLE: "control.throttle",
    CONTROL_TURN: "control.turn",
    CONTROL_SOLAR: "control.solar",

    TELEMETRY_BASIC: "telemetry.basic",
    TELEMETRY_ORBITAL: "telemetry.orbital",
    TELEMETRY_LIDAR: "telemetry.lidar",

    NAV_PROGRADE: "nav.prograde",
    NAV_RETROGRADE: "nav.retrograde",
    NAV_ALIGN_TO: "nav.alignTo",

    SCIENCE_ATMOSPHERE: "science.atmosphere",
    SCIENCE_SURFACE: "science.surface",
    COMMS_DEEP_SPACE: "comms.deep_space",
} as const;
