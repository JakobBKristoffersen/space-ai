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
  Container,
  SimpleGrid,
} from "@chakra-ui/react";
import { useAppCore } from "../app/AppContext";
import { DefaultCatalog, PartCategory } from "../game/PartStore";
import { ROCKET_TEMPLATES, RocketTemplate, RocketSlot } from "../game/RocketTemplates";

import { StoredLayout } from "../app/services/LayoutService";
import { GameProgression } from "../game/GameProgression";
import { TechIds } from "../game/GameIds";
import { SpaceCenterHeader } from "../components/SpaceCenterHeader";
import { FaTrash, FaInfoCircle, FaBolt, FaWeightHanging, FaDollarSign, FaFire, FaTools, FaChevronLeft, FaFlask, FaRocket, FaLock, FaCheckCircle, FaExclamationTriangle, FaPlus, FaBan } from "react-icons/fa";

export default function BuildPage({ onNavigate }: { onNavigate: (view: string) => void }) {
  const { manager, services } = useAppCore();

  // --- State ---
  const [currentVabLevel, setCurrentVabLevel] = useState<number>(1);
  const [templateId, setTemplateId] = useState<string>("template.basic");
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [disabledStages, setDisabledStages] = useState<Record<string, boolean>>({});
  const [activeSlot, setActiveSlot] = useState<RocketSlot | null>(null);
  const [scriptId, setScriptId] = useState<string>("");
  const [rocketName, setRocketName] = useState<string>("My Rocket");
  const [availableScripts, setAvailableScripts] = useState<{ label: string, value: string }[]>([]);

  // Collections
  const scriptsCollection = useMemo(() => createListCollection({
    items: [{ label: "None", value: "" }, ...availableScripts]
  }), [availableScripts]);

  useEffect(() => {
    if (services.scripts) {
      const list = services.scripts.list();
      setAvailableScripts(list.map(s => ({ label: s.name, value: s.id })));
    }
  }, [services.scripts]);

  // Resources
  const [maxActiveRockets, setMaxActiveRockets] = useState<number>(1);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showTutorial, setShowTutorial] = useState(() => !localStorage.getItem("tutorial_vab_seen"));

  // Sync with Global State
  const [unlockedTechs, setUnlockedTechs] = useState<string[]>(services.research?.system?.unlockedTechs || []);
  const [researchPoints, setResearchPoints] = useState<number>(services.research?.system?.points || 0);

  // Sync Logic
  const sync = () => {
    try {
      const upg = services.upgrades;
      if (upg) {
        // VAB Level -> Template
        const lvl = upg.getLevel("vab");
        setCurrentVabLevel(lvl);

        const tsLvl = upg.getLevel("trackingStation");
        setMaxActiveRockets(upg.getMaxActiveRockets(tsLvl));
      }

      const res = services.research;
      if (res) {
        setResearchPoints(res.system.points);
        setUnlockedTechs([...res.system.unlockedTechs]);
      }

    } catch { }
  };

  useEffect(() => {
    sync();
    // Use interval as fallback for upgrades service which doesn't have subscription yet
    const id = setInterval(sync, 1000);

    // Research Subscription
    let unsubResearch: (() => void) | undefined;
    const research = services.research;
    if (research) {
      // Subscribe
      unsubResearch = research.subscribe(() => {
        sync();
      });
    }

    return () => {
      clearInterval(id);
      unsubResearch?.();
    };
  }, [services]);

  // Auto-Select Template based on VAB Level
  useEffect(() => {
    // Find highest tier template allowed by currentVabLevel
    // Logic: template.tier <= currentVabLevel
    // We default to the highest available tier.
    const bestTemplate = ROCKET_TEMPLATES
      .filter(t => t.tier <= currentVabLevel)
      .sort((a, b) => b.tier - a.tier)[0];

    if (bestTemplate && bestTemplate.id !== templateId) {
      // If we switch templates, we might lose assignments if slot IDs mismatch, 
      // but since we are "upgrading", usually slots are additive or compatible.
      // For now, we keep assignments. Users can clear if they want.
      setTemplateId(bestTemplate.id);
    }
  }, [currentVabLevel, templateId]);


  // Load Layout
  useEffect(() => {
    if (!isLoaded && services.layout) {
      try {
        const saved = services.layout.loadLayout();
        if (saved) {
          // If saved template requires higher tier than we have, we might have an issue.
          // But usually we just load it. 
          // Ideally we should respect VAB level. 
          // Let's assume saved layout is valid.
          if (saved.templateId) {
            // Check if we can actually use this template
            const t = ROCKET_TEMPLATES.find(x => x.id === saved.templateId);
            if (t && t.tier <= currentVabLevel) {
              setTemplateId(saved.templateId);
            }
          }
          if (saved.slots) setAssignments(saved.slots);
          if (saved.scriptId) setScriptId(saved.scriptId);

          if (saved.name) {
            setRocketName(saved.name);
          } else if (manager?.getRocket()) {
            setRocketName(manager.getRocket()!.name);
          }

          // Restore disabled stages? 
          // Not currently saved in StoredLayout. 
          // We can infer: if a stage has NO assignments, maybe it's disabled? 
          // Or just default to all enabled.
        } else if (manager?.getRocket()) {
          // No saved layout, use active rocket name
          setRocketName(manager.getRocket()!.name);
        }
      } catch { }
      setIsLoaded(true);
    }
  }, [services, isLoaded, currentVabLevel]);

  // Auto-Save & Simulation Sync
  useEffect(() => {
    if (isLoaded && services.layout) {
      const layout: StoredLayout = { templateId, slots: assignments, scriptId, name: rocketName };
      services.layout.saveLayout(layout);

      // Auto-sync simulation if on launchpad (not yet launched)
      if (manager && !manager.hasLaunched()) {
        manager.recreateFromLayout(layout);
        // Also ensure the script is assigned if needed
        if (scriptId && services.scripts) {
          const s = services.scripts.getById(scriptId);
          if (s && manager.getRocket()?.cpu) {
            const codeToRun = (s as any).compiledCode || s.code;
            manager.getRunner().installScript(codeToRun, { timeLimitMs: 6 }, s.name);
          }
        }
      }
    }
  }, [templateId, assignments, scriptId, rocketName, isLoaded, services, manager]);


  // Derived Data
  const template = useMemo(() => ROCKET_TEMPLATES.find(t => t.id === templateId) || ROCKET_TEMPLATES[0], [templateId]);

  // Helper: Get Tech Requirement Name
  const getUnlockReq = (partId: string): string | null => {
    const tech = GameProgression.find(t => t.parts.includes(partId));
    return tech ? tech.name : "Unknown Tech";
  };

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
      case "science_large": return DefaultCatalog.science; // Shared catalog list
      case "structure": return DefaultCatalog.structures;
      default: return [];
    }
  };

  const getPartStats = (partId: string, cat: PartCategory) => {
    const list = getPartsByCategory(cat);
    const p: any = list.find(x => x.id === partId);
    if (!p) return null;

    const instance = p.make();
    const stats: { label: string, value: string, icon?: any }[] = [];

    const mass = (instance as any).massKg ?? (instance as any).dryMassKg;
    if (mass !== undefined) stats.push({ label: "Mass", value: `${mass}kg`, icon: FaWeightHanging });

    const i = instance as any;
    if (i.maxThrustN) stats.push({ label: "Thrust", value: `${i.maxThrustN}N`, icon: FaFire });
    if (i.vacuumBonusAtVacuum) stats.push({ label: "Vac Eff", value: `+${(i.vacuumBonusAtVacuum * 100).toFixed(0)}%`, icon: FaFire });
    if (i.capacityKg) stats.push({ label: "Fuel", value: `${i.capacityKg}kg`, icon: FaFire });
    const capJ = i.capacityJoules ?? i.capacity;
    if (capJ) stats.push({ label: "Cap", value: `${capJ}J`, icon: FaBolt });
    if (i.maxScriptChars) stats.push({ label: "Mem", value: `${(i.maxScriptChars / 1024).toFixed(1)}kb`, icon: FaTools });
    if (i.processingBudgetPerTick) stats.push({ label: "CPU", value: `${i.processingBudgetPerTick}ops`, icon: FaTools });
    const range = i.rangeMeters ?? i.antennaPower;
    if (range) stats.push({ label: "Range", value: `${(range / 1000).toFixed(0)}km`, icon: FaBolt });
    if (i.dragCoefficient) stats.push({ label: "Drag", value: `${i.dragCoefficient}`, icon: FaWeightHanging });
    if (i.deployedDrag) stats.push({ label: "Chute", value: `${i.deployedDrag}`, icon: FaWeightHanging });
    if (i.maxTemp) stats.push({ label: "MaxTemp", value: `${i.maxTemp}K`, icon: FaFire });
    if (i.generationWatts) stats.push({ label: "Gen", value: `${i.generationWatts}W`, icon: FaBolt });

    return { name: p.name, stats, instance };
  };

  const summary = useMemo(() => {
    let wetMass = 0;
    let dryMass = 0;

    // Only count assignments for ENABLED stages
    const enabledAssignments: Record<string, string> = {};

    template.stages.forEach(stage => {
      if (disabledStages[stage.id]) return;
      stage.slots.forEach(slot => {
        if (assignments[slot.id]) enabledAssignments[slot.id] = assignments[slot.id];
      });
    });

    Object.values(enabledAssignments).forEach((partId) => {
      const def = Object.values(DefaultCatalog).flat().find((x: any) => x.id === partId) as any;
      if (def) {
        const instance = def.make();
        const dry = (instance as any).dryMassKg ?? (instance as any).massKg ?? 0;
        const fuel = (instance as any).fuelKg ?? 0;
        wetMass += dry + fuel;
        dryMass += dry;
      }
    });
    return { wetMass, dryMass, enabledAssignments }; // Return enabled assignments for build
  }, [assignments, disabledStages, template]);

  // Handlers
  const stageStats = useMemo(() => {
    const stats: any[] = [];
    let payloadMass = 0; // Mass of everything ABOVE the current stage

    // Iterate Top-Down (Stage 0 is Upper Stage)
    template.stages.forEach((stage) => {
      if (disabledStages[stage.id]) {
        stats.push(null);
        return;
      }

      let stageDry = 0;
      let stageWet = 0;

      let thrustVac = 0;
      let thrustSL = 0;
      let flowRate = 0;
      let finCount = 0;
      let rwAuthority = 0;

      stage.slots.forEach(slot => {
        const partId = assignments[slot.id];
        if (!partId) return;
        const def = Object.values(DefaultCatalog).flat().find((x: any) => x.id === partId) as any;
        if (!def) return;

        const instance = def.make();
        const dry = (instance as any).dryMassKg ?? (instance as any).massKg ?? 0;
        const fuel = (instance as any).fuelKg ?? 0;

        stageDry += dry;
        stageWet += dry + fuel;

        if ((instance as any).maxThrustN) {
          // Calculate Thrust at Vac and SL
          // Assuming instance.currentThrust(rho, rho0) exists or we estimate it
          // Since we can't easily call methods on fresh instance without context, we replicate logic or use static props if available.
          // Just instantiating 'new SmallEngine()' gives us the object.
          // We can call `instance.currentThrust(...)` if the class implements it independently of state (it usually does for max thrust).
          // However, power is 0 by default. Set power to 1.
          if ('power' in instance) (instance as any).power = 1;

          // Vac: rho=0
          thrustVac += (instance as any).currentThrust ? (instance as any).currentThrust(0, 1.225) : (instance as any).maxThrustN;
          // SL: rho=1.225
          thrustSL += (instance as any).currentThrust ? (instance as any).currentThrust(1.225, 1.225) : (instance as any).maxThrustN;

          if ((instance as any).fuelBurnRateKgPerS) {
            flowRate += (instance as any).fuelBurnRateKgPerS;
          }
        }

        if (slot.allowedCategories.includes("fin")) {
          finCount++;
        }
        if (slot.allowedCategories.includes("reactionWheels")) {
          rwAuthority += (instance as any).maxOmegaRadPerS || 0;
        }
      });

      // Stats for this stage
      const totalMass = stageWet + payloadMass;
      const finalMass = stageDry + payloadMass;

      const twrVac = totalMass > 0 ? thrustVac / (totalMass * 9.81) : 0;
      const twrSL = totalMass > 0 ? thrustSL / (totalMass * 9.81) : 0;

      const ispVac = flowRate > 0 ? thrustVac / (flowRate * 9.81) : 0;
      const ispSL = flowRate > 0 ? thrustSL / (flowRate * 9.81) : 0;

      const dV_Vac = ispVac * 9.81 * Math.log(totalMass / finalMass);
      const dV_SL = ispSL * 9.81 * Math.log(totalMass / finalMass);

      // Fin Authority at 100m/s @ Sea Level
      // Formula: 0.5 * count * scaleRho * scaleV
      // scaleRho = 1.0 at SL, scaleV = 1.0 at 100m/s
      const finTurnRate = 0.5 * finCount;

      if (stageWet > 0) {
        console.log(`[VAB Stage ${template.stages.indexOf(stage)}] Mass: ${totalMass.toFixed(1)}/${finalMass.toFixed(1)}, ThrustSL: ${thrustSL.toFixed(1)}, ISP_SL: ${ispSL.toFixed(1)}, dV_SL: ${dV_SL.toFixed(1)}`);
      }

      stats.push({
        massDry: stageDry,
        massWet: stageWet,
        thrustVac,
        thrustSL,
        twrVac,
        twrSL,
        dV_Vac,
        dV_SL,
        finTurnRate,
        rwAuthority,
        payload: payloadMass
      });

      // Accumulate payload
      payloadMass += stageWet;
    });

    return stats;
  }, [assignments, disabledStages, template]);


  // Handlers
  const handlePartSelect = (partId: string) => {
    if (!activeSlot) return;
    setAssignments(prev => {
      const next = { ...prev };
      if (!partId) delete next[activeSlot.id];
      else next[activeSlot.id] = partId;
      return next;
    });
    setActiveSlot(null);
  };

  const toggleStage = (stageId: string) => {
    setDisabledStages(prev => ({
      ...prev,
      [stageId]: !prev[stageId]
    }));
  };

  const handleUpgradeVab = () => {
    if (!services.upgrades || !services.research) return;
    const nextLevel = currentVabLevel + 1;
    const cost = services.upgrades.getUpgradeCost("vab", currentVabLevel);

    if (cost !== null && researchPoints >= cost) {
      if (confirm(`Upgrade Vehicle Assembly Building for ${cost} RP?`)) {
        // Deduct RP
        services.research.system.addPoints(-cost);
        services.research.save();

        services.upgrades.upgrade("vab");
        sync(); // Force refresh
      }
    }
  };

  const handleBuildLaunch = () => {
    // Check Limits & Overwrites
    const activeCount = manager?.getRockets().length ?? 0;
    const names = manager?.getRocketNames() ?? [];
    const targetIdx = names.indexOf(rocketName);
    const currentIdx = manager?.getActiveRocketIndex() ?? 0;

    if (targetIdx !== -1) {
      if (targetIdx !== currentIdx) {
        if (!confirm(`Overwrite existing rocket "${names[targetIdx]}"?`)) return;
        manager?.setActiveRocketIndex(targetIdx);
      }
    } else {
      if (activeCount >= maxActiveRockets) {
        const currentName = names[currentIdx] || "Current Rocket";
        if (!confirm(`Tracking Station Limit Reached (${activeCount}/${maxActiveRockets}).\n\nOverwrite currently active rocket "${currentName}" with new name "${rocketName}"?`)) return;
      }
    }

    // Build only with enabled assignments
    const layout: StoredLayout = { templateId, slots: summary.enabledAssignments, scriptId, name: rocketName };
    const rocket = services.layout?.buildRocketFromLayout(layout);

    if (rocket) {
      manager?.recreateFromLayout(layout);
      manager?.setRocketName(manager.getActiveRocketIndex(), rocketName);
      if (scriptId && services.scripts) {
        const s = services.scripts.getById(scriptId);
        if (s) {
          const codeToRun = (s as any).compiledCode || s.code;
          manager?.getRunner()?.installScript(codeToRun, { timeLimitMs: 6 }, s.name);
          // Persist
          const ai = manager?.getActiveRocketIndex() ?? 0;
          const assigns = services.scripts.loadAssignments().filter((a: any) => a.rocketIndex !== ai);
          assigns.push({ rocketIndex: ai, scriptId: s.id, enabled: true });
          services.scripts.saveAssignments(assigns as any);
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
        description="Design and build your rockets"
        onNavigate={onNavigate}
        onInfoClick={() => setShowTutorial(true)}
        currentView="build"
      >
        <HStack gap={4} w="full" justify="space-between">
          {/* LEFT: Rocket Name */}
          <HStack flex={1} maxW="400px">
            <Icon as={FaRocket} color="cyan.400" />
            <Input
              value={rocketName}
              onChange={(e) => setRocketName(e.target.value)}
              placeholder="Rocket Name"
              size="sm"
              variant="subtle"
              color="white"
              fontWeight="bold"
              fontSize="lg"
              bg="transparent"
              borderColor="transparent"
              _hover={{ borderColor: "gray.700" }}
              _focus={{ borderColor: "cyan.400", bg: "gray.900" }}
            />
          </HStack>

          {/* RIGHT: Controls */}
          <HStack gap={4}>
            {/* Mass Info */}
            <HStack gap={2} mr={2}>
              <Icon as={FaWeightHanging} color="gray.400" />
              <VStack gap={0} align="start" lineHeight={1}>
                <Text fontSize="xs" color="gray.400">DRY: <Text as="span" color="white" fontWeight="bold">{summary.dryMass.toLocaleString()}</Text> kg</Text>
                <Text fontSize="xs" color="gray.400">WET: <Text as="span" color="white" fontWeight="bold">{summary.wetMass.toLocaleString()}</Text> kg</Text>
              </VStack>
            </HStack>

            {/* Script Selector */}
            <Box w="200px">
              <Select.Root collection={scriptsCollection} value={[scriptId]} onValueChange={(d) => setScriptId(Array.isArray(d.value) ? d.value[0] : d.value)} size="sm">
                <Select.HiddenSelect />
                <Select.Control>
                  <Select.Trigger
                    bg="gray.900"
                    borderColor="gray.700"
                    disabled={!services.research?.system?.isUnlocked(TechIds.BASIC_COMPUTING)}
                    cursor={!services.research?.system?.isUnlocked(TechIds.BASIC_COMPUTING) ? "not-allowed" : "pointer"}
                    opacity={!services.research?.system?.isUnlocked(TechIds.BASIC_COMPUTING) ? 0.5 : 1}
                  >
                    <Select.ValueText placeholder={
                      services.research?.system?.isUnlocked(TechIds.BASIC_COMPUTING)
                        ? "Select Flight Software..."
                        : "Locked: Basic Computing Required"
                    } />
                  </Select.Trigger>
                </Select.Control>
                <Portal>
                  <Select.Positioner>
                    <Select.Content bg="gray.800" borderColor="gray.700">
                      {scriptsCollection.items.map(s => (
                        <Select.Item key={s.value} item={s} _hover={{ bg: "gray.700" }}>{s.label}</Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Positioner>
                </Portal>
              </Select.Root>
            </Box>

            {/* Deploy Button */}
            <Button
              size="sm"
              colorPalette="green"
              variant="solid"
              onClick={handleBuildLaunch}
              disabled={summary.wetMass === 0}
            >
              <Icon as={FaRocket} mr={2} />
              DEPLOY TO PAD
            </Button>
          </HStack>
        </HStack>
      </SpaceCenterHeader>

      <Grid templateColumns="1fr" gap={6} flex={1} minH={0} overflow="hidden">

        {/* === MAIN ASSEMBLY BAY === */}
        <GridItem h="100%" overflowY="auto" bg="gray.900" position="relative" display="flex" justifyContent="center">
          {/* Blueprint Grid Background Pattern */}
          <Box position="absolute" inset="0" zIndex="0"
            backgroundImage="radial-gradient(circle, #2D3748 1px, transparent 1px)"
            backgroundSize="30px 30px"
            opacity="0.1"
            pointerEvents="none"
          />

          {/* ROCKET FUSELAGE CONTAINER */}
          <VStack py={0} w="380px" gap={0} position="relative" zIndex="1" pb="100px">
            <Heading size="md" color="gray.500" letterSpacing="widest" fontWeight="light" mb={4}>ASSEMBLY BAY (Tier {currentVabLevel})</Heading>

            {/* Render Stages Top-Down */}
            {template.stages.map((stage, i) => {
              const isDisabled = !!disabledStages[stage.id];
              // First stage (Upper) cannot be disabled
              const canDisable = i > 0;
              const stats = stageStats[i];

              if (isDisabled) {
                return (
                  <Box key={stage.id} w="full" position="relative" my={2}>
                    <Box position="absolute" left="-120px" top="10px" textAlign="right" w="100px">
                      <Text color="gray.600" fontSize="xs" fontWeight="bold">STAGE {template.stages.length - i} (OFF)</Text>
                    </Box>
                    <Button size="sm" variant="outline" colorPalette="gray" w="full" onClick={() => toggleStage(stage.id)}>
                      <Icon as={FaPlus} mr={2} /> Enable {stage.name}
                    </Button>
                  </Box>
                )
              }

              // GROUPING LOGIC
              const groups: { [key: string]: RocketSlot[] } = { nose: [], body: [], engine: [] };

              stage.slots.forEach(slot => {
                const id = slot.id.toLowerCase();
                if (id.includes("nose") || id.includes("cone") || id.includes("guidance") || id.includes("sensor") || id.includes("chute") || id.includes("scie")) {
                  groups.nose.push(slot);
                } else if (id.includes("engine") || id.includes("nozzle") || slot.allowedCategories.includes("engine")) {
                  groups.engine.push(slot);
                } else {
                  groups.body.push(slot);
                }
              });

              const renderSlotGroup = (groupName: string, slots: RocketSlot[]) => {
                // Filter: Only show slots that either have an assigned part OR have at least one unlocked part available
                const visibleSlots = slots.filter(slot => {
                  if (assignments[slot.id]) return true;

                  const category = slot.allowedCategories[0];
                  const allPartsInCat = getPartsByCategory(category);
                  return allPartsInCat.some(p => {
                    const tech = GameProgression.find(t => t.parts.includes(p.id));
                    if (!tech) return false;
                    return services.research?.system.isUnlocked(tech.id);
                  });
                });

                if (visibleSlots.length === 0) return null;
                return (
                  <Box w="full">
                    <Text fontSize="2xs" color="gray.600" textTransform="uppercase" letterSpacing="wider" ml={2} mb={1} mt={2}>{groupName}</Text>
                    <VStack gap="1px" bg="whiteAlpha.100" p="2px" borderRadius="sm" borderXWidth="2px" borderColor="gray.700">
                      {visibleSlots.map((slot) => {
                        const assignedId = assignments[slot.id];
                        let partInfo = null;
                        if (assignedId) {
                          for (const cat of slot.allowedCategories) {
                            const info = getPartStats(assignedId, cat);
                            if (info) { partInfo = info; break; }
                          }
                        }

                        const isEmpty = !assignedId;

                        // Calculate unlocked and total parts for the first allowed category
                        const category = slot.allowedCategories[0];
                        const allPartsInCat = getPartsByCategory(category);
                        const totalCount = allPartsInCat.length;
                        const unlockedCount = allPartsInCat.filter(p => {
                          // Find tech for this part
                          const tech = GameProgression.find(t => t.parts.includes(p.id));
                          // Strict check: if not in tech tree, it's locked.
                          if (!tech) return false;
                          // Check if tech is unlocked via ResearchService -> System
                          return services.research?.system.isUnlocked(tech.id);
                        }).length;

                        return (
                          <Flex
                            key={slot.id}
                            w="full"
                            h="48px"
                            align="center"
                            bg={isEmpty ? "transparent" : "gray.800"}
                            borderWidth="1px"
                            borderColor={isEmpty ? "gray.700" : "gray.600"}
                            borderStyle={isEmpty ? "dashed" : "solid"}
                            _hover={{ borderColor: "cyan.400", bg: "whiteAlpha.50" }}
                            cursor="pointer"
                            onClick={() => setActiveSlot(slot)}
                            px={3}
                            transition="all 0.1s"
                          >
                            {/* Icon / Empty State */}
                            <Box w="30px" display="flex" justifyContent="center">
                              {partInfo ? (
                                <Icon as={FaCheckCircle} color="cyan.500" />
                              ) : (
                                <Icon as={FaPlus} color="gray.600" size="sm" />
                              )}
                            </Box>

                            {/* Name & Type */}
                            <VStack align="start" gap={1} flex={1} ml={1} py={1} overflow="hidden">
                              {partInfo ? (
                                <>
                                  <Text fontWeight="bold" color="cyan.100" fontSize="sm" lineHeight="1" truncate w="full">{partInfo.name}</Text>
                                  <HStack gap={1} wrap="wrap">
                                    {partInfo.stats.map((s: any) => (
                                      <Badge key={s.label} colorPalette="gray" size="xs" variant="surface" px={1} py={0} fontSize="0.6rem">
                                        {s.icon && <Icon as={s.icon} mr={1} boxSize={2} />}
                                        {s.label}: {s.value}
                                      </Badge>
                                    ))}
                                  </HStack>
                                </>
                              ) : (
                                <>
                                  <Text color="gray.500" fontSize="sm" fontStyle="italic">{slot.name}</Text>
                                  <HStack gap={1} align="center">
                                    <Text fontSize="2xs" color="gray.600">{slot.allowedCategories[0].toUpperCase()}</Text>
                                    {unlockedCount > 0 && <Text fontSize="2xs" color="cyan.600" fontWeight="bold">({unlockedCount})</Text>}
                                  </HStack>
                                </>
                              )}
                            </VStack>

                            {/* Chevron */}
                            <Icon as={FaChevronLeft} color="gray.700" boxSize={3} />
                          </Flex>
                        );
                      })}
                    </VStack>
                  </Box>
                );
              };

              return (
                <Box key={stage.id} w="full" position="relative">

                  {/* STAGE LABEL (Left) */}
                  <Box position="absolute" left="-120px" top="10px" textAlign="right" w="100px">
                    <Text color="gray.500" fontSize="xs" fontWeight="bold">STAGE {template.stages.length - i}</Text>
                    <Text color="cyan.700" fontSize="xs">{stage.name}</Text>

                    {canDisable && (
                      <Button size="xs" variant="ghost" colorPalette="red" mt={1} h="20px" onClick={() => toggleStage(stage.id)}>
                        <Icon as={FaBan} /> Disable
                      </Button>
                    )}
                  </Box>

                  {/* STAGE STATS (Right) */}
                  {stats && (
                    <Box position="absolute" right="-160px" top="0" textAlign="left" w="140px">
                      <VStack align="start" gap={2} p={2} bg="blackAlpha.600" borderRadius="md" borderWidth="1px" borderColor="gray.800">
                        <VStack align="start" gap={0} w="full">
                          <Text fontSize="2xs" color="gray.400" fontWeight="bold">MASS</Text>
                          <Text fontSize="xs" color="white" fontFamily="mono">{stats.massDry.toLocaleString()} / {stats.massWet.toLocaleString()} kg</Text>
                        </VStack>

                        <VStack align="start" gap={0} w="full">
                          <Text fontSize="2xs" color="gray.400" fontWeight="bold">DELTA-V (Vac/Atm)</Text>
                          <HStack gap={1}>
                            <Text fontSize="xs" color="cyan.300" fontFamily="mono">{stats.dV_Vac.toFixed(0)}</Text>
                            <Text fontSize="xs" color="gray.600">/</Text>
                            <Text fontSize="xs" color="blue.300" fontFamily="mono">{stats.dV_SL.toFixed(0)} m/s</Text>
                          </HStack>
                        </VStack>

                        <VStack align="start" gap={0} w="full">
                          <Text fontSize="2xs" color="gray.400" fontWeight="bold">TWR (Vac/Atm)</Text>
                          <HStack gap={1}>
                            <Text fontSize="xs" color={stats.twrVac > 1 ? "green.300" : "yellow.500"} fontFamily="mono">{stats.twrVac.toFixed(2)}</Text>
                            <Text fontSize="xs" color="gray.600">/</Text>
                            <Text fontSize="xs" color={stats.twrSL > 1 ? "green.300" : "yellow.500"} fontFamily="mono">{stats.twrSL.toFixed(2)}</Text>
                          </HStack>
                        </VStack>

                        {stats.finTurnRate > 0 && (
                          <VStack align="start" gap={0} w="full">
                            <Text fontSize="2xs" color="gray.400" fontWeight="bold">CONTROL (Fins)</Text>
                            <Text fontSize="xs" color="purple.300" fontFamily="mono">+{stats.finTurnRate.toFixed(1)} rad/s <Text as="span" color="gray.600" fontSize="2xs">@100m/s</Text></Text>
                          </VStack>
                        )}

                        {stats.rwAuthority > 0 && (
                          <VStack align="start" gap={0} w="full">
                            <Text fontSize="2xs" color="gray.400" fontWeight="bold">CONTROL (Wheels)</Text>
                            <Text fontSize="xs" color="orange.300" fontFamily="mono">+{stats.rwAuthority.toFixed(1)} rad/s</Text>
                          </VStack>
                        )}
                      </VStack>
                    </Box>
                  )}

                  <VStack gap={0} w="full">
                    {renderSlotGroup("AVIONICS & PAYLOAD", groups.nose)}
                    {renderSlotGroup("FUSELAGE", groups.body)}
                    {renderSlotGroup("PROPULSION", groups.engine)}
                  </VStack>

                  {/* DECOUPLER VISUAL (between stages) */}
                  {i < template.stages.length - 1 && (
                    <Flex justify="center" h="12px" align="center" w="full" my="2px">
                      <Box w="full" h="2px" bg="yellow.600" />
                      <Icon as={FaLock} color="yellow.500" position="absolute" bg="gray.900" px={1} boxSize={3} />
                    </Flex>
                  )}

                </Box>
              );
            })}

            {/* UPGRADE BUTTON */}
            {services.upgrades && services.upgrades.getUpgradeCost("vab", currentVabLevel) !== null && (
              <Box mt={8} w="full">
                <Button
                  size="md"
                  variant="surface"
                  colorPalette="cyan"
                  w="full"
                  borderStyle="dashed"
                  onClick={handleUpgradeVab}
                  disabled={researchPoints < (services.upgrades.getUpgradeCost("vab", currentVabLevel) || 99999)}
                >
                  <Icon as={FaPlus} mr={2} />
                  Unlock Next Chassis Layout ({services.upgrades.getUpgradeCost("vab", currentVabLevel)} RP)
                </Button>
              </Box>
            )}


            {/* ENGINE NOZZLE VISUAL (Bottom) */}
            <Box w="60%" h="20px" bgGradient="to-b" gradientFrom="gray.700" gradientTo="transparent" clipPath="polygon(0 0, 100% 0, 80% 100%, 20% 100%)" mt="2px" opacity={0.5} />

          </VStack>
        </GridItem>
      </Grid>

      {/* TUTORIAL DIALOG */}
      <Dialog.Root open={showTutorial} onOpenChange={(e) => setShowTutorial(e.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg="gray.900" borderColor="gray.700">
            <Dialog.Header>
              <Dialog.Title>Welcome to the VAB</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack align="start" gap={3} color="gray.300">
                <Text>The Vehicle Assembly Building (VAB) is where you design rockets.</Text>
                <ul style={{ marginLeft: "20px", listStyleType: "disc" }}>
                  <li><Text><strong>Assemble:</strong> Click slots on the rocket to install parts.</Text></li>
                  <li><Text><strong>Upload Code:</strong> Select a flight script to control your rocket. <Text as="span" color="cyan.400" fontWeight="bold">(Requires "Basic Computing" research)</Text></Text></li>
                  <li><Text><strong>Deploy:</strong> When ready, click "Deploy to Pad" to launch.</Text></li>
                </ul>
                <Text color="cyan.300" fontSize="sm">
                  <strong>Note:</strong> You can upgrade the VAB to unlock larger heavy-lift rockets.
                </Text>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button onClick={() => {
                setShowTutorial(false);
                localStorage.setItem("tutorial_vab_seen", "true");
              }} colorPalette="blue" variant="solid">Got it</Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger />
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* === PART PICKER DIALOG === */}
      <Dialog.Root open={!!activeSlot} onOpenChange={() => setActiveSlot(null)} size="lg" scrollBehavior="inside">
        <Dialog.Backdrop backdropFilter="blur(5px)" bg="blackAlpha.600" />
        <Dialog.Positioner>
          <Dialog.Content bg="gray.900" borderColor="cyan.700" borderWidth="1px" boxShadow="0 0 20px rgba(0,0,0,0.5)">
            <Dialog.Header borderBottomWidth="1px" borderColor="gray.800" bg="gray.900">
              <HStack>
                <Icon as={FaTools} color="cyan.500" />
                <Dialog.Title color="white">Installation: {activeSlot?.name}</Dialog.Title>
              </HStack>
            </Dialog.Header>
            <Dialog.Body p={4} bg="gray.900">
              <VStack align="stretch" gap={3}>
                {activeSlot && assignments[activeSlot.id] && (
                  <Button variant="outline" borderColor="red.800" color="red.400" justifyContent="start" onClick={() => handlePartSelect("")} _hover={{ bg: "red.900" }}>
                    <Icon as={FaTrash} mr={2} /> Unequip Module
                  </Button>
                )}

                <Separator borderColor="gray.800" />

                {activeSlot && (() => {
                  const cat = activeSlot.allowedCategories[0] || 'misc';
                  const unlockedTechs = services.research?.system.unlockedTechs || [];
                  const genericParts = getPartsByCategory(cat as any).filter(p => p.category === cat);

                  return genericParts.map(part => {
                    const info = getPartStats(part.id, cat as any);
                    const isUnlocked = part.isUnlocked([], unlockedTechs);
                    const req = !isUnlocked ? getUnlockReq(part.id) : null;
                    const isSelected = assignments[activeSlot!.id] === part.id;

                    return (
                      <Card.Root
                        key={part.id}
                        variant="outline"
                        bg={isSelected ? "cyan.900" : "gray.800"}
                        borderColor={isSelected ? "cyan.500" : (isUnlocked ? "gray.700" : "red.900")}
                        opacity={isUnlocked ? 1 : 0.7}
                        cursor={isUnlocked ? "pointer" : "not-allowed"}
                        onClick={() => isUnlocked && handlePartSelect(part.id)}
                        transition="all 0.1s"
                        _hover={isUnlocked ? { transform: "translateX(4px)", borderColor: "cyan.500" } : {}}
                      >
                        <Card.Body p={3}>
                          <Grid templateColumns="1fr auto" alignItems="start">
                            <VStack align="start" gap={1}>
                              <HStack>
                                <Text fontWeight="bold" color={isUnlocked ? "gray.100" : "gray.500"}>{part.name}</Text>
                                {!isUnlocked && <Badge colorPalette="red" variant="solid"><Icon as={FaLock} mr={1} /> {req}</Badge>}
                                {isSelected && <Badge colorPalette="cyan" variant="solid"><Icon as={FaCheckCircle} mr={1} /> INSTALLED</Badge>}
                              </HStack>
                              {info && (
                                <HStack gap={2} wrap="wrap">
                                  {info.stats.map(s => (
                                    <Badge key={s.label} variant="subtle" colorPalette="gray" size="xs">
                                      {s.icon && <Icon as={s.icon} mr={1} />} {s.label}: {s.value}
                                    </Badge>
                                  ))}
                                </HStack>
                              )}
                            </VStack>
                          </Grid>
                        </Card.Body>
                      </Card.Root>
                    );
                  });
                })()}

              </VStack>
            </Dialog.Body>
            <Dialog.CloseTrigger />
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

    </Flex >
  );
}
