/**
 * ScriptRunner coordinates Sandbox + RocketAPI per simulation tick.
 * - Builds the API and command queue around the provided Rocket.
 * - Compiles user code respecting the installed CPU part limits.
 * - On each tick, runs the script within budget and drains battery.
 *
 * This module has no rendering or physics; it only orchestrates scripting.
 */
import { Rocket, SimpleQueue } from "../simulation/Rocket";
import { RocketAPI } from "./RocketAPI";
import { CompiledScript, Sandbox, SandboxOptions } from "./Sandbox";

export interface ScriptRunnerOptions {
  /** Optional wall-clock limit per tick execution for the sandbox. */
  timeLimitMs?: number;
}

export class ScriptRunner {
  // Per-CPU script slots (resize when CPU changes)
  private slots: { compiled: CompiledScript | null; name: string; enabled: boolean; logs: string[] }[] = [];
  private readonly queue = new SimpleQueue();
  private readonly api: RocketAPI;
  private readonly sandbox = new Sandbox();
  // Accumulates elapsed seconds since last script execution (for CPU interval gating)
  private elapsedSinceRunS = 0;

  constructor(private readonly rocket: Rocket) {
    this.api = new RocketAPI(rocket, this.queue, {});
    this.resizeSlots();
  }

  private resizeSlots() {
    const count = this.rocket.cpu?.scriptSlots ?? 1;
    if (this.slots.length === count) return;
    const next: typeof this.slots = [];
    for (let i = 0; i < count; i++) {
      next[i] = this.slots[i] ?? { compiled: null, name: `Slot ${i+1}`, enabled: i === 0, logs: [] };
    }
    this.slots = next;
  }

  /** Install script into a specific slot (default 0) */
  installScriptToSlot(userCode: string, opts?: ScriptRunnerOptions, slotIndex = 0, name?: string): void {
    const cpu = this.rocket.cpu;
    if (!cpu) throw new Error("No CPU installed on rocket");
    this.resizeSlots();
    const idx = Math.max(0, Math.min(slotIndex, this.slots.length - 1));

    const sbOpts: SandboxOptions = {
      maxChars: cpu.maxScriptChars,
      budgetPerTick: cpu.processingBudgetPerTick,
      energyPerTickJ: cpu.energyPerTickJ,
      timeLimitMs: opts?.timeLimitMs ?? 8,
    };
    const compiled = this.sandbox.compile(userCode, sbOpts);
    this.slots[idx].compiled = compiled;
    if (name) this.slots[idx].name = name;
  }

  /** Back-compat: install into slot 0 */
  installScript(userCode: string, opts?: ScriptRunnerOptions): void {
    this.installScriptToSlot(userCode, opts, 0);
  }

  setSlotEnabled(slotIndex: number, enabled: boolean): void {
    this.resizeSlots();
    if (!this.slots[slotIndex]) return;
    this.slots[slotIndex].enabled = enabled;
  }

  getSlotInfo(): { name: string; enabled: boolean; hasScript: boolean; logs: readonly string[] }[] {
    this.resizeSlots();
    return this.slots.map(s => ({ name: s.name, enabled: s.enabled, hasScript: !!s.compiled, logs: s.logs }));
  }

  appendLog(slotIndex: number, msg: string): void {
    const slot = this.slots[slotIndex];
    if (!slot) return;
    slot.logs.push(msg);
    if (slot.logs.length > 200) slot.logs.splice(0, slot.logs.length - 200);
  }

  /** Clear logs for a specific slot (UI convenience). */
  clearSlotLogs(slotIndex: number): void {
    this.resizeSlots();
    const slot = this.slots[slotIndex];
    if (!slot) return;
    if (slot.logs.length) slot.logs.length = 0;
  }

  /** Clear logs for all slots. */
  clearAllLogs(): void {
    this.resizeSlots();
    for (const s of this.slots) if (s.logs.length) s.logs.length = 0;
  }

  /**
   * Runs scripts according to the CPU processing interval.
   * Accumulates dt and executes only when the interval elapses.
   * Returns the command queue to be applied by the environment.
   */
  runTick(dt: number, opts?: ScriptRunnerOptions): SimpleQueue {
    const cpu = this.rocket.cpu;
    if (!cpu) return this.queue; // nothing to run
    this.resizeSlots();

    const interval = cpu.processingIntervalSeconds ?? 0;
    if (interval > 0) {
      this.elapsedSinceRunS += Math.max(0, dt || 0);
      if (this.elapsedSinceRunS + 1e-9 < interval) {
        // Not time yet: no scripts run this engine tick
        (this.rocket as any)._cpuSlotCount = this.slots.length;
        (this.rocket as any)._cpuScriptsRunning = 0;
        (this.rocket as any)._cpuEnergyUsedLastTick = 0;
        (this.rocket as any)._cpuCostUsedLastTick = 0;
        (this.rocket as any)._cpuNextRunInSeconds = Math.max(0, interval - this.elapsedSinceRunS);
        return this.queue;
      }
      // Time to run once; carry over any remainder to preserve cadence
      this.elapsedSinceRunS = Math.max(0, this.elapsedSinceRunS - interval);
    } else {
      // Run every tick; no wait
      (this.rocket as any)._cpuNextRunInSeconds = 0;
    }

    const timeLimit = opts?.timeLimitMs ?? 8;

    let scriptsRan = 0;
    let totalEnergy = 0;
    let totalCost = 0;

    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (!slot.enabled || !slot.compiled) continue;

      const sbOpts: SandboxOptions = {
        maxChars: cpu.maxScriptChars,
        budgetPerTick: cpu.processingBudgetPerTick,
        energyPerTickJ: cpu.energyPerTickJ,
        timeLimitMs: timeLimit,
      };

      try {
        // Provide api logging for this slot via a lightweight hook
        (this.api as any)._setLogger?.((m: string) => this.appendLog(i, m));
        const beforeBudget = cpu.processingBudgetPerTick;
        const ok = this.sandbox.runTick(slot.compiled, this.rocket, this.api, sbOpts);
        if (ok) {
          scriptsRan++;
          totalEnergy += cpu.energyPerTickJ;
          // We cannot read remaining budget directly here; instead, SimpleTickBudget is internal to Sandbox.
          // Approximate cost as full budget for now; can be refined by returning remaining from Sandbox.
          totalCost += beforeBudget; 
        }
      } catch (e: any) {
        this.appendLog(i, `Error: ${e?.message ?? String(e)}`);
      }
    }

    // Update CPU runtime fields for snapshot (if used by UI)
    (this.rocket as any)._cpuSlotCount = this.slots.length;
    (this.rocket as any)._cpuScriptsRunning = scriptsRan;
    (this.rocket as any)._cpuEnergyUsedLastTick = totalEnergy;
    (this.rocket as any)._cpuCostUsedLastTick = totalCost;
    // Compute next-run ETA after executing (or immediately for run-every-tick)
    const _interval = this.rocket.cpu?.processingIntervalSeconds ?? 0;
    (this.rocket as any)._cpuNextRunInSeconds = _interval > 0 ? Math.max(0, _interval - this.elapsedSinceRunS) : 0;

    return this.queue;
  }
}
