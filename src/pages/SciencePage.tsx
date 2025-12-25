import { SpaceCenterHeader } from "../components/SpaceCenterHeader";
import { FaFlask, FaCheck, FaTrophy } from "react-icons/fa";
import {
  HStack,
  VStack,
  Heading,
  Text,
  Button,
  Icon,
  Box,
  Card,
  SimpleGrid,
  Badge,
  Dialog,
  Progress,
  Center,
  Container,
  Tabs
} from "@chakra-ui/react";
import React, { useState, useEffect, useMemo } from "react";
import { Scatter, ScatterChart, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { toaster } from "../components/ui/toaster";

// Types matching ScienceManager
interface MilestoneStatus {
  id: string;
  type: "temp" | "atmo" | "surface" | "biosample" | "velocity" | "altitude" | "distance";
  zone: string;
  level: string;
  reqCount: number;
  rewardRp: number;
  title: string;
  currentCount: number;
  progress: number;
  isCompleted: boolean;
  isClaimed: boolean;
}

export default function MissionsPage({ onNavigate }: { onNavigate: (view: string) => void }) {
  const [data, setData] = useState<{ temp: Map<number, number>, atm: Map<number, number>, surface: Map<number, string>, interactions: Record<string, number> }>({
    temp: new Map(), atm: new Map(), surface: new Map(), interactions: {}
  });
  const [milestones, setMilestones] = useState<MilestoneStatus[]>([]);
  const [hideClaimed, setHideClaimed] = useState(false);
  const [showTutorial, setShowTutorial] = useState(() => !localStorage.getItem("tutorial_science_seen"));

  const nextUpdateRef = React.useRef(0);

  // Explicit render trigger
  const triggerUpdate = () => {
    // Bypass throttle for manual actions
    nextUpdateRef.current = 0;
    // We need to call the effect's update... but it's inside useEffect.
    // Better to just force a re-render or re-fetch.
    // Let's refactor the update logic out of useEffect or just use a state toggle.
  };

  // Ref for update helper
  const updateFnRef = React.useRef<() => void>(() => { });

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      // Keep throttle for polling, but allow bypass
      if (now < nextUpdateRef.current) return;
      nextUpdateRef.current = now + 500; // Reduce to 500ms

      const svc: any = (window as any).__services;
      try {
        const d = svc.getScienceData?.();
        if (d) {
          setData({
            temp: new Map(d.temperature),
            atm: new Map(d.atmosphere),
            surface: new Map(d.surface),
            interactions: d.interactions || {}
          });
        }
        const ms = svc.getMilestones?.();
        if (ms) setMilestones(ms);
      } catch { }
    };

    updateFnRef.current = () => {
      nextUpdateRef.current = 0; // Force
      update();
    };

    update();
    const interval = setInterval(update, 500); // Poll faster
    return () => clearInterval(interval);
  }, []);

  const handleClaim = (id: string) => {
    const svc: any = (window as any).__services;
    const m = milestones.find(m => m.id === id);
    svc?.claimMilestone?.(id);

    if (m) {
      toaster.create({
        title: "Achievement Claimed!",
        description: `Successfully claimed ${m.title} for ${m.rewardRp} RP.`,
        type: "success",
      });
    }

    // Force immediate UI refresh
    setTimeout(() => updateFnRef.current?.(), 10);
  };

  const claimableCounts = useMemo(() => {
    const counts = { flight: 0, atmo: 0, surface: 0 };
    for (const m of milestones) {
      if (m.isCompleted && !m.isClaimed) {
        if (m.type === 'velocity' || m.type === 'altitude' || m.type === 'distance') counts.flight++;
        if (m.type === 'temp' || m.type === 'atmo') counts.atmo++;
        if (m.type === 'surface' || m.type === 'biosample') counts.surface++;
      }
    }
    return counts;
  }, [milestones]);

  return (
    <VStack align="stretch" gap={0} bg="gray.900" minH="100%" h="100%">
      <Tabs.Root defaultValue="flight" variant="line" h="100%" display="flex" flexDirection="column">

        {/* Unified Header */}
        <SpaceCenterHeader
          title="Science & Achievements"
          icon={FaFlask}
          description="Track Achievements & Earn RP"
          onInfoClick={() => setShowTutorial(true)}
        >
          <HStack gap={4}>
            {/* Tabs (Navigation) */}
            <Box overflowX="auto" maxW="100%">
              <Tabs.List bg="transparent" borderColor="transparent" gap={2}>
                <Tabs.Trigger value="flight" px={3}>
                  Flight Data
                  {claimableCounts.flight > 0 && (
                    <Badge colorPalette="red" variant="solid" size="xs" ml={2} borderRadius="full">{claimableCounts.flight}</Badge>
                  )}
                </Tabs.Trigger>
                <Tabs.Trigger value="atmo" px={3}>
                  Atmosphere
                  {claimableCounts.atmo > 0 && (
                    <Badge colorPalette="red" variant="solid" size="xs" ml={2} borderRadius="full">{claimableCounts.atmo}</Badge>
                  )}
                </Tabs.Trigger>
                <Tabs.Trigger value="surface" px={3}>
                  Surface Ops
                  {claimableCounts.surface > 0 && (
                    <Badge colorPalette="red" variant="solid" size="xs" ml={2} borderRadius="full">{claimableCounts.surface}</Badge>
                  )}
                </Tabs.Trigger>
              </Tabs.List>
            </Box>

            {/* Actions */}
            <Button
              size="xs"
              variant={hideClaimed ? "solid" : "outline"}
              colorPalette={hideClaimed ? "blue" : "gray"}
              onClick={() => setHideClaimed(!hideClaimed)}
            >
              {hideClaimed ? "Show Claimed" : "Hide Claimed"}
            </Button>
          </HStack>
        </SpaceCenterHeader>

        <Box flex={1} overflowY="hidden">
          {/* Content Areas */}
          <Tabs.Content value="flight" h="100%" overflowY="auto" p={6}>
            <Container maxW="container.xl">
              <VStack align="stretch" gap={10}>
                <ScienceSection
                  title="Flight Velocity Records"
                  description="Maximum velocity achieved relative to surface."
                  milestones={milestones.filter(m => m.type === "velocity")}
                  onClaim={handleClaim}
                  hideClaimed={hideClaimed}
                >
                  <MetricDisplay
                    label="MAX VELOCITY"
                    value={data.interactions["max_velocity"] || 0}
                    unit="m/s"
                    color="orange.400"
                    icon={FaTrophy}
                  />
                </ScienceSection>

                <ScienceSection
                  title="Max Altitude Records"
                  description="Maximum altitude achieved above sea level."
                  milestones={milestones.filter(m => m.type === "altitude")}
                  onClaim={handleClaim}
                  hideClaimed={hideClaimed}
                >
                  <MetricDisplay
                    label="MAX ALTITUDE"
                    value={data.interactions["max_altitude"] || 0}
                    unit="m"
                    color="cyan.400"
                    icon={FaTrophy}
                  />
                </ScienceSection>

                <ScienceSection
                  title="Distance from Origin"
                  description="Maximum angular distance achieved from the launch site."
                  milestones={milestones.filter(m => m.type === "distance")}
                  onClaim={handleClaim}
                  hideClaimed={hideClaimed}
                >
                  <MetricDisplay
                    label="MAX LATITUDE"
                    value={data.interactions["max_distance"] || 0}
                    unit="°"
                    color="purple.400"
                    icon={FaTrophy}
                  />
                </ScienceSection>
              </VStack>
            </Container>
          </Tabs.Content>

          <Tabs.Content value="atmo" h="100%" overflowY="auto" p={6}>
            <Container maxW="container.xl">
              <VStack align="stretch" gap={10}>
                <ScienceSection
                  title="Atmospheric Temperature"
                  description="Vertical temperature profile of the atmosphere."
                  milestones={milestones.filter(m => m.type === "temp")}
                  onClaim={handleClaim}
                  hideClaimed={hideClaimed}
                >
                  <TempChart data={data.temp} />
                </ScienceSection>

                <ScienceSection
                  title="Atmospheric Pressure"
                  description="Pressure measurements at various altitudes."
                  milestones={milestones.filter(m => m.type === "atmo")}
                  onClaim={handleClaim}
                  hideClaimed={hideClaimed}
                >
                  <PressureChart data={data.atm} />
                </ScienceSection>
              </VStack>
            </Container>
          </Tabs.Content>

          <Tabs.Content value="surface" h="100%" overflowY="auto" p={6}>
            <Container maxW="container.xl">
              <VStack align="stretch" gap={10}>
                <ScienceSection
                  title="Planetary Surface"
                  description="Terrain composition survey results."
                  milestones={milestones.filter(m => m.type === "surface")}
                  onClaim={handleClaim}
                  hideClaimed={hideClaimed}
                >
                  <SurfaceChart data={data.surface} />
                </ScienceSection>

                <ScienceSection
                  title="Biosample Recovery"
                  description="Physical samples recovered from the surface."
                  milestones={milestones.filter(m => m.type === "biosample")}
                  onClaim={handleClaim}
                  hideClaimed={hideClaimed}
                >
                  <BiosampleDisplay count={data.interactions["biosamples"] || 0} />
                </ScienceSection>
              </VStack>
            </Container>
          </Tabs.Content>
        </Box>
      </Tabs.Root>

      {/* TUTORIAL DIALOG */}
      <Dialog.Root open={showTutorial} onOpenChange={(e) => setShowTutorial(e.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg="gray.900" borderColor="gray.700">
            <Dialog.Header>
              <Dialog.Title>Welcome to Science & Achievements</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack align="start" gap={3} color="gray.300">
                <Text>The R&D Lab is where you analyze mission data and claim rewards.</Text>
                <ul style={{ marginLeft: "20px", listStyleType: "disc" }}>
                  <li><Text><strong>Review Data:</strong> See charts for atmospheric pressure, temperature, and surface composition.</Text></li>
                  <li><Text><strong>Claim Achievements:</strong> Earn Research Points (RP) by claiming rewards from completed milestones.</Text></li>
                  <li><Text>Use the RP you earn here to unlock new technologies at the <Text as="span" fontWeight="bold">R&D Laboratory</Text>.</Text></li>
                </ul>
                <Text color="cyan.300" fontSize="sm">
                  <strong>Goal:</strong> Reach "Flight Data" milestones first by launching higher and faster!
                </Text>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button onClick={() => {
                setShowTutorial(false);
                localStorage.setItem("tutorial_science_seen", "true");
              }} colorPalette="blue" variant="solid">Ready to Science</Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger />
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </VStack>
  );
}

function ScienceSection({ title, description, children, milestones, onClaim, hideClaimed }: { title: string, description: string, children: React.ReactNode, milestones: MilestoneStatus[], onClaim: (id: string) => void, hideClaimed: boolean }) {
  // Group milestones by Zone
  const zones = useMemo(() => {
    const map = new Map<string, MilestoneStatus[]>();
    milestones.forEach(m => {
      const list = map.get(m.zone) || [];
      list.push(m);
      map.set(m.zone, list);
    });
    // Order: lower, mid, upper, space, global
    const order = ["lower", "mid", "upper", "space", "global"];
    return Array.from(map.entries()).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  }, [milestones]);

  // Fetch zone definitions
  const [zoneDefs, setZoneDefs] = useState<Record<string, { label: string }>>({});

  useEffect(() => {
    const svc: any = (window as any).__services;
    const sm = svc?.getScienceManager?.();
    if (sm?.getZones) {
      setZoneDefs(sm.getZones());
    }
  }, []);

  // Map zone codes to labels
  const zoneLabels: Record<string, string> = {
    lower: zoneDefs.lower?.label || "Lower Atmosphere",
    mid: zoneDefs.mid?.label || "Mid Atmosphere",
    upper: zoneDefs.upper?.label || "Upper Atmosphere",
    space: zoneDefs.space?.label || "Space",
    global: "Global Survey"
  };

  const LEVEL_ORDER = ['easy', 'medium', 'hard', 'master'];

  return (
    <Card.Root variant="outline" bg="gray.950" borderColor="gray.800">
      <Card.Header>
        <Heading size="md" color="blue.300">{title}</Heading>
        <Text fontSize="sm" color="gray.400">{description}</Text>
      </Card.Header>
      <Card.Body gap={6}>
        <Box h="300px" w="100%" position="relative" bg="gray.900" borderRadius="md" p={4} mb={6}>
          {children}
        </Box>

        <VStack align="stretch" gap={6}>
          <Heading size="sm" color="gray.300">Research Milestones</Heading>
          <SimpleGrid columns={{ base: 1, lg: 2 }} gap={4}>
            {zones.map(([zone, ms]) => {
              // Filter Logic:
              // 1. Sort by difficulty
              const sorted = [...ms].sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level));

              // 2. Progressive Disclosure
              // Display if: (OrderIndex == 0) OR (Previous.isCompleted)
              // Also respect hideClaimed
              const visible = sorted.filter((m, idx) => {
                if (hideClaimed && m.isClaimed) return false;

                if (idx === 0) return true; // Always show easy
                const prev = sorted[idx - 1];
                return prev.isCompleted; // Show if prev completed
              });

              if (visible.length === 0) return null;

              return (
                <Card.Root key={zone} variant="subtle" bg="gray.900" borderColor="gray.700">
                  <Card.Header pb={2}>
                    <Text fontWeight="bold" fontSize="sm" color="gray.400">{zoneLabels[zone] || zone}</Text>
                  </Card.Header>
                  <Card.Body pt={0}>
                    <VStack align="stretch" gap={3}>
                      {visible.map(m => (
                        <MilestoneRow key={m.id} m={m} onClaim={onClaim} />
                      ))}
                    </VStack>
                  </Card.Body>
                </Card.Root>
              )
            })}
          </SimpleGrid>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
}

function MilestoneRow({ m, onClaim }: { m: MilestoneStatus, onClaim: (id: string) => void }) {
  let color = "gray";
  if (m.level === "easy") color = "green";
  if (m.level === "medium") color = "blue";
  if (m.level === "hard") color = "purple";
  if (m.level === "master") color = "orange";

  const isDone = m.progress >= 1;

  return (
    <HStack justify="space-between" align="center" bg="gray.800" p={2} borderRadius="md">
      <VStack align="start" gap={1} flex={1}>
        <HStack>
          <Badge colorPalette={color} variant="solid" size="xs">{m.level.toUpperCase()}</Badge>
          <Text fontSize="xs" fontWeight="bold" color="gray.200">{m.title}</Text>
        </HStack>
        <HStack w="100%" gap={2}>
          <Progress.Root value={m.progress * 100} size="xs" flex={1} colorPalette={isDone ? "green" : "blue"}>
            <Progress.Track bg="gray.700">
              <Progress.Range />
            </Progress.Track>
          </Progress.Root>
          <Text fontSize="2xs" color="gray.500" minW="50px" textAlign="right">
            {m.currentCount.toLocaleString(undefined, { maximumFractionDigits: 1 })} / {m.reqCount.toLocaleString()}
          </Text>
        </HStack>
      </VStack>

      <Box ml={2}>
        {m.isClaimed ? (
          <HStack color="green.500">
            <Icon as={FaCheck} />
            <Text fontSize="xs" fontWeight="bold">Claimed</Text>
          </HStack>
        ) : isDone ? (
          <Button
            size="xs"
            colorPalette="green"
            variant="solid"
            onClick={() => onClaim(m.id)}
          >
            <Icon as={FaTrophy} mr={1} />
            Claim {m.rewardRp} RP
          </Button>
        ) : (
          <Badge variant="outline" colorPalette="gray" size="sm">
            {m.rewardRp} RP
          </Badge>
        )}
      </Box>
    </HStack>
  );
}

// -- Charts --

const COLORS = ["#63b3ed", "#f6e05e", "#68d391", "#f687b3", "#a0aec0", "#fc8181"];

function TempChart({ data }: { data: Map<number, number> }) {
  const chartData = useMemo(() => {
    return Array.from(data.entries())
      .map(([alt, temp]) => ({ altitude: alt, temp }))
      .sort((a, b) => a.altitude - b.altitude);
  }, [data]);

  if (chartData.length === 0) return <NoData />;

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '300px' }}>
      <ResponsiveContainer width="100%" height={280} debounce={50}>
        <ScatterChart margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" />
          <XAxis type="number" dataKey="altitude" name="Altitude" unit="m" stroke="#718096" tick={{ fill: '#718096', fontSize: 10 }} />
          <YAxis type="number" dataKey="temp" name="Temperature" unit="K" stroke="#718096" tick={{ fill: '#718096', fontSize: 10 }} domain={['auto', 'auto']} />
          <Tooltip contentStyle={{ backgroundColor: '#171923', border: '1px solid #2D3748' }} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter name="Temperature" data={chartData} fill="#feb2b2" line={{ stroke: '#feb2b2', strokeWidth: 2 }} lineType="joint" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function PressureChart({ data }: { data: Map<number, number> }) {
  const chartData = useMemo(() => {
    return Array.from(data.entries())
      .map(([alt, pressure]) => ({ altitude: alt, pressure }))
      .sort((a, b) => a.altitude - b.altitude);
  }, [data]);

  if (chartData.length === 0) return <NoData />;

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '300px' }}>
      <ResponsiveContainer width="100%" height={280} debounce={50}>
        <ScatterChart margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" />
          <XAxis type="number" dataKey="altitude" name="Altitude" unit="m" stroke="#718096" tick={{ fill: '#718096', fontSize: 10 }} />
          <YAxis type="number" dataKey="pressure" name="Pressure" unit="Pa" stroke="#718096" tick={{ fill: '#718096', fontSize: 10 }} />
          <Tooltip contentStyle={{ backgroundColor: '#171923', border: '1px solid #2D3748' }} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter name="Pressure" data={chartData} fill="#90cdf4" line={{ stroke: '#90cdf4', strokeWidth: 2 }} lineType="joint" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

const TERRAIN_COLORS: Record<string, string> = {
  "Plains": "#2e5d2e",
  "Mountains": "#5d5d5d",
  "Water": "#1e3f5a",
  "Desert": "#c2b280",
  "Forest": "#1a331a",
  "Ice": "#e0f7fa",
  "Unknown": "#1a202c", // darker gray for unmapped
};

function SurfaceChart({ data }: { data: Map<number, string> }) {
  const chartData = useMemo(() => {
    // 1. Build 360-degree array of types
    // lat is -180 to 180.
    // We map index 0 -> -180, index 360 -> 180.
    const types: string[] = new Array(360).fill("Unknown");

    // Fill known data
    for (const [lat, type] of data.entries()) {
      // normalize lat to 0..359
      // lat is -180..180
      let idx = Math.floor(lat + 180);
      if (idx < 0) idx = 0;
      if (idx >= 360) idx = 359;
      types[idx] = type;
    }

    // 2. Compress into segments
    const segments: { name: string; value: number; startAngle: number; endAngle: number; fill: string }[] = [];
    if (types.length === 0) return [];

    let currentType = types[0];
    let currentLen = 1;
    let startIdx = 0;

    for (let i = 1; i < types.length; i++) {
      if (types[i] === currentType) {
        currentLen++;
      } else {
        // Finish segment
        segments.push({
          name: currentType,
          value: currentLen, // 1 degree per unit
          startAngle: startIdx - 180,
          endAngle: i - 180,
          fill: TERRAIN_COLORS[currentType] || "#888888"
        });
        currentType = types[i];
        currentLen = 1;
        startIdx = i;
      }
    }
    // Push last
    segments.push({
      name: currentType,
      value: currentLen,
      startAngle: startIdx - 180,
      endAngle: 180,
      fill: TERRAIN_COLORS[currentType] || "#888888"
    });

    return segments;
  }, [data]);

  if (data.size === 0) return <NoData />;

  return (
    <VStack w="100%" h="100%" gap={2}>
      <Box w="100%" h="240px">
        <div style={{ width: '100%', height: '100%', minHeight: '200px' }}>
          <ResponsiveContainer width="100%" height={220} debounce={50}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                startAngle={180}
                endAngle={-180}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <Box bg="gray.900" border="1px solid" borderColor="gray.700" p={2} borderRadius="md">
                        <Text fontWeight="bold" color="white">{d.name}</Text>
                        <Text fontSize="xs" color="gray.400">{d.startAngle}° to {d.endAngle}°</Text>
                      </Box>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Box>
      <HStack wrap="wrap" justify="center" gap={3}>
        {Object.keys(TERRAIN_COLORS).filter(k => k !== "Unknown").map(k => (
          <HStack key={k} gap={1}>
            <Box w="12px" h="12px" bg={TERRAIN_COLORS[k]} borderRadius="sm" />
            <Text fontSize="xs" color="gray.400">{k}</Text>
          </HStack>
        ))}
      </HStack>
    </VStack>
  );
}

function NoData() {
  return (
    <Center h="100%">
      <Text color="gray.600" fontStyle="italic">No Data Collected Yet</Text>
    </Center>
  );
}

function MetricDisplay({ label, value, unit, color, icon }: { label: string, value: number, unit: string, color: string, icon: any }) {
  return (
    <Center w="100%" h="100%">
      <VStack gap={4}>
        <Icon as={icon} boxSize={12} color={color} />
        <VStack gap={0}>
          <HStack align="baseline" gap={2}>
            <Text fontSize="4xl" fontWeight="bold" color="white" fontFamily="mono">
              {Math.round(value).toLocaleString()}
            </Text>
            <Text fontSize="xl" fontWeight="bold" color="gray.500" fontFamily="mono">
              {unit}
            </Text>
          </HStack>
          <Text color="gray.400" fontSize="sm">{label}</Text>
        </VStack>
        <Text color="gray.500" fontSize="xs" maxW="200px" textAlign="center">
          Achieve new records to earn Research Points.
        </Text>
      </VStack>
    </Center>
  );
}

function BiosampleDisplay({ count }: { count: number }) {
  return (
    <Center w="100%" h="100%">
      <VStack gap={4}>
        <Icon as={FaFlask} boxSize={12} color="green.400" />
        <VStack gap={0}>
          <Text fontSize="4xl" fontWeight="bold" color="white" fontFamily="mono">
            {count}
          </Text>
          <Text color="gray.400" fontSize="sm">SAMPLES RECOVERED</Text>
        </VStack>
        <Text color="gray.500" fontSize="xs" maxW="200px" textAlign="center">
          Recover biosample containers from successful missions to earn Research Points.
        </Text>
      </VStack>
    </Center>
  );
}
