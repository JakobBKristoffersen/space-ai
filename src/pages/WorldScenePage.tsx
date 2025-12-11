import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Box,
    Button,
    Card,
    Center,
    createListCollection,
    Grid,
    GridItem,
    Heading,
    HStack,
    Portal,
    Progress,
    Select,
    Tabs,
    Text,
    VStack
} from "@chakra-ui/react";
import { useAppCore } from "../app/AppContext";
import { estimateDeltaV, mag2 } from "../app/utils/rocketPerf";

// --- Orbital helpers (primary body approximation) ---
function computeOrbit(primary: any, rocket: any) {
    if (!primary || !rocket) return null;
    const rx = rocket.position?.x ?? 0;
    const ry = rocket.position?.y ?? 0;
    const vx = rocket.velocity?.x ?? 0;
    const vy = rocket.velocity?.y ?? 0;
    const rvec = { x: rx - primary.position.x, y: ry - primary.position.y };
    const vvec = { x: vx, y: vy };

    const r = Math.hypot(rvec.x, rvec.y);
    const v2 = vvec.x * vvec.x + vvec.y * vvec.y;
    const mu = primary.surfaceGravity * primary.radiusMeters * primary.radiusMeters; // since g0 = mu/R^2
    if (!(mu > 0) || r <= 0) return null;
    const eps = 0.5 * v2 - mu / r; // specific orbital energy
    // Eccentricity vector: e = ( (v^2 - mu/r) r - (r·v) v ) / mu
    const rv = rvec.x * vvec.x + rvec.y * vvec.y;
    const ex = ((v2 - mu / r) * rvec.x - rv * vvec.x) / mu;
    const ey = ((v2 - mu / r) * rvec.y - rv * vvec.y) / mu;
    const e = Math.hypot(ex, ey);
    let a = Number.NaN;
    if (eps < 0) a = -mu / (2 * eps); // ellipse

    const argPeri = Math.atan2(ey, ex); // orientation of periapsis in world frame

    if (isFinite(a) && e < 1 && a > 0) {
        const rp = a * (1 - e);
        const ra = a * (1 + e);
        const peAlt = rp - primary.radiusMeters;
        const apAlt = ra - primary.radiusMeters;
        return { a, e, argPeri, apAlt, peAlt };
    }
    return { a: Number.NaN, e, argPeri, apAlt: Number.NaN, peAlt: Number.NaN };
}

function fmt(n: number, digits = 2): string {
    if (!isFinite(n)) return "-";
    const a = Math.abs(n);
    if (a >= 10000) return n.toFixed(0);
    if (a >= 1000) return n.toFixed(1);
    return n.toFixed(digits);
}

export default function WorldScenePage() {
    const { manager, services } = useAppCore();
    const [running, setRunning] = useState<boolean>(false);
    const [speed, setSpeed] = useState<number>(1);
    const [now, setNow] = useState<number>(performance.now());
    const [snapKey, setSnapKey] = useState<number>(0); // trigger UI recompute
    const [launched, setLaunched] = useState<boolean>(false);

    // Chakra UI v3 Select collection for speed options
    const speedOptions = useMemo(() => createListCollection({
        items: [
            { label: "0.5x", value: "0.5" },
            { label: "1x", value: "1" },
            { label: "2x", value: "2" },
            { label: "4x", value: "4" },
        ],
    }), []);

    // Ensure the canvas exists for main bootstrap
    useEffect(() => {
        // nothing here; canvas is rendered below
    }, []);

    // Subscribe to manager render cadence to update UI ~5Hz
    useEffect(() => {
        if (!manager) return;
        const sync = () => {
            setRunning(manager.isRunning());
            setSpeed(manager.getSpeedMultiplier ? manager.getSpeedMultiplier() : 1);
            try { setLaunched(!!manager.hasLaunched?.()); } catch { }
        };
        const unsub = manager.onPostRender((_alpha, ts) => {
            setNow(ts);
            setSnapKey((k) => (k + 1) % 1000000);
            sync();
        });
        // sync initial states
        sync();
        return () => {
            unsub?.();
        };
    }, [manager]);

    const envSnap = useMemo(() => {
        try {
            return manager?.getEnvironment().snapshot();
        } catch {
            return null;
        }
    }, [manager, snapKey]);

    const rocketSnap = envSnap?.rocket as any;

    const primaryBody = useMemo(() => {
        try {
            return envSnap ? envSnap.bodies.find((b: any) => b.id === envSnap.primaryId) : null;
        } catch {
            return null;
        }
    }, [envSnap]);
    // Body currently exerting the strongest gravitational pull (SOI)
    const soiBody = useMemo(() => {
        try {
            const id = (rocketSnap as any)?.soiBodyId ?? (envSnap as any)?.primaryId;
            return envSnap ? envSnap.bodies.find((b: any) => b.id === id) : null;
        } catch { return null; }
    }, [envSnap, rocketSnap]);
    const orbit = useMemo(() => {
        if (!soiBody || !envSnap) return null;
        return computeOrbit(soiBody, envSnap.rocket);
    }, [soiBody, envSnap]);

    const onPlayPause = () => {
        if (!manager) return;
        if (manager.isRunning()) manager.pause(); else manager.start();
        setRunning(manager.isRunning());
    };

    // Speed change via Chakra v3 Select
    const onSpeedChangeValue = (value: string) => {
        const v = parseFloat(value);
        if (!Number.isFinite(v)) return;
        setSpeed(v);
        manager?.setSpeedMultiplier?.(v);
    };

    const onResetRocket = () => {
        manager?.resetSimulationOnly?.();
    };

    // Minimap drawing
    const miniRef = useRef<HTMLCanvasElement | null>(null);
    const miniBoundsRef = useRef<{ bounds: { minX: number; maxX: number; minY: number; maxY: number }; sig: string } | null>(null);
    useEffect(() => {
        const canvas = miniRef.current;
        if (!canvas || !envSnap) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const w = canvas.width = canvas.clientWidth || 160;
        const h = canvas.height = canvas.clientHeight || 120;
        ctx.clearRect(0, 0, w, h);

        const primary = envSnap.bodies.find((b) => b.id === envSnap.primaryId)!;
        let maxDist = 0;
        for (const b of envSnap.bodies) {
            const dx = b.position.x - primary.position.x;
            const dy = b.position.y - primary.position.y;
            const dist = Math.hypot(dx, dy) + b.radiusMeters;
            if (dist > maxDist) maxDist = dist;
        }
        // Include all rockets
        const rockets = Array.isArray((envSnap as any).rockets) ? (envSnap as any).rockets : [envSnap.rocket];
        for (const r of rockets) {
            const dx = r.position.x - primary.position.x;
            const dy = r.position.y - primary.position.y;
            const dist = Math.hypot(dx, dy) + primary.radiusMeters * 0.1;
            if (dist > maxDist) maxDist = dist;
        }
        maxDist = Math.max(maxDist, primary.radiusMeters * 2);
        const bounds = { minX: -maxDist, maxX: maxDist, minY: -maxDist, maxY: maxDist };
        const worldW = Math.max(1, bounds.maxX - bounds.minX);
        const worldH = Math.max(1, bounds.maxY - bounds.minY);
        const scale = Math.min((w - 4) / worldW, (h - 4) / worldH);
        const ox = (w - worldW * scale) / 2;
        const oy = (h - worldH * scale) / 2;
        const toMini = (x: number, y: number) => ({
            x: ox + (x - bounds.minX) * scale,
            y: h - (oy + (y - bounds.minY) * scale),
        });

        // backdrop
        ctx.fillStyle = "rgba(0,0,0,0.9)";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

        for (const b of envSnap.bodies) {
            const p = toMini(b.position.x, b.position.y);
            const R = Math.max(1, b.radiusMeters * scale);
            ctx.beginPath();
            ctx.fillStyle = b.id === envSnap.primaryId ? (b.color || "#2e5d2e") : (b.color || "#888");
            ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
            ctx.fill();
        }

        // Atmosphere cutoff circle (if defined) drawn around the primary
        try {
            const cutoffAlt = (typeof envSnap.atmosphereCutoffAltitudeMeters === 'number')
                ? Math.max(0, Number(envSnap.atmosphereCutoffAltitudeMeters))
                : (primary.atmosphereScaleHeightMeters ? Math.max(0, primary.atmosphereScaleHeightMeters * 7) : 0);
            if (cutoffAlt > 0) {
                const pc = toMini(primary.position.x, primary.position.y);
                const Rc = (primary.radiusMeters + cutoffAlt) * scale;
                if (isFinite(Rc) && Rc > 1) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.setLineDash([4, 3]);
                    // Use a subtle blue matching atmosphere
                    const base = primary.atmosphereColor || "rgba(80,160,255,1)";
                    // Simple alpha override regardless of input format
                    const stroke = base.startsWith("rgba(") ? base.replace(/rgba\(([^)]+),\s*([\d.]+)\)/, "rgba($1,0.35)") : "rgba(80,160,255,0.35)";
                    ctx.strokeStyle = stroke;
                    ctx.lineWidth = 1;
                    ctx.arc(pc.x, pc.y, Rc, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                }
            }
        } catch {
        }

        // Predicted elliptical trajectory around the body with strongest gravity (SOI) if bound
        try {
            const soiId = (rocketSnap as any)?.soiBodyId ?? envSnap.primaryId;
            const baseBody = envSnap.bodies.find((b: any) => b.id === soiId) ?? primary;
            const orb = computeOrbit(baseBody, envSnap.rocket);
            if (orb && isFinite(orb.a) && orb.e < 1 && orb.a > 0) {
                const a = orb.a;
                const b = a * Math.sqrt(Math.max(0, 1 - orb.e * orb.e));
                const cosW = Math.cos(orb.argPeri);
                const sinW = Math.sin(orb.argPeri);
                ctx.strokeStyle = "rgba(0,200,255,0.6)";
                ctx.lineWidth = 1;
                ctx.beginPath();
                const steps = 180;
                for (let i = 0; i <= steps; i++) {
                    const E = (i / steps) * Math.PI * 2;
                    // Ellipse in orbital frame (focus at origin): r(E) = a(cosE - e), y = b sinE, then rotate by argPeri
                    const x_orb = a * (Math.cos(E) - orb.e);
                    const y_orb = b * Math.sin(E);
                    const xw = x_orb * cosW - y_orb * sinW + baseBody.position.x;
                    const yw = x_orb * sinW + y_orb * cosW + baseBody.position.y;
                    const p2 = toMini(xw, yw);
                    if (i === 0) ctx.moveTo(p2.x, p2.y); else ctx.lineTo(p2.x, p2.y);
                }
                ctx.stroke();
            }
        } catch {
        }

        const rocketsDraw = Array.isArray((envSnap as any).rockets) ? (envSnap as any).rockets : [envSnap.rocket];
        const activeIdxMM = Number((envSnap as any).activeRocketIndex ?? 0) | 0;
        for (let i = 0; i < rocketsDraw.length; i++) {
            const rr = rocketsDraw[i];
            const p = toMini(rr.position.x, rr.position.y);
            ctx.fillStyle = i === activeIdxMM ? "#ffcc00" : "#cccccc";
            ctx.beginPath();
            ctx.arc(p.x, p.y, i === activeIdxMM ? 3 : 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }, [envSnap, snapKey]);

    const dv = useMemo(() => manager ? estimateDeltaV(manager.getRocket()) : 0, [manager, snapKey]);
    const speedMag = rocketSnap ? mag2(rocketSnap.velocity.x, rocketSnap.velocity.y) : 0;
    // Clamp battery percentage to a safe [0,100] number for Progress component
    const batteryPct = (() => {
        const raw = Number(rocketSnap?.batteryPercent ?? 0);
        if (!Number.isFinite(raw)) return 0;
        return Math.max(0, Math.min(100, raw));
    })();

    // Rocket selection (active vehicle)
    const rocketOptions = useMemo(() => {
        try {
            const names = manager?.getRocketNames?.();
            if (Array.isArray(names) && names.length) {
                return createListCollection({ items: names.map((label: string, i: number) => ({ label, value: String(i) })) });
            }
        } catch { }
        const count = envSnap?.rockets?.length ?? 1;
        const items = new Array(count).fill(0).map((_, i) => ({ label: `Rocket ${i + 1}`, value: String(i) }));
        return createListCollection({ items });
    }, [manager, envSnap?.rockets?.length, snapKey]);
    const [activeIdx, setActiveIdx] = useState<number>(0);
    useEffect(() => {
        const idx = Number(envSnap?.activeRocketIndex ?? 0) | 0;
        setActiveIdx(idx);
    }, [envSnap?.activeRocketIndex]);

    return (
        <VStack align="stretch" gap={3} h="100%">
            {/* Controls */}
            <HStack justify="space-between">
                <HStack gap={2}>
                    <Button onClick={onPlayPause}
                        colorScheme={running ? "yellow" : "green"}>{running ? "Pause" : "Play"}</Button>
                    <Select.Root size="sm" minW={32} collection={speedOptions} value={[String(speed)]}
                        onValueChange={(d: any) => onSpeedChangeValue(Array.isArray(d?.value) ? d.value[0] : d?.value)}>
                        <Select.HiddenSelect />
                        <Select.Control>
                            <Select.Trigger>
                                <Select.ValueText placeholder="Speed" />
                            </Select.Trigger>
                            <Select.IndicatorGroup>
                                <Select.Indicator />
                            </Select.IndicatorGroup>
                        </Select.Control>
                        <Portal>
                            <Select.Positioner>
                                <Select.Content>
                                    {speedOptions.items.map((opt: any) => (
                                        <Select.Item item={opt} key={opt.value}>
                                            {opt.label}
                                            <Select.ItemIndicator />
                                        </Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Positioner>
                        </Portal>
                    </Select.Root>
                    {!launched ? (
                        <Button onClick={() => { try { manager?.takeOff?.(); } catch { } }} colorScheme="green">Take Off</Button>
                    ) : (
                        <Button onClick={onResetRocket} variant="outline" colorScheme="orange">Reset Rocket</Button>
                    )}
                    <Select.Root size="sm" minW={32} collection={rocketOptions} value={[String(activeIdx)]}
                        onValueChange={(d: any) => {
                            const v = Array.isArray(d?.value) ? d.value[0] : d?.value;
                            const idx = Number(v) | 0;
                            setActiveIdx(idx);
                            try { manager?.setActiveRocketIndex?.(idx); } catch { }
                        }}>
                        <Select.HiddenSelect />
                        <Select.Control>
                            <Select.Trigger>
                                <Select.ValueText placeholder="Active rocket" />
                            </Select.Trigger>
                            <Select.IndicatorGroup>
                                <Select.Indicator />
                            </Select.IndicatorGroup>
                        </Select.Control>
                        <Portal>
                            <Select.Positioner>
                                <Select.Content>
                                    {rocketOptions.items.map((opt: any) => (
                                        <Select.Item item={opt} key={opt.value}>
                                            {opt.label}
                                            <Select.ItemIndicator />
                                        </Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Positioner>
                        </Portal>
                    </Select.Root>
                </HStack>
            </HStack>
            <Grid templateColumns="repeat(4, 1fr)" p={2} gap={3}>
                <GridItem>
                    {/* Navigation */}
                    <Card.Root variant="subtle">
                        <Card.Header><Heading size="sm">Navigation</Heading></Card.Header>
                        <Card.Body>
                            <VStack align="stretch" fontFamily="mono" fontSize="sm">
                                <Text>Altitude: {rocketSnap?.exposedKeys?.includes('altitude') ? fmt(rocketSnap?.altitude ?? 0) + ' m' : 'N/A'}</Text>

                                {rocketSnap?.exposedKeys?.includes('position') && (
                                    <Text>Position: x={fmt(rocketSnap?.position?.x ?? 0)} m,
                                        y={fmt(rocketSnap?.position?.y ?? 0)} m</Text>
                                )}

                                {rocketSnap?.exposedKeys?.includes('velocity') && (
                                    <Text>Velocity: x={fmt(rocketSnap?.velocity?.x ?? 0)} m/s,
                                        y={fmt(rocketSnap?.velocity?.y ?? 0)} m/s, |v|={fmt(speedMag)} m/s</Text>
                                )}

                                {rocketSnap?.exposedKeys?.includes('orientationRad') && (
                                    <>
                                        <Text>Orientation: {fmt(((rocketSnap?.orientationRad ?? 0) * 180) / Math.PI, 1)}°</Text>
                                        <Text>Turn rate: {fmt(rocketSnap?.rwOmegaRadPerS ?? 0, 3)} rad/s ({fmt(((rocketSnap?.rwOmegaRadPerS ?? 0) * 180) / Math.PI, 1)} °/s)</Text>
                                        {typeof rocketSnap?.rwDesiredOmegaRadPerS === 'number' && (
                                            <Text color="gray.500">Desired turn rate: {fmt(rocketSnap?.rwDesiredOmegaRadPerS ?? 0, 3)} rad/s ({fmt(((rocketSnap?.rwDesiredOmegaRadPerS ?? 0) * 180) / Math.PI, 1)} °/s)</Text>
                                        )}
                                    </>
                                )}

                                {rocketSnap?.exposedKeys?.includes('apAltitude') && (
                                    <Text>Apoapsis (Ap): {orbit && isFinite(orbit.apAlt) ? fmt(orbit.apAlt) + ' m' : '-'}</Text>
                                )}
                                {rocketSnap?.exposedKeys?.includes('peAltitude') && (
                                    <Text>Periapsis (Pe): {orbit && isFinite(orbit.peAlt) ? fmt(orbit.peAlt) + ' m' : '-'}</Text>
                                )}

                                {rocketSnap?.exposedKeys?.includes('airDensity') && typeof rocketSnap?.airDensity === 'number' && (
                                    <Text>Air density: {fmt(Number(rocketSnap?.airDensity || 0), 3)} kg/m³ {rocketSnap?.inAtmosphere ? '' : '(space)'}</Text>
                                )}
                            </VStack>
                        </Card.Body>
                    </Card.Root>
                    {/* Rocket Stats */}
                    <Card.Root variant="subtle">
                        <Card.Header><Heading size="sm">Rocket</Heading></Card.Header>
                        <Card.Body>
                            <VStack align="stretch" fontFamily="mono" fontSize="sm">
                                <Text>Fuel: {fmt(rocketSnap?.fuelKg ?? 0)} kg</Text>
                                <Text>Burn Rate: {fmt(rocketSnap?.fuelConsumptionKgPerS ?? 0)} kg/s</Text>
                                <Text>Δv (est): {fmt(dv)} m/s</Text>
                                <Progress.Root value={batteryPct} maxW="sm" min={0} max={100}>
                                    <HStack gap="5">
                                        <Progress.Label>Battery</Progress.Label>
                                        <Progress.Track flex="1">
                                            <Progress.Range />
                                        </Progress.Track>
                                        <Progress.ValueText> <Text fontFamily="mono"
                                            fontSize="sm">{fmt(rocketSnap?.batteryJoules ?? 0)} J
                                            / {fmt(rocketSnap?.batteryCapacityJoules ?? 0)} J
                                            ({fmt(batteryPct, 1)}%)</Text></Progress.ValueText>
                                    </HStack>

                                </Progress.Root>
                                <Text>Mass: {fmt(rocketSnap?.massKg ?? 0)} kg</Text>
                                <Text>RW max turn rate: {fmt(rocketSnap?.rwMaxOmegaRadPerS ?? 0, 3)} rad/s ({fmt(((rocketSnap?.rwMaxOmegaRadPerS ?? 0) * 180) / Math.PI, 1)} °/s)</Text>
                                <Text>Temperature: {fmt(rocketSnap?.temperature ?? 0)} / {fmt(services.upgrades?.getMaxTemperature?.(Number(envSnap?.activeRocketIndex ?? 0) | 0) ?? 1000)} units</Text>
                            </VStack>
                        </Card.Body>
                    </Card.Root>

                </GridItem>

                {/* Canvas */}
                <GridItem colSpan={2} rowSpan={1}>
                    <Box display="flex" alignItems="center" justifyContent="center" minH="320px" borderWidth="0px"
                        rounded="md">
                        <Box as="canvas" id="game" width={900} height={600} />
                    </Box>
                </GridItem>

                {/* Minimap */}
                <GridItem colSpan={1} >
                    <Center>
                        <Box as="canvas" ref={miniRef} width="400" height="400"
                            style={{ width: 400, height: 400 }} />
                    </Center>
                </GridItem>

                {/* Base Station Panel */}
                <GridItem colSpan={1}>
                    <BaseStationPanel />
                </GridItem>

                {/* Processing Unit */}
                <GridItem>
                    <Card.Root variant="subtle">
                        <Card.Header><Heading size="sm">Guidance System</Heading></Card.Header>
                        <Card.Body>
                            <VStack align="stretch" fontFamily="mono" fontSize="sm">
                                {/*<Text>Name: {rocketSnap?.cpuName ?? "-"}</Text>*/} {/*<Text>Budget/tick: {fmt(rocketSnap?.cpuProcessingBudgetPerTick ?? 0)}</Text>*/}
                                {/* Optional interval & next-run ETA */}
                                {(rocketSnap?.cpuProcessingIntervalSeconds ?? 0) > 0 && (
                                    <>
                                        <Text>Processing
                                            interval: {fmt(rocketSnap?.cpuProcessingIntervalSeconds ?? 0, 2)} s</Text>
                                        <Text>Next run
                                            in: {fmt(Math.max(0, Number(rocketSnap?.cpuNextRunInSeconds ?? 0)), 2)} s</Text>
                                    </>
                                )}
                                {/*<Text>Slots: {rocketSnap?.cpuSlotCount ?? 0}</Text>*/}
                                <Text>Scripts running: {rocketSnap?.cpuScriptsRunning ?? 0}</Text>
                                <Text>Cost used last tick: {fmt(rocketSnap?.cpuCostUsedLastTick ?? 0)}</Text>
                                <Text>Energy used last tick: {fmt(rocketSnap?.cpuEnergyUsedLastTick ?? 0)} J</Text>
                            </VStack>
                        </Card.Body>
                    </Card.Root>
                </GridItem>

                {/* Forces */}
                <GridItem>
                    <Card.Root variant="subtle">
                        <Card.Header><Heading size="sm">Forces</Heading></Card.Header>
                        <Card.Body>
                            <VStack align="stretch" fontFamily="mono" fontSize="sm">
                                <Text>Thrust: Fx={fmt(rocketSnap?.forces?.thrust.fx ?? 0)} N,
                                    Fy={fmt(rocketSnap?.forces?.thrust.fy ?? 0)} N</Text>
                                <Text>Drag: Fx={fmt(rocketSnap?.forces?.drag.fx ?? 0)} N,
                                    Fy={fmt(rocketSnap?.forces?.drag.fy ?? 0)} N</Text>
                                <Text>Gravity (total): Fx={fmt(rocketSnap?.forces?.gravity.fx ?? 0)} N,
                                    Fy={fmt(rocketSnap?.forces?.gravity.fy ?? 0)} N</Text>

                                {rocketSnap?.forces?.gravity.perBody?.map((g: any) => (
                                    <Text key={g.id} color="gray.500">Gravity {g.name}: Fx={fmt(g.fx)} N,
                                        Fy={fmt(g.fy)} N</Text>
                                ))}
                            </VStack>
                        </Card.Body>
                    </Card.Root>
                </GridItem>

                {/* Script Logs */}
                <GridItem colSpan={2}>
                    <ScriptLogsPanel />
                </GridItem>
            </Grid>
        </VStack>
    );
}

// --- Base Station Panel ---
function BaseStationPanel() {
    const { services } = useAppCore();
    const [packets, setPackets] = useState<any[]>([]);

    useEffect(() => {
        const id = setInterval(() => {
            const list = (services as any).getReceivedPackets ? (services as any).getReceivedPackets() : [];
            // Update if changed (shallow compare length or last id)
            setPackets(prev => {
                if (prev.length === list.length && prev[prev.length - 1]?.id === list[list.length - 1]?.id) return prev;
                return [...list];
            });
        }, 500);
        return () => clearInterval(id);
    }, [services]);

    return (
        <Card.Root variant="subtle">
            <Card.Header><Heading size="sm">Base Station (Received Data)</Heading></Card.Header>
            <Card.Body>
                <VStack align="stretch" maxH="220px" overflowY="auto" fontFamily="mono" fontSize="xs" gap={1}>
                    {packets.length === 0 && <Text color="gray.500">No data received.</Text>}
                    {packets.slice().reverse().map((p) => (
                        <Box key={p.id} p={1} borderWidth="1px" rounded="sm" bg={{ base: "gray.50", _dark: "gray.800/50" }}>
                            <HStack justify="space-between">
                                <Text fontWeight="bold" color="cyan.400">{p.type.toUpperCase()}</Text>
                                <Text color="gray.500">{p.sizeKb}kb</Text>
                            </HStack>
                            <Text lineClamp={2} color="gray.500">{JSON.stringify(p.data)}</Text>
                            <Text fontSize="xx-small" color="gray.400">via {p.sourceId} &rarr; {p.targetId}</Text>
                        </Box>
                    ))}
                </VStack>
            </Card.Body>
        </Card.Root>
    );
}
function ScriptLogsPanel() {
    const { manager } = useAppCore();
    const [activeTab, setActiveTab] = useState<string>("0");
    const scrollRef = useRef<HTMLDivElement | null>(null);

    const slotInfo = useMemo(() => {
        try {
            return manager?.getRunner().getSlotInfo() ?? [];
        } catch {
            return [];
        }
    }, [manager, (manager as any)?.getGameSeconds?.()]);

    // Scroll to bottom on re-render to keep newest lines visible
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [slotInfo, activeTab]);

    const clearCurrent = () => {
        try {
            const idx = Number(activeTab) || 0;
            manager?.getRunner().clearSlotLogs(idx);
        } catch {
        }
    };
    const clearAll = () => {
        try {
            manager?.getRunner().clearAllLogs();
        } catch {
        }
    };

    const linesFor = (idx: number) => (slotInfo[idx]?.logs ?? []);

    const renderLogBox = (idx: number) => (
        <Box ref={idx === Number(activeTab) ? scrollRef : undefined}
            borderWidth="1px" rounded="md" p={2} maxH="220px" overflowY="auto" fontFamily="mono" fontSize="xs" bg={{ _dark: 'gray.800', base: 'white' }}>
            {linesFor(idx).length === 0 && <Text color="gray.500">No logs yet.</Text>}
            {linesFor(idx).map((ln: string, i: number) => (
                <Text key={i} whiteSpace="pre-wrap">{ln}</Text>
            ))}
        </Box>
    );

    return (
        <Card.Root variant="subtle">
            <Card.Header>
                <HStack justify="space-between" align="center">
                    <Heading size="sm">Script Logs</Heading>
                    <HStack gap={2}>
                        <Button size="xs" variant="outline" onClick={clearCurrent}>Clear Current</Button>
                        <Button size="xs" variant="outline" onClick={clearAll}>Clear All</Button>
                    </HStack>
                </HStack>
            </Card.Header>
            <Card.Body>
                {slotInfo.length <= 1 ? (
                    <VStack align="stretch">
                        <Text fontSize="sm"
                            color="gray.500">{slotInfo[0]?.name || "Slot 1"}{slotInfo[0]?.enabled ? " (enabled)" : " (disabled)"}</Text>
                        {renderLogBox(0)}
                    </VStack>
                ) : (
                    <Tabs.Root value={activeTab}
                        onValueChange={(d: any) => setActiveTab(String(Array.isArray(d?.value) ? d.value[0] : d?.value ?? "0"))}>
                        <Tabs.List>
                            {slotInfo.map((s, i) => (
                                <Tabs.Trigger key={i} value={String(i)}>
                                    {s.name || `Slot ${i + 1}`}
                                </Tabs.Trigger>
                            ))}
                        </Tabs.List>
                        {slotInfo.map((s, i) => (
                            <Tabs.Content key={i} value={String(i)}>
                                <VStack align="stretch" gap={1} mt={2}>
                                    <Text fontSize="sm"
                                        color="gray.500">{s.enabled ? "Enabled" : "Disabled"} • {s.hasScript ? "Has script" : "No script"}</Text>
                                    {renderLogBox(i)}
                                </VStack>
                            </Tabs.Content>
                        ))}
                    </Tabs.Root>
                )}
            </Card.Body>
        </Card.Root>
    );
}
