import { PartCategory } from "./PartStore";

export interface RocketSlot {
    id: string;
    name: string;
    allowedCategories: PartCategory[];
    isMultiple?: boolean; // Can hold multiple parts of this category? (Simplification: for now, 1 part per slot usually, unless 'body' allows stacking?)
    // For VAB simplicity, let's say 1 part per slot ID. If we want 2 fuel tanks, we have 2 slots.
}

export interface RocketStage {
    id: string;
    name: string;
    slots: RocketSlot[];
}

export interface RocketTemplate {
    id: string;
    name: string;
    description: string;
    stages: RocketStage[];
    unlockTech?: string;
    price: number; // Cost to unlock the chassis/template itself? Or free if researched? Let's say free if researched.
}

export const ROCKET_TEMPLATES: (RocketTemplate & { tier: number })[] = [
    {
        id: "template.basic",
        name: "Basic Rocket",
        description: "A simple single-stage sounding rocket.",
        price: 0,
        tier: 1,
        stages: [
            {
                id: "stage.upper",
                name: "Upper Stage",
                slots: [
                    // Nose
                    { id: "slot.nose.cone", name: "Nose Cone", allowedCategories: ["cone"] },
                    { id: "slot.nose.cpu", name: "Guidance System", allowedCategories: ["cpu"] },
                    { id: "slot.nose.sci", name: "Science Exp 1", allowedCategories: ["science"] },
                    { id: "slot.nose.sci2", name: "Science Exp 2", allowedCategories: ["science"] },
                    { id: "slot.nose.antenna", name: "Antenna", allowedCategories: ["antenna"] },
                    { id: "slot.nose.rw", name: "Reaction Wheels", allowedCategories: ["reactionWheels"] },
                    { id: "slot.nose.sensor", name: "Sensor", allowedCategories: ["sensor"] },
                    { id: "slot.nose.chute", name: "Parachute", allowedCategories: ["parachute"] },
                    // Body
                    { id: "slot.body.tank", name: "Fuel Tank", allowedCategories: ["fuel"] },
                    { id: "slot.body.battery", name: "Battery", allowedCategories: ["battery"] },
                    { id: "slot.body.msci", name: "Medium Science", allowedCategories: ["science_large"] },
                    { id: "slot.body.fin", name: "Fins", allowedCategories: ["fin"] },
                    { id: "slot.body.solar", name: "Solar Panel", allowedCategories: ["solar"] },
                    // Tail
                    { id: "slot.tail.engine", name: "Engine", allowedCategories: ["engine"] },
                ]
            }
        ]
    },
    {
        id: "template.tier2",
        name: "Tier 2 Rocket",
        description: "Two-stage orbital capability.",
        price: 1000,
        unlockTech: "tech.rocketry_2",
        tier: 2,
        stages: [
            {
                id: "stage.upper",
                name: "Upper Stage",
                slots: [
                    { id: "slot.u.nose.cone", name: "Nose Cone", allowedCategories: ["cone"] },
                    { id: "slot.u.nose.cpu", name: "Guidance", allowedCategories: ["cpu"] },
                    { id: "slot.u.nose.sensor", name: "Sensor", allowedCategories: ["sensor"] },
                    { id: "slot.u.nose.batt", name: "Battery", allowedCategories: ["battery"] },
                    { id: "slot.u.nose.sci1", name: "Science 1", allowedCategories: ["science"] },
                    { id: "slot.u.nose.sci2", name: "Science 2", allowedCategories: ["science"] },
                    { id: "slot.u.nose.chute", name: "Parachute", allowedCategories: ["parachute"] },
                    { id: "slot.u.body.tank", name: "Fuel Tank", allowedCategories: ["fuel"] },
                    { id: "slot.u.body.rw", name: "Reaction Wheel", allowedCategories: ["reactionWheels"] },
                    { id: "slot.u.body.fin", name: "Fins", allowedCategories: ["fin"] },
                    { id: "slot.u.body.solar", name: "Solar Panel", allowedCategories: ["solar"] },
                    { id: "slot.u.tail.engine", name: "Engine", allowedCategories: ["engine"] },
                ]
            },
            {
                id: "stage.lower",
                name: "Lower Stage",
                slots: [
                    { id: "slot.l.body.tank", name: "Fuel Tank", allowedCategories: ["fuel"] },
                    { id: "slot.l.body.fin", name: "Fins", allowedCategories: ["fin"] },
                    { id: "slot.l.tail.engine", name: "Engine", allowedCategories: ["engine"] },
                ]
            }
        ]
    },
    {
        id: "template.tier3",
        name: "Tier 3 Heavy",
        description: "Three-stage heavy lifter.",
        price: 5000,
        unlockTech: "tech.rocketry_3",
        tier: 3,
        stages: [
            {
                id: "stage.upper",
                name: "Upper Stage",
                slots: [
                    { id: "slot.u.cone", name: "Nose Cone", allowedCategories: ["cone"] },
                    { id: "slot.u.cpu", name: "Guidance", allowedCategories: ["cpu"] },
                    { id: "slot.u.sensor", name: "Sensor", allowedCategories: ["sensor"] },
                    { id: "slot.u.batt", name: "Battery", allowedCategories: ["battery"] },
                    { id: "slot.u.sci1", name: "Science 1", allowedCategories: ["science"] },
                    { id: "slot.u.sci2", name: "Science 2", allowedCategories: ["science"] },
                    { id: "slot.u.ant", name: "Antenna", allowedCategories: ["antenna"] },
                    { id: "slot.u.chute", name: "Parachute", allowedCategories: ["parachute"] },
                    { id: "slot.u.tank1", name: "Fuel Tank 1", allowedCategories: ["fuel"] },
                    { id: "slot.u.tank2", name: "Fuel Tank 2", allowedCategories: ["fuel"] },
                    { id: "slot.u.rw", name: "Reaction Wheel", allowedCategories: ["reactionWheels"] },
                    { id: "slot.u.fin", name: "Fins", allowedCategories: ["fin"] },
                    { id: "slot.u.lsci", name: "Large Sci", allowedCategories: ["science"] }, // Assuming science category covers large too
                    { id: "slot.u.sol1", name: "Solar 1", allowedCategories: ["solar"] },
                    { id: "slot.u.sol2", name: "Solar 2", allowedCategories: ["solar"] },
                    { id: "slot.u.shield", name: "Heat Shield", allowedCategories: ["heatShield"] },
                ]
            },
            {
                id: "stage.mid",
                name: "Mid Stage",
                slots: [
                    { id: "slot.m.tank1", name: "Fuel Tank 1", allowedCategories: ["fuel"] },
                    { id: "slot.m.tank2", name: "Fuel Tank 2", allowedCategories: ["fuel"] },
                    { id: "slot.m.fin", name: "Fins", allowedCategories: ["fin"] },
                    { id: "slot.m.engine", name: "Engine", allowedCategories: ["engine"] },
                ]
            },
            {
                id: "stage.lower",
                name: "Lower Stage",
                slots: [
                    { id: "slot.l.tank1", name: "Fuel Tank 1", allowedCategories: ["fuel"] },
                    { id: "slot.l.tank2", name: "Fuel Tank 2", allowedCategories: ["fuel"] },
                    { id: "slot.l.fin", name: "Fins", allowedCategories: ["fin"] },
                    { id: "slot.l.engine", name: "Engine", allowedCategories: ["engine"] },
                ]
            }
        ]
    }
];
