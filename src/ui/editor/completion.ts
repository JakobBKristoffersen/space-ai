import type { Completion, CompletionSource, CompletionContext } from "@codemirror/autocomplete";

// RocketAPI methods shown after typing `api.`
export const rocketApiMethodCompletions: Completion[] = [
  { label: "getSnapshot", type: "function", detail: "RocketAPI", apply: "getSnapshot()" },
  { label: "setEnginePower", type: "function", detail: "RocketAPI", apply: "setEnginePower(1)" },
  // Kept for compatibility (the preferred API is setTurnRate)
  { label: "turnLeft", type: "function", detail: "RocketAPI", apply: "turnLeft(0.001)" },
  { label: "turnRight", type: "function", detail: "RocketAPI", apply: "turnRight(0.001)" },
  { label: "log", type: "function", detail: "RocketAPI", apply: "log(\"hello\")" },
];

function makeTelemetryCompletions(keys?: string[]): Completion[] {
  return (keys ?? []).slice().sort().map(k => ({ label: k, type: "property", detail: "telemetry" }));
}

/**
 * Completion source that suggests RocketAPI methods and dynamic telemetry keys.
 * - After `api.` → RocketAPI methods
 * - After `api.getSnapshot().data.` or `snap.` → telemetry keys
 */
export function makeRocketApiCompletionSource(telemetryKeys?: string[]): CompletionSource {
  return (ctx: CompletionContext) => {
    const { state, pos } = ctx;
    const line = state.doc.lineAt(pos);
    const before = line.text.slice(0, pos - line.from);

    const apiDot = /(?:^|[\s\(\[,;])api\.([\w$]*)$/;
    const mApi = before.match(apiDot);
    if (mApi) {
      const typed = mApi[1] ?? "";
      const from = pos - typed.length;
      return { from, options: rocketApiMethodCompletions, validFor: /[\w$]*/ };
    }

    const dataDot = /(?:api\.getSnapshot\(\)\.data|snap)\.([\w$]*)$/;
    const mData = before.match(dataDot);
    if (mData) {
      const typed = mData[1] ?? "";
      const from = pos - typed.length;
      return { from, options: makeTelemetryCompletions(telemetryKeys), validFor: /[\w$]*/ };
    }

    return null;
  };
}
