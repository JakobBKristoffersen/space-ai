export const PYTHON_SEED_SCRIPT = `
# Orbit insertion autopilot using Modular RocketAPI
# Goal: Raise Apoapsis (Ap) to ~2000 m, coast to Ap, then burn prograde until Periapsis (Pe) reaches ~2000 m (±10%).
# Controls: api.control.throttle(0|1); api.control.turn(rate)

import math
import time
from rocket_api import RocketAPI

def clamp01(x: float) -> float:
    return max(0, min(1, x))

def update(api: RocketAPI) -> None:
    PHASES = ["liftoff", "raise_ap", "coast_to_ap", "circularize", "done"]
    
    # 1. State & Setup
    if not api.memory.get("__phasesListed"):
        api.log("Phases: " + " -> ".join(PHASES))
        api.memory.set("__phasesListed", 1)

    # Telemetry Access
    # Note: These will fail/error if sensors are missing!
    alt = api.telemetry.altitude
    vel = api.telemetry.velocity
    fuel = api.telemetry.fuel
    ap = api.telemetry.apoapsis
    pe = api.telemetry.periapsis
    
    # Approx speed
    vx = vel.x
    vy = vel.y
    speed = math.sqrt(vx*vx + vy*vy)

    # Telemetry Ping (every 2s)
    last_ping = float(api.memory.get("__lastPing") or 0)
    now_ms = time.time() * 1000
    if now_ms - last_ping > 2000:
        if hasattr(api, 'comms') and hasattr(api.comms, 'send'):
             api.comms.send("telemetry", 2, {"alt": int(alt), "phase": api.memory.get("phase")})
        api.memory.set("__lastPing", now_ms)

    # Parameters
    target_ap = 2000
    target_pe = 2000
    pe_ok_low = target_pe * 0.9
    
    # Phase Management
    stored_phase = api.memory.get("phase")
    phase = stored_phase if stored_phase else "liftoff"
    
    def set_phase(p):
        nonlocal phase
        if p != phase:
            phase = p
            api.memory.set("phase", p)
            api.memory.set("__lastProgressBucket", -1)
            api.log("Phase -> " + p)

    def report_progress(label, p):
        p = clamp01(p)
        last_phase = api.memory.get("__progressPhase") or ""
        last_bucket = int(api.memory.get("__lastProgressBucket") or -1)
        bucket = int(p * 10)
        
        if phase != last_phase or bucket > last_bucket:
            api.log(f"{label}: {int(p*100)}%")
            api.memory.set("__progressPhase", phase)
            api.memory.set("__lastProgressBucket", bucket)

    # Safety Check
    if fuel <= 0:
        api.control.throttle(0)
        api.control.turn(0)
        return

    # Track altitude state
    prev_alt = float(api.memory.get("prevAlt") or alt)
    api.memory.set("prevAlt", alt)

    # 2. Control Logic
    if phase == "liftoff":
        # Vertical ascent
        rho0 = float(api.memory.get("rho0") or float("nan"))
        # Simplified: Launch until speed > 10m/s
        
        # Keep vertical
        api.control.turn(0)
        api.control.throttle(1)
        
        if speed > 10:
            set_phase("raise_ap")

    elif phase == "raise_ap":
        # Gravity turn
        tilt = float(api.memory.get("tilt") or 0)
        max_tilt = math.pi * 0.45
        tilt = min(max_tilt, tilt + 0.12)
        api.memory.set("tilt", tilt)
        
        use_prograde = abs(vx) > 20
        if use_prograde:
            # Check availability
            # In JS it's api.nav.prograde (property)
            # Assuming Python wrapper exposes properties
            try:
                aim = api.nav.prograde
                api.nav.alignTo(aim)
            except:
                api.control.turn(-0.25)
        else:
            # Manual turn right
            api.control.turn(-0.25)
            
        api.control.throttle(1)
        
        if not math.isnan(ap):
            report_progress("Raise Ap", ap / target_ap)
            if ap >= target_ap * 0.98:
                api.control.throttle(0)
                api.control.turn(0)
                set_phase("coast_to_ap")

    elif phase == "coast_to_ap":
        api.control.throttle(0)
        api.control.turn(0)
        
        if not math.isnan(ap):
            close = abs(ap - alt) < 50
            passed_peak = prev_alt > alt and alt > ap * 0.9
            
            p = 1 - abs(ap - alt) / max(1, ap)
            report_progress("Coast to Ap", p)
            
            if close or passed_peak:
                set_phase("circularize")

    elif phase == "circularize":
        try:
            aim = api.nav.prograde
            api.nav.alignTo(aim)
        except:
            pass
            
        api.control.throttle(1)
        
        if not math.isnan(pe):
            report_progress("Circularize", pe / target_pe)
            if pe >= pe_ok_low:
                api.control.throttle(0)
                api.control.turn(0)
                set_phase("done")

    elif phase == "done":
        api.control.throttle(0)
        api.control.turn(0)
        report_progress("Mission", 1)
`;
