# Space AI - Game Design

**Version**: 2.1 (Precise)
**Core Concept**: A programming-focused space exploration game. You build rockets, write software to control them (TypeScript), and explore a toy solar system.

---

## 1. The World (Toy System)
The universe is a fixed-timestep simulation. Scale is roughly 1/60th of reality but with Earth-like surface gravity to keep launch profiles familiar.

### Primary Body: "Toy Planet"
- **Radius**: 8,000 m (8 km)
- **Surface Gravity**: 12.0 m/s² (~1.2 G)
- **Atmosphere Height**: 2,000 m (Cutoff)
- **Atmospheric Density**: Exponential decay.
- **Terrain**: Plains, Mountains, Water, Desert, Forest, Ice.

### Satellite: "Big Moon"
- **Radius**: 800 m
- **Surface Gravity**: 1.62 m/s² (0.165 G)
- **Orbit Radius**: 25,000 m (25 km)
- **Orbital Period**: ~600 s

---

## 2. Parts Catalog
All parts have mass, cost (RP for unlock), and physical properties.

### Engines
| ID | Name | Mass (Dry) | Thrust (Vac) | Thrust (SL) | Burn Rate | ISP (Vac) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `engine.small` | Small Engine | 50 kg | 2.5 kN | 2.0 kN | 2.5 kg/s | ~100s |
| `engine.precision` | Precision Engine | Variable | Variable | Variable | Variable | High |
| `engine.vacuum` | Vacuum Engine | 300 kg | 25.0 kN | 10.0 kN | 7.5 kg/s | ~340s |
| `engine.ion` | Ion Thruster | Variable | Low | N/A | Very Low | Very High |

### Fuel Tanks
| ID | Name | Mass (Dry) | Fuel Capacity | Total Mass |
| :--- | :--- | :--- | :--- | :--- |
| `fueltank.small` | Small Tank | 20 kg | 60 kg | 80 kg |
| `fueltank.medium` | Medium Tank | 40 kg | 120 kg | 160 kg |
| `fueltank.large` | Large Tank | 60 kg | 200 kg | 260 kg |

### Batteries
| ID | Name | Mass | Capacity |
| :--- | :--- | :--- | :--- |
| `battery.small` | Small Battery | 10 kg | 50 kJ |
| `battery.medium` | Medium Battery | 25 kg | 150 kJ |

### Communications
| ID | Name | Range | Bandwidth | Power (Tx) |
| :--- | :--- | :--- | :--- | :--- |
| `antenna.small` | Comm 16 | 500 km | 20 B/s | 0.5 W |
| `antenna.medium` | Comm DTS-M1 | 50,000 km | 120 B/s | 2.5 W |
| `antenna.relay` | Relay Dish | 50,000 km | 500 B/s | 10 W |
| `antenna.deep` | Deep Space Dish | 500,000 km | 2,000 B/s | 50 W |

### Guidance Systems (CPUs)
| ID | Name | Ops/Tick | Memory | Slots | Unlock |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `cpu.basic` | Basic Guidance | 50 | 10 KB | 1 | Start |
| `cpu.advanced` | Adv Guidance | 100 | 32 KB | 2 | Tier 1 |
| `cpu.orbital` | Orbital Comp | 250 | 64 KB | 4 | Tier 2 |

---

## 3. Technology Tree
Progression is driven by Research Points (RP).

| ID | Name | Cost (RP) | Unlocks |
| :--- | :--- | :--- | :--- |
| **Start** | Basic Rocketry | 0 | Small Engine, Small Tank, Basic CPU, Comm 16 |
| `tech.batteries_med` | Enhanced Storage | 10 | Med Tank, Med Battery |
| `tech.guidance_adv` | Advanced Guidance | 25 | Adv CPU, Adv Nav Sensor |
| `tech.propulsion_prec` | Precision Prop. | 40 | Precision Engine, Med RW |
| `tech.comms_basic` | Basic Comms | 50 | Comm DTS-M1 (Med Antenna) |
| `tech.satellite` | Miniaturized Sys | 75 | CubeSat Deployer |
| `tech.solar` | Solar Power | 100 | Basic Solar Panel |
| `tech.orbital_comp` | Orbital Computing | 150 | Orbital CPU |
| `tech.comms_relay` | Relay Networks | 200 | Relay Antenna |
| `tech.propulsion_vac` | High Vac Engines | 300 | Vacuum Engine |
| `tech.deep_space` | Deep Space Comms | 500 | Deep Space Dish |
| `tech.ion` | Ion Propulsion | 1000 | Ion Thruster |

---

## 4. RocketAPI Reference
The `RocketAPI` object is passed to your `update(api)` function.

### `api.control`
- `throttle(value: number)`: Set throttle 0.0-1.0.
- `turn(rate: number)`: Set turn rate (rad/s). Requires **Reaction Wheels** (Space/Atmo) OR **Fins** (Atmosphere only).
- `deployParachute()`: Deploy parachutes.
- `deploySolar()` / `retractSolar()`: Manage solar panels.

### `api.telemetry`
Access depends on installed sensors and CPU Tier.
- `altitude`: Surface altitude (m).
- `velocity`: Vector `{x, y}` (m/s).
- `position`: Vector `{x, y}` relative to planet center.
- `speed`: Scalar speed (m/s).
- `apoapsis`: Orbit Ap (m). Requires `cpu.orbital`.
- `periapsis`: Orbit Pe (m). Requires `cpu.orbital`.

### `api.nav`
- `heading`: Current orientation (rad).
- `alignTo(targetRad)`: Helper to turn towards angle.
- `prograde` / `retrograde`: Flight path angles (rad).

### `api.comms`
- `transmitMessage(msg: string)`: Send text log to base.
- `transmitData(key, value)`: Send key-value telemetry.

### `api.science`
- `temperature.collect()`: Buffer temp reading.
- `temperature.transmit()`: Send buffered readings (Earn RP).
- `atmosphere.collect()` / `transmit()`: Buffer/Send pressure data.
- `surface.collect()` / `transmit()`: Buffer/Send surface type scan.

### `api.memory`
- `get(key)`, `set(key, val)`, `remove(key)`, `clear()`: Persist data between ticks.

### API Visibility & Unlocks
The Editor only exposes API methods corresponding to unlocked technologies:

| Method | Required Tech |
| :--- | :--- |
| `science.temperature` | **Enhanced Storage** (`tech.batteries_med`) (Placeholder: Basic Science) |
| `science.atmosphere` | **Advanced Guidance** (`tech.guidance_adv`) |
| `science.surface` | **Miniaturized Systems** (`tech.satellite`) |
| `telemetry.apoapsis` | **Orbital Computing** (`tech.orbital_comp`) |
| `telemetry.periapsis` | **Orbital Computing** (`tech.orbital_comp`) |
| `nav.alignTo` | **Advanced Guidance** (`tech.guidance_adv`) |

---

## 5. Economy & Science Rewards
You earn RP by completing Science Milestones.

### Milestone Tiers & Zones
**Zones**:
1. Lower Atmosphere (0-660m)
2. Mid Atmosphere (660-1,320m)
3. Upper Atmosphere (1,320-2,000m)
4. Space (>2,000m)

**Rewards**:
- **Temperature/Pressure Scans**:
    - Lower: 20 RP
    - Mid: 40 RP
    - Upper: 80 RP
    - Space: 200 RP (Single reading)
- **Surface Scans** (Global coverage):
    - 25% Coverage: 50 RP
    - 50% Coverage: 100 RP
    - 75% Coverage: 200 RP
    - 100% Coverage: 500 RP
