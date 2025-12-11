import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Card, HStack, Heading, Progress, Select, SimpleGrid, Text, VStack, Portal, createListCollection } from "@chakra-ui/react";

interface MissionRow {
  id: string;
  name: string;
  description: string;
  reward: number;
  completed: boolean;
  progress: number; // 0..1
}

function fmtMoney(n: number) {
  try { return "$ " + n.toLocaleString(); } catch { return "$ " + String(n); }
}

export default function MissionsPage() {
  const [rows, setRows] = useState<MissionRow[]>([]);
  const [filter, setFilter] = useState<string>("active");

  const filters = useMemo(() => createListCollection({ items: [
    { label: "Active", value: "active" },
    { label: "Completed", value: "completed" },
    { label: "All", value: "all" },
  ]}), []);

  // Poll missions via services getter on render cadence
  useEffect(() => {
    const g: any = (window as any).__manager;
    const svc: any = (window as any).__services;
    const tick = () => {
      try { const data = svc?.getMissions ? svc.getMissions() as MissionRow[] : []; setRows(data); } catch { setRows([]); }
    };
    tick();
    const unsub = g?.onPostRender?.(() => tick());
    return () => { try { unsub?.(); } catch {} };
  }, []);

  const shown = useMemo(() => {
    if (filter === "active") return rows.filter(r => !r.completed);
    if (filter === "completed") return rows.filter(r => r.completed);
    return rows;
  }, [rows, filter]);

  return (
    <VStack align="stretch" gap={3} p={3}>
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
                  <Text fontFamily="mono" fontSize="sm">Reward: {fmtMoney(m.reward)}</Text>
                  <Text fontFamily="mono" fontSize="sm">{Math.round(m.progress * 100)}%</Text>
                </HStack>
                <Progress.Root value={Math.floor(m.progress * 100)} max={100}>
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
