// Default example user script used to seed the session Scripts Library.
// Keep this in sync with the current RocketAPI and telemetry fields.

export const DEFAULT_EXAMPLE = `// Orbit insertion autopilot using Apoapsis/Periapsis
// Goal: Raise Apoapsis (Ap) to ~2000 m, coast to Ap, then burn prograde until Periapsis (Pe) reaches ~2000 m (±10%).
// API: const s = api.getSnapshot().data; fields used: altitude, velocity{x,y}, orientationRad, apAltitude, peAltitude, fuelKg, airDensity
// Controls: api.setEnginePower(0|1); api.setTurnRate(rateRadPerS) where positive turns right/clockwise; pass 0 to stop turning.
function update(api) {
  const PHASES = ["liftoff","raise_ap","coast_to_ap","circularize","done"];
  // Show all phases once
  if (!api.memory.get("__phasesListed")) {
    api.log("Phases: " + PHASES.join(" -> "));
    api.memory.set("__phasesListed", 1);
  }

  // --- Telemetry Ping ---
  // Send a packet every 2 seconds if valid
  const lastPing = Number(api.memory.get("__lastPing") || 0);
  const now = Date.now();
  if (now - lastPing > 2000) {
    // Check if we can send (e.g. valid tiers?), but api.sendDataPacket checks internally or just charges
    api.sendDataPacket("telemetry", 2, { alt: Math.floor(Number(api.getSnapshot().data.altitude||0)), phase: api.memory.get("phase") });
    api.memory.set("__lastPing", now);
  }
  // ---------------------

  // --- Telemetry Ping ---
  // Send a packet every 2 seconds if valid
  const lastPing = Number(api.memory.get("__lastPing") || 0);
  const now = Date.now();
  if (now - lastPing > 2000) {
    // Check if we can send (e.g. valid tiers?); api.sendDataPacket checks internally or just charges
    api.sendDataPacket("telemetry", 2, { alt: Math.floor(Number(api.getSnapshot().data.altitude||0)), phase: api.memory.get("phase") });
    api.memory.set("__lastPing", now);
  }

  const s = api.getSnapshot().data;
  const alt = Number(s.altitude ?? 0);
  const v = s.velocity || { x: 0, y: 0 };
  const vx = Number(v.x || 0), vy = Number(v.y || 0);
  const fuel = Number(s.fuelKg ?? 0);
  const ap = Number(s.apAltitude ?? NaN);
  const pe = Number(s.peAltitude ?? NaN);
  const orient = Number(s.orientationRad ?? 0);

  // Parameters
  const targetAp = 2000;    // m
  const targetPe = 2000;    // m (±10% acceptable)
  const peOkLow = targetPe * 0.9;
  const peOkHigh = targetPe * 1.1;
  const alignRate = 0.25;   // rad/s turn rate to command
  const alignTol = 0.05;    // rad (~1.7°)

  // Persistent phase (ensure first one is logged)
  const storedPhase = api.memory.get("phase");
  let phase = (typeof storedPhase === "string" && storedPhase) ? storedPhase : "liftoff";
  if (storedPhase !== phase) { api.memory.set("phase", phase); api.log("Phase → " + phase); }
  function setPhase(p) { if (p !== phase) { phase = p; api.memory.set("phase", p); api.memory.set("__lastProgressBucket", -1); api.log("Phase → " + p); } }

  // Helpers
  function clamp01(x){ return Math.max(0, Math.min(1, x)); }
  function angleWrap(a) { const TWO = Math.PI * 2; let x = a % TWO; if (x < 0) x += TWO; return x; }
  function angDiff(a, b) { // shortest signed difference a - b in [-pi, pi]
    let d = angleWrap(a) - angleWrap(b);
    if (d > Math.PI) d -= 2*Math.PI; else if (d < -Math.PI) d += 2*Math.PI; return d;
  }
  function progradeAngle() { return Math.atan2(vy, vx); }
  function alignTo(targetAngle) {
    const err = angDiff(targetAngle, orient);
    if (Math.abs(err) <= alignTol) { api.setTurnRate(0); return true; }
    api.setTurnRate(err > 0 ? +alignRate : -alignRate);
    return false;
  }
  function reportProgress(label, p){
    p = clamp01(p);
    const lastPhase = api.memory.get("__progressPhase") || "";
    let lastBucket = Number(api.memory.get("__lastProgressBucket") ?? -1);
    const bucket = Math.floor(p * 10); // 0..10
    if (phase !== lastPhase || bucket > lastBucket) {
      api.log(label + ": " + Math.round(p*100) + "%");
      api.memory.set("__progressPhase", phase);
      api.memory.set("__lastProgressBucket", bucket);
    }
  }

  // Safety
  if (fuel <= 0) { api.setEnginePower(0); api.setTurnRate(0); return; }

  // Track last altitude for apoapsis detection during coast
  const prevAlt = Number(api.memory.get("prevAlt") ?? alt);
  api.memory.set("prevAlt", alt);

  if (phase === "liftoff") {
    // New liftoff phase: ascend vertically until air density halves, then start turning.
    const rho = Number(s.airDensity ?? NaN);
    let rho0 = Number(api.memory.get("rho0") ?? NaN);
    if (!isFinite(rho0) && isFinite(rho)) { rho0 = rho; api.memory.set("rho0", rho0); }
    // Align to local vertical (outward normal): orientation should be pi/2 at launch; keep correcting just in case.
    const upAngle = Math.PI / 2;
    alignTo(upAngle);
    api.setEnginePower(1);
    if (isFinite(rho0) && isFinite(rho)) {
      const target = 0.5 * rho0;
      const p = clamp01(1 - (rho - target) / Math.max(1e-6, rho0 - target));
      reportProgress("Liftoff", p);
      if (rho <= target) {
        setPhase("raise_ap");
      }
    }
  } else if (phase === "raise_ap") {
    // Gravity turn: gradually tilt from vertical to build horizontal velocity,
    // then follow prograde as it approaches the horizon. This avoids staying vertical forever.
    const upAngle = Math.PI / 2;
    let tilt = Number(api.memory.get("tilt") ?? 0);
    const maxTilt = Math.PI * 0.45; // ~81° from +X i.e., slightly below horizontal in screen terms
    // Increase tilt a bit every script run (runner interval ~2s on basic guidance)
    tilt = Math.min(maxTilt, tilt + 0.12);
    api.memory.set("tilt", tilt);

    // Desired attitude: start from up and subtract tilt (turn right toward +X)
    const desired = upAngle - tilt;

    // Once horizontal speed is significant, hand over to prograde alignment (avoid early vertical lock)
    const vhor = Math.abs(vx);
    const usePrograde = vhor > 20; // m/s horizontal threshold

    // Diagnostics to understand why we might not be turning
    try {
      const errDeg = (angDiff(usePrograde ? progradeAngle() : desired, orient) * 180) / Math.PI;
      const desRW = Number(s.rwDesiredOmegaRadPerS ?? NaN);
      const actRW = Number(s.rwOmegaRadPerS ?? NaN);
      api.log("[raise_ap] tilt=" + tilt.toFixed(2) + " rad, aim=" + (usePrograde ? "prograde" : "gravity-turn") + " orientDeg=" + ((orient*180)/Math.PI).toFixed(1) + ", errDeg=" + errDeg.toFixed(1) + ", vhor=" + vhor.toFixed(1) + " m/s, desRW=" + (isFinite(desRW)? desRW.toFixed(3) : "-") + " rad/s, actRW=" + (isFinite(actRW)? actRW.toFixed(3) : "-") + " rad/s");
    } catch {}

    if (usePrograde) {
      // Align to prograde when we have meaningful horizontal speed
      const aim = progradeAngle();
      const aligned = alignTo(aim);
      try { api.log("[raise_ap] prograde align aligned=" + (aligned ? "true" : "false")); } catch {}
    } else {
      // During the gravity-turn phase, command a steady rightward turn rate so we visibly tip over
      api.setTurnRate(-alignRate); // negative = left (CCW) in our convention toward +X when starting at +Y
      try { api.log("[raise_ap] gravity-turn cmdRate=" + (-alignRate).toFixed(2) + " rad/s"); } catch {}
    }

    api.setEnginePower(1);
    if (isFinite(ap) && isFinite(targetAp)) {
      reportProgress("Raise Ap", clamp01(ap / targetAp));
    }
    if (isFinite(ap) && ap >= targetAp * 0.98) { // reached ~target Ap
      api.setEnginePower(0);
      api.setTurnRate(0); // stop any residual rotation
      setPhase("coast_to_ap");
    }
  } else if (phase === "coast_to_ap") {
    // Engines off; wait until we reach (or are very near) apoapsis
    api.setEnginePower(0);
    api.setTurnRate(0);
    if (isFinite(ap)) {
      const close = Math.abs(ap - alt) < 50; // within 25 m of Ap
      const passedPeak = prevAlt > alt && alt > ap * 0.9; // started descending near Ap
      const p = clamp01(1 - Math.abs(ap - alt) / Math.max(1, ap));
      reportProgress("Coast to Ap", p);
      if (close || passedPeak) {
        setPhase("circularize");
      }
    }
  } else if (phase === "circularize") {
    // At/near Ap: burn prograde to raise Periapsis to target band
    const aim = progradeAngle();
    const aligned = alignTo(aim);
    
    api.log('close to prograde burning to Pe and mainting prograde')
    api.setEnginePower(1);  
    
    if (isFinite(pe) && isFinite(targetPe)) {
      reportProgress("Circularize (raise Pe)", clamp01(pe / targetPe));
    }
    if (isFinite(pe) && pe >= peOkLow) {
      api.setEnginePower(0);
      api.setTurnRate(0);
      setPhase("done");
    }
  } else if (phase === "done") {
    api.setEnginePower(0);
    api.setTurnRate(0);
    reportProgress("Mission", 1);
  }
}`;
