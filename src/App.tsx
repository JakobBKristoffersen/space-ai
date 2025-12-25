import React, { useEffect, useMemo, useState } from "react";
import { Box, Flex, HStack, Heading, Tabs, Button, Text, Dialog, Icon, Select, Portal, createListCollection } from "@chakra-ui/react";
import { useColorModeValue } from "@/components/ui/color-mode";
import { initAppLogic } from "./app/bootstrap/initAppLogic";
import { AppCoreContext } from "./app/AppContext";
import MissionControlPage from "./pages/MissionControlPage";
import ScriptsPage from "./pages/ScriptsPage";
import SciencePage from "./pages/SciencePage";
import ResearchPage from "./pages/ResearchPage";
import BuildPage from "./pages/BuildPage";
import SpaceCenterPage from "./pages/SpaceCenterPage";
import { CommsCenterPage } from "./pages/CommsCenterPage";
import { DebugToolbox } from "./ui/DebugToolbox";
import { Sidebar } from "./components/Sidebar";
import { FaPause, FaPlay } from "react-icons/fa";
import { toaster } from "./components/ui/toaster";

function useManagerAndServices() {
  const [core, setCore] = useState<any>({ manager: null, services: { layout: null, scripts: null, telemetry: null } });
  useEffect(() => {
    const g = window as any;
    if (!g.__appInited) {
      g.__appInited = true;
      // Ensure the canvas exists: MissionControlPage is mounted by default (tab index 0)
      initAppLogic();
    }
    // Pull manager & services from globals (set by initAppLogic)
    const id = setInterval(() => {
      if ((window as any).__manager) {
        const mgr = (window as any).__manager;
        const svcs = (window as any).__services || {};
        setCore({ manager: mgr, services: { layout: svcs.layoutSvc ?? null, scripts: svcs.scripts ?? null, telemetry: svcs.telemetrySvc ?? null, upgrades: svcs.upgrades ?? null, research: svcs.research ?? null, pending: svcs.pending ?? null } });
        clearInterval(id);
      }
    }, 50);
    return () => clearInterval(id);
  }, []);
  return core;
}

function formatGameTime(parts: { year: number; month: number; day: number; hours: number; minutes: number }): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const HH = pad(parts.hours);
  const mi = pad(parts.minutes);
  const dd = pad(parts.day);
  const mm = pad(parts.month);
  const yyyy = parts.year;
  return `${HH}:${mi}`;
}

export default function App() {
  const appBg = useColorModeValue("gray.50", "gray.900");
  const appFg = useColorModeValue("gray.900", "gray.100");

  const core = useManagerAndServices();

  // View state
  const [currentView, setCurrentView] = useState<string>("space_center");

  // RP state for header
  const [rp, setRp] = useState<number>(0);
  useEffect(() => {
    const t = setInterval(() => {
      try {
        const svcs: any = (window as any).__services;
        if (svcs?.getResearchPoints) setRp(Number(svcs.getResearchPoints()) || 0);
      } catch { }
    }, 500);
    return () => clearInterval(t);
  }, []);

  // Time control state
  const [running, setRunning] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);

  // Speed options
  const speedOptions = useMemo(() => createListCollection({
    items: [{ label: "0.5x", value: "0.5" }, { label: "1x", value: "1" }, { label: "2x", value: "2" }, { label: "4x", value: "4" }, { label: "10x", value: "10" }, { label: "50x", value: "50" }],
  }), []);

  const onPlayPause = () => {
    const mgr = (window as any).__manager;
    if (mgr) {
      if (mgr.isRunning()) mgr.pause();
      else mgr.start();
      setRunning(mgr.isRunning());
    }
  };
  const onSpeedChange = (v: string) => {
    const n = parseFloat(v);
    const mgr = (window as any).__manager;
    if (isFinite(n)) {
      setSpeed(n);
      mgr?.setSpeedMultiplier?.(n);
    }
  };

  // Simulation-driven clock (updates only while the simulation is rendering)
  const [clock, setClock] = useState<string>("");
  const [perf, setPerf] = useState<{ fps: number, tps: number }>({ fps: 0, tps: 0 });

  useEffect(() => {
    const mgr: any = (core as any)?.manager;
    if (!mgr) return;
    const update = () => {
      try {
        const parts = mgr.getGameTimeParts?.();
        if (parts) setClock(formatGameTime(parts));

        const p = mgr.getPerf?.();
        if (p) {
          setPerf(p);
        }

        // Also sync state
        setRunning(mgr.isRunning());
        setSpeed(mgr.getSpeedMultiplier ? mgr.getSpeedMultiplier() : 1);

      } catch { }
    };
    const unsub = mgr.onPostRender?.((_alpha: number, _now: number) => update());
    // initialize immediately
    update();
    return () => { try { unsub?.(); } catch { } };
  }, [core]);

  // Achievement listener
  const [lastClaimableCount, setLastClaimableCount] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      const svc: any = (window as any).__services;
      if (!svc?.getMilestones) return;

      const ms: any[] = svc.getMilestones();
      const claimable = ms.filter(m => m.isCompleted && !m.isClaimed);
      const count = claimable.length;

      if (count > lastClaimableCount) {
        // New achievement(s) available!
        const latest = claimable[claimable.length - 1]; // Just take the last one for the toast
        toaster.create({
          title: "Achievement Available",
          description: `New achievement: ${latest.title}`,
          duration: 4000,
        });
      }
      setLastClaimableCount(count);
    }, 2000);
    return () => clearInterval(id);
  }, [lastClaimableCount]);

  // Render logic: specific pages + persistent WorldScene
  return (
    <AppCoreContext.Provider value={core}>
      <Flex id="app" direction="row" minH="100dvh" bg={appBg} color={appFg}>

        {/* Sidebar Navigation */}
        <Sidebar currentView={currentView} onNavigate={setCurrentView} />

        {/* Main Content Area */}
        <Flex direction="column" flex={1} overflow="hidden">
          {/* App header */}
          <HStack px={4} py={3} justify="space-between" borderBottomWidth="1px" bg="gray.800" borderColor="gray.700">
            <HStack>
              <Heading size="md" fontFamily="mono" color="cyan.400">{`> Space AI`}</Heading>
            </HStack>

            <HStack gap={6}>
              {/* Time Controls */}
              <HStack gap={2}>
                <Button onClick={onPlayPause} variant="subtle" size="xs" colorPalette={running ? "yellow" : "green"}>
                  <Icon as={running ? FaPause : FaPlay} />
                  {running ? "PAUSE" : "RESUME"}
                </Button>
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
              </HStack>

              <Text fontFamily="mono" fontSize="sm">{clock}</Text>
              {perf.tps > 0 && (
                <Text fontFamily="mono" fontSize="xs" color="gray.500" title="Ticks/Sec | Frames/Sec">
                  {perf.tps} TPS / {perf.fps} FPS
                </Text>
              )}
              <HStack gap={4}>
                <Text fontFamily="mono" color="cyan.300">RP {rp}</Text>
              </HStack>
            </HStack>

            <HStack gap={3}>
              <DebugToolbox />
            </HStack>
          </HStack>

          {/* Views */}
          <Box flex={1} overflow="hidden" position="relative">
            <Box h="100%" display={currentView === 'world_scene' ? 'block' : 'none'}>
              <MissionControlPage onNavigate={setCurrentView} isActive={currentView === 'world_scene'} />
            </Box>

            {currentView === 'space_center' && <SpaceCenterPage onNavigate={setCurrentView} />}
            {currentView === 'comms' && <CommsCenterPage onNavigate={setCurrentView} />}
            {currentView === 'build' && <BuildPage onNavigate={setCurrentView} />}
            {currentView === 'science' && <SciencePage onNavigate={setCurrentView} />}
            {currentView === 'research' && <ResearchPage onNavigate={setCurrentView} />}
            {currentView === 'scripts' && <ScriptsPage onNavigate={setCurrentView} />}
          </Box>
        </Flex>
      </Flex>
    </AppCoreContext.Provider>
  );
}


