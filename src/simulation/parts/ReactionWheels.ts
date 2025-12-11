/**
 * Reaction wheels parts provide attitude control by consuming battery energy.
 */
import type { ReactionWheelsPart } from "../Rocket";

export class SmallReactionWheels implements ReactionWheelsPart {
  readonly id = "rw.small";
  readonly name = "Small Reaction Wheels";
  readonly massKg = 5;
  /** Max sustainable angular velocity this unit can provide (rad/s) */
  readonly maxOmegaRadPerS = 0.5;
  /** Energy cost per (rad/s) per second. Example: 40 J/s at 1 rad/s. */
  readonly energyPerRadPerS = 40;
  readonly exposes = ["rwOmegaRadPerS", "rwMaxOmegaRadPerS", "rwDesiredOmegaRadPerS"];
}
