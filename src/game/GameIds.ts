/**
 * GameIds.ts
 * 
 * Central constants for all ID strings in the game.
 * Usage of these constants is preferred over raw strings to prevent typos.
 */

export const PartIds = {
    // Engine
    ENGINE_SMALL: "engine.small",
    ENGINE_SMALL_V2: "engine.small_v2",
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
    BASIC_NAV: "tech.basic_nav",
    BASIC_ROCKETRY: "tech.basic_rocketry",
    ELECTRICS: "tech.electrics",
    BASIC_COMPUTING: "tech.basic_computing",
    SCIENCE_BASIC: "tech.science_basic",
    GUIDANCE_ADV: "tech.guidance_adv",
    COMMS_BASIC: "tech.comms_basic",
    COMMS_ADV: "tech.comms_adv",
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

export const TelemetryIds = {
    // Flight Dynamics
    ALTITUDE: "altitude",
    VELOCITY: "velocity", // {x, y}
    POSITION: "position", // {x, y}
    VERTICAL_SPEED: "verticalSpeed",
    RADAR_ALT: "radarAltitude",
    ORIENTATION: "orientationRad", // Radians
    FORCES: "forces", // {x, y}

    // Orbital
    APOAPSIS: "apAltitude",
    PERIAPSIS: "peAltitude",
    SOI_BODY: "soiBodyId",

    // Physics / Environment
    MASS: "massKg",
    AIR_DENSITY: "airDensity",
    TEMPERATURE: "temperature",

    // Resources
    FUEL: "fuelKg",
    BATTERY: "batteryJoules",
    BATTERY_CAPACITY: "batteryCapacityJoules",
    BATTERY_PERCENT: "batteryPercent",
    SOLAR_INPUT: "solarInputWatts",

    // Systems
    RW_OMEGA: "rwOmegaRadPerS",
    RW_MAX_OMEGA: "rwMaxOmegaRadPerS",
    RW_DESIRED_OMEGA: "rwDesiredOmegaRadPerS", // Debug/Internal

    // Comms
    COMMS_RANGE: "commsRocketRangeMeters",
} as const;

export const SlotIds = {
    // Basic Rocket Template
    BASIC: {
        NOSE: {
            CONE: "slot.nose.cone",
            CPU: "slot.nose.cpu",
            SCI_1: "slot.nose.sci",
            SCI_2: "slot.nose.sci2",
            ANTENNA: "slot.nose.antenna",
            RW: "slot.nose.rw",
            SENSOR: "slot.nose.sensor",
            CHUTE: "slot.nose.chute",
        },
        BODY: {
            TANK: "slot.body.tank",
            BATTERY: "slot.body.battery",
            MED_SCI: "slot.body.msci",
            FIN: "slot.body.fin",
            SOLAR: "slot.body.solar",
        },
        TAIL: {
            ENGINE: "slot.tail.engine",
        }
    }
} as const;
