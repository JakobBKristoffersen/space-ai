/**
 * CommSystem.ts
 * Manages the communication network between rockets and base.
 */
import { Rocket } from "../simulation/Rocket";
import { BodyState } from "../simulation/Environment";

export interface CommNode {
    id: string;
    position: { x: number; y: number };
    antennaRange: number; // meters
    isPowered: boolean;
    isRelay: boolean;
}

export interface CommLink {
    nodeA: string;
    nodeB: string;
    distance: number;
    signalStrength: number; // 0..1
}

export interface CommPath {
    connected: boolean;
    hops: number;
    path: string[];
    latencyMs: number;
    signalStrength: number;
}

export interface DataPacket {
    id: string;
    type: 'telemetry' | 'science' | 'command' | 'science_data_bulk';
    sizeKb: number;
    progressKb: number;
    sourceId: string;
    targetId: string;
    data: any;
}

export class CommSystem {
    private nodes: Map<string, CommNode> = new Map();
    private links: CommLink[] = [];
    /** Packets successfully received by the Base. */
    public readonly receivedPackets: DataPacket[] = [];

    /**
     * Main update loop for communications.
     */
    update(dt: number, rockets: Rocket[], bodies: BodyState[], basePosition: { x: number; y: number } = { x: 0, y: 0 }) {
        // 1. Build Nodes
        this.nodes.clear();

        // Base Node
        this.nodes.set("base", {
            id: "base",
            position: basePosition,
            antennaRange: 50_000_000,
            isPowered: true,
            isRelay: true,
        });

        // Rocket Nodes
        for (const r of rockets) {
            if (!r.id) continue;
            let range = 0;
            let isRelay = false;
            if ((r as any).antennas) {
                for (const a of r.antennas) {
                    range = Math.max(range, a.rangeMeters || 0);
                    isRelay = true;
                }
            }

            this.nodes.set(r.id, {
                id: r.id,
                position: r.state.position,
                antennaRange: Math.max(range, 2000), // Min 2km range (visual/telemetry) even without antenna
                isPowered: r.availableEnergyJ() > 100,
                isRelay: isRelay,
            });
        }

        // 2. Build Links (Adjacency)
        this.links = [];
        const nodeList = Array.from(this.nodes.values());

        for (let i = 0; i < nodeList.length; i++) {
            for (let j = i + 1; j < nodeList.length; j++) {
                const a = nodeList[i];
                const b = nodeList[j];

                const dx = a.position.x - b.position.x;
                const dy = a.position.y - b.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                const limit = Math.min(a.antennaRange, b.antennaRange);

                if (dist <= limit && a.isPowered && b.isPowered) {
                    // Skip occlusion check for short-range links (< 2.5km) to simulate "tower line of sight" / flat ground
                    const isShortRange = dist < 2500;
                    if (isShortRange || !this.checkOcclusion(a.position, b.position, bodies)) {
                        this.links.push({
                            nodeA: a.id,
                            nodeB: b.id,
                            distance: dist,
                            signalStrength: 1.0 - (dist / limit),
                        });
                    }
                }
            }
        }

        // 3. Update Routing (Dijkstra from Base)
        const distTo = new Map<string, number>();
        const prev = new Map<string, string>();
        const pq: { id: string, dist: number }[] = [];

        for (const n of this.nodes.keys()) {
            distTo.set(n, Infinity);
        }
        distTo.set("base", 0);
        pq.push({ id: "base", dist: 0 });

        while (pq.length > 0) {
            pq.sort((x, y) => x.dist - y.dist);
            const u = pq.shift()!;

            if (u.dist > (distTo.get(u.id) as number)) continue;

            const neighbors = this.links.filter(l => l.nodeA === u.id || l.nodeB === u.id);
            for (const link of neighbors) {
                const vId = link.nodeA === u.id ? link.nodeB : link.nodeA;
                // Verify relay capability if not endpoint
                if (vId !== "base" && !this.nodes.get(vId)?.isRelay && !rockets.find(r => r.id === vId)) {
                    continue;
                }

                const weight = link.distance;
                const alt = u.dist + weight;
                if (alt < (distTo.get(vId) ?? Infinity)) {
                    distTo.set(vId, alt);
                    prev.set(vId, u.id);
                    pq.push({ id: vId, dist: alt });
                }
            }
        }

        // Push state and Process Packets
        for (const r of rockets) {
            if (!r.id) continue;
            const d = distTo.get(r.id);
            const connected = (d !== undefined && d < Infinity);

            const path: string[] = [];
            let curr: string | undefined = r.id;
            if (connected) {
                while (curr) {
                    path.push(curr);
                    curr = prev.get(curr);
                }
            }

            r.commState = {
                connected,
                hops: Math.max(0, path.length - 1),
                path,
                latencyMs: path.length * 50,
                signalStrength: connected ? 1.0 : 0.0,
                distanceMeters: connected ? (distTo.get(r.id) ?? 0) : 0,
            };

            // Explicit idle check: if not connected or no data, do not process or consume energy
            if (!connected || r.packetQueue.length === 0) {
                (r as any)._commsSentPerS = 0;
                continue;
            }

            // At this point, we are connected AND have data to send.
            // Calculate Energy Cost for Transmission
            let bandwidth = 5; // 5 B/s fallback
            let powerCost = 0.1; // 0.1W fallback

            if (r.antennas && r.antennas.length > 0) {
                // Use the first antenna for now (simplification)
                const antenna = r.antennas[0];
                if (antenna.bandwidth) bandwidth = antenna.bandwidth;
                if (antenna.power) powerCost = antenna.power;
            }

            // Check Energy
            const energyNeeded = powerCost * dt;
            const energyAvailable = r.drawEnergy ? r.drawEnergy(energyNeeded) : energyNeeded;

            // If not enough energy, throughput drops
            const efficiency = energyNeeded > 0 ? (energyAvailable / energyNeeded) : 1.0;

            const bandwidthKb = bandwidth / 1024;
            const sentKb = bandwidthKb * dt * efficiency;

            // Peek first packet
            const pkt = r.packetQueue[0];

            pkt.progressKb += sentKb;
            // UI wants Bytes/s rate. sentKb is KB sent in 'dt' seconds.
            // Rate = (sentKb * 1024) / dt
            (r as any)._commsSentPerS = (dt > 0) ? (sentKb * 1024) / dt : 0;

            if (pkt.progressKb >= pkt.sizeKb) {
                // Send complete
                r.packetQueue.shift();
                // Hack to signal completion to missions
                (r as any)._lastPacketSentId = pkt.id;
                (r as any)._lastPacketSentType = pkt.type;

                // Store in Base logs if target is base
                if (pkt.targetId === 'base') {
                    this.receivedPackets.push({ ...pkt, type: pkt.type as any, progressKb: pkt.sizeKb });
                    // Limit log size
                    if (this.receivedPackets.length > 50) this.receivedPackets.shift();
                }
            }
        }
    }

    // Segment vs Circle intersection
    private checkOcclusion(p1: { x: number, y: number }, p2: { x: number, y: number }, bodies: BodyState[]): boolean {
        for (const b of bodies) {
            // Circle center C, radius R. Segment P1-P2.
            // Check if distance from C to segment P1P2 < R

            // Vector d = P2 - P1
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            if (dx === 0 && dy === 0) continue;

            // Vector f = P1 - C
            const fx = p1.x - b.position.x;
            const fy = p1.y - b.position.y;

            const a = dx * dx + dy * dy;
            const B = 2 * (fx * dx + fy * dy);
            const c = (fx * fx + fy * fy) - b.radiusMeters * b.radiusMeters;

            const discriminant = B * B - 4 * a * c;
            if (discriminant >= 0) {
                const t1 = (-B - Math.sqrt(discriminant)) / (2 * a);
                const t2 = (-B + Math.sqrt(discriminant)) / (2 * a);

                // If either intersection is within segment [0,1], it's blocked
                if ((t1 > 0.01 && t1 < 0.99) || (t2 > 0.01 && t2 < 0.99)) {
                    // use epsilon to avoid self-occlusion if on surface (though usually antenna is above surface)
                    return true; // Blocked
                }
            }
        }
        return false;
    }
}
