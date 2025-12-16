import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Grid,
  GridItem,
  VStack,
  HStack,
  Button,
  Icon,
  Card,
  Heading,
  Text,
  Select,
  Input,
  Portal,
  Separator,
  Badge,
  Flex,
  Dialog,
  createListCollection,
} from "@chakra-ui/react";
import { useAppCore } from "../app/AppContext";
import { DefaultCatalog, PartCategory } from "../game/PartStore";
import { ROCKET_TEMPLATES, RocketTemplate, RocketSlot } from "../game/RocketTemplates";
import { StoredLayout } from "../app/services/LayoutService";
import { SpaceCenterHeader } from "../components/SpaceCenterHeader";
import { FaTrash, FaInfoCircle, FaBolt, FaWeightHanging, FaDollarSign, FaFire, FaTools, FaChevronLeft, FaFlask, FaPlus } from "react-icons/fa";

// ... (helpers) ...

export default function BuildPage({ onNavigate }: { onNavigate: (view: string) => void }) {
  const { manager, services } = useAppCore();
  // --- State ---
  const [templateId, setTemplateId] = useState<string>("template.basic");
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [activeSlot, setActiveSlot] = useState<RocketSlot | null>(null);
  const [scriptId, setScriptId] = useState<string>("");
  const [rocketName, setRocketName] = useState<string>("My Rocket");
  const [availableScripts, setAvailableScripts] = useState<{ label: string, value: string }[]>([]);

  // Collections
  const templatesCollection = useMemo(() => createListCollection({
    items: ROCKET_TEMPLATES.map(t => ({ label: t.name, value: t.id, description: t.description }))
  }), []);

  const scriptsCollection = useMemo(() => createListCollection({
    items: availableScripts
  }), [availableScripts]);

  useEffect(() => {
    if (services.scripts) {
      const list = services.scripts.list();
      setAvailableScripts(list.map(s => ({ label: s.name, value: s.id })));
    }
  }, [services.scripts]);

  // Resources & Limits
  const [padLevel, setPadLevel] = useState<number>(1);
  const [maxMassKg, setMaxMassKg] = useState<number>(30_000);
  const [maxActiveRockets, setMaxActiveRockets] = useState<number>(1);

  // Sync with Global State
  useEffect(() => {
    const sync = () => {
      try {
        const upg = services.upgrades;
        if (upg) {
          const lvl = upg.getLevel("launchPad");
          setPadLevel(lvl);
          setMaxMassKg(upg.getMaxLaunchMass(lvl));

          const tsLvl = upg.getLevel("trackingStation");
          setMaxActiveRockets(upg.getMaxActiveRockets(tsLvl));
        }
      } catch { }
    };
    sync();
    const id = setInterval(sync, 1000);
    return () => clearInterval(id);
  }, [services]);

  const [isLoaded, setIsLoaded] = useState(false);

  // Load Layout
  useEffect(() => {
    try {
      const saved = services.layout?.loadLayout();
      if (saved) {
        if (saved.templateId) setTemplateId(saved.templateId);
        if (saved.slots) setAssignments(saved.slots);
        if (saved.scriptId) setScriptId(saved.scriptId);
        if (saved.name) setRocketName(saved.name);
      }
    } catch { }
    setIsLoaded(true);
  }, [services]);

  // Derived
  const template = useMemo(() => ROCKET_TEMPLATES.find(t => t.id === templateId) || ROCKET_TEMPLATES[0], [templateId]);

  const getPartsByCategory = (cat: PartCategory) => {
    switch (cat) {
      case "engine": return DefaultCatalog.engines;
      case "fuel": return DefaultCatalog.fuelTanks;
      case "battery": return DefaultCatalog.batteries;
      case "cpu": return DefaultCatalog.cpus;
      case "sensor": return DefaultCatalog.sensors;
      case "reactionWheels": return DefaultCatalog.reactionWheels;
      case "antenna": return DefaultCatalog.antennas;
      case "payload": return DefaultCatalog.payloads;
      case "solar": return DefaultCatalog.solarPanels;
      case "cone": return DefaultCatalog.cones;
      case "fin": return DefaultCatalog.fins;
      case "parachute": return DefaultCatalog.parachutes;
      case "heatShield": return DefaultCatalog.heatShields;
      case "science": return DefaultCatalog.science;
      default: return [];
    }
  };

  const getPartStats = (partId: string, cat: PartCategory) => {
    const list = getPartsByCategory(cat);
    const p: any = list.find(x => x.id === partId);
    if (!p) return null;

    const instance = p.make();

    // Build generic stats array
    const stats: { label: string, value: string, icon?: any }[] = [];

    // Mass: Standard parts use massKg, Engines/Tanks use dryMassKg
    const mass = (instance as any).massKg ?? (instance as any).dryMassKg;
    if (mass !== undefined) stats.push({ label: "Mass", value: `${mass}kg`, icon: FaWeightHanging });

    // --- Specific Part Stats ---
    const i = instance as any;

    // Engine
    if (i.maxThrustN) stats.push({ label: "Thrust", value: `${i.maxThrustN}N`, icon: FaFire });
    if (i.vacuumBonusAtVacuum) stats.push({ label: "Vac Bonus", value: `+${(i.vacuumBonusAtVacuum * 100).toFixed(0)}%`, icon: FaFire });

    // Fuel Tank
    if (i.capacityKg) stats.push({ label: "Fuel", value: `${i.capacityKg}kg`, icon: FaFire });

    // Battery
    const capJ = i.capacityJoules ?? i.capacity;
    if (capJ) stats.push({ label: "Cap", value: `${capJ}J`, icon: FaBolt });

    // CPU
    if (i.maxScriptChars) stats.push({ label: "Mem", value: `${(i.maxScriptChars / 1024).toFixed(1)}kb`, icon: FaTools });
    if (i.processingBudgetPerTick) stats.push({ label: "CPU", value: `${i.processingBudgetPerTick}ops`, icon: FaTools });

    // Antenna
    const range = i.rangeMeters ?? i.antennaPower;
    if (range) stats.push({ label: "Range", value: `${(range / 1000).toFixed(0)}km`, icon: FaBolt });

    // Aero (NoseCone, Fin)
    if (i.dragCoefficient) stats.push({ label: "Drag", value: `${i.dragCoefficient}`, icon: FaWeightHanging });
    // Parachute
    if (i.deployedDrag) stats.push({ label: "Chute Drag", value: `${i.deployedDrag}`, icon: FaWeightHanging });
    // HeatShield
    if (i.maxTemp) stats.push({ label: "MaxTemp", value: `${i.maxTemp}K`, icon: FaFire });

    // Science
    // If scienceValue exists on instance, show it (dynamic cast)
    if (i.scienceValue) stats.push({ label: "Sci", value: `${i.scienceValue}pts`, icon: FaFlask });

    return { name: p.name, stats };
  };

  const summary = useMemo(() => {
    let totalMass = 0;

    // Sum assignments
    Object.values(assignments).forEach((partId) => {
      // Find definition
      const def = Object.values(DefaultCatalog).flat().find((x: any) => x.id === partId) as any;
      if (def) {
        // Instantiate to get physical stats which might not be on the catalog item
        const instance = def.make();
        totalMass += ((instance as any).massKg ?? (instance as any).dryMassKg ?? 0);
      }
    });

    return { totalMass };
  }, [assignments]);

  // Logic
  const handleTemplateChange = (d: any) => {
    const val = Array.isArray(d?.value) ? d.value[0] : d?.value;
    if (val && val !== templateId) {
      // Confirm reset?
      if (Object.keys(assignments).length > 0 && !confirm("Switching templates will clear current assignments. Continue?")) return;
      setTemplateId(val);
      setAssignments({});
    }
  };

  const handlePartSelect = (partId: string) => {
    if (!activeSlot) return;
    setAssignments(prev => {
      const next = { ...prev };
      if (!partId) delete next[activeSlot.id];
      else next[activeSlot.id] = partId;
      // Auto-save removed; handled by effect
      return next;
    });
    setActiveSlot(null);
  };

  const handleNewRocket = () => {
    if (Object.keys(assignments).length > 0 && !confirm("Start new rocket? Unsaved changes to current configuration will be lost.")) return;
    setTemplateId("template.basic");
    setAssignments({});
    setScriptId("");
    setRocketName("New Rocket");
  };

  useEffect(() => {
    if (isLoaded && services.layout) {
      services.layout.saveLayout({ templateId, slots: assignments, scriptId, name: rocketName });
    }
  }, [templateId, assignments, scriptId, rocketName, isLoaded, services]);

  const handleBuildLaunch = () => {
    // 1. Check constraints
    if (summary.totalMass > maxMassKg) { alert("Weight exceeds launch pad capacity!"); return; }


    // 2. Check Active Rocket Limit / Name Collision
    const activeCount = manager?.getRockets().length ?? 0;
    const names = manager?.getRocketNames() ?? [];
    const targetIdx = names.indexOf(rocketName); // -1 if new name
    const currentIdx = manager?.getActiveRocketIndex() ?? 0;

    if (targetIdx !== -1) {
      // Name matches an existing rocket
      if (targetIdx !== currentIdx) {
        if (!confirm(`Overwrite existing rocket "${names[targetIdx]}"?`)) return;
        manager?.setActiveRocketIndex(targetIdx);
      }
      // If matches current, we just proceed to overwrite it.
    } else {
      // New Name
      if (activeCount >= maxActiveRockets) {
        // Limit Reached. Ask to overwrite current.
        const currentName = names[currentIdx] || "Current Rocket";
        if (!confirm(`Tracking Station Limit Reached (${activeCount}/${maxActiveRockets}).\n\nOverwrite currently active rocket "${currentName}" with new name "${rocketName}"?`)) {
          return;
        }
        // User confirmed overwrite. We proceed. 
        // Note: The launch logic below calls `recreateFromLayout` on the active index,
        // which will effectively rename it since we update the name in the Rocket object.
      }
    }


    // 4. Build Rocket Object
    const layout: StoredLayout = { templateId, slots: assignments, scriptId, name: rocketName };
    const rocket = services.layout?.buildRocketFromLayout(layout);

    if (rocket) {
      manager?.recreateFromLayout(layout); // Replaces active rocket
      manager?.setRocketName(manager.getActiveRocketIndex(), rocketName);

      // Install Flight Software
      if (scriptId && services.scripts) {
        const s = services.scripts.getById(scriptId);
        if (s) {
          const codeToRun = (s as any).compiledCode || s.code;
          manager?.getRunner()?.installScriptToSlot(codeToRun, { timeLimitMs: 6 }, 0, s.name);

          // Persist assignment so it survives reset/reloads
          const ai = manager?.getActiveRocketIndex() ?? 0;
          const assigns = services.scripts.loadAssignments().filter((a: any) => !(a.rocketIndex === ai && a.slot === 0));
          assigns.push({ rocketIndex: ai, slot: 0, scriptId: s.id, enabled: true });
          services.scripts.saveAssignments(assigns);
        }
      }

      onNavigate("world_scene");
    }
  };

  return (
    <Flex direction="column" h="calc(100vh - 60px)" p={4} gap={4}>
      <SpaceCenterHeader
        title="Vehicle Assembly Building"
        icon={FaTools}
        description="Design and build your rockets."
        onNavigate={onNavigate}
        currentView="build"
      >
      </SpaceCenterHeader>

      <Grid templateColumns="300px 1fr" gap={6} flex={1} minH={0} overflow="hidden">

        {/* SIDEBAR: Controls & Summary */}
        <GridItem h="100%" overflowY="auto">
          <VStack align="stretch" gap={4} h="100%">
            {/* Removed internal back button */}
            <Card.Root variant="elevated" bg="gray.800" borderColor="gray.700">
              <Card.Header pb={2}>
                <HStack justify="space-between">
                  <Heading size="sm" color="gray.300">Design Overview</Heading>
                  <Button size="xs" variant="ghost" colorScheme="cyan" title="Import from Active Rocket" onClick={() => {
                    const rocket = manager?.getEnvironment().rocket;
                    if (rocket && services.layout) {
                      const l = services.layout.getLayoutFromRocket(rocket);
                      if (l) {
                        if (l.templateId) setTemplateId(l.templateId);
                        if (l.slots) setAssignments(l.slots);
                        // alert("Imported configuration from active rocket."); 
                        // Silent is better or toast? Alert is fine for now.
                      }
                    }
                  }}>
                    <Icon as={FaTools} /> Import Active
                  </Button>
                </HStack>
              </Card.Header>
              <Card.Body>
                <VStack align="stretch" gap={4}>
                  <Box>
                    <Text fontSize="xs" color="gray.500" mb={1}>ROCKET NAME</Text>
                    <Input size="sm" value={rocketName} onChange={(e) => setRocketName(e.target.value)} borderColor="gray.600" />
                  </Box>

                  <Box>
                    <Text fontSize="xs" color="gray.500" mb={1}>CHASSIS TEMPLATE</Text>
                    <Select.Root collection={templatesCollection} value={[templateId]} onValueChange={handleTemplateChange} size="sm">
                      <Select.HiddenSelect />
                      <Select.Control>
                        <Select.Trigger>
                          <Select.ValueText placeholder="Select template" />
                        </Select.Trigger>
                        <Select.IndicatorGroup><Select.Indicator /></Select.IndicatorGroup>
                      </Select.Control>
                      <Portal>
                        <Select.Positioner>
                          <Select.Content>
                            {templatesCollection.items.map(t => (
                              <Select.Item key={t.value} item={t}>{t.label}</Select.Item>
                            ))}
                          </Select.Content>
                        </Select.Positioner>
                      </Portal>
                    </Select.Root>
                    <Text fontSize="xs" color="gray.500" mt={1}>{template.description}</Text>
                  </Box>

                  <Box>
                    <Text fontSize="xs" color="gray.500" mb={1}>FLIGHT SOFTWARE</Text>
                    <Select.Root collection={scriptsCollection} value={[scriptId]} onValueChange={(d) => setScriptId(Array.isArray(d.value) ? d.value[0] : d.value)} size="sm">
                      <Select.HiddenSelect />
                      <Select.Control>
                        <Select.Trigger>
                          <Select.ValueText placeholder="No script assigned" />
                        </Select.Trigger>
                        <Select.IndicatorGroup><Select.Indicator /></Select.IndicatorGroup>
                      </Select.Control>
                      <Portal>
                        <Select.Positioner>
                          <Select.Content>
                            <Select.Item item={{ label: "None", value: "" }} key="none">None</Select.Item>
                            {scriptsCollection.items.map(s => (
                              <Select.Item key={s.value} item={s}>{s.label}</Select.Item>
                            ))}
                          </Select.Content>
                        </Select.Positioner>
                      </Portal>
                    </Select.Root>
                  </Box>

                  <Separator borderColor="gray.600" />

                  <VStack align="stretch" gap={2}>
                    <HStack justify="space-between">
                      <Text color="gray.400">Total Mass</Text>
                      {/* Display Mass Check */}
                      <VStack align="end" gap={0}>
                        <Text fontWeight="mono" color={summary.totalMass > maxMassKg ? "red.400" : "white"}>{summary.totalMass} kg</Text>
                        <Text fontSize="xs" color="gray.500">Max: {maxMassKg} kg</Text>
                      </VStack>
                    </HStack>

                  </VStack>

                  <Button size="lg" colorScheme="blue" width="full" mt={4} onClick={handleBuildLaunch}
                    disabled={summary.totalMass > maxMassKg}>
                    Deploy to Pad
                  </Button>
                  {summary.totalMass > maxMassKg && <Text fontSize="xs" color="red.400" textAlign="center">Exceeds Pad Limit (Lvl {padLevel})</Text>}
                </VStack>
              </Card.Body>
            </Card.Root>
          </VStack>
        </GridItem>

        {/* MAIN: Stages & Slots */}
        <GridItem overflowY="auto" pr={2}>
          <VStack align="stretch" gap={3}>
            {template.stages.map((stage, i) => (
              <Box key={stage.id} position="relative">
                <HStack mb={1} ml={1}>
                  <Badge colorPalette="purple" variant="solid">STAGE {template.stages.length - i}</Badge>
                  <Text fontWeight="bold" color="gray.300">{stage.name}</Text>
                </HStack>

                <VStack align="stretch" gap={0} bg="gray.800" borderRadius="md" overflow="hidden" borderWidth="1px" borderColor="gray.700">
                  {stage.slots.map((slot, idx) => {
                    const assignedId = assignments[slot.id];
                    let partInfo = null;
                    if (assignedId) {
                      // Find info
                      for (const cat of slot.allowedCategories) {
                        const info = getPartStats(assignedId, cat);
                        if (info) { partInfo = info; break; }
                      }
                    }

                    return (
                      <Flex key={slot.id}
                        p={3}
                        align="center"
                        justify="space-between"
                        borderTopWidth={idx > 0 ? "1px" : "0"}
                        borderColor="whiteAlpha.100"
                        _hover={{ bg: "whiteAlpha.50", cursor: "pointer" }}
                        onClick={() => setActiveSlot(slot)}
                      >
                        {/* Left: Slot Name & Requirements */}
                        <VStack align="start" gap={0} w="150px">
                          <Text fontWeight="medium" fontSize="sm" color="gray.200">{slot.name}</Text>
                          <Text fontSize="xs" color="gray.500">{slot.allowedCategories.join("/")}</Text>
                        </VStack>

                        {/* Center: Assigned Part Info */}
                        <Box flex={1}>
                          {partInfo ? (
                            <HStack gap={4}>
                              <Text fontWeight="bold" color="cyan.300">{partInfo.name}</Text>
                              {partInfo.stats.map(s => (
                                <Badge key={s.label} variant="subtle" colorPalette="gray" fontSize="xs">
                                  {s.icon && <Icon as={s.icon} mr={1} boxSize={3} />}
                                  {s.label}: {s.value}
                                </Badge>
                              ))}
                            </HStack>
                          ) : (
                            <Text color="gray.600" fontStyle="italic">Empty Slot</Text>
                          )}
                        </Box>

                        {/* Right: Actions/Price */}
                        <HStack>
                          <Icon as={FaInfoCircle} color="gray.600" />
                        </HStack>
                      </Flex>
                    );
                  })}
                </VStack>
              </Box>
            ))}
          </VStack>
        </GridItem>

      </Grid>

      {/* PART PICKER MODAL */}
      <Dialog.Root open={!!activeSlot} onOpenChange={() => setActiveSlot(null)} size="lg">
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg="gray.900" borderColor="gray.700">
            <Dialog.Header borderBottomWidth="1px" borderColor="gray.700" pb={2}>
              <Dialog.Title>Select Part for {activeSlot?.name}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body pt={4} maxH="60vh" overflowY="auto">
              <VStack align="stretch" gap={2}>
                <Button variant="ghost" colorPalette="red" justifyContent="start" onClick={() => handlePartSelect("")}>
                  <Icon as={FaTrash} mr={2} /> Unequip Current Part
                </Button>

                {(() => {
                  const cat = activeSlot?.allowedCategories?.[0] || 'misc';
                  return getPartsByCategory(cat as any).map(part => {
                    const info = getPartStats(part.id, cat as any);
                    return (
                      <Button key={part.id}
                        variant={assignments[activeSlot!.id] === part.id ? "solid" : "outline"}
                        colorScheme={assignments[activeSlot!.id] === part.id ? "cyan" : "gray"}
                        borderColor="gray.700"
                        justifyContent="space-between"
                        height="auto"
                        py={3}
                        disabled={false}
                        onClick={() => handlePartSelect(part.id)}
                      >
                        <VStack align="start" gap={1}>
                          <Text fontWeight="bold">{part.name}</Text>
                          <HStack gap={2} wrap="wrap">
                            {info?.stats.map(s => (
                              <Text key={s.label} fontSize="xs" color="gray.400">{s.label}: {s.value}</Text>
                            ))}
                          </HStack>
                        </VStack>
                        <VStack align="end" gap={0}>
                        </VStack>
                      </Button>
                    );
                  });
                })()}
              </VStack>
            </Dialog.Body>
            <Dialog.CloseTrigger />
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </Flex>
  );
}
