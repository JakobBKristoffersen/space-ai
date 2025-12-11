import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Card, HStack, Heading, Progress, Select, SimpleGrid, Text, VStack, Portal, createListCollection } from "@chakra-ui/react";

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

export default function MissionsPage() {
  const [rows, setRows] = useState<MissionRow[]>([]);
  const [filter, setFilter] = useState<string>("active");

  const filters = useMemo(() => createListCollection({
    items: [
      { label: "Active", value: "active" },
      { label: "Completed", value: "completed" },
      { label: "All", value: "all" },
    ]
  }), []);

  // Poll missions (throttled)
  useEffect(() => {
    const svcs: any = (window as any).__services;
    const tick = () => {
      try {
        // Simple optimization: only update if we have data
        // Ideally we'd deep compare, but 200ms-500ms poll is fine for UI
        const data = svcs?.getMissions ? svcs.getMissions() as MissionRow[] : [];
        setRows(prev => {
          // Very cheap check: if length and IDs match, maybe skip? 
          // For now, just setting it is fine if throttled.
          // React performs strict equality check on state. New array = new render.
          // Let's rely on JSON stringify check to avoid re-render if data is identical?
          if (JSON.stringify(prev) === JSON.stringify(data)) return prev;
          return data;
        });
      } catch { }
    };
    tick(); // initial
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
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
    <VStack align="stretch" gap={4} p={3}>
      <HStack justify="space-between">
        <Heading size="sm">Missions</Heading>
        <Select.Root size="sm" collection={filters} value={[filter]} onValueChange={(d: any) => setFilter(Array.isArray(d?.value) ? d.value[0] : d?.value)}>
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
      </HStack>

      {shown.length === 0 && (
        <Card.Root variant="subtle">
          <Card.Body>
            <Text color="gray.500">No missions to show.</Text>
          </Card.Body>
        </Card.Root>
      )}

      {tiers.map(([tier, missions]) => (
        <Box key={tier}>
          <Heading size="xs" mb={2} color="gray.400" textTransform="uppercase" letterSpacing="wider">
            Tier {tier}
          </Heading>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={3}>
            {missions.map(m => (
              <Card.Root key={m.id} variant="outline" borderColor={m.completed ? "green.500/30" : undefined} bg={m.completed ? "green.500/5" : undefined}>
                <Card.Header>
                  <HStack justify="space-between" align="center">
                    <Heading size="sm">{m.name}</Heading>
                    {m.completed && <Text fontSize="xs" color="green.400" fontWeight="bold">COMPLETED</Text>}
                  </HStack>
                </Card.Header>
                <Card.Body>
                  <VStack align="stretch" gap={2}>
                    <Text fontSize="sm" color="gray.500">{m.description}</Text>
                    <HStack justify="space-between">
                      <Text fontFamily="mono" fontSize="xs" color="yellow.400">{fmtReward(m.reward)}</Text>
                      <Text fontFamily="mono" fontSize="xs">{Math.round(m.progress * 100)}%</Text>
                    </HStack>
                    <Progress.Root value={Math.floor(m.progress * 100)} max={100} colorScheme={m.completed ? "green" : "blue"} size="sm">
                      <Progress.Track>
                        <Progress.Range />
                      </Progress.Track>
                    </Progress.Root>
                  </VStack>
                </Card.Body>
              </Card.Root>
            ))}
          </SimpleGrid>
        </Box>
      ))}
    </VStack>
  );
}
