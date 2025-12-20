import React, { useEffect, useMemo, useRef, useState } from "react";
import { MinimapPanel } from "../components/MinimapPanel";
import { ForceGauge } from "../components/ForceGauge";
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
import { FaGlobe, FaTachometerAlt, FaRocket, FaThermometerHalf, FaParachuteBox, FaWind, FaSatelliteDish, FaFlask, FaMapMarkedAlt, FaCircle, FaClock } from "react-icons/fa";
import { SpaceCenterHeader } from "../components/SpaceCenterHeader";

// --- Helpers ---
function fmt(n: number, digits = 2): string {
    if (!isFinite(n)) return "-";
    const a = Math.abs(n);
    if (a >= 10000) return n.toFixed(0);
    if (a >= 10000) return n.toFixed(1); // Typo protection
    return n.toFixed(digits);
}

import { StatRow } from "../components/ui/StatRow";

export default function WorldScenePage({ onNavigate }: { onNavigate?: (v: string) => void }) {
    const { manager, services } = useAppCore();
    const [snapKey, setSnapKey] = useState<number>(0);
    const [launched, setLaunched] = useState<boolean>(false);
    const [milestonesCount, setMilestonesCount] = useState<number>(0);

    // Loop
    useEffect(() => {
        if (!manager) return;
        const sync = () => {
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

    // Milestones Check
    useEffect(() => {
        const check = () => {
            const mgr = services.getScienceManager?.();
            if (!mgr) return;
            const completed = mgr.getCompletedIds().length;
            if (completed > milestonesCount) {
                // Milestone toast logic here if needed
                setMilestonesCount(completed);
            }
        };
        const interval = setInterval(check, 1000);
        return () => clearInterval(interval);
    }, [services, milestonesCount]);

    const envSnap = useMemo(() => {
        try { return manager?.getEnvironment().snapshot(); } catch { return null; }
    }, [manager, snapKey]);

    const rocketSnap = envSnap?.rocket as any;

    // Controls
    const onResetRocket = () => manager?.resetSimulationOnly?.();
    const onTakeOff = () => { try { manager?.takeOff?.(); } catch { } };

    // Derived Flight Data
    const alt = rocketSnap?.altitude ?? 0;
    const speedMag = rocketSnap ? mag2(rocketSnap.velocity?.x ?? 0, rocketSnap.velocity?.y ?? 0) : 0;
    const verticalSpeed = rocketSnap?.velocity?.y ?? 0;
    const fuel = rocketSnap?.fuelKg ?? 0;
    const fuelRate = rocketSnap?.fuelConsumptionKgPerS ?? 0;
    const throttle = (rocketSnap?.avgEngineThrustPct ?? 0) * 100;
    const mass = rocketSnap?.massKg ?? 1;

    // TWR & DeltaV
    const thrustN = rocketSnap?.forces ? mag2(rocketSnap.forces.thrust.fx, rocketSnap.forces.thrust.fy) : 0;
    const weightN = mass * 9.81; // Using standard G for ref
    const twr = weightN > 0 ? thrustN / weightN : 0;

    // Delta V Estimate
    const dryMass = Math.max(1, mass - fuel);
    const isp = rocketSnap?.avgEngineIsp || 300;
    const dV = 9.81 * isp * Math.log(mass / dryMass);

    const energy = rocketSnap?.batteryJoules ?? 0;
    const capacity = rocketSnap?.batteryCapacityJoules ?? 0;
    const batPct = capacity > 0 ? (energy / capacity) * 100 : 0;

    const latDeg = (() => {
        const pId = envSnap?.primaryId;
        const pBody = envSnap?.bodies?.find((b: any) => b.id === pId);
        if (!pBody || !rocketSnap) return 0;
        return Math.atan2(rocketSnap.position.y - pBody.position.y, rocketSnap.position.x - pBody.position.x) * (180 / Math.PI);
    })();

    const orientDeg = (rocketSnap?.orientationRad ?? 0) * (180 / Math.PI);
    const heading = (450 - orientDeg) % 360;

    return (
        <VStack align="stretch" h="100%" gap={0} bg="gray.950" className="dashboard-container">
            {/* Header */}
            <SpaceCenterHeader
                title="Launch Control"
                icon={FaGlobe}
                description="Mission Dashboard"
                onNavigate={onNavigate}
                currentView="world_scene"
            >
                <HStack gap={2} >
                    {!launched ? <Button size="xs" colorPalette="green" onClick={onTakeOff}>LAUNCH</Button> : (
                        <>
                            {launched && alt < 20 && speedMag < 1 && (
                                <Button size="xs" colorPalette="cyan" onClick={() => manager?.recoverActiveRocket?.()}>RECOVER</Button>
                            )}
                            <Button size="xs" colorPalette="orange" variant="outline" onClick={onResetRocket}>RESET</Button>
                        </>
                    )}
                </HStack>
            </SpaceCenterHeader>

            {/* Main 3-Column Dashboard */}
            <Grid templateColumns="320px 1fr 320px" flex={1} overflow="hidden" gap={0} bg="black">

                {/* LEFT COL: Instruments */}
                <Box borderRightWidth="1px" borderColor="gray.800" bg="gray.900" p={3} overflowY="auto" display="flex" flexDirection="column" gap={3}>
                    <SectionHeader title="PROPULSION" icon={FaRocket} />
                    <Card.Root size="sm" variant="subtle" bg="gray.900" borderWidth="1px" borderColor="gray.800">
                        <Card.Body gap={2}>
                            <Box mb={2}>
                                <HStack justify="space-between" mb={1}><Text fontSize="xs" color="gray.400">THROTTLE</Text><Text fontSize="xs" color="cyan.300">{fmt(throttle, 0)}%</Text></HStack>
                                <Progress.Root value={throttle} max={100} size="sm" colorPalette="cyan">
                                    <Progress.Track bg="gray.800"><Progress.Range /></Progress.Track>
                                </Progress.Root>
                            </Box>
                            <Box mb={2}>
                                <HStack justify="space-between" mb={1}><Text fontSize="xs" color="gray.400">FUEL</Text><Text fontSize="xs" color={fuelRate > 0 ? "yellow.300" : "gray.400"}>{fmt(fuel, 0)} kg</Text></HStack>
                                <Progress.Root value={fuel > 0 ? 100 : 0} max={100} size="sm" colorPalette="yellow" striped={fuelRate > 0} animated={fuelRate > 0}>
                                    <Progress.Track bg="gray.800"><Progress.Range /></Progress.Track>
                                </Progress.Root>
                                {fuelRate > 0 && <Text fontSize="xs" color="yellow.500" textAlign="right">-{fmt(fuelRate, 1)} kg/s</Text>}
                            </Box>
                            <Grid templateColumns="1fr 1fr" gap={2} mt={1}>
                                <BigStat label="TWR" value={fmt(twr, 2)} color={twr > 1 ? "green.300" : "orange.300"} />
                                <BigStat label="DELTA-V" value={fmt(dV, 0)} unit="m/s" color="blue.300" />
                            </Grid>
                        </Card.Body>
                    </Card.Root>

                    <SectionHeader title="AERODYNAMICS & FORCES" icon={FaWind} />
                    <Card.Root size="sm" variant="subtle" bg="gray.900" borderWidth="1px" borderColor="gray.800">
                        <Card.Body>
                            <ForceGauge forces={rocketSnap?.forces} orientationRad={rocketSnap?.orientationRad} />
                            <VStack mt={3} gap={1}>
                                <StatRow label="Drag Coeff" value={fmt(rocketSnap?.totalDragCoefficient ?? 0, 2)} />
                                <StatRow label="Q (Dyn Pressure)" value={fmt(0.5 * (rocketSnap?.airDensity ?? 0) * speedMag * speedMag, 0)} unit="Pa" />
                            </VStack>
                        </Card.Body>
                    </Card.Root>

                    <SectionHeader title="SYSTEMS STATUS" icon={FaTachometerAlt} />
                    <Card.Root size="sm" variant="subtle" bg="gray.900" borderWidth="1px" borderColor="gray.800">
                        <Card.Body gap={2}>

                            <Box mb={2}>
                                <Text fontSize="xs" color="gray.400" mb={1}>THERMAL</Text>
                                <HStack justify="space-between" mb={0.5}>
                                    <Text fontSize="xx-small" color="orange.400">NOSE</Text>
                                    <Text fontSize="xx-small" fontWeight="mono" color="gray.500">{fmt(rocketSnap?.noseTemperature ?? 0, 0)} / {rocketSnap?.maxNoseTemperature ?? 1200} K</Text>
                                </HStack>
                                <Progress.Root value={((rocketSnap?.noseTemperature ?? 0) / (rocketSnap?.maxNoseTemperature ?? 1200)) * 100} max={100} size="xs" colorPalette="orange">
                                    <Progress.Track bg="gray.800"><Progress.Range /></Progress.Track>
                                </Progress.Root>

                                <HStack justify="space-between" mb={0.5} mt={1}>
                                    <Text fontSize="xx-small" color="blue.400">TAIL</Text>
                                    <Text fontSize="xx-small" fontWeight="mono" color="gray.500">{fmt(rocketSnap?.tailTemperature ?? 0, 0)} / {rocketSnap?.maxTailTemperature ?? 1200} K</Text>
                                </HStack>
                                <Progress.Root value={((rocketSnap?.tailTemperature ?? 0) / (rocketSnap?.maxTailTemperature ?? 1200)) * 100} max={100} size="xs" colorPalette="cyan">
                                    <Progress.Track bg="gray.800"><Progress.Range /></Progress.Track>
                                </Progress.Root>
                            </Box>
                            <Box mb={1}>
                                <HStack justify="space-between" mb={1}><Text fontSize="xs" color="gray.400">BATTERY {fmt(batPct, 0)}%</Text><Text fontSize="xs" color={batPct < 20 ? "red.300" : "green.300"}>{fmt(energy)} J</Text></HStack>
                                <Progress.Root value={batPct} max={100} size="xs" colorPalette={batPct < 20 ? "red" : "green"}>
                                    <Progress.Track bg="gray.800"><Progress.Range /></Progress.Track>
                                </Progress.Root>
                                <HStack justify="space-between" mt={1}>
                                    <Text fontSize="xx-small" color="green.500">+{fmt(rocketSnap?.energyGainJPerS ?? 0, 0)}W</Text>
                                    <Text fontSize="xx-small" color="orange.500">-{fmt(rocketSnap?.energyDrawJPerS ?? 0, 0)}W</Text>
                                </HStack>
                            </Box>

                            <Separator borderColor="gray.800" />
                            <HStack justify="space-between">
                                {rocketSnap?.hasSolarPanels && (
                                    <Badge size="xs" colorPalette={rocketSnap?.solarDeployed ? "green" : "gray"}>{rocketSnap?.solarDeployed ? "SOLAR ON" : "SOLAR OFF"}</Badge>
                                )}
                                {rocketSnap?.hasParachutes && (
                                    <Badge size="xs" colorPalette={rocketSnap?.parachuteDeployed ? "green" : "gray"}>{rocketSnap?.parachuteDeployed ? "CHUTE ON" : "CHUTE OFF"}</Badge>
                                )}
                            </HStack>
                        </Card.Body>
                    </Card.Root>
                </Box>

                {/* CENTER COL: Canvas & Logs */}
                <Box position="relative" display="flex" flexDirection="column" bg="black">
                    {/* Viewport (Canvas) */}
                    <Box flex={1} position="relative" minH="300px" overflow="hidden">
                        <Box as="canvas" id="game" w="100%" h="100%" objectFit="contain" />

                        {/* DESTRUCTION OVERLAY */}
                        {envSnap?.destroyed && (
                            <Center position="absolute" inset={0} bg="blackAlpha.800" zIndex={20} flexDirection="column" backdropFilter="blur(4px)">
                                <VStack gap={4} p={8} bg="gray.900" borderRadius="xl" borderWidth="1px" borderColor="red.900" shadow="xl">
                                    <Heading size="3xl" color="red.500" letterSpacing="widest">MISSION FAILED</Heading>
                                    <Text color="gray.300" fontSize="lg">Rapid Unscheduled Disassembly Detected.</Text>
                                    <Button size="lg" colorPalette="red" variant="solid" onClick={onResetRocket}>
                                        <Icon as={FaRocket} mr={2} />
                                        REVERT TO LAUNCH
                                    </Button>
                                </VStack>
                            </Center>
                        )}

                        {/* Overlay Info (Top Left) */}
                        <Box position="absolute" top={4} left={4} pointerEvents="none">
                            <Heading size="xl" color="whiteAlpha.800" fontFamily="mono">T+{fmt(manager?.getGameSeconds?.() ?? 0, 1)}s</Heading>
                        </Box>
                    </Box>

                    {/* Guidance Computer Log (Bottom Console) */}
                    <Box h="250px" borderTopWidth="1px" borderColor="gray.800" bg="gray.950" display="flex" flexDirection="column">
                        <ScriptLogsPanel manager={manager} nextRun={rocketSnap?.cpuNextRunInSeconds} />
                    </Box>
                </Box>

                {/* RIGHT COL: Nav & Science */}
                <Box borderLeftWidth="1px" borderColor="gray.800" bg="gray.900" p={3} overflowY="auto" display="flex" flexDirection="column" gap={3}>

                    {/* Minimap Box */}
                    <Box bg="black" borderRadius="md" overflow="hidden" borderWidth="1px" borderColor="gray.800" h="240px">
                        <MinimapPanel envSnap={envSnap} height="100%" />
                    </Box>

                    <SectionHeader title="FLIGHT DATA" icon={FaMapMarkedAlt} />
                    <Card.Root size="sm" variant="subtle" bg="gray.900" borderWidth="1px" borderColor="gray.800">
                        <Card.Body gap={1}>
                            <StatRow label="Altitude" value={rocketSnap?.exposedKeys?.includes('altitude') ? fmt(alt, 0) : "---"} unit="m" />
                            {rocketSnap?.exposedKeys?.includes('radarAltitude') && (
                                <StatRow label="Radar Alt" value={fmt(rocketSnap?.exposedKeys?.includes('radarAltitude') ? (alt > 5000 ? Infinity : alt) : 0, 0)} unit="m" color="green.300" />
                            )}
                            <StatRow label="Speed" value={rocketSnap?.exposedKeys?.includes('velocity') ? fmt(speedMag, 0) : "---"} unit="m/s" color="cyan.300" />
                            <StatRow label="V-Speed" value={rocketSnap?.exposedKeys?.includes('verticalSpeed') ? fmt(verticalSpeed, 1) : "---"} unit="m/s" />
                            <Separator borderColor="gray.800" my={1} />
                            <StatRow label="Heading" value={rocketSnap?.exposedKeys?.includes('orientationRad') ? fmt(heading, 0) : "---"} unit="°" />
                            <StatRow label="Latitude" value={rocketSnap?.exposedKeys?.includes('position') ? fmt(latDeg, 1) : "---"} unit="°" />
                            {rocketSnap?.exposedKeys?.includes('apAltitude') && <StatRow label="Apoapsis" value={fmt(rocketSnap?.apAltitude ?? 0, 0)} unit="m" color="blue.300" />}
                            {rocketSnap?.exposedKeys?.includes('peAltitude') && <StatRow label="Periapsis" value={fmt(rocketSnap?.peAltitude ?? 0, 0)} unit="m" />}
                        </Card.Body>
                    </Card.Root>

                    <SectionHeader title="SCIENCE & COMMS" icon={FaSatelliteDish} />
                    <Card.Root size="sm" variant="subtle" bg="gray.900" borderWidth="1px" borderColor="gray.800">
                        <Card.Body gap={2}>
                            <HStack justify="space-between">
                                <Text fontSize="xs" color="gray.500">Uplink</Text>
                                <Badge size="xs" colorPalette={rocketSnap?.commsInRange ? "green" : "red"}>{rocketSnap?.commsInRange ? "CONNECTED" : "NO SIGNAL"}</Badge>
                            </HStack>
                            <StatRow label="Queue" value={`${rocketSnap?.packetQueueLength || 0} pkts`} unit="" />

                            <Separator borderColor="gray.800" my={1} />

                            {/* Science Experiments */}
                            {rocketSnap?.science?.length ? (
                                <VStack align="stretch" gap={1}>
                                    {rocketSnap.science.map((s: any) => (
                                        <HStack key={s.id} justify="space-between">
                                            <Text fontSize="xs" color="gray.400" truncate>{s.name}</Text>
                                            <Text fontSize="xs" fontWeight="bold" color={s.hasData ? "green.300" : "gray.600"}>{s.hasData ? "READY" : "IDLE"}</Text>
                                        </HStack>
                                    ))}
                                </VStack>
                            ) : (
                                <Text fontSize="xx-small" color="gray.600" fontStyle="italic">No Science Modules</Text>
                            )}
                        </Card.Body>
                    </Card.Root>

                </Box>
            </Grid>
        </VStack>
    );
}

// --- Subcomponents ---

const SectionHeader = ({ title, icon }: any) => (
    <HStack gap={2} mb={0} px={1}>
        {icon && <Icon as={icon} color="cyan.600" size="xs" />}
        <Text fontSize="xs" fontWeight="bold" color="cyan.600" letterSpacing="wide">{title}</Text>
    </HStack>
);

const BigStat = ({ label, value, unit, color = "white" }: any) => (
    <Box bg="gray.950" p={2} borderRadius="md" borderWidth="1px" borderColor="gray.800" textAlign="center">
        <Text fontSize="xx-small" color="gray.500" mb={0}>{label}</Text>
        <Text fontSize="lg" fontWeight="bold" color={color} lineHeight={1.1}>{value}</Text>
        {unit && <Text fontSize="xx-small" color="gray.600">{unit}</Text>}
    </Box>
);

function ScriptLogsPanel({ manager, nextRun }: any) {
    const scrollRef = useRef<HTMLDivElement | null>(null);

    const scriptInfo = useMemo(() => {
        try {
            // Try new API first, fall back to slot 0
            const runner = manager?.getRunner();
            if (runner?.getScriptInfo) return runner.getScriptInfo();
            return runner?.getSlotInfo()?.[0];
        } catch { return null; }
    }, [manager, (manager as any)?.getGameSeconds?.()]); // Poll on tick

    // Auto scroll
    useEffect(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [scriptInfo]);

    const lines = scriptInfo?.logs ?? [];
    const name = scriptInfo?.name ?? "No Script";

    return (
        <Box h="100%" display="flex" flexDirection="column">
            {/* Sub-header inside the panel to show script name */}
            {/* Note: The parent container already has a header "GUIDANCE COMPUTER", we can overlay or just show it inside. 
                 The parent header is static "GUIDANCE COMPUTER". We will add specific script info here.
             */}
            <Box px={3} py={1} bg="gray.900" borderBottomWidth="1px" borderColor="gray.800" display="flex" alignItems="center" gap={2}>
                {/* Left side: System Name */}
                <HStack gap={2} mr={2}>
                    <Icon as={FaCircle} fontSize="8px" color={scriptInfo?.hasScript ? "green.500" : "gray.600"} />
                    <Text fontSize="xs" fontWeight="bold" color="gray.300" letterSpacing="wider">GUIDANCE COMPUTER</Text>
                </HStack>

                {/* Divider */}
                <Box w="1px" h="12px" bg="gray.700" />

                {/* Script Details */}
                <Text fontSize="xs" fontWeight="bold" color="gray.400">{name}</Text>
                {scriptInfo?.hasScript && <Badge size="xs" colorPalette="green" variant="outline">RUNNING</Badge>}
                {nextRun !== undefined && nextRun > 0 && (
                    <HStack ml="auto" gap={1}>
                        <Icon as={FaClock} size="xs" color="gray.500" />
                        <Text fontSize="xs" fontFamily="mono" color="gray.400">Next: {nextRun.toFixed(1)}s</Text>
                    </HStack>
                )}
            </Box>

            {/* Terminal View */}
            <Box flex={1} bg="black" p={2} fontFamily="mono" fontSize="xs" color="green.300" overflowY="auto" ref={scrollRef}>
                {lines.length === 0 && <Text color="gray.800" userSelect="none">_awaiting output_</Text>}
                {lines.map((l: string, i: number) => (
                    <Box key={i} borderBottomWidth="1px" borderColor="whiteAlpha.50" py={0.5}>{l}</Box>
                ))}
                <Box h="20px" /> {/* Pad bottom */}
            </Box>
        </Box>
    )
}


