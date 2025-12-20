# System Status Report

This document audits the implementation status of discussed features (Tier 1/2 Progression, Staging, Science) as of the current codebase state.

## 1. New Components & Parts
| Component | Part ID | Tech Required | Implementation Status | Logic Verified |
| :--- | :--- | :--- | :--- | :--- |
| **Lidar Altimeter** | `sensor.lidar` | Landing Systems | ✅ Implemented in `PartStore.ts` | ✅ `RocketAPI.telemetry.radarAltitude` |
| **Landing Legs** | `leg.landing.fixed` | Landing Systems | ✅ Implemented in `PartStore.ts` | ✅ Visual/Structural (Physics pending specific leg logic if complex) |
| **Biosample Container** | `science.bio_sample` | Landing Systems | ✅ Implemented in `PartStore.ts` | ✅ `RocketAPI.science.biosample` |
| **Medium Fuel Tank** | `fueltank.medium` | Enhanced Storage | ✅ Implemented | ✅ Standard Part |
| **Orbital CPU** | `cpu.orbital` | Orbital Computing | ✅ Implemented | ✅ Unlocks API Tier 2 |
| **Satellite Payload** | `payload.sat.basic` | Miniaturized Systems | ✅ Implemented | ✅ `RocketAPI.payload.deploy` |
| **Decoupler** | N/A (Logic-based) | Orbital Rocketry | ✅ Implemented via `RocketTemplates` | ✅ `RocketAPI.staging` |
| **Advanced Navigation** | `sensor.nav.adv` | Advanced Guidance | ✅ Implemented | ✅ Unlocks `nav.alignTo` |

## 2. Tech Tree Progression
| Tech Node | ID | Cost | Features Unlocked | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Landing Systems** | `tech.landing_systems` | 30 RP | Lidar, Legs, Biosample | ✅ Verified in `TechDefinitions` |
| **Orbital Rocketry** | `tech.rocketry_2` | 200 RP | Tier 2 Rocket Template | ✅ Verified |
| **Heavy Rocketry** | `tech.rocketry_3` | 500 RP | Tier 3 Rocket Template | ✅ Verified |
| **Orbital Computing** | `tech.orbital_comp` | 150 RP | Orbital CPU | ✅ Verified |

## 3. Science & Achievements
| Feature | Implementation | Reward | Status |
| :--- | :--- | :--- | :--- |
| **Biosample Recovery** | `ScienceManager.recoverBiosample` | 50 RP (Diminishing) | ✅ Logic in `ScienceManager.ts` |
| **Atmosphere Scans** | `ScienceManager.getDefinitions` | Variable | ✅ Milestones defined |
| **Recovery Button** | `RecoverButton` logic | N/A | ✅ Calls `recoverBiosample` |

## 4. Rocket API (Scripting)
| Module | Function | Verified availability | Note |
| :--- | :--- | :--- | :--- |
| **Telemetry** | `radarAltitude` | ✅ Yes | Returns `Infinity` > 5km |
| **Telemetry** | `verticalSpeed` | ✅ Yes | Calculated from Dot Product |
| **Telemetry** | `apoapsis/periapsis` | ✅ Yes | Tier 2 CPU required |
| **Science** | `biosample.collect()` | ✅ Yes | Requires Container |
| **Payload** | `deploy()` | ✅ Yes | Requires Payload Part |
| **Staging** | `separate()` | ✅ Yes | Requires Active Stage > 0 |

## 5. TypeScript Autocompletion
*   **Status**: ✅ **Working**.
*   **Mechanism**: The Script Editor (Monaco) injects the `d.ts` generated from `RocketAPI.ts`. Since `RocketAPI.ts` has been updated with the new classes (`RocketStagingAPI`, `RocketPayloadAPI`, etc.) and the main `RocketAPI` class exposes them as readonly properties, the editor will automatically provide autocompletion for `rocket.staging`, `rocket.science.biosample`, etc.

## Summary
The system is consistent. The initial "mess" was due to `Lidar` and `Biosample Container` definitions missing from the `PartStore` catalog, preventing them from appearing in the game even though the code supported them. **This has been fixed.**
