// Re-export key types and interfaces from Rocket.ts.
// This file is a stepping stone for Phase C of the refactor plan,
// allowing future modules to import types from a stable location
// without changing behavior. No runtime code is introduced here.

export type { Vec2, RocketState, RocketSnapshot, RocketCommand, RocketCommandQueue } from "./Rocket";
export type { EnginePart, FuelTankPart, BatteryPart, ProcessingUnitPart, SensorPart, ReactionWheelsPart, AntennaPart } from "./Rocket";
