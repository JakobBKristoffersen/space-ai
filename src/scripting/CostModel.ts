/**
 * Cost model defines the processing cost of Rocket API operations.
 * Scripting layer uses this to enforce per-tick CPU budgets.
 */

export interface CostModel {
  readonly getSnapshotBase: number; // cost to get a snapshot
  readonly setEnginePower: number;
  readonly turn: number; // for left/right
  // Memory ops
  readonly memoryGet: number;
  readonly memorySet: number;
  readonly memoryRemove: number;
  readonly memoryClear: number;
  // Logging
  readonly log: number;
  // Assist / Helpers
  readonly assistBase: number;
}

export const DefaultCostModel: CostModel = {
  getSnapshotBase: 1,
  setEnginePower: 10,
  turn: 8,
  memoryGet: 1,
  memorySet: 3,
  memoryRemove: 3,
  memoryClear: 3,
  log: 1,
  assistBase: 2,
};
