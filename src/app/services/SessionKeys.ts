export const SessionKeys = {
  SCRIPT: "session:user-script",
  LAYOUT: "session:rocket-layout",
  SCRIPTS: "session:scripts",
  CPU_SLOTS: "session:cpuSlots",
  CURRENT_SCRIPT_NAME: "session:current-script-name",
} as const;

export type SessionKey = typeof SessionKeys[keyof typeof SessionKeys];
