import React, { useEffect, useMemo, useRef, useState } from "react";
import { MinimapPanel } from "../components/MinimapPanel";
import {
    Badge,
    Box,
    Button,
    Card,
    Center,
    createListCollection,
    Grid,
    GridItem,
    Heading,
    HStack,
    Icon,
    Portal,
    Progress,
    Select,
    Separator,
    Tabs,
    Text,
    VStack
} from "@chakra-ui/react";
import { useAppCore } from "../app/AppContext";
import { estimateDeltaV, mag2 } from "../app/utils/rocketPerf";
import { FaGlobe, FaTachometerAlt, FaRocket, FaThermometerHalf, FaParachuteBox, FaWind, FaSatelliteDish, FaFlask } from "react-icons/fa";
import { SpaceCenterHeader } from "../components/SpaceCenterHeader";

// --- Helpers ---
function fmt(n: number, digits = 2): string {
    if (!isFinite(n)) return "-";
    const a = Math.abs(n);
    if (a >= 10000) return n.toFixed(0);
    if (a >= 1000) return n.toFixed(1);
    return n.toFixed(digits);
}

export default function WorldScenePage({ onNavigate }: { onNavigate?: (v: string) => void }) {
    const { manager, services } = useAppCore();
    const [running, setRunning] = useState<boolean>(false);
    const [speed, setSpeed] = useState<number>(1);
    const [snapKey, setSnapKey] = useState<number>(0);
    const [launched, setLaunched] = useState<boolean>(false);
    const [showVectors, setShowVectors] = useState<boolean>(false);

    // Speed options
    const speedOptions = useMemo(() => createListCollection({
        items: [{ label: "0.5x", value: "0.5" }, { label: "1x", value: "1" }, { label: "2x", value: "2" }, { label: "4x", value: "4" }, { label: "10x", value: "10" }, { label: "50x", value: "50" }],
    }), []);

    // Loop
    useEffect(() => {
        if (!manager) return;
        const sync = () => {
            setRunning(manager.isRunning());
            setSpeed(manager.getSpeedMultiplier ? manager.getSpeedMultiplier() : 1);
            try { setLaunched(!!manager.hasLaunched?.()); } catch { }
        };
        let lastTs = 0;
        const unsub = manager.onPostRender((_alpha, ts) => {
            if (ts - lastTs < 100) return;
            lastTs = ts;
            setSnapKey((k) => (k + 1) % 1000000);
            sync();
        });
        sync();
        return () => { unsub?.(); };
    }, [manager]);

    const envSnap = useMemo(() => {
        try { return manager?.getEnvironment().snapshot(); } catch { return null; }
    }, [manager, snapKey]);

    const rocketSnap = envSnap?.rocket as any;

    // Rocket selection
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
    }, [manager, envSnap?.rockets?.length]);

    const activeIdx = Number(envSnap?.activeRocketIndex ?? 0) | 0;

    // Controls
    const onPlayPause = () => { if (manager) { if (manager.isRunning()) manager.pause(); else manager.start(); setRunning(manager.isRunning()); } };
    const onSpeedChange = (v: string) => { const n = parseFloat(v); if (isFinite(n)) { setSpeed(n); manager?.setSpeedMultiplier?.(n); } };
    const onResetRocket = () => manager?.resetSimulationOnly?.();
    const onTakeOff = () => { try { manager?.takeOff?.(); } catch { } };

    // Derived Data
    const alt = rocketSnap?.altitude ?? 0;
    const speedMag = rocketSnap ? mag2(rocketSnap.velocity?.x ?? 0, rocketSnap.velocity?.y ?? 0) : 0;
    const verticalSpeed = rocketSnap?.velocity?.y ?? 0; // rough approx if y is up
    const fuel = rocketSnap?.fuelKg ?? 0;
    const fuelRate = rocketSnap?.fuelConsumptionKgPerS ?? 0;
    // Throttle: provided by snapshot or 0
    const throttle = (rocketSnap?.avgEngineThrustPct ?? 0) * 100;
    const energy = rocketSnap?.batteryJoules ?? 0;
    const capacity = rocketSnap?.batteryCapacityJoules ?? 0;
    const batPct = capacity > 0 ? (energy / capacity) * 100 : 0;
    const temp = rocketSnap?.temperature ?? 0;
    const maxTemp = services.upgrades?.getMaxTemperature?.(activeIdx) ?? 1000;
    const chuteDeployed = !!rocketSnap?.parachuteDeployed;
    const dragCd = rocketSnap?.totalDragCoefficient ?? 0.5;

    // Latitude (Angle from primary)
    const primaryId = envSnap?.primaryId;
    const primaryBody = envSnap?.bodies?.find((b: any) => b.id === primaryId);
    const primaryPos = primaryBody?.position ?? { x: 0, y: 0 };
    const rPos = rocketSnap?.position ?? { x: 0, y: 0 };
    // atan2(y, x) gives angle from +X axis (East). 
    // -180 to 180.
    const latDeg = Math.atan2(rPos.y - primaryPos.y, rPos.x - primaryPos.x) * (180 / Math.PI);

    return (
        <VStack align="stretch" h="100%" gap={0} bg="gray.950">
            {/* Header */}
            <SpaceCenterHeader
                title="Launch Control"
                icon={FaGlobe}
                description="Mission Telemetry"
                onNavigate={onNavigate}
                currentView="world_scene"
            > <HStack gap={2} >
                    <Button onClick={onPlayPause} variant="subtle" size="xs" colorPalette={running ? "yellow" : "green"}>{running ? "PAUSE" : "RESUME"}</Button>
                    <Select.Root size="xs" w="70px" collection={speedOptions} value={[String(speed)]} onValueChange={(d: any) => onSpeedChange(d.value[0])}>
                        <Select.Control>
                            <Select.Trigger h="24px" minH="unset" py={0}><Select.ValueText /></Select.Trigger>
                        </Select.Control>
                        <Portal>
                            <Select.Positioner>
                                <Select.Content>
                                    {speedOptions.items.map((opt: any) => (
                                        <Select.Item item={opt} key={opt.value}>
                                            {opt.label}
                                        </Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Positioner>
                        </Portal>
                    </Select.Root>
                    {!launched ? <Button size="xs" colorPalette="green" onClick={onTakeOff}>LAUNCH ROCKET</Button> : <Button size="xs" colorPalette="orange" variant="outline" onClick={onResetRocket}>RESET ROCKET</Button>}
                </HStack>
            </SpaceCenterHeader>

            {/* Main Content Grid */}
            <Grid templateColumns="280px 1fr 300px" flex={1} overflow="hidden">

                {/* LEFT: Flight Instruments */}
                <Box borderRightWidth="1px" borderColor="gray.800" bg="gray.900" p={2} overflowY="auto">
                    {!rocketSnap ? (
                        <VStack align="center" justify="center" h="100%" gap={4} color="gray.500">
                            <Icon as={FaRocket} boxSize={8} opacity={0.3} />
                            <Text fontSize="sm" textAlign="center">No Active Rocket</Text>
                            <Button size="xs" variant="outline" onClick={() => onNavigate?.("build")}>Go to VAB</Button>
                        </VStack>
                    ) : (
                        <VStack align="stretch" gap={4}>

                            {/* Throttle & Fuel */}
                            <Card.Root size="sm" variant="subtle" bg="gray.800">
                                <Card.Header pb={1}><HStack justify="space-between"><Text fontSize="xs" fontWeight="bold" color="gray.400">PROPULSION</Text><Icon as={FaRocket} size="xs" /></HStack></Card.Header>
                                <Card.Body>
                                    <VStack align="stretch" gap={3}>
                                        <Box>
                                            <HStack justify="space-between" mb={1}><Text fontSize="xs">Throttle</Text><Text fontSize="xs" fontWeight="mono" color="cyan.300">{fmt(throttle, 0)}%</Text></HStack>
                                            <Progress.Root value={throttle} max={100} size="sm" colorPalette="cyan">
                                                <Progress.Track><Progress.Range /></Progress.Track>
                                            </Progress.Root>
                                        </Box>
                                        <Box>
                                            <HStack justify="space-between" mb={1}><Text fontSize="xs">Fuel</Text><Text fontSize="xs" fontWeight="mono" color={fuelRate > 0 ? "yellow.300" : "gray.300"}>{fmt(fuel, 0)} kg</Text></HStack>
                                            <Progress.Root value={fuel > 0 ? 100 : 0} max={100} size="sm" colorPalette="yellow" striped={fuelRate > 0} animated={fuelRate > 0}>
                                                <Progress.Track><Progress.Range /></Progress.Track>
                                            </Progress.Root>
                                            {fuelRate > 0 && <Text fontSize="xs" color="yellow.500" textAlign="right" mt={1}>-{fmt(fuelRate, 1)} kg/s</Text>}
                                        </Box>
                                    </VStack>
                                </Card.Body>
                            </Card.Root>

                            {/* COMMUNICATIONS */}
                            <Card.Root size="sm" variant="subtle" bg="gray.800">
                                <Card.Header pb={1}><HStack justify="space-between"><Heading size="xs" color="gray.400">COMMUNICATIONS</Heading><Icon as={FaSatelliteDish} size="xs" /></HStack></Card.Header>
                                <Card.Body>
                                    <VStack align="stretch" gap={2}>
                                        <HStack justify="space-between">
                                            <Text fontSize="xs">Status</Text>
                                            {rocketSnap?.commsInRange ?
                                                <Box px={1.5} py={0.5} bg="green.900" color="green.300" borderRadius="sm" fontSize="xs" fontWeight="bold">CONNECTED</Box> :
                                                <Box px={1.5} py={0.5} bg="red.900" color="red.300" borderRadius="sm" fontSize="xs" fontWeight="bold">NO SIGNAL</Box>
                                            }
                                        </HStack>
                                        <Grid templateColumns="1fr 1fr" gap={2}>
                                            <StatBox label="DISTANCE" value={fmt((rocketSnap?.commsDistanceMeters ?? 0) / 1000, 1)} unit="km" />
                                            <Box bg="gray.950" p={2} borderRadius="md" borderWidth="1px" borderColor="gray.800">
                                                <Text fontSize="xx-small" color="gray.500" fontWeight="bold">QUEUE</Text>
                                                <HStack align="baseline" gap={1}>
                                                    <Text fontSize="md" fontWeight="mono" color="white">{rocketSnap?.packetQueueLength ?? 0}</Text>
                                                    <Text fontSize="xs" color="gray.400">/ {fmt(rocketSnap?.packetQueueSizeKb ?? 0, 2)} KB</Text>
                                                </HStack>
                                            </Box>
                                        </Grid>

                                        <HStack justify="space-between">
                                            <Text fontSize="xs">Upload</Text>
                                            <Text fontSize="xs" fontWeight="mono" color={rocketSnap?.commsInRange ? "green.300" : "red.300"}>{fmt((rocketSnap?.commsBytesSentPerS ?? 0) / 1024, 2)} KB/s</Text>
                                        </HStack>

                                    </VStack>
                                </Card.Body>
                            </Card.Root>

                            {/* SYSTEMS */}
                            <Card.Root size="sm" variant="subtle" bg="gray.800">
                                <Card.Header pb={1}><HStack justify="space-between"><Text fontSize="xs" fontWeight="bold" color="gray.400">SYSTEMS</Text><Icon as={FaTachometerAlt} size="xs" /></HStack></Card.Header>
                                <Card.Body>
                                    <VStack align="stretch" gap={3}>
                                        <Box>
                                            <HStack justify="space-between" mb={1}>
                                                <Text fontSize="xs">Battery</Text>
                                                <Text fontSize="xs" fontWeight="mono">{fmt(energy)} J</Text>
                                            </HStack>
                                            <Progress.Root value={batPct} max={100} size="xs" colorPalette={batPct < 20 ? "red" : "green"}>
                                                <Progress.Track><Progress.Range /></Progress.Track>
                                            </Progress.Root>
                                            <HStack justify="space-between" mt={1}>
                                                <Text fontSize="xx-small" color="green.400">+{fmt(rocketSnap?.energyGainJPerS ?? 0, 1)} W</Text>
                                                <Text fontSize="xx-small" color="orange.400">-{fmt(rocketSnap?.energyDrawJPerS ?? 0, 1)} W</Text>
                                            </HStack>
                                        </Box>
                                        <Box>
                                            <HStack justify="space-between" mb={1}><Text fontSize="xs">Thermal Status</Text></HStack>

                                            {/* Nose Temp */}
                                            <HStack justify="space-between" mb={0.5}>
                                                <Text fontSize="xx-small" color="orange.300">NOSE</Text>
                                                <Text fontSize="xx-small" fontWeight="mono" color="gray.400">{fmt(rocketSnap?.noseTemperature ?? 0, 0)} / {rocketSnap?.maxNoseTemperature ?? 1200}</Text>
                                            </HStack>
                                            <Progress.Root value={((rocketSnap?.noseTemperature ?? 0) / (rocketSnap?.maxNoseTemperature ?? 2400)) * 100} max={100} size="xs" colorPalette="orange">
                                                <Progress.Track><Progress.Range /></Progress.Track>
                                            </Progress.Root>

                                            {/* Tail Temp */}
                                            <HStack justify="space-between" mb={0.5} mt={2}>
                                                <Text fontSize="xx-small" color="blue.300">TAIL</Text>
                                                <Text fontSize="xx-small" fontWeight="mono" color="gray.400">{fmt(rocketSnap?.tailTemperature ?? 0, 0)} / {rocketSnap?.maxTailTemperature ?? 1200}</Text>
                                            </HStack>
                                            <Progress.Root value={((rocketSnap?.tailTemperature ?? 0) / (rocketSnap?.maxTailTemperature ?? 3400)) * 100} max={100} size="xs" colorPalette="cyan">
                                                <Progress.Track><Progress.Range /></Progress.Track>
                                            </Progress.Root>
                                        </Box>

                                        {/* Status Badges */}
                                        <HStack gap={2} mt={1}>
                                            <Badge variant={rocketSnap?.solarDeployed ? "solid" : "subtle"} colorPalette={rocketSnap?.solarDeployed ? "green" : "gray"} size="xs">
                                                {rocketSnap?.solarDeployed ? "SOLAR: ON" : "SOLAR: OFF"}
                                            </Badge>
                                            <Badge variant={rocketSnap?.parachuteDeployed ? "solid" : "subtle"} colorPalette={rocketSnap?.parachuteDeployed ? "green" : "gray"} size="xs">
                                                {rocketSnap?.parachuteDeployed ? "CHUTE: ON" : "CHUTE: OFF"}
                                            </Badge>
                                        </HStack>
                                    </VStack>
                                </Card.Body>
                            </Card.Root>

                            {/* SCIENCE */}
                            <Card.Root size="sm" variant="subtle" bg="gray.800">
                                <Card.Header pb={1}><HStack justify="space-between"><Text fontSize="xs" fontWeight="bold" color="cyan.400">SCIENCE</Text><Icon as={FaFlask} size="xs" color="cyan.400" /></HStack></Card.Header>
                                <Card.Body>
                                    {rocketSnap?.science?.length ? (
                                        <VStack align="stretch" gap={2}>
                                            {rocketSnap.science.map((s: any) => (
                                                <HStack key={s.id} justify="space-between">
                                                    <Text fontSize="xs" color="gray.300">{s.name}</Text>
                                                    <Text fontSize="xs" fontWeight="bold" color={s.hasData ? "green.300" : "gray.500"}>{s.hasData ? "READY" : "IDLE"}</Text>
                                                </HStack>
                                            ))}
                                            <Box pt={1} borderTopWidth="1px" borderColor="gray.700">
                                                <Grid templateColumns="1fr 1fr" gap={2}>
                                                    {rocketSnap.science.some((s: any) => s.id === "science.temp") && (
                                                        <StatBox label="TEMP" value={fmt(rocketSnap.ambientTemperature ?? 0, 1)} unit="K" />
                                                    )}
                                                    {rocketSnap.science.some((s: any) => s.id === "science.atmos") && (
                                                        <StatBox label="PRESSURE" value={fmt(rocketSnap.ambientPressure ?? 0, 1)} unit="Pa" />
                                                    )}
                                                    {rocketSnap.science.some((s: any) => s.id === "science.surface") && (
                                                        <StatBox label="TERRAIN" value={rocketSnap?.currentTerrain ?? "-"} unit="" />
                                                    )}
                                                </Grid>
                                            </Box>
                                        </VStack>
                                    ) : (
                                        <Text fontSize="xs" color="gray.500" fontStyle="italic">No Experiments Installed</Text>
                                    )}
                                </Card.Body>
                            </Card.Root>

                            {/* Aerodynamics */}
                            <Card.Root size="sm" variant="subtle" bg="gray.800">
                                <Card.Header pb={1}><HStack justify="space-between"><Text fontSize="xs" fontWeight="bold" color="gray.400">AERODYNAMICS</Text><Icon as={FaWind} size="xs" /></HStack></Card.Header>
                                <Card.Body>
                                    <HStack justify="space-between" mb={2}>
                                        <Text fontSize="xs">Drag Coeff (Cd)</Text>
                                        <Text fontSize="xs" fontWeight="mono">{fmt(dragCd, 2)}</Text>
                                    </HStack>
                                    <HStack justify="space-between">
                                        <Text fontSize="xs">Parachutes</Text>
                                        {chuteDeployed ?
                                            <HStack gap={1} color="green.400"><Icon as={FaParachuteBox} /><Text fontSize="xs" fontWeight="bold">DEPLOYED</Text></HStack>
                                            : <Text fontSize="xs" color="gray.500">STOWED</Text>
                                        }
                                    </HStack>
                                </Card.Body>
                            </Card.Root>

                        </VStack>
                    )}
                </Box>

                {/* CENTER: Canvas */}
                <Box bg="black" position="relative" display="flex" flexDirection="column">
                    <Box flex={1} display="flex" alignItems="center" justifyContent="center" overflow="hidden" position="relative">
                        <Box as="canvas" id="game" width={900} height={600} w="100%" h="100%" objectFit="contain" />

                        {/* DESTRUCTION OVERLAY */}
                        {envSnap?.destroyed && (
                            <Center position="absolute" inset={0} bg="rgba(0,0,0,0.7)" zIndex={10} flexDirection="column">
                                <Heading size="2xl" color="red.500" mb={2}>MISSION FAILED</Heading>
                                <Text color="white" mb={4}>Rocket destroyed by heat or impact.</Text>
                                <Button colorPalette="red" variant="solid" onClick={onResetRocket}>RESET MISSION</Button>
                            </Center>
                        )}
                    </Box>
                    {/* Overlay Stats? */}
                    <Box position="absolute" top={2} left={2} pointerEvents="none">
                        <Text fontSize="xs" fontFamily="mono" color="white" textShadow="0 0 2px black">T+{fmt(manager?.getGameSeconds?.() ?? 0, 1)}s</Text>
                    </Box>

                </Box>

                {/* RIGHT: Telemetry & Logs */}
                <Box borderLeftWidth="1px" borderColor="gray.800" bg="gray.900" p={2} overflowY="auto">
                    {/* MINIMAP */}
                    <Box bg="black" position="relative" display="flex" flexDirection="column" mb={2}>

                        <MinimapPanel envSnap={envSnap} height="280px" />
                    </Box>

                    {!rocketSnap ? (
                        <VStack align="center" justify="center" h="100%" gap={4} color="gray.500">
                            <Text fontSize="sm" textAlign="center" fontStyle="italic">Telemetry Offline</Text>
                        </VStack>
                    ) : (

                        <VStack align="stretch" gap={4}>

                            {/* FLIGHT DATA */}
                            <Card.Root size="sm" variant="subtle" bg="gray.800">
                                <Card.Header pb={1}>
                                    <HStack justify="space-between">
                                        <Heading size="xs" color="gray.400">FLIGHT DATA</Heading>
                                        <Button size="2xs" variant={showVectors ? "solid" : "ghost"} colorPalette="cyan" onClick={() => setShowVectors(!showVectors)}>XY</Button>
                                    </HStack>
                                </Card.Header>
                                <Card.Body>
                                    <Grid templateColumns={showVectors ? "1fr" : "1fr 1fr"} gap={2}>
                                        <StatBox label="MASS" value={fmt(rocketSnap?.massKg ?? 0, 0)} unit="kg" />
                                        <StatBox label="ALTITUDE" value={fmt(alt)} unit="m" />
                                        {showVectors ? (
                                            <StatBox label="VELOCITY" value={`x: ${fmt(rocketSnap?.velocity?.x ?? 0, 0)}  y: ${fmt(rocketSnap?.velocity?.y ?? 0, 0)}`} unit="m/s" />
                                        ) : (
                                            <StatBox label="SPEED" value={fmt(speedMag)} unit="m/s" />
                                        )}
                                        <StatBox label="V-SPEED" value={fmt(verticalSpeed)} unit="m/s" />
                                        <StatBox label="LATITUDE" value={`${fmt(latDeg, 1)}°`} unit="" />
                                        <StatBox label="TURN RATE" value={fmt((rocketSnap?.angularVelocityRadPerS ?? 0) * 57.3, 1)} unit="°/s" />
                                        <StatBox label="APOAPSIS" value={fmt(rocketSnap?.apAltitude ?? 0)} unit="m" />
                                        <StatBox label="PERIAPSIS" value={fmt(rocketSnap?.peAltitude ?? 0)} unit="m" />

                                    </Grid>
                                </Card.Body>
                            </Card.Root>

                            {/* FORCES */}
                            <Card.Root size="sm" variant="subtle" bg="gray.800">
                                <Card.Header pb={1}><Heading size="xs" color="gray.400">FORCES (N)</Heading></Card.Header>
                                <Card.Body>
                                    <Grid templateColumns={showVectors ? "1fr" : "1fr 1fr 1fr"} gap={2}>
                                        {showVectors ? (
                                            <>
                                                <StatBox label="THRUST" value={`x: ${fmt(rocketSnap?.forces?.thrust?.fx ?? 0, 0)}  y: ${fmt(rocketSnap?.forces?.thrust?.fy ?? 0, 0)}`} unit="N" />
                                                <StatBox label="DRAG" value={`x: ${fmt(rocketSnap?.forces?.drag?.fx ?? 0, 0)}  y: ${fmt(rocketSnap?.forces?.drag?.fy ?? 0, 0)}`} unit="N" />
                                                <StatBox label="GRAVITY" value={`x: ${fmt(rocketSnap?.forces?.gravity?.fx ?? 0, 0)}  y: ${fmt(rocketSnap?.forces?.gravity?.fy ?? 0, 0)}`} unit="N" />
                                            </>
                                        ) : (
                                            <>
                                                <StatBox label="THRUST" value={fmt(rocketSnap?.forces ? mag2(rocketSnap.forces.thrust.fx ?? rocketSnap.forces.thrust.x, rocketSnap.forces.thrust.fy ?? rocketSnap.forces.thrust.y) : 0, 0)} unit="N" />
                                                <StatBox label="DRAG" value={fmt(rocketSnap?.forces ? mag2(rocketSnap.forces.drag.fx ?? rocketSnap.forces.drag.x, rocketSnap.forces.drag.fy ?? rocketSnap.forces.drag.y) : 0, 0)} unit="N" />
                                                <StatBox label="GRAVITY" value={fmt(rocketSnap?.forces ? mag2(rocketSnap.forces.gravity.fx, rocketSnap.forces.gravity.fy) : 0, 0)} unit="N" />
                                            </>
                                        )}
                                    </Grid>
                                </Card.Body>
                            </Card.Root>

                            {/* CONSOLE */}
                            <ScriptLogsPanel manager={manager} />

                        </VStack>
                    )}
                </Box>

            </Grid>
        </VStack >
    );
}

const StatBox = ({ label, value, unit }: any) => (
    <Box bg="gray.950" p={2} borderRadius="md" borderWidth="1px" borderColor="gray.800">
        <Text fontSize="xx-small" color="gray.500" mb={0.5}>{label}</Text>
        <Text fontSize="sm" fontFamily="mono" color="white" lineHeight={1}>{value}</Text>
        <Text fontSize="xx-small" color="gray.600">{unit}</Text>
    </Box>
);

function ScriptLogsPanel({ manager }: any) {
    const [activeTab, setActiveTab] = useState<string>("0");
    const scrollRef = useRef<HTMLDivElement | null>(null);

    const slotInfo = useMemo(() => {
        try { return manager?.getRunner().getSlotInfo() ?? []; } catch { return []; }
    }, [manager, (manager as any)?.getGameSeconds?.()]); // force update on tick?

    // Auto scroll
    useEffect(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [slotInfo, activeTab]);

    const lines = slotInfo[Number(activeTab)]?.logs ?? [];

    return (
        <Card.Root size="sm" variant="subtle" bg="gray.800" flex={1} display="flex" flexDirection="column">
            <Card.Header pb={1}><Heading size="xs" color="gray.400">GUIDANCE LOG</Heading></Card.Header>
            <Card.Body display="flex" flexDirection="column" gap={2} flex={1} minH="200px">
                <Tabs.Root value={activeTab} onValueChange={(d: any) => setActiveTab(d.value)} variant="plain" size="sm">
                    <Tabs.List bg="gray.900" p={1} borderRadius="md">
                        {slotInfo.map((s: any, i: number) => (
                            <Tabs.Trigger key={i} value={String(i)} flex={1} fontSize="xs" py={1}>{s.name || `S${i}`}</Tabs.Trigger>
                        ))}
                    </Tabs.List>
                    <Box mt={2} bg="black" color="green.300" fontFamily="mono" fontSize="xs" p={2} borderRadius="md" flex={1} overflowY="auto" maxH="200px" ref={scrollRef}>
                        {lines.length === 0 && <Text color="gray.600" fontStyle="italic">_no data</Text>}
                        {lines.map((l: string, i: number) => <Text key={i}>{l}</Text>)}
                    </Box>
                </Tabs.Root>
            </Card.Body>
        </Card.Root>
    )
}


