import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Card, HStack, Heading, Input, Portal, Select, SimpleGrid, Tabs, Text, VStack, createListCollection, Dialog } from "@chakra-ui/react";
import { useAppCore } from "../app/AppContext";
import { DefaultCatalog } from "../game/PartStore";

function fmt(n: number, d = 2) {
  if (!Number.isFinite(n)) return "-";
  const a = Math.abs(n); if (a >= 10000) return n.toFixed(0); if (a >= 1000) return n.toFixed(1); return n.toFixed(d);
}

export default function EnterprisePage() {
  const { manager, services } = useAppCore();
  const scripts = services.scripts as any;
  const pendingSvc: any = services.pending;
  const upgrades = services.upgrades as any;

  // Snapshot ticker for base info
  const [snapKey, setSnapKey] = useState(0);
  useEffect(() => {
    const unsub = manager?.onPostRender?.(() => setSnapKey(k => (k + 1) % 1_000_000));
    return () => { try { unsub?.(); } catch { } };
  }, [manager]);
  const envSnap = useMemo(() => { try { return manager?.getEnvironment().snapshot(); } catch { return null; } }, [manager, snapKey]);

  // Rocket selection and naming
  const [rocketIndex, setRocketIndex] = useState<number>(0);
  const [rocketNames, setRocketNames] = useState<string[]>([]);
  useEffect(() => {
    const tick = () => { try { setRocketNames(manager?.getRocketNames?.() ?? []); } catch { setRocketNames([]); } };
    tick();
    const unsub = manager?.onPostRender?.(() => tick());
    return () => { try { unsub?.(); } catch { } };
  }, [manager]);
  useEffect(() => {
    setRocketIndex(Number(envSnap?.activeRocketIndex ?? 0) | 0);
  }, [envSnap?.activeRocketIndex]);
  const rocketCollection = useMemo(() => createListCollection({
    items: (rocketNames.length ? rocketNames : (envSnap?.rockets?.map((_r: any, i: number) => `Rocket ${i + 1}`) ?? ["Rocket 1"]))
      .map((label: string, i: number) => ({ label, value: String(i) }))
  }), [rocketNames, envSnap?.rockets?.length]);

  const [editName, setEditName] = useState<string>("");
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  useEffect(() => {
    if (!isEditingName) setEditName(rocketNames[rocketIndex] || "");
  }, [rocketIndex, rocketNames, isEditingName]);
  const saveName = () => { try { manager?.setRocketName?.(rocketIndex, editName); } catch { } };

  // Scripts library and assignment per rocket
  const [scriptList, setScriptList] = useState<{ id: string; name: string }[]>([]);
  const [scriptId, setScriptId] = useState<string>("");
  const [enabled, setEnabled] = useState<boolean>(false);
  useEffect(() => {
    if (!scripts) return;
    try {
      setScriptList(scripts.list().map((s: any) => ({ id: s.id, name: s.name })));
      const assigns = scripts.loadAssignments() as any[];
      const a0 = assigns.find(a => (a.rocketIndex ?? 0) === rocketIndex && a.slot === 0);
      setScriptId(a0?.scriptId || "");
      setEnabled(!!a0?.enabled);
    } catch { }
  }, [scripts, rocketIndex]);
  const scriptsCollection = useMemo(() => createListCollection({ items: scriptList.map(s => ({ label: s.name, value: s.id })) }), [scriptList]);
  const assignToSlot0 = () => {
    if (!scripts) return;
    const s = scripts.getById(scriptId);
    if (!s) return;
    // Save assignment with rocketIndex; if active rocket matches, install immediately
    const assigns = scripts.loadAssignments() as any[];
    let ex = assigns.find((a: any) => (a.rocketIndex ?? 0) === rocketIndex && a.slot === 0);
    if (ex) { ex.scriptId = s.id; } else { assigns.push({ rocketIndex, slot: 0, scriptId: s.id, enabled: false }); }
    scripts.saveAssignments(assigns);
    try {
      if ((envSnap?.activeRocketIndex ?? 0) === rocketIndex) {
        manager?.getRunner()?.installScriptToSlot(s.code, { timeLimitMs: 6 }, 0, s.name);
      }
    } catch { }
  };
  const toggleSlot0 = () => {
    if (!scripts) return;
    const next = !enabled; setEnabled(next);
    const assigns = scripts.loadAssignments() as any[];
    let ex = assigns.find((a: any) => (a.rocketIndex ?? 0) === rocketIndex && a.slot === 0);
    if (ex) { ex.enabled = next; } else { assigns.push({ rocketIndex, slot: 0, scriptId: null, enabled: next }); }
    scripts.saveAssignments(assigns);
    try { if ((envSnap?.activeRocketIndex ?? 0) === rocketIndex) manager?.getRunner()?.setSlotEnabled(0, next); } catch { }
  };

  // Parts upgrade queues (per rocket)
  const [availableIds, setAvailableIds] = useState<string[]>([]);
  const [money, setMoney] = useState<number>(0);
  useEffect(() => {
    const tick = () => {
      try { const svcs: any = (window as any).__services; if (svcs?.getAvailableIds) setAvailableIds(svcs.getAvailableIds()); if (svcs?.getMoney) setMoney(Number(svcs.getMoney()) || 0); } catch { }
    };
    tick();
    const unsub = manager?.onPostRender?.(() => tick());
    return () => { try { unsub?.(); } catch { } };
  }, [manager]);

  const priceById = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of DefaultCatalog.engines) m[a.id] = a.price;
    for (const a of DefaultCatalog.fuelTanks) m[a.id] = a.price;
    for (const a of DefaultCatalog.batteries) m[a.id] = a.price;
    for (const a of DefaultCatalog.cpus) m[a.id] = a.price;
    for (const a of DefaultCatalog.sensors) m[a.id] = a.price;
    for (const a of (DefaultCatalog as any).reactionWheels) m[a.id] = a.price;
    for (const a of (DefaultCatalog as any).antennas) m[a.id] = a.price;
    return m;
  }, []);
  const nameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of DefaultCatalog.engines) m[a.id] = a.name;
    for (const a of DefaultCatalog.fuelTanks) m[a.id] = a.name;
    for (const a of DefaultCatalog.batteries) m[a.id] = a.name;
    for (const a of DefaultCatalog.cpus) m[a.id] = a.name;
    for (const a of DefaultCatalog.sensors) m[a.id] = a.name;
    for (const a of (DefaultCatalog as any).reactionWheels) m[a.id] = a.name;
    for (const a of (DefaultCatalog as any).antennas) m[a.id] = a.name;
    return m;
  }, []);
  const isLocked = (id: string) => !availableIds.includes(id);
  const isUnaffordable = (id: string) => (priceById[id] ?? Infinity) > money;

  const queuePurchase = (category: "cpu" | "engines" | "fuelTanks" | "batteries" | "sensors" | "reactionWheels" | "antennas", id: string, currentId?: string | null) => {
    if (!id) return;
    if (currentId && id === currentId) { alert("Already installed."); return; }
    try {
      const curPrice = currentId ? (priceById[currentId] ?? Infinity) : Infinity;
      const nextPrice = priceById[id] ?? Infinity;
      // Downgrades (cheaper or equal) are free
      if (Number.isFinite(curPrice) && Number.isFinite(nextPrice) && nextPrice <= curPrice) {
        pendingSvc?.queueUpgrade?.(category, id, rocketIndex);
        setPending(pendingSvc?.load?.(rocketIndex) ?? {});
        return;
      }
      const svcs: any = (window as any).__services;
      if (!svcs?.purchasePart) return;
      const res = svcs.purchasePart(id);
      if (!res?.ok) { alert(res?.reason === "insufficient" ? `Not enough money ($${res.price})` : "Upgrade locked or unavailable"); return; }
      pendingSvc?.queueUpgrade?.(category, id, rocketIndex);
      setMoney(res.newBalance ?? money);
      setPending(pendingSvc?.load?.(rocketIndex) ?? {});
    } catch (e: any) { alert("Error purchasing: " + (e?.message ?? String(e))); }
  };



  // Pending summary for selected rocket
  const [pending, setPending] = useState<any>({});
  useEffect(() => {
    const tick = () => { try { setPending(pendingSvc?.load?.(rocketIndex) ?? {}); } catch { setPending({}); } };
    tick();
    const unsub = manager?.onPostRender?.(() => tick());
    return () => { try { unsub?.(); } catch { } };
  }, [manager, pendingSvc, rocketIndex]);

  const rocket = useMemo(() => { try { return manager?.getRockets?.()[rocketIndex]; } catch { return null; } }, [manager, rocketIndex, snapKey]);

  // Upgrade dialog state
  const [dlgOpen, setDlgOpen] = useState(false);
  const [dlgCategory, setDlgCategory] = useState<"cpu" | "batteries" | "fuelTanks" | "engines" | "reactionWheels" | "antennas" | "sensors" | null>(null);
  const [dlgCurrentId, setDlgCurrentId] = useState<string | null>(null);

  const openUpgradeDialog = (cat: "cpu" | "batteries" | "fuelTanks" | "engines" | "reactionWheels" | "antennas" | "sensors", currentId: string | null) => {
    setDlgCategory(cat);
    setDlgCurrentId(currentId || null);
    setDlgOpen(true);
  };

  function renderSpecs(item: any, cat: string) {
    try {
      switch (cat) {
        case 'cpu': return (
          <VStack align="start" fontSize="xs">
            <Text>Budget/tick: {fmt(item.processingBudgetPerTick)}</Text>
            <Text>Max chars: {fmt(item.maxScriptChars, 0)}</Text>
            <Text>Slots: {fmt(item.scriptSlots, 0)}</Text>
            <Text>Energy/tick: {fmt(item.energyPerTickJ, 0)} J</Text>
            <Text>Interval: {fmt(item.processingIntervalSeconds)} s</Text>
            <Text>Mass: {fmt(item.massKg)} kg</Text>
          </VStack>
        );
        case 'batteries': return (
          <VStack align="start" fontSize="xs">
            <Text>Capacity: {fmt(item.capacityJoules, 0)} J</Text>
            <Text>Mass: {fmt(item.massKg)} kg</Text>
          </VStack>
        );
        case 'fuelTanks': return (
          <VStack align="start" fontSize="xs">
            <Text>Capacity: {fmt(item.capacityKg, 0)} kg</Text>
            <Text>Dry mass: {fmt(item.dryMassKg)} kg</Text>
          </VStack>
        );
        case 'engines': return (
          <VStack align="start" fontSize="xs">
            <Text>Thrust: {fmt(item.maxThrustN, 0)} N</Text>
            <Text>Burn: {fmt(item.fuelBurnRateKgPerS, 2)} kg/s</Text>
            <Text>Vacuum bonus: {fmt((item.vacuumBonusAtVacuum ?? 0) * 100, 1)}%</Text>
            <Text>Dry mass: {fmt(item.dryMassKg)} kg</Text>
          </VStack>
        );
        case 'reactionWheels': return (
          <VStack align="start" fontSize="xs">
            <Text>Max ω: {fmt(item.maxOmegaRadPerS, 2)} rad/s</Text>
            <Text>Energy/ω: {fmt(item.energyPerRadPerS, 0)} J/(rad/s)/s</Text>
            <Text>Mass: {fmt(item.massKg)} kg</Text>
          </VStack>
        );
        case 'antennas': return (
          <VStack align="start" fontSize="xs">
            <Text>Range: {fmt(item.rangeMeters, 0)} m</Text>
            <Text>Mass: {fmt(item.massKg)} kg</Text>
          </VStack>
        );
        case 'sensors': return (
          <VStack align="start" fontSize="xs">
            <Text>Mass: {fmt(item.massKg)} kg</Text>
          </VStack>
        );
      }
    } catch { }
    return null;
  }

  const dialogItems = useMemo(() => {
    if (!dlgCategory) return [] as any[];
    const cat = dlgCategory;
    const mapPart = (sp: any) => ({ id: sp.id, name: sp.name, price: sp.price, spec: sp.make() });
    if (cat === 'cpu') return DefaultCatalog.cpus.map(mapPart);
    if (cat === 'batteries') return DefaultCatalog.batteries.map(mapPart);
    if (cat === 'fuelTanks') return DefaultCatalog.fuelTanks.map(mapPart);
    if (cat === 'engines') return DefaultCatalog.engines.map(mapPart);
    if (cat === 'reactionWheels') return (DefaultCatalog as any).reactionWheels.map(mapPart);
    if (cat === 'antennas') return (DefaultCatalog as any).antennas.map(mapPart);
    if (cat === 'sensors') return DefaultCatalog.sensors.map(mapPart);
    return [] as any[];
  }, [dlgCategory]);

  return (
    <>
      <Dialog.Root open={dlgOpen} onOpenChange={(e: any) => setDlgOpen(!!(Array.isArray(e?.open) ? e.open[0] : e?.open))}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="800px">
            <Dialog.CloseTrigger />
            <Dialog.Header>
              <Dialog.Title>Choose Upgrade</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
                {dialogItems.map((it: any) => {
                  const locked = isLocked(it.id);
                  const price = priceById[it.id] ?? 0;
                  const same = dlgCurrentId && it.id === dlgCurrentId;
                  const unaff = (price > money) && !(dlgCurrentId && (price <= (priceById[dlgCurrentId] ?? Infinity))); // downgrades free
                  return (
                    <Card.Root key={it.id} variant="outline">
                      <Card.Header>
                        <HStack justify="space-between"><Heading size="sm">{it.name}</Heading><Text fontFamily="mono">${price}</Text></HStack>
                      </Card.Header>
                      <Card.Body>
                        {renderSpecs(it.spec, dlgCategory || '')}
                        <HStack mt={2}>
                          <Button size="sm" onClick={() => { if (dlgCategory) { queuePurchase(dlgCategory, it.id, dlgCurrentId || undefined); setDlgOpen(false); } }} disabled={locked || same || unaff}>
                            {same ? "Current" : (price <= (dlgCurrentId ? (priceById[dlgCurrentId] ?? Infinity) : -1) ? "Downgrade (free)" : "Select")}
                          </Button>
                        </HStack>
                      </Card.Body>
                    </Card.Root>
                  );
                })}
              </SimpleGrid>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={() => setDlgOpen(false)}>Close</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      <Tabs.Root defaultValue={'base'} variant="outline">
        <Tabs.List>
          <Tabs.Trigger value={'base'}>Base</Tabs.Trigger>
          <Tabs.Trigger value={'rockets'}>Rockets</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value={'base'} p={3}>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
            <Card.Root variant="outline">
              <Card.Header><Heading size="sm">Base Structure</Heading></Card.Header>
              <Card.Body>
                <VStack align="stretch" gap={1} fontFamily="mono" fontSize="sm">
                  <Text>Planet: {envSnap?.bodies?.find((b: any) => b.id === envSnap?.primaryId)?.name ?? '-'}</Text>
                  <Text>Position: {(() => { const base = (envSnap as any)?.structures?.find((s: any) => s.id === 'base'); if (!base) return '-'; return `x=${fmt(base.position.x)} m, y=${fmt(base.position.y)} m`; })()}</Text>
                </VStack>
              </Card.Body>
            </Card.Root>
            <Card.Root variant="outline">
              <Card.Header><Heading size="sm">General Upgrades</Heading></Card.Header>
              <Card.Body>
                <VStack align="stretch" gap={2}>
                  <HStack justify="space-between">
                    <Text>Heating Protection Level: {upgrades?.getHeatProtectionLevel?.(rocketIndex) ?? 0}</Text>
                    <HStack>
                      <Button size="sm" onClick={() => upgrades?.setHeatProtectionLevel?.(Math.max(0, (upgrades.getHeatProtectionLevel?.(rocketIndex) ?? 0) - 1), rocketIndex)} disabled={(upgrades?.getHeatProtectionLevel?.(rocketIndex) ?? 0) <= 0}>-</Button>
                      <Button size="sm" onClick={() => upgrades?.setHeatProtectionLevel?.((upgrades.getHeatProtectionLevel?.(rocketIndex) ?? 0) + 1, rocketIndex)}>+</Button>
                    </HStack>
                  </HStack>
                  <Text fontSize="sm" color="gray.500">Max Temperature: {(upgrades?.getMaxTemperature?.(rocketIndex) ?? 1000)} units</Text>
                </VStack>
              </Card.Body>
            </Card.Root>
          </SimpleGrid>
        </Tabs.Content>

        <Tabs.Content value={'rockets'} p={3}>
          <VStack align="stretch" gap={3}>
            <Card.Root variant="outline">
              <Card.Header><Heading size="sm">Select Rocket</Heading></Card.Header>
              <Card.Body>
                <HStack gap={3}>
                  <Select.Root size="sm" collection={rocketCollection} value={[String(rocketIndex)]}
                    onValueChange={(d: any) => { const v = Array.isArray(d?.value) ? d.value[0] : d?.value; const idx = Number(v) || 0; setRocketIndex(idx); }}>
                    <Select.HiddenSelect />
                    <Select.Control>
                      <Select.Trigger>
                        <Select.ValueText placeholder="Select rocket" />
                      </Select.Trigger>
                      <Select.IndicatorGroup>
                        <Select.Indicator />
                      </Select.IndicatorGroup>
                    </Select.Control>
                    <Portal>
                      <Select.Positioner>
                        <Select.Content>
                          {rocketCollection.items.map((opt: any) => (
                            <Select.Item item={opt} key={opt.value}>
                              {opt.label}
                              <Select.ItemIndicator />
                            </Select.Item>
                          ))}
                        </Select.Content>
                      </Select.Positioner>
                    </Portal>
                  </Select.Root>
                  <Input size="sm" value={editName}
                    onFocus={() => setIsEditingName(true)}
                    onBlur={() => { setIsEditingName(false); saveName(); }}
                    onChange={(e) => setEditName(e.target.value)} minW={200} placeholder="Rocket name" />
                  <Button size="sm" onClick={saveName}>Rename</Button>
                </HStack>
              </Card.Body>
            </Card.Root>

            <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
              <Card.Root variant="outline">
                <Card.Header><Heading size="sm">Guidance System</Heading></Card.Header>
                <Card.Body>
                  <VStack align="stretch" gap={2}>
                    <Text fontFamily="mono">Name: {rocket?.cpu?.name ?? '-'}</Text>
                    <Text fontFamily="mono">Budget/tick: {fmt(rocket?.cpu?.processingBudgetPerTick ?? 0)}</Text>
                    <Text fontFamily="mono">Max Script Chars: {fmt(rocket?.cpu?.maxScriptChars ?? 0)}</Text>
                    <Text fontFamily="mono">Slots: {fmt(rocket?.cpu?.scriptSlots ?? 0, 0)}</Text>
                    <Text fontFamily="mono">Energy/tick: {fmt((rocket?.cpu as any)?.energyPerTickJ ?? 0, 0)} J</Text>
                    <Text fontFamily="mono">Interval: {fmt((rocket?.cpu as any)?.processingIntervalSeconds ?? 0)} s</Text>
                    <Text fontFamily="mono">Mass: {fmt((rocket?.cpu as any)?.massKg ?? 0)} kg</Text>
                    <HStack>
                      <Select.Root size="sm" collection={scriptsCollection} value={scriptId ? [scriptId] : []}
                        onValueChange={(d: any) => setScriptId(Array.isArray(d?.value) ? d.value[0] : d?.value || "")}>
                        <Select.HiddenSelect />
                        <Select.Control>
                          <Select.Trigger>
                            <Select.ValueText placeholder="-- Select script --" />
                          </Select.Trigger>
                          <Select.IndicatorGroup>
                            <Select.Indicator />
                          </Select.IndicatorGroup>
                        </Select.Control>
                        <Portal>
                          <Select.Positioner>
                            <Select.Content>
                              {scriptsCollection.items.map((opt: any) => (
                                <Select.Item item={opt} key={opt.value}>
                                  {opt.label}
                                  <Select.ItemIndicator />
                                </Select.Item>
                              ))}
                            </Select.Content>
                          </Select.Positioner>
                        </Portal>
                      </Select.Root>
                      <Button size="sm" onClick={assignToSlot0} disabled={!scriptId}>Assign</Button>
                      <Button size="sm" variant="outline" onClick={toggleSlot0}>{enabled ? 'Disable' : 'Enable'}</Button>
                    </HStack>
                    <HStack>
                      <Button size="sm" variant="outline" onClick={() => openUpgradeDialog('cpu', (rocket?.cpu as any)?.id ?? null)}>Upgrade</Button>
                    </HStack>
                  </VStack>
                </Card.Body>
              </Card.Root>

              <Card.Root variant="outline">
                <Card.Header><Heading size="sm">Sensors</Heading></Card.Header>
                <Card.Body>
                  <VStack align="stretch" gap={2}>
                    <Text fontFamily="mono">Installed: {(rocket?.sensors ?? []).map((s: any) => s.name).join(', ') || '(none)'}</Text>
                    <Text fontFamily="mono">Total sensor mass: {fmt((rocket?.sensors ?? []).reduce((m: any, s: any) => m + (s.massKg || 0), 0))} kg</Text>
                    <HStack>
                      <Button size="sm" variant="outline" onClick={() => openUpgradeDialog('sensors', null)}>Add Sensor</Button>
                    </HStack>
                  </VStack>
                </Card.Body>
              </Card.Root>
            </SimpleGrid>

            <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
              <Card.Root variant="outline">
                <Card.Header><Heading size="sm">Battery</Heading></Card.Header>
                <Card.Body>
                  <VStack align="stretch" gap={2}>
                    <Text fontFamily="mono">Installed: {(rocket?.batteries ?? []).map((b: any) => b.name).join(', ') || '(none)'}</Text>
                    {rocket?.batteries?.length ? (
                      <VStack align="start" fontFamily="mono" fontSize="sm">
                        <Text>Capacity: {fmt((rocket?.batteries?.[0] as any)?.capacityJoules ?? 0, 0)} J</Text>
                        <Text>Mass: {fmt((rocket?.batteries?.[0] as any)?.massKg ?? 0)} kg</Text>
                      </VStack>
                    ) : null}
                    <HStack>
                      <Button size="sm" variant="outline" onClick={() => openUpgradeDialog('batteries', ((rocket?.batteries?.[0] as any)?.id ?? null))}>Upgrade</Button>
                    </HStack>
                  </VStack>
                </Card.Body>
              </Card.Root>

              <Card.Root variant="outline">
                <Card.Header><Heading size="sm">Fuel Tank</Heading></Card.Header>
                <Card.Body>
                  <VStack align="stretch" gap={2}>
                    <Text fontFamily="mono">Installed: {(rocket?.fuelTanks ?? []).map((t: any) => t.name).join(', ') || '(none)'}</Text>
                    {rocket?.fuelTanks?.length ? (
                      <VStack align="start" fontFamily="mono" fontSize="sm">
                        <Text>Capacity: {fmt((rocket?.fuelTanks?.[0] as any)?.capacityKg ?? 0, 0)} kg</Text>
                        <Text>Dry mass: {fmt((rocket?.fuelTanks?.[0] as any)?.dryMassKg ?? 0)} kg</Text>
                      </VStack>
                    ) : null}
                    <HStack>
                      <Button size="sm" variant="outline" onClick={() => openUpgradeDialog('fuelTanks', ((rocket?.fuelTanks?.[0] as any)?.id ?? null))}>Upgrade</Button>
                    </HStack>
                  </VStack>
                </Card.Body>
              </Card.Root>

              <Card.Root variant="outline">
                <Card.Header><Heading size="sm">Reaction Wheels</Heading></Card.Header>
                <Card.Body>
                  <VStack align="stretch" gap={2}>
                    <Text fontFamily="mono">Installed: {((rocket as any)?.reactionWheels ?? []).map((rw: any) => rw.name).join(', ') || '(none)'}</Text>
                    {((rocket as any)?.reactionWheels ?? []).length ? (
                      <VStack align="start" fontFamily="mono" fontSize="sm">
                        <Text>Max ω: {fmt(((rocket as any)?.reactionWheels?.[0] as any)?.maxOmegaRadPerS ?? 0, 2)} rad/s</Text>
                        <Text>Energy/ω: {fmt(((rocket as any)?.reactionWheels?.[0] as any)?.energyPerRadPerS ?? 0, 0)} J/(rad/s)/s</Text>
                        <Text>Mass: {fmt(((rocket as any)?.reactionWheels?.[0] as any)?.massKg ?? 0)} kg</Text>
                      </VStack>
                    ) : null}
                    <HStack>
                      <Button size="sm" variant="outline" onClick={() => openUpgradeDialog('reactionWheels', (((rocket as any)?.reactionWheels?.[0] as any)?.id ?? null))}>Upgrade</Button>
                    </HStack>
                  </VStack>
                </Card.Body>
              </Card.Root>

              <Card.Root variant="outline">
                <Card.Header><Heading size="sm">Engines</Heading></Card.Header>
                <Card.Body>
                  <VStack align="stretch" gap={2}>
                    <Text fontFamily="mono">Installed: {(rocket?.engines ?? []).map((e: any) => e.name).join(', ') || '(none)'}</Text>
                    {rocket?.engines?.length ? (
                      <VStack align="start" fontFamily="mono" fontSize="sm">
                        <Text>Thrust: {fmt((rocket?.engines?.[0] as any)?.maxThrustN ?? 0, 0)} N</Text>
                        <Text>Burn: {fmt((rocket?.engines?.[0] as any)?.fuelBurnRateKgPerS ?? 0, 2)} kg/s</Text>
                        <Text>Vacuum bonus: {fmt((((rocket?.engines?.[0] as any)?.vacuumBonusAtVacuum ?? 0) * 100), 1)}%</Text>
                        <Text>Dry mass: {fmt((rocket?.engines?.[0] as any)?.dryMassKg ?? 0)} kg</Text>
                      </VStack>
                    ) : null}
                    <HStack>
                      <Button size="sm" variant="outline" onClick={() => openUpgradeDialog('engines', (rocket?.engines?.[0] as any)?.id ?? null)}>Upgrade</Button>
                    </HStack>
                  </VStack>
                </Card.Body>
              </Card.Root>
            </SimpleGrid>

            <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
              {/* Antennas */}
              <Card.Root variant="outline">
                <Card.Header><Heading size="sm">Antennas</Heading></Card.Header>
                <Card.Body>
                  <VStack align="stretch" gap={2}>
                    <Text fontFamily="mono">Installed: {(((rocket as any)?.antennas ?? []).map((a: any) => a.name).join(', ') || '(none)')}</Text>
                    {((rocket as any)?.antennas ?? []).length ? (
                      <VStack align="start" fontFamily="mono" fontSize="sm">
                        <Text>Range: {fmt((((rocket as any)?.antennas?.[0] as any)?.rangeMeters ?? 0), 0)} m</Text>
                        <Text>Mass: {fmt((((rocket as any)?.antennas?.[0] as any)?.massKg ?? 0))} kg</Text>
                      </VStack>
                    ) : null}
                    <HStack>
                      <Button size="sm" variant="outline" onClick={() => openUpgradeDialog('antennas', (((rocket as any)?.antennas?.[0] as any)?.id ?? null))}>Upgrade</Button>
                    </HStack>
                  </VStack>
                </Card.Body>
              </Card.Root>
            </SimpleGrid>

            <Card.Root variant="outline">
              <Card.Header><Heading size="sm">Pending Upgrades</Heading></Card.Header>
              <Card.Body>
                <VStack align="stretch" gap={1} fontFamily="mono" fontSize="sm">
                  <Text color="gray.500">These will be installed on the next Reset Rocket for this rocket.</Text>
                  <Text>Guidance: {pending?.cpu ? (nameById[pending.cpu] || pending.cpu) : "(none)"}</Text>
                  <Text>Sensors: {(pending?.sensors ?? []).map((id: string) => nameById[id] || id).join(', ') || '(none)'}</Text>
                  <Text>Battery: {(pending?.batteries ?? []).map((id: string) => nameById[id] || id).join(', ') || '(none)'}</Text>
                  <Text>Fuel Tank: {(pending?.fuelTanks ?? []).map((id: string) => nameById[id] || id).join(', ') || '(none)'}</Text>
                  <Text>Reaction Wheels: {(pending?.reactionWheels ?? []).map((id: string) => nameById[id] || id).join(', ') || '(none)'}</Text>
                  <Text>Engines: {(pending?.engines ?? []).map((id: string) => nameById[id] || id).join(', ') || '(none)'}</Text>
                  <Text>Antennas: {((pending as any)?.antennas ?? []).map((id: string) => nameById[id] || id).join(', ') || '(none)'}</Text>
                </VStack>
              </Card.Body>
            </Card.Root>
          </VStack>
        </Tabs.Content>
      </Tabs.Root>
    </>
  );
}
