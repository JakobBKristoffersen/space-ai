import { PartIds } from "./GameIds";
import { PartCategory } from "./PartStore";
import { SmallEngine } from "../simulation/parts/Engine";
import { PrecisionEngine } from "../simulation/parts/PrecisionEngine";
import { VacuumEngine } from "../simulation/parts/VacuumEngine";
import { IonEngine } from "../simulation/parts/IonEngine";
import { SmallFuelTank, MediumFuelTank, LargeFuelTank } from "../simulation/parts/FuelTank";
import { SmallBattery, MediumBattery } from "../simulation/parts/Battery";
import { BasicCPU, AdvancedCPU, OrbitalProcessingUnit } from "../simulation/parts/ProcessingUnit";
import { BasicNavigationSensor, AdvancedNavigationSensor, LidarSensor } from "../simulation/parts/Sensor";
import { SmallReactionWheels } from "../simulation/parts/ReactionWheels";
import { SmallAntenna, MediumAntenna, RelayAntenna, DeepSpaceAntenna } from "../simulation/parts/Antenna";
import { BasicSatellitePayload } from "../simulation/parts/Payloads";
import { BasicSolarPanel } from "../simulation/parts/SolarPanels";
import { NoseCone, Fin, Parachute, HeatShield } from "../simulation/parts/Aerodynamics";
import { TemperatureScanner, AtmosphereScanner, SurfaceScanner, BiosampleContainer } from "../simulation/parts/Science";
import { LandingLegs } from "../simulation/parts/Structure";

export interface PartDefinition {
    id: string;
    name: string;
    category: PartCategory;
    description?: string;
    cost: number; // For future economy
    factory: () => any; // Returns a new instance (Part)
}

export const PartDefinitions: Record<string, PartDefinition> = {
    // Engines
    [PartIds.ENGINE_SMALL]: {
        id: PartIds.ENGINE_SMALL,
        name: "Small Engine",
        category: "engine",
        cost: 100,
        factory: () => new SmallEngine()
    },
    [PartIds.ENGINE_PRECISION]: {
        id: PartIds.ENGINE_PRECISION,
        name: "Precision Engine",
        category: "engine",
        cost: 250,
        factory: () => new PrecisionEngine()
    },
    [PartIds.ENGINE_VACUUM]: {
        id: PartIds.ENGINE_VACUUM,
        name: "Vacuum Engine",
        category: "engine",
        cost: 500,
        factory: () => new VacuumEngine()
    },
    [PartIds.ENGINE_ION]: {
        id: PartIds.ENGINE_ION,
        name: "Ion Thruster",
        category: "engine",
        cost: 1500,
        factory: () => new IonEngine()
    },

    // Fuel Tanks
    [PartIds.FUEL_SMALL]: {
        id: PartIds.FUEL_SMALL,
        name: "Small Fuel Tank",
        category: "fuel",
        cost: 50,
        factory: () => new SmallFuelTank()
    },
    [PartIds.FUEL_MEDIUM]: {
        id: PartIds.FUEL_MEDIUM,
        name: "Medium Fuel Tank",
        category: "fuel",
        cost: 150,
        factory: () => new MediumFuelTank()
    },
    [PartIds.FUEL_LARGE]: {
        id: PartIds.FUEL_LARGE,
        name: "Large Fuel Tank",
        category: "fuel",
        cost: 400,
        factory: () => new LargeFuelTank()
    },

    // Batteries
    [PartIds.BATTERY_SMALL]: {
        id: PartIds.BATTERY_SMALL,
        name: "Small Battery",
        category: "battery",
        cost: 50,
        factory: () => new SmallBattery()
    },
    [PartIds.BATTERY_MEDIUM]: {
        id: PartIds.BATTERY_MEDIUM,
        name: "Medium Battery",
        category: "battery",
        cost: 150,
        factory: () => new MediumBattery()
    },

    // CPUs
    [PartIds.CPU_BASIC]: {
        id: PartIds.CPU_BASIC,
        name: "Basic Guidance System",
        category: "cpu",
        cost: 100,
        factory: () => new BasicCPU()
    },
    [PartIds.CPU_ADVANCED]: {
        id: PartIds.CPU_ADVANCED,
        name: "Advanced Guidance System",
        category: "cpu",
        cost: 500,
        factory: () => new AdvancedCPU()
    },
    [PartIds.CPU_ORBITAL]: {
        id: PartIds.CPU_ORBITAL,
        name: "Orbital Computer",
        category: "cpu",
        cost: 2000,
        factory: () => new OrbitalProcessingUnit()
    },

    // Sensors
    [PartIds.SENSOR_NAV_BASIC]: {
        id: PartIds.SENSOR_NAV_BASIC,
        name: "Basic Navigation Sensor",
        category: "sensor",
        cost: 50,
        factory: () => new BasicNavigationSensor()
    },
    [PartIds.SENSOR_NAV_ADV]: {
        id: PartIds.SENSOR_NAV_ADV,
        name: "Advanced Navigation Sensor",
        category: "sensor",
        cost: 200,
        factory: () => new AdvancedNavigationSensor()
    },
    [PartIds.SENSOR_LIDAR]: {
        id: PartIds.SENSOR_LIDAR,
        name: "Lidar Altimeter",
        category: "sensor",
        cost: 300,
        factory: () => new LidarSensor()
    },

    // Reaction Wheels
    [PartIds.RW_SMALL]: {
        id: PartIds.RW_SMALL,
        name: "Small Reaction Wheels",
        category: "reactionWheels",
        cost: 150,
        factory: () => new SmallReactionWheels()
    },

    // Antennas
    [PartIds.ANTENNA_SMALL]: {
        id: PartIds.ANTENNA_SMALL,
        name: "Small Antenna",
        category: "antenna",
        cost: 50,
        factory: () => new SmallAntenna()
    },
    [PartIds.ANTENNA_MEDIUM]: {
        id: PartIds.ANTENNA_MEDIUM,
        name: "Medium Antenna",
        category: "antenna",
        cost: 150,
        factory: () => new MediumAntenna()
    },
    [PartIds.ANTENNA_RELAY]: {
        id: PartIds.ANTENNA_RELAY,
        name: "Relay Dish",
        category: "antenna",
        cost: 500,
        factory: () => new RelayAntenna()
    },
    [PartIds.ANTENNA_DEEP]: {
        id: PartIds.ANTENNA_DEEP,
        name: "Deep Space Dish",
        category: "antenna",
        cost: 1000,
        factory: () => new DeepSpaceAntenna()
    },

    // Payloads
    [PartIds.PAYLOAD_SAT_BASIC]: {
        id: PartIds.PAYLOAD_SAT_BASIC,
        name: "CubeSat Deployer",
        category: "payload",
        cost: 200,
        factory: () => new BasicSatellitePayload()
    },

    // Solar
    [PartIds.SOLAR_BASIC]: {
        id: PartIds.SOLAR_BASIC,
        name: "Basic Solar Panel",
        category: "solar",
        cost: 100,
        factory: () => new BasicSolarPanel()
    },

    // Aerodynamics
    [PartIds.CONE_BASIC]: {
        id: PartIds.CONE_BASIC,
        name: "Nose Cone",
        category: "cone",
        cost: 50,
        factory: () => ({ ...new NoseCone(), dragModifier: -0.2, heatTolerance: 2400 })
    },
    [PartIds.FIN_BASIC]: {
        id: PartIds.FIN_BASIC,
        name: "Aerodynamic Fin",
        category: "fin",
        cost: 50,
        factory: () => new Fin()
    },
    [PartIds.PARACHUTE_BASIC]: {
        id: PartIds.PARACHUTE_BASIC,
        name: "Parachute",
        category: "parachute",
        cost: 100,
        factory: () => new Parachute()
    },
    [PartIds.HEATSHIELD_BASIC]: {
        id: PartIds.HEATSHIELD_BASIC,
        name: "Heat Shield",
        category: "heatShield",
        cost: 100,
        factory: () => ({ ...new HeatShield(), heatTolerance: 3400 })
    },

    // Science
    [PartIds.SCIENCE_TEMP]: {
        id: PartIds.SCIENCE_TEMP,
        name: "Temperature Scanner",
        category: "science",
        cost: 100,
        factory: () => new TemperatureScanner()
    },
    [PartIds.SCIENCE_ATMOS]: {
        id: PartIds.SCIENCE_ATMOS,
        name: "Atmosphere Scanner",
        category: "science",
        cost: 150,
        factory: () => new AtmosphereScanner()
    },
    [PartIds.SCIENCE_SURFACE]: {
        id: PartIds.SCIENCE_SURFACE,
        name: "Surface Scanner",
        category: "science",
        cost: 200,
        factory: () => new SurfaceScanner()
    },
    [PartIds.SCIENCE_BIO]: {
        id: PartIds.SCIENCE_BIO,
        name: "Biosample Container",
        category: "science_large",
        cost: 400,
        factory: () => new BiosampleContainer()
    },

    // Structure
    [PartIds.LEG_LANDING_FIXED]: {
        id: PartIds.LEG_LANDING_FIXED,
        name: "Landing Legs",
        category: "structure",
        cost: 100,
        factory: () => new LandingLegs()
    }
};
