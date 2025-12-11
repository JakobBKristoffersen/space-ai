import React, { useEffect, useState } from "react";
import { Box, Flex, HStack, Heading, Tabs, Button, Text, Dialog } from "@chakra-ui/react";
import { ColorModeButton, useColorModeValue } from "@/components/ui/color-mode";
import { initAppLogic } from "./app/bootstrap/initAppLogic";
import { AppCoreContext } from "./app/AppContext";
import WorldScenePage from "./pages/WorldScenePage";
import ScriptsPage from "./pages/ScriptsPage";
import EnterprisePage from "./pages/EnterprisePage";
import MissionsPage from "./pages/MissionsPage";
import ResearchPage from "./pages/ResearchPage";

function useManagerAndServices() {
  const [core, setCore] = useState<any>({ manager: null, services: { layout: null, scripts: null, telemetry: null } });
  useEffect(() => {
    const g = window as any;
    if (!g.__appInited) {
      g.__appInited = true;
      // Ensure the canvas exists: WorldScenePage is mounted by default (tab index 0)
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

  // Money & RP state for header
  const [money, setMoney] = useState<number>(0);
  const [rp, setRp] = useState<number>(0);
  useEffect(() => {
    const t = setInterval(() => {
      try {
        const svcs: any = (window as any).__services;
        if (svcs?.getMoney) setMoney(Number(svcs.getMoney()) || 0);
        if (svcs?.getResearchPoints) setRp(Number(svcs.getResearchPoints()) || 0);
      } catch { }
    }, 500);
    return () => clearInterval(t);
  }, []);

  // Simulation-driven clock (updates only while the simulation is rendering)
  const [clock, setClock] = useState<string>("");
  useEffect(() => {
    const mgr: any = (core as any)?.manager;
    if (!mgr) return;
    const update = () => {
      try {
        const parts = mgr.getGameTimeParts?.();
        if (parts) setClock(formatGameTime(parts));
      } catch { }
    };
    const unsub = mgr.onPostRender?.((_alpha: number, _now: number) => update());
    // initialize immediately
    update();
    return () => { try { unsub?.(); } catch { } };
  }, [core]);

  const handleResetAll = () => {
    try { (window as any).__services?.resetAll?.(); } catch { }
  };

  return (
    <AppCoreContext.Provider value={core}>
      <Flex id="app" direction="column" minH="100dvh" bg={appBg} color={appFg}>
        {/* App header */}
        <HStack px={4} py={3} justify="space-between" borderBottomWidth="1px">
          <Heading size="md">Space AI</Heading>

          <Text fontFamily="mono">{clock}</Text>
          <Text fontFamily="mono" color="cyan.300">RP {rp}</Text>
          <Text fontFamily="mono" color="green.300">$ {money.toLocaleString()}</Text>
          <HStack gap={3}>
            <Dialog.Root>
              <Dialog.Trigger asChild>
                <Button size="sm" variant="outline" colorScheme="purple">Dev</Button>
              </Dialog.Trigger>
              <Dialog.Content>
                <Dialog.Header><Dialog.Title>Developer Tools</Dialog.Title></Dialog.Header>
                <Dialog.Body>
                  <HStack gap={4}>
                    <Button onClick={() => { (window as any).__services?.debug?.unlockAll(); alert("Unlocked!"); }}>Unlock All Cheats</Button>
                    <Button onClick={() => { (window as any).__services?.debug?.maximizeRocket(0); }}>Max Rocket (0)</Button>
                  </HStack>
                </Dialog.Body>
                <Dialog.CloseTrigger />
              </Dialog.Content>
            </Dialog.Root>
            <Button size="sm" variant="ghost" colorPalette="red" onClick={handleResetAll}>Reset All</Button>
            <ColorModeButton />
          </HStack>
        </HStack>

        {/* Pages */}
        <Tabs.Root defaultValue={'world_scene'} variant="outline" fitted >
          <Tabs.List>
            <Tabs.Trigger value={'world_scene'}>World</Tabs.Trigger>
            <Tabs.Trigger value={'missions'}>Missions</Tabs.Trigger>
            <Tabs.Trigger value={'research'}>Research</Tabs.Trigger>
            <Tabs.Trigger value={'scripts'}>Scripts</Tabs.Trigger>
            <Tabs.Trigger value={'enterprise'}>Enterprise</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content p={0} value={'world_scene'}>
            <WorldScenePage />
          </Tabs.Content>

          <Tabs.Content p={0} value={'missions'}>
            <MissionsPage />
          </Tabs.Content>

          <Tabs.Content p={0} value={'research'}>
            <ResearchPage />
          </Tabs.Content>

          <Tabs.Content p={0} value={'scripts'}>
            <ScriptsPage />
          </Tabs.Content>

          <Tabs.Content p={0} value={'enterprise'}>
            <EnterprisePage />
          </Tabs.Content>
        </Tabs.Root>
      </Flex>
    </AppCoreContext.Provider>
  );
}
