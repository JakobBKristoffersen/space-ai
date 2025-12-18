# Player Experience & Progression

**Goal**: Guide the player from "Hello World" to "Lunar Landing" through iterative engineering challenges.

## The Player Journey

### Phase 1: The Engineer's Awakening
*Context*: Player is a new recruit at the Space AI agency.
- **Challenge**: Launch a rocket to 100m.
- **Experience**:
    - Opens VAB, sees basic parts.
    - Opens Editor, sees `Default Script` ("Full Throttle").
    - Launches. It crashes or flies high.
    - Learns: "I need to control this thing."
- **Unlock**: Basic Sensors (Altimeter).

### Phase 2: The Data Gatherer
*Context*: We need to understand the atmosphere.
- **Challenge**: Transmit atmospheric data from upper atmosphere.
- **Experience**:
    - Equips `Thermometer`.
    - Writes script to `log(temperature)` or uses Comms API.
    - Realizes: "I need an antenna and battery power."
    - Balances Mass vs Fuel vs Power.
- **Unlock**: Better Batteries, Medium Engine.

### Phase 3: The Orbital Mechanic
*Context*: Going Up is easy. Staying Up is hard.
- **Challenge**: Achieve a stable orbit (Pe > 10km).
- **Experience**:
    - Gravity Turn logic.
    - Prograde/Retrograde vector understanding.
    - Writing a State Machine (Launch -> Turn -> Coast -> Circularize).
    - *The "Aha!" Moment*: Watching the orbit circle close on the map.
- **Unlock**: Solar Panels, Reaction Wheels II, Orbital CPU.

### Phase 4: The Network Architect
*Context*: Direct Line-of-Sight is limiting.
- **Challenge**: Maintain connection while on the dark side of the planet.
- **Experience**:
    - Deploying a relay satellite constellation.
    - Multi-rocket management.
    - Networking logic (Routing packets?).
- **Unlock**: Deep Space Antenna.

### Phase 5: The Explorer
*Context*: The Moon awaits.
- **Challenge**: Lunar Flyby / Transfer.
- **Experience**:
    - Hohmann Transfer calculation (or estimation).
    - High delta-v burns.
    - Deep space autonomous operation (latency/signal loss simulation?).
- **Unlock**: Ion Engines, Landing Legs.

## UX Guidelines
- **Feedback**: Failures should be educational (e.g., "Script Error: Out of Energy" or "Rocket Aerodynamic Failure").
- **Visuals**: Satisfaction from seeing the trail, the Mach diamond shockwaves, the clean UI.
- **Pacing**: Unlock new toys regularly, but require mastery of previous ones.
- **Documentation**: In-game docs (API Reference) must be excellent since coding is the gameplay.
