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
  Progress,
  Center,
  Container
} from "@chakra-ui/react";
import React, { useState, useEffect, useMemo } from "react";
import { Scatter, ScatterChart, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

// Types matching ScienceManager
interface MilestoneStatus {
  id: string;
  type: "temp" | "atmo" | "surface" | "biosample";
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

  const nextUpdateRef = React.useRef(0);

  useEffect(() => {
    const update = () => {
      const now = Date.now();
      if (now < nextUpdateRef.current) return;
      nextUpdateRef.current = now + 1000; // 1 second throttle

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

    update();
    // Schedule periodic check just in case throttle skips the 'last' event?
    // Actually, simple throttle drops events. For a chart, dropping intermediate frames is fine.
    // Ideally we want trailing edge.
    // Let's use a simpler "raf loop" or interval that checks a dirty flag?
    // Or just interval.

    // Changing approach: Use polling for UI (1s interval) instead of subscription for high-freq data.
    // Subscriptions might flood.
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleClaim = (id: string) => {
    const svc: any = (window as any).__services;
    svc?.claimMilestone?.(id);
  };

  return (
    <VStack align="stretch" gap={0} bg="gray.900" minH="100%">
      <Box p={6} bg="gray.900">
        <SpaceCenterHeader
          title="Science Data & Analysis"
          icon={FaFlask}
          description="Analyze collected data and claim research rewards."
          onNavigate={onNavigate}
        />
        <HStack justify="flex-end" mt={4}>
          <Button
            size="sm"
            variant={hideClaimed ? "solid" : "outline"}
            colorPalette={hideClaimed ? "blue" : "gray"}
            onClick={() => setHideClaimed(!hideClaimed)}
          >
            {hideClaimed ? "Show Claimed" : "Hide Claimed"}
          </Button>
        </HStack>
      </Box>

      <Container maxW="container.xl" p={6}>
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
            {m.currentCount} / {m.reqCount}
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
