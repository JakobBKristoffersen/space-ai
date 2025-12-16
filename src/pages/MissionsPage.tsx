import { SpaceCenterHeader } from "../components/SpaceCenterHeader";
import { FaSatelliteDish } from "react-icons/fa";
import {
  HStack,
  VStack,
  Heading,
  Text,
  Button,
  Icon,
  Box,
  Card,
  Select,
  Portal,
  SimpleGrid,
  Badge,
  Progress,
  createListCollection
} from "@chakra-ui/react";
import { useState, useRef, useEffect, useMemo } from "react";
interface MissionRow {
  id: string;
  name: string;
  description: string;
  reward: { money: number; rp: number };
  tier: number;
  completed: boolean;
  progress: number; // 0..1
}

function fmtReward(r: { money: number; rp: number }) {
  const parts = [];
  if (r.money > 0) parts.push(`$${r.money.toLocaleString()}`);
  if (r.rp > 0) parts.push(`RP ${r.rp.toLocaleString()}`);
  return parts.join(" + ");
}

interface Props {
  onNavigate: (view: string) => void;
}

export default function MissionsPage({ onNavigate }: Props) {
  const [rows, setRows] = useState<MissionRow[]>([]);
  const rowsRef = useRef<MissionRow[]>([]);
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  const [filter, setFilter] = useState<string>("active");

  const filters = useMemo(() => createListCollection({
    items: [
      { label: "Active", value: "active" },
      { label: "Completed", value: "completed" },
      { label: "All", value: "all" },
    ]
  }), []);

  // Poll missions via services getter on render cadence (throttled and equality-guarded)
  useEffect(() => {
    const g: any = (window as any).__manager;
    const svc: any = (window as any).__services;

    let disposed = false;
    let rafId: number | null = null;
    let lastUpdateTs = 0; // ms, throttle UI updates

    const equalRows = (a: MissionRow[], b: MissionRow[]) => {
      if (a === b) return true;
      if (!a || !b) return false;
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        const x = a[i], y = b[i];
        if (!x || !y) return false;
        if (x.id !== y.id || x.completed !== y.completed || x.progress !== y.progress || x.reward !== y.reward || x.name !== y.name || x.description !== y.description) {
          return false;
        }
      }
      return true;
    };

    const scheduleUpdate = (data: MissionRow[]) => {
      if (disposed) return;
      if (equalRows(data, rowsRef.current)) return; // no change -> avoid state churn
      const now = performance.now();
      // throttle to ~5 Hz (200 ms)
      if (now - lastUpdateTs < 200) return;
      lastUpdateTs = now;
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (disposed) return;
        if (!equalRows(data, rowsRef.current)) {
          setRows(data);
        }
      });
    };

    const tick = () => {
      try {
        // Updated to use ScienceManager achievements
        const raw = (svc?.getAchievements ? (svc.getAchievements() as any[]) : []);

        // Map ScienceAchievement to MissionRow
        // ScienceAchievement: { id, name, description, isCompleted, rewardRp }
        const data: MissionRow[] = raw.map(a => ({
          id: a.id,
          name: a.name,
          description: a.description,
          reward: { money: 0, rp: a.rewardRp },
          tier: 1, // Default tier
          completed: a.isCompleted,
          progress: a.isCompleted ? 1 : 0 // No partial progress for science achievements yet
        }));

        // Sanitize progress
        const safe = data.map((m) => ({
          ...m,
          progress: (Number.isFinite(m.progress) ? Math.max(0, Math.min(1, m.progress)) : 0),
        }));
        scheduleUpdate(safe);
      } catch {
        scheduleUpdate([]);
      }
    };

    // initial fetch
    tick();
    const unsub = g?.onPostRender?.(() => tick());

    return () => {
      disposed = true;
      try { if (rafId != null) cancelAnimationFrame(rafId); } catch { }
      try { unsub?.(); } catch { }
    };
  }, []);

  const shown = useMemo(() => {
    let r = rows;
    if (filter === "active") r = rows.filter(r => !r.completed);
    if (filter === "completed") r = rows.filter(r => r.completed);
    return r.sort((a, b) => a.tier - b.tier || (a.id.localeCompare(b.id)));
  }, [rows, filter]);

  // Group by tier
  const tiers = useMemo(() => {
    const map = new Map<number, MissionRow[]>();
    for (const m of shown) {
      if (!map.has(m.tier)) map.set(m.tier, []);
      map.get(m.tier)!.push(m);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [shown]);

  return (
    <VStack align="stretch" gap={4} p={6} bg="gray.900" minH="100%">
      <SpaceCenterHeader
        title="Mission Control"
        icon={FaSatelliteDish}
        description="Manage active contracts and view progress."
        onNavigate={onNavigate}
      >
        <Select.Root size="sm" collection={filters} value={[filter]} onValueChange={(d: any) => setFilter(Array.isArray(d?.value) ? d.value[0] : d?.value)} width="150px">
          <Select.HiddenSelect />
          <Select.Control>
            <Select.Trigger>
              <Select.ValueText placeholder="Filter" />
            </Select.Trigger>
          </Select.Control>
          <Portal>
            <Select.Positioner>
              <Select.Content>
                {filters.items.map((opt: any) => (
                  <Select.Item item={opt} key={opt.value}>
                    {opt.label}
                    <Select.ItemIndicator />
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Portal>
        </Select.Root>
      </SpaceCenterHeader>

      {shown.length === 0 && (
        <Card.Root variant="subtle">
          <Card.Body>
            <Text color="gray.500">No missions to show.</Text>
          </Card.Body>
        </Card.Root>
      )}

      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={3}>
        {shown.map(m => (
          <Card.Root key={m.id} variant="outline">
            <Card.Header>
              <HStack justify="space-between" align="center">
                <Heading size="sm">{m.name}</Heading>
                <Text fontFamily="mono" fontSize="sm" color={m.completed ? "green.400" : "gray.500"}>{m.completed ? "Completed" : ""}</Text>
              </HStack>
            </Card.Header>
            <Card.Body>
              <VStack align="stretch" gap={2}>
                <Text fontSize="sm" color="gray.500">{m.description}</Text>
                <HStack justify="space-between">
                  <Text fontFamily="mono" fontSize="sm">Reward: {fmtReward(m.reward)}</Text>
                  <Text fontFamily="mono" fontSize="sm">{Math.max(0, Math.min(100, Math.round(((Number.isFinite(m.progress) ? m.progress : 0) * 100))))}%</Text>
                </HStack>
                <Progress.Root value={Math.max(0, Math.min(100, Math.floor(((Number.isFinite(m.progress) ? m.progress : 0) * 100))))} max={100}>
                  <Progress.Track>
                    <Progress.Range />
                  </Progress.Track>
                </Progress.Root>
              </VStack>
            </Card.Body>
          </Card.Root>
        ))}
      </SimpleGrid>
    </VStack>
  );
}
