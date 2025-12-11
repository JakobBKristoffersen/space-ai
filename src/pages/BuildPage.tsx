import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, HStack, Heading, Select, SimpleGrid, Text, VStack, Portal, createListCollection } from "@chakra-ui/react";
import { useAppCore } from "../app/AppContext";
import { DefaultCatalog } from "../game/PartStore";

function fmt(n: number, d = 2) {
  if (!Number.isFinite(n)) return "-";
  const a = Math.abs(n); if (a >= 10000) return n.toFixed(0); if (a >= 1000) return n.toFixed(1); return n.toFixed(d);
}

export default function BuildPage() {
  const { manager, services } = useAppCore();
  const scripts = services.scripts as any;
  const layout = services.layout;
  const upgrades = services.upgrades;
  const pendingSvc: any = services.pending;

  const [running, setRunning] = useState<boolean>(false);
  const [money, setMoney] = useState<number>(0);

  const [scriptId, setScriptId] = useState<string>("");
  const [enabled, setEnabled] = useState<boolean>(false);
  const [scriptList, setScriptList] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!scripts) return;
    try {
      setScriptList(scripts.list().map((s: any) => ({ id: s.id, name: s.name })));
      const assigns = scripts.loadAssignments();
      const s0 = assigns.find((a: any) => a.slot === 0);
      if (s0) { setScriptId(s0.scriptId || ""); setEnabled(!!s0.enabled); }
    } catch {}
  }, [scripts]);

  const scriptsCollection = useMemo(() => createListCollection({
    items: scriptList.map((s) => ({ label: s.name, value: s.id })),
  }), [scriptList]);

  const cpuCollection = useMemo(() => createListCollection({ items: DefaultCatalog.cpus.map((c) => ({ label: `${c.name} — $${c.price}`, value: c.id })) }), []);
  const sensorsCollection = useMemo(() => createListCollection({ items: DefaultCatalog.sensors.map((s) => ({ label: `${s.name} — $${s.price}`, value: s.id })) }), []);
  const batteriesCollection = useMemo(() => createListCollection({ items: DefaultCatalog.batteries.map((b) => ({ label: `${b.name} — $${b.price}`, value: b.id })) }), []);
  const tanksCollection = useMemo(() => createListCollection({ items: DefaultCatalog.fuelTanks.map((t) => ({ label: `${t.name} — $${t.price}`, value: t.id })) }), []);
  const enginesCollection = useMemo(() => createListCollection({ items: DefaultCatalog.engines.map((e) => ({ label: `${e.name} — $${e.price}`, value: e.id })) }), []);
  const reactionCollection = useMemo(() => createListCollection({ items: (DefaultCatalog as any).reactionWheels.map((rw: any) => ({ label: `${rw.name} — $${rw.price}`, value: rw.id })) }), []);

  const [cpuSel, setCpuSel] = useState<string>("");
  const [sensorSel, setSensorSel] = useState<string>("");
  const [batterySel, setBatterySel] = useState<string>("");
  const [tankSel, setTankSel] = useState<string>("");
  const [engineSel, setEngineSel] = useState<string>("");
  const [reactionSel, setReactionSel] = useState<string>("");

  const rocket = manager?.getRocket();

  // Running state and money/availability
  useEffect(() => {
    setRunning(!!manager?.isRunning?.());
    const unsub = manager?.onPostRender?.(() => {
      setRunning(!!manager?.isRunning?.());
      try {
        const svcs: any = (window as any).__services;
        if (svcs?.getMoney) setMoney(Number(svcs.getMoney()) || 0);
      } catch {}
    });
    // Init money once
    try { const svcs: any = (window as any).__services; if (svcs?.getMoney) setMoney(Number(svcs.getMoney()) || 0); } catch {}
    return () => { try { unsub?.(); } catch {} };
  }, [manager]);

  // Available ids & pending summary
  const [availableIds, setAvailableIds] = useState<string[]>([]);
  const [pending, setPending] = useState<any>(() => pendingSvc?.load?.() ?? {});
  useEffect(() => {
    const tick = () => {
      try { const svcs: any = (window as any).__services; if (svcs?.getAvailableIds) setAvailableIds(svcs.getAvailableIds()); } catch {}
      try { setPending(pendingSvc?.load?.() ?? {}); } catch {}
    };
    tick();
    const unsub = manager?.onPostRender?.(() => tick());
    return () => { try { unsub?.(); } catch {} };
  }, [manager, pendingSvc]);

  // Price map helpers
  const priceById = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of DefaultCatalog.engines) m[a.id] = a.price;
    for (const a of DefaultCatalog.fuelTanks) m[a.id] = a.price;
    for (const a of DefaultCatalog.batteries) m[a.id] = a.price;
    for (const a of DefaultCatalog.cpus) m[a.id] = a.price;
    for (const a of DefaultCatalog.sensors) m[a.id] = a.price;
    for (const a of (DefaultCatalog as any).reactionWheels) m[a.id] = a.price;
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
    return m;
  }, []);

  const isLocked = (id: string) => !availableIds.includes(id);
  const isUnaffordable = (id: string) => (priceById[id] ?? Infinity) > money;

  // Queue purchase helper
  const queuePurchase = (category: "cpu"|"engines"|"fuelTanks"|"batteries"|"sensors"|"reactionWheels", id: string) => {
    if (!id) return;
    try {
      const svcs: any = (window as any).__services;
      if (!svcs?.purchasePart) return;
      const res = svcs.purchasePart(id);
      if (!res?.ok) {
        alert(res?.reason === "insufficient" ? `Not enough money ($${res.price})` : "Upgrade locked or unavailable");
        return;
      }
      pendingSvc?.queueUpgrade?.(category, id);
      setMoney(res.newBalance ?? money);
      setPending(pendingSvc?.load?.() ?? {});
    } catch (e: any) {
      alert("Error purchasing: " + (e?.message ?? String(e)));
    }
  };

  const assignToSlot0 = () => {
    if (!manager || !scripts) return;
    const s = scripts.getById(scriptId);
    if (!s) return;
    try { manager.getRunner().installScriptToSlot(s.code, { timeLimitMs: 6 }, 0, s.name); } catch (e: any) { alert("Compile error: " + (e?.message ?? String(e))); return; }
    const assigns = scripts.loadAssignments();
    const ex = assigns.find((a: any) => a.slot === 0);
    if (ex) ex.scriptId = s.id; else assigns.push({ slot: 0, scriptId: s.id, enabled: false });
    scripts.saveAssignments(assigns);
  };

  const toggleSlot0 = () => {
    if (!manager || !scripts) return;
    const next = !enabled;
    try { manager.getRunner().setSlotEnabled(0, next); } catch {}
    const assigns = scripts.loadAssignments();
    const ex = assigns.find((a: any) => a.slot === 0);
    if (ex) ex.enabled = next; else assigns.push({ slot: 0, scriptId: null, enabled: next });
    scripts.saveAssignments(assigns);
    setEnabled(next);
  };

  // Upgrades: Heating Protection (levelled)
  const [heatLevel, setHeatLevel] = useState<number>(() => upgrades?.getHeatProtectionLevel?.() ?? 0);
  const incHeat = (d: number) => {
    const lv = Math.max(0, (heatLevel || 0) + d); setHeatLevel(lv); upgrades?.setHeatProtectionLevel?.(lv);
  };

  // Simple part replacement helpers (replace first item of category)
  const replaceEngine = (id: string) => {
    if (!manager || !layout) return;
    const r = manager.getRocket();
    // build new layout
    const lay = layout.getLayoutFromRocket(r);
    lay.engines = [id];
    layout.saveLayout(r);
    manager.recreateFromLayout(lay);
    manager.publishTelemetry();
  };
  const replaceTank = (id: string) => {
    if (!manager || !layout) return;
    const r = manager.getRocket();
    const lay = layout.getLayoutFromRocket(r);
    lay.fuelTanks = [id];
    layout.saveLayout(r);
    manager.recreateFromLayout(lay);
    manager.publishTelemetry();
  };
  const replaceBattery = (id: string) => {
    if (!manager || !layout) return;
    const r = manager.getRocket();
    const lay = layout.getLayoutFromRocket(r);
    lay.batteries = [id];
    layout.saveLayout(r);
    manager.recreateFromLayout(lay);
    manager.publishTelemetry();
  };
  const replaceCPU = (id: string) => {
    if (!manager || !layout) return;
    const r = manager.getRocket();
    const lay = layout.getLayoutFromRocket(r);
    lay.cpu = id;
    layout.saveLayout(r);
    manager.recreateFromLayout(lay);
    manager.publishTelemetry();
  };
  const addSensor = (id: string) => {
    if (!manager || !layout) return;
    const r = manager.getRocket();
    const lay = layout.getLayoutFromRocket(r);
    if (!lay.sensors.includes(id)) lay.sensors.push(id);
    layout.saveLayout(r);
    manager.recreateFromLayout(lay);
    manager.publishTelemetry();
  };

  return (
    <VStack align="stretch" gap={3}>
      {/* Top: Processing Unit + Sensors */}
      <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
        <Card.Root variant="outline">
          <Card.Header><Heading size="sm">Guidance System</Heading></Card.Header>
          <Card.Body>
            <VStack align="stretch" gap={2}>
              <Text fontFamily="mono">Name: {rocket?.cpu?.name ?? "-"}</Text>
              <Text fontFamily="mono">Budget/tick: {fmt(rocket?.cpu?.processingBudgetPerTick ?? 0)}</Text>
              <Text fontFamily="mono">Max Script Chars: {fmt(rocket?.cpu?.maxScriptChars ?? 0)}</Text>
              {/* Single-slot assignment UI */}
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
                <Button size="sm" onClick={assignToSlot0} disabled={!scriptId}>Assign to Guidance</Button>
                <Button size="sm" variant="outline" onClick={toggleSlot0}>{enabled ? "Disable" : "Enable"}</Button>
              </HStack>
              {/* CPU Upgrade */}
              <HStack>
                <Select.Root size="sm" collection={cpuCollection} value={cpuSel ? [cpuSel] : []}
                               onValueChange={(d: any) => { const v = Array.isArray(d?.value) ? d.value[0] : d?.value; if (v) { setCpuSel(v); queuePurchase("cpu", v); setCpuSel(""); } }}>
                  <Select.HiddenSelect />
                  <Select.Control>
                    <Select.Trigger>
                      <Select.ValueText placeholder="Upgrade Guidance..." />
                    </Select.Trigger>
                    <Select.IndicatorGroup>
                      <Select.Indicator />
                    </Select.IndicatorGroup>
                  </Select.Control>
                  <Portal>
                    <Select.Positioner>
                      <Select.Content>
                        {cpuCollection.items.map((opt: any) => (
                          <Select.Item item={opt} key={opt.value} disabled={isLocked(opt.value) || isUnaffordable(opt.value)}>
                            {opt.label}
                            <Select.ItemIndicator />
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Positioner>
                  </Portal>
                </Select.Root>
              </HStack>
            </VStack>
          </Card.Body>
        </Card.Root>

        <Card.Root variant="outline">
          <Card.Header><Heading size="sm">Sensors</Heading></Card.Header>
          <Card.Body>
            <VStack align="stretch" gap={2}>
              <Text fontFamily="mono">Installed: {(rocket?.sensors ?? []).map(s => s.name).join(", ") || "(none)"}</Text>
              <HStack>
                <Select.Root size="sm" collection={sensorsCollection} value={sensorSel ? [sensorSel] : []}
                               onValueChange={(d: any) => { const v = Array.isArray(d?.value) ? d.value[0] : d?.value; if (v) { setSensorSel(v); queuePurchase("sensors", v); setSensorSel(""); } }}>
                  <Select.HiddenSelect />
                  <Select.Control>
                    <Select.Trigger>
                      <Select.ValueText placeholder="Add sensor..." />
                    </Select.Trigger>
                    <Select.IndicatorGroup>
                      <Select.Indicator />
                    </Select.IndicatorGroup>
                  </Select.Control>
                  <Portal>
                    <Select.Positioner>
                      <Select.Content>
                        {sensorsCollection.items.map((opt: any) => (
                          <Select.Item item={opt} key={opt.value} disabled={isLocked(opt.value) || isUnaffordable(opt.value)}>
                            {opt.label}
                            <Select.ItemIndicator />
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Positioner>
                  </Portal>
                </Select.Root>
              </HStack>
            </VStack>
          </Card.Body>
        </Card.Root>
      </SimpleGrid>

      {/* Mid: Battery, Fuel Tank, Reaction Wheels */}
      <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
        <Card.Root variant="outline">
          <Card.Header><Heading size="sm">Battery</Heading></Card.Header>
          <Card.Body>
            <VStack align="stretch" gap={2}>
              <Text fontFamily="mono">Installed: {(rocket?.batteries ?? []).map(b => b.name).join(", ") || "(none)"}</Text>
              <HStack>
                <Select.Root size="sm" collection={batteriesCollection} value={batterySel ? [batterySel] : []} disabled={running}
                               onValueChange={(d: any) => { const v = Array.isArray(d?.value) ? d.value[0] : d?.value; if (v) { setBatterySel(v); queuePurchase("batteries", v); setBatterySel(""); } }}>
                  <Select.HiddenSelect />
                  <Select.Control>
                    <Select.Trigger>
                      <Select.ValueText placeholder="Upgrade battery..." />
                    </Select.Trigger>
                    <Select.IndicatorGroup>
                      <Select.Indicator />
                    </Select.IndicatorGroup>
                  </Select.Control>
                  <Portal>
                    <Select.Positioner>
                      <Select.Content>
                        {batteriesCollection.items.map((opt: any) => (
                          <Select.Item item={opt} key={opt.value} disabled={isLocked(opt.value) || isUnaffordable(opt.value)}>
                            {opt.label}
                            <Select.ItemIndicator />
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Positioner>
                  </Portal>
                </Select.Root>
              </HStack>
            </VStack>
          </Card.Body>
        </Card.Root>

        <Card.Root variant="outline">
          <Card.Header><Heading size="sm">Fuel Tank</Heading></Card.Header>
          <Card.Body>
            <VStack align="stretch" gap={2}>
              <Text fontFamily="mono">Installed: {(rocket?.fuelTanks ?? []).map(t => t.name).join(", ") || "(none)"}</Text>
              <HStack>
                <Select.Root size="sm" collection={tanksCollection} value={tankSel ? [tankSel] : []} disabled={running}
                               onValueChange={(d: any) => { const v = Array.isArray(d?.value) ? d.value[0] : d?.value; if (v) { setTankSel(v); queuePurchase("fuelTanks", v); setTankSel(""); } }}>
                  <Select.HiddenSelect />
                  <Select.Control>
                    <Select.Trigger>
                      <Select.ValueText placeholder="Upgrade tank..." />
                    </Select.Trigger>
                    <Select.IndicatorGroup>
                      <Select.Indicator />
                    </Select.IndicatorGroup>
                  </Select.Control>
                  <Portal>
                    <Select.Positioner>
                      <Select.Content>
                        {tanksCollection.items.map((opt: any) => (
                          <Select.Item item={opt} key={opt.value} disabled={isLocked(opt.value) || isUnaffordable(opt.value)}>
                            {opt.label}
                            <Select.ItemIndicator />
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Positioner>
                  </Portal>
                </Select.Root>
              </HStack>
            </VStack>
          </Card.Body>
        </Card.Root>

        {/* Reaction Wheels */}
        <Card.Root variant="outline">
          <Card.Header><Heading size="sm">Reaction Wheels</Heading></Card.Header>
          <Card.Body>
            <VStack align="stretch" gap={2}>
              <Text fontFamily="mono">Installed: {((rocket as any)?.reactionWheels ?? []).map((rw: any) => rw.name).join(", ") || "(none)"}</Text>
              <HStack>
                <Select.Root size="sm" collection={reactionCollection} value={reactionSel ? [reactionSel] : []}
                               onValueChange={(d: any) => { const v = Array.isArray(d?.value) ? d.value[0] : d?.value; if (v) { setReactionSel(v); queuePurchase("reactionWheels", v); setReactionSel(""); } }}>
                  <Select.HiddenSelect />
                  <Select.Control>
                    <Select.Trigger>
                      <Select.ValueText placeholder="Upgrade reaction wheels..." />
                    </Select.Trigger>
                    <Select.IndicatorGroup>
                      <Select.Indicator />
                    </Select.IndicatorGroup>
                  </Select.Control>
                  <Portal>
                    <Select.Positioner>
                      <Select.Content>
                        {reactionCollection.items.map((opt: any) => (
                          <Select.Item item={opt} key={opt.value} disabled={isLocked(opt.value) || isUnaffordable(opt.value)}>
                            {opt.label}
                            <Select.ItemIndicator />
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Positioner>
                  </Portal>
                </Select.Root>
              </HStack>
            </VStack>
          </Card.Body>
        </Card.Root>
      </SimpleGrid>

      {/* Bottom: Engines */}
      <Card.Root variant="outline">
        <Card.Header><Heading size="sm">Engines</Heading></Card.Header>
        <Card.Body>
          <VStack align="stretch" gap={2}>
            <Text fontFamily="mono">Installed: {(rocket?.engines ?? []).map(e => e.name).join(", ") || "(none)"}</Text>
            <HStack>
              <Select.Root size="sm" collection={enginesCollection} value={engineSel ? [engineSel] : []} disabled={running}
                               onValueChange={(d: any) => { const v = Array.isArray(d?.value) ? d.value[0] : d?.value; if (v) { setEngineSel(v); queuePurchase("engines", v); setEngineSel(""); } }}>
                  <Select.HiddenSelect />
                  <Select.Control>
                    <Select.Trigger>
                      <Select.ValueText placeholder="Upgrade engine..." />
                    </Select.Trigger>
                    <Select.IndicatorGroup>
                      <Select.Indicator />
                    </Select.IndicatorGroup>
                  </Select.Control>
                  <Portal>
                    <Select.Positioner>
                      <Select.Content>
                        {enginesCollection.items.map((opt: any) => (
                          <Select.Item item={opt} key={opt.value} disabled={isLocked(opt.value) || isUnaffordable(opt.value)}>
                            {opt.label}
                            <Select.ItemIndicator />
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Positioner>
                  </Portal>
                </Select.Root>
            </HStack>
          </VStack>
        </Card.Body>
      </Card.Root>

      {/* Pending Upgrades (installs on next Reset Rocket) */}
      <Card.Root variant="outline">
        <Card.Header><Heading size="sm">Pending Upgrades</Heading></Card.Header>
        <Card.Body>
          <VStack align="stretch" gap={1} fontFamily="mono" fontSize="sm">
            <Text color="gray.500">These will be installed on the next Reset Rocket.</Text>
            <Text>Guidance: {pending?.cpu ? (nameById[pending.cpu] || pending.cpu) : "(none)"}</Text>
            <Text>Sensors: {(pending?.sensors ?? []).map((id: string) => nameById[id] || id).join(", ") || "(none)"}</Text>
            <Text>Battery: {(pending?.batteries ?? []).map((id: string) => nameById[id] || id).join(", ") || "(none)"}</Text>
            <Text>Fuel Tank: {(pending?.fuelTanks ?? []).map((id: string) => nameById[id] || id).join(", ") || "(none)"}</Text>
            <Text>Reaction Wheels: {(pending?.reactionWheels ?? []).map((id: string) => nameById[id] || id).join(", ") || "(none)"}</Text>
            <Text>Engines: {(pending?.engines ?? []).map((id: string) => nameById[id] || id).join(", ") || "(none)"}</Text>
          </VStack>
        </Card.Body>
      </Card.Root>

      {/* General upgrades */}
      <Card.Root variant="outline">
        <Card.Header><Heading size="sm">General Upgrades</Heading></Card.Header>
        <Card.Body>
          <VStack align="stretch" gap={2}>
            <HStack justify="space-between">
              <Text>Heating Protection Level: {heatLevel}</Text>
              <HStack>
                <Button size="sm" onClick={() => incHeat(-1)} disabled={heatLevel <= 0}>-</Button>
                <Button size="sm" onClick={() => incHeat(1)}>+</Button>
              </HStack>
            </HStack>
            <Text fontSize="sm" color="gray.500">Max Temperature: {(upgrades?.getMaxTemperature?.() ?? 1000)} units</Text>
          </VStack>
        </Card.Body>
      </Card.Root>
    </VStack>
  );
}
