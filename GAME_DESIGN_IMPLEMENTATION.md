# GAME_DESIGN_IMPLEMENTATION.md

**Authoritative Design Document for Space AI Game Systems**

## 1. Overview
This document outlines the architectural and functional specifications for the next major iteration of *Space AI*. The focus is on adding depth through progression systems (Research, Missions), a realistic Communication Network, and an expanded unified Part Catalog.

**Core Pillars:**
1.  **Communication Network**: Realistic line-of-sight and relay mechanics.
2.  **Research & Economy**: Dual-currency progression (Money + Research Points).
3.  **Mission Tiers**: Guided progression from sounding rockets to multi-planetary operations.
4.  **Story & Tone**: Pragmatic, slightly humorous agency management.

---

## 2. System Specifications

### 2.1 Communication Network System (`src/comms/`)

**Concept:** 
Telemetry and command control require a valid path from the rocket/satellite to the Base. The network is a graph where nodes are `Rocket` entities or the `Base`.

**Module:** `src/comms/CommSystem.ts`

**Data Structures:**
```typescript
interface CommNode {
  id: string;          // Rocket ID or 'base'
  position: Vector2;   // World coordinates
  antennaRange: number;// Max distance in meters
  isPowered: boolean;  // Has battery?
  isRelay: boolean;    // Can relay others' signals?
}

interface CommLink {
  nodeA: string;
  nodeB: string;
  distance: number;
  signalStrength: number; // 0-1 based on distance/range
}

interface CommPath {
  connected: boolean;
  hops: number;
  path: string[]; // List of Node IDs e.g., ['rocket1', 'sat1', 'base']
  latencyMs: number;
}

interface DataPacket {
  id: string;
  type: 'telemetry' | 'science' | 'command';
  sizeKb: number;
  progressKb: number;
  sourceId: string;
  targetId: string; // Usually 'base'
  data: any;
}
```

**Logic:**
1.  **Line-of-Sight (LOS) Check**:
    *   `dist(A, B) <= min(rangeA, rangeB)`? (Actually usually max range of the pair, or min? *Spec says: "Distance ≤ antenna range". We'll assume the link supports the *min* of the two ranges for bidirectional, or the *max* if asymmetric. Let's strictly follow: "Distance ≤ antenna range" of the transmitting node for one-way, but commonly comms are bidirectional. We will assume link exists if `dist <= min(rangeA, rangeB)` for stable 2-way link.*)
    *   **Occlusion**: Raycast `A -> B`. If ray intersects any Planet/Moon collider, link is blocked.
2.  **Graph & Routing**:
    *   Build adjacency graph of all valid Links.
    *   BFS/Dijkstra from `Rocket` to `Base`.
3.  **Packet System**:
    *   `Rocket` maintains a `packetQueue`.
    *   Tick loop: If `connected`, transmission speed = `Bandwidth` (e.g., 50Kb/tick).
    *   Drain `sizeKb` from active packet. If 0, mark sent.

**API Expose:**
```typescript
class CommSystem {
  public getCommState(rocketId: string): CommPath;
  public sendDataPacket(rocketId: string, type: string, sizeKb: number, data: any): void;
  public update(dt: number, rockets: Rocket[], bodies: CelestialBody[]): void;
}
```

---

### 2.2 Research Points System (`src/research/`)

**Concept:**
A global currency `researchPoints` (RP) is earned alongside `money`. Used to unlock specific technologies.

**Module:** `src/research/ResearchSystem.ts`

**Data Structures:**
```typescript
interface ResearchState {
  points: number;
  unlockedTechs: string[]; // IDs of unlocked techs e.g., 'tech_solar'
}

interface TechDefinition {
  id: string;
  name: string;
  costRP: number;
  description: string;
  unlocksParts: string[]; // Part IDs enabled by this tech
}
```

**Rules:**
*   Missions award `money` and `rp`.
*   Parts in `PartStore` will check `ResearchState.unlockedTechs` before being buyable.
*   RP is global (stored in `GameManager` or `AppCore`).

---

### 2.3 Mission Progression (`src/missions/`)

**Concept:**
Tiered objectives that guide the player. 

**Module:** `src/missions/MissionData.ts` (Data), `src/missions/MissionSystem.ts` (Logic)

**Data Structures:**
```typescript
interface MissionObjective {
  type: 'reach_altitude' | 'orbit' | 'packet_sent' | 'coverage' | 'landing';
  targetValue: number; // e.g., 1000 (meters)
  currentValue?: number;
  completed: boolean;
}

interface Mission {
  id: string;
  tier: number;
  title: string;
  briefing: string;
  objectives: MissionObjective[];
  rewards: {
    money: number;
    rp: number;
    unlocks?: string[]; // Special item unlocks (optional)
  };
  prerequisites: string[]; // Mission IDs
  state: 'locked' | 'available' | 'active' | 'completed';
}
```

**Tiers (Summary):**
*   **Tier 0 (Bootstrap)**: Sounding rockets. Basic altitude mechanics.
*   **Tier 1 (Atmo Mastery)**: Reaching space, staying aloft.
*   **Tier 2 (Orbital)**: Orbit sustained, first big data packets.
*   **Tier 3 (Network)**: Relay satellites, coverage goals.
*   **Tier 4 (Lunar)**: Moon shot, surface scan.
*   **Tier 5 (Automated)**: Constellations, multi-rocket sync.

---

### 2.4 Part Unlock Structure (`src/parts/`)

**Concept:**
Unified definition for part costs and requirements.

**Module:** `src/parts/Unlocks.ts` extensions to `PartStore.ts`

**New Interface:**
```typescript
interface PartUnlockInfo {
  moneyCost: number;
  researchCost: number; // If buying blueprint directly (optional alternative)
  techRequired?: string; // Tech ID from ResearchSystem
}
// Extend existing PartCatalog items with this info.
```

**New Parts to Implement:**
1.  **Engines**: Precision (low thrust, high eff), Gimballed (steering), High Vacuum, Ion (very low thrust, insane eff).
2.  **Utility**: Reaction Wheels (torque), Solar Panels (generate Energy/tick), Radiators.
3.  **Comms**: High-range Antenna, Deep-space Antenna.
4.  **CPU**: Advanced Multi-slot CPUs.

---

### 2.5 Story Framework (`src/story/`)

**Concept:**
Flavor text to give personality.

**Module:** `src/story/Briefings.ts`

**Content:**
Map mission IDs to string paragraphs.
*Tone*: "Slightly humorous, pragmatic, science-agency-like."

---

### 2.6 Guidance & Sensor Gating (API Tiers)

**Concept:**
Initially, scripts have limited access to telemetry (blind flight). Upgrading the Guidance System (CPU) unlocks more data.

**Module:** `src/systems/GuidanceSystem.ts` (or integrated into `RocketAPI`)

**CPU Tiers:**
*   **Tier 0 (Basic)**:
    *   **Controls**: `setThrottle()`, `setSteering()` (turn left/right).
    *   **Data**: *None*. (Blind firing. Player must use visual cues from World Scene).
*   **Tier 1 (Telemetry)**:
    *   **Data**: `getAltitude()`, `getVelocity()`, `getPosition()`, `getHeading()`.
*   **Tier 2 (Orbital Computer)**:
    *   **Data**: `getApoapsis()`, `getPeriapsis()`, `getOrbitalPeriod()`, `getTimeToApoapsis()`.
*   **Tier 3 (Network/Advanced)**:
    *   **Data**: Comm network status, full state vectors.

**Implementation:**
`RocketAPI` methods will check the installed CPU's tier before returning values. If too low, return `NaN` or throw/log "Upgrade Required".

---

## 3. Implementation Order

### Phase 1: Fundamentals
1.  **Scaffold Files**: Create directory structure (`comms`, `research`, `missions`, `story`).
2.  **Research System**: Implement `ResearchSystem.ts` core state and save/load.
3.  **Unlock Metadata**: Create `TechDefinitions` and update `PartCatalog` types.
4.  **Mission Data**: definte `MissionData.ts` with Tiers 0-1 fully populated.

### Phase 2: Communication Network
1.  **Comm Nodes**: Add `CommNode` property to `Rocket` class.
2.  **LOS Logic**: Implement `checkLineOfSight(a, b, bodies)`.
3.  **Graph**: Implement `buildCommGraph()` and `findPath()`.
4.  **Integration**: Update `Rocket.ts` to fail commands/telemetry if `!commState.connected`.

### Phase 3: Progression & UI
1.  **Header UI**: Add Research Points counter next to Money.
2.  **Mission UI**: Create `MissionsPage.tsx` or update tab to show Tiered lists.
3.  **Part Store UI**: Grey out locked parts, show "Requires [Tech Name]".
4.  **Minimap**: Draw Comm lines (green = connected, red = blocked).

### Phase 4: Late Game Content
1.  **Satellite Logic**: "Deploy" action separates a part of the rocket as a new persistent entity.
2.  **Tiers 2-5**: Populate remaining mission data.
3.  **Refinement**: Balance costs and rewards.

## 4. Constraints & Architecture
*   **Hot Path**: Physics tick (FixedUpdate) must NOT run heavy graph searches every frame. Run Comm updates continuously but perhaps throttled (e.g., every 10 ticks) or optimized.
*   **State Management**: Use `GameManager` as the source of truth. Modules attach to it.
*   **UI**: Chakra UI v3.
*   **No Circular Deps**: `CommSystem` depends on `Physics`, but `Physics` should not depend on `CommSystem`. `GameManager` orchestrates both.
