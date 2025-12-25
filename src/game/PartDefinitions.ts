import { PartIds } from "./GameIds";
import { PartCategory } from "./PartStore";
import { SmallEngine, SmallEngineV2, PrecisionEngine, VacuumEngine, IonEngine } from "../simulation/parts/Engines";
import { SmallFuelTank, MediumFuelTank, LargeFuelTank } from "../simulation/parts/FuelTanks";
import { SmallBattery, MediumBattery, BasicSolarPanel } from "../simulation/parts/Power";
import { BasicCPU, AdvancedCPU, OrbitalProcessingUnit, BasicNavigationSensor, AdvancedNavigationSensor, LidarSensor, SmallReactionWheels, SmallAntenna, MediumAntenna, RelayAntenna, DeepSpaceAntenna } from "../simulation/parts/Avionics";
import { NoseCone, Fin, Parachute, HeatShield, LandingLegs, BasicSatellitePayload } from "../simulation/parts/Structure";
import { TemperatureScanner, AtmosphereScanner, SurfaceScanner, BiosampleContainer } from "../simulation/parts/Science";

export interface PartDefinition {
    id: string;
    name: string;
    category: PartCategory;
    description?: string;
    // cost: number; // Removed as per RP-only economy
    factory: () => any; // Returns a new instance (Part)
}

export const PartDefinitions: Record<string, PartDefinition> = {
    // Engines
    [PartIds.ENGINE_SMALL]: {
        id: PartIds.ENGINE_SMALL,
        name: "Small Engine",
        category: "engine",
        factory: () => new SmallEngine()
    },
    [PartIds.ENGINE_SMALL_V2]: {
        id: PartIds.ENGINE_SMALL_V2,
        name: "Small Engine V2",
        category: "engine",
        factory: () => new SmallEngineV2()
    },
    [PartIds.ENGINE_PRECISION]: {
        id: PartIds.ENGINE_PRECISION,
        name: "Precision Engine",
        category: "engine",
        factory: () => new PrecisionEngine()
    },
    [PartIds.ENGINE_VACUUM]: {
        id: PartIds.ENGINE_VACUUM,
        name: "Vacuum Engine",
        category: "engine",
        factory: () => new VacuumEngine()
    },
    [PartIds.ENGINE_ION]: {
        id: PartIds.ENGINE_ION,
        name: "Ion Thruster",
        category: "engine",
        factory: () => new IonEngine()
    },

    // Fuel Tanks
    [PartIds.FUEL_SMALL]: {
        id: PartIds.FUEL_SMALL,
        name: "Small Fuel Tank",
        category: "fuel",
        factory: () => new SmallFuelTank()
    },
    [PartIds.FUEL_MEDIUM]: {
        id: PartIds.FUEL_MEDIUM,
        name: "Medium Fuel Tank",
        category: "fuel",
        factory: () => new MediumFuelTank()
    },
    [PartIds.FUEL_LARGE]: {
        id: PartIds.FUEL_LARGE,
        name: "Large Fuel Tank",
        category: "fuel",
        factory: () => new LargeFuelTank()
    },

    // Batteries
    [PartIds.BATTERY_SMALL]: {
        id: PartIds.BATTERY_SMALL,
        name: "Small Battery",
        category: "battery",
        factory: () => new SmallBattery()
    },
    [PartIds.BATTERY_MEDIUM]: {
        id: PartIds.BATTERY_MEDIUM,
        name: "Medium Battery",
        category: "battery",
        factory: () => new MediumBattery()
    },

    // CPUs
    [PartIds.CPU_BASIC]: {
        id: PartIds.CPU_BASIC,
        name: "Basic Guidance System",
        category: "cpu",
        factory: () => new BasicCPU()
    },
    [PartIds.CPU_ADVANCED]: {
        id: PartIds.CPU_ADVANCED,
        name: "Advanced Guidance System",
        category: "cpu",
        factory: () => new AdvancedCPU()
    },
    [PartIds.CPU_ORBITAL]: {
        id: PartIds.CPU_ORBITAL,
        name: "Orbital Computer",
        category: "cpu",
        factory: () => new OrbitalProcessingUnit()
    },

    // Sensors
    [PartIds.SENSOR_NAV_BASIC]: {
        id: PartIds.SENSOR_NAV_BASIC,
        name: "Basic Navigation Sensor",
        category: "sensor",
        factory: () => new BasicNavigationSensor()
    },
    [PartIds.SENSOR_NAV_ADV]: {
        id: PartIds.SENSOR_NAV_ADV,
        name: "Advanced Navigation Sensor",
        category: "sensor",
        factory: () => new AdvancedNavigationSensor()
    },
    [PartIds.SENSOR_LIDAR]: {
        id: PartIds.SENSOR_LIDAR,
        name: "Lidar Altimeter",
        category: "sensor",
        factory: () => new LidarSensor()
    },

    // Reaction Wheels
    [PartIds.RW_SMALL]: {
        id: PartIds.RW_SMALL,
        name: "Small Reaction Wheels",
        category: "reactionWheels",
        factory: () => new SmallReactionWheels()
    },

    // Antennas
    [PartIds.ANTENNA_SMALL]: {
        id: PartIds.ANTENNA_SMALL,
        name: "Small Antenna",
        category: "antenna",
        factory: () => new SmallAntenna()
    },
    [PartIds.ANTENNA_MEDIUM]: {
        id: PartIds.ANTENNA_MEDIUM,
        name: "Medium Antenna",
        category: "antenna",
        factory: () => new MediumAntenna()
    },
    [PartIds.ANTENNA_RELAY]: {
        id: PartIds.ANTENNA_RELAY,
        name: "Relay Dish",
        category: "antenna",
        factory: () => new RelayAntenna()
    },
    [PartIds.ANTENNA_DEEP]: {
        id: PartIds.ANTENNA_DEEP,
        name: "Deep Space Dish",
        category: "antenna",
        factory: () => new DeepSpaceAntenna()
    },

    // Payloads
    [PartIds.PAYLOAD_SAT_BASIC]: {
        id: PartIds.PAYLOAD_SAT_BASIC,
        name: "CubeSat Deployer",
        category: "payload",
        factory: () => new BasicSatellitePayload()
    },

    // Solar
    [PartIds.SOLAR_BASIC]: {
        id: PartIds.SOLAR_BASIC,
        name: "Basic Solar Panel",
        category: "solar",
        factory: () => new BasicSolarPanel()
    },

    // Aerodynamics
    [PartIds.CONE_BASIC]: {
        id: PartIds.CONE_BASIC,
        name: "Nose Cone",
        category: "cone",
        factory: () => ({ ...new NoseCone(), dragModifier: -0.2, heatTolerance: 2400 })
    },
    [PartIds.FIN_BASIC]: {
        id: PartIds.FIN_BASIC,
        name: "Aerodynamic Fin",
        category: "fin",
        factory: () => new Fin()
    },
    [PartIds.PARACHUTE_BASIC]: {
        id: PartIds.PARACHUTE_BASIC,
        name: "Parachute",
        category: "parachute",
        factory: () => new Parachute()
    },
    [PartIds.HEATSHIELD_BASIC]: {
        id: PartIds.HEATSHIELD_BASIC,
        name: "Heat Shield",
        category: "heatShield",
        factory: () => ({ ...new HeatShield(), heatTolerance: 3400 })
    },

    // Science
    [PartIds.SCIENCE_TEMP]: {
        id: PartIds.SCIENCE_TEMP,
        name: "Temperature Scanner",
        category: "science",
        factory: () => new TemperatureScanner()
    },
    [PartIds.SCIENCE_ATMOS]: {
        id: PartIds.SCIENCE_ATMOS,
        name: "Atmosphere Scanner",
        category: "science",
        factory: () => new AtmosphereScanner()
    },
    [PartIds.SCIENCE_SURFACE]: {
        id: PartIds.SCIENCE_SURFACE,
        name: "Surface Scanner",
        category: "science",
        factory: () => new SurfaceScanner()
    },
    [PartIds.SCIENCE_BIO]: {
        id: PartIds.SCIENCE_BIO,
        name: "Biosample Container",
        category: "science_large",
        factory: () => new BiosampleContainer()
    },

    // Structure
    [PartIds.LEG_LANDING_FIXED]: {
        id: PartIds.LEG_LANDING_FIXED,
        name: "Landing Legs",
        category: "structure",
        factory: () => new LandingLegs()
    }
};
