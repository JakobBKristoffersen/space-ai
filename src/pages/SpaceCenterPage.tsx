import React, { useEffect, useState } from "react";
import { SimpleGrid, Card, Heading, Text, VStack, Icon, Flex, Box, Dialog, Button, Badge, Separator, HStack } from "@chakra-ui/react";
import { FaRocket, FaSatelliteDish, FaFlag, FaFlask, FaCode, FaBuilding, FaArrowUp, FaCoins, FaGlobe } from "react-icons/fa";
import { useAppCore } from "../app/AppContext";
import { FacilityType } from "../app/services/UpgradesService";
import { TechIds } from "../game/GameIds";

interface Props {
    onNavigate: (view: string) => void;
}

export default function SpaceCenterPage({ onNavigate }: Props) {
    const { services } = useAppCore();
    const [updater, setUpdater] = useState(0); // force refresh

    const [selectedFacility, setSelectedFacility] = useState<{ id: string, name: string, type?: FacilityType } | null>(null);

    const upgrades = services.upgrades;








    // Check if any milestones claimed (RP earned)

    // Actually user said "earning first RP", usually via milestone.
    // Let's check via ScienceManager if available in services?
    // SpaceCenterPage uses `useAppCore` -> `services`.
    // Services interface has `getScienceManager`?
    // Looking at AppContext, `services` is `AppServices`.
    // Let's use `(window as any).__services?.getMilestones?.()` or similar if simpler, 
    // or rely on `services.research.system.points > 0`.
    // But points might be spent.
    // Use `services.research.system.lifetimePoints` if it exists?
    // Or just `(window as any).__services.getScienceManager().getCompletedIds().length > 0`.
    // Or simply check if `services.research.system.points > 0` (if initial is 0).
    // Let's stick to `hasEarnedRp` via science check if possible without messy casts.

    // Quickest robust way:
    const [hasUnlocks, setHasUnlocks] = useState({ scripts: false, rnd: false, comms: false });

    useEffect(() => {
        const update = () => {
            const svc = (window as any).__services;
            if (!svc) return;
            // ResearchService wraps ResearchSystem as .system
            const system = svc.research?.system;
            const sm = svc.getScienceManager ? svc.getScienceManager() : null;

            // Use optional chaining carefully
            const scripts = system?.isUnlocked ? system.isUnlocked(TechIds.BASIC_COMPUTING) : false;
            // R&D visible if ANY milestone claimed (first RP source usually)
            const rnd = (sm?.getCompletedIds?.().length ?? 0) > 0;

            const comms = system?.isUnlocked ? system.isUnlocked(TechIds.COMMS_BASIC) : false;

            setHasUnlocks({ scripts, rnd, comms });
        }
        update();
        const interval = setInterval(update, 2000);
        return () => clearInterval(interval);
    }, []);

    if (!upgrades) {
        return (
            <Flex h="full" align="center" justify="center" bg="gray.900" color="white">
                <Text>Loading Space Center...</Text>
            </Flex>
        );
    }

    const getFacilityInfo = (type: FacilityType) => {
        const level = upgrades.getLevel(type);
        let desc = `Level ${level}`;
        if (type === "trackingStation") desc = `Lvl ${level} (Max ${upgrades.getMaxActiveRockets(level)} Missions)`;
        // VAB upgrades handled internally in VAB
        if (type === "software") desc = `Lvl ${level} (${upgrades.getMaxScripts(level) === 999 ? "Unlimited" : upgrades.getMaxScripts(level)} Scripts)`;
        if (type === "comms") desc = `Lvl ${level} (Max ${upgrades.getMaxKVKeys(level) === 999 ? "Unlimited" : upgrades.getMaxKVKeys(level)} Keys)`;

        return { level, desc };
    };

    const cards = [
        { id: "world_scene", title: "Mission Control", icon: FaGlobe, desc: "Monitor active missions.", color: "purple.400", type: "trackingStation" },
        ...(hasUnlocks.comms ? [{ id: "comms", title: "Comms Center", icon: FaSatelliteDish, desc: "View incoming data.", color: "cyan.500", type: "comms" }] : []),
        { id: "build", title: "VAB (Vehicle Assembly Building)", icon: FaRocket, desc: "Construct rockets.", color: "cyan.400" },
        { id: "science", title: "Science & Achievements", icon: FaFlag, desc: "View research goals and data.", color: "orange.400", type: "missionControl" },
        ...(hasUnlocks.rnd ? [{ id: "research", title: "R&D Lab", icon: FaFlask, desc: "Unlock technologies.", color: "blue.400", type: "researchCenter" }] : []),
        ...(hasUnlocks.scripts ? [{ id: "scripts", title: "Software Engineering", icon: FaCode, desc: "Develop flight software.", color: "green.400", type: "software" }] : []),
    ];


    return (
        <Flex direction="column" h="full" p={8} align="center" justify="center" bg="gray.900">
            <HStack w="full" maxW="1200px" justify="space-between" mb={8}>
                <Heading size="2xl" color="white" textShadow="0 0 10px rgba(255,255,255,0.3)">Space Center Hub</Heading>
            </HStack>

            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6} maxW="1200px" w="full">
                {cards.map((c) => {
                    const info = c.type ? getFacilityInfo(c.type as FacilityType) : null;

                    return (
                        <Card.Root
                            key={c.id}
                            variant="elevated"
                            onClick={() => {
                                if (c.type) {
                                    // It's a navigable page, but maybe show upgrade button on hover or separate?
                                    // Let's navigation be primary, but add right-click or a small icon for upgrade?
                                    // For simplicity: If user clicks the *Card*, they go to the page. 
                                    // We need a specific "Manage" button for upgrades?
                                    // Let's Add a "Manage" button in the card footer if it has a type.
                                    onNavigate(c.id);
                                } else {
                                    onNavigate(c.id);
                                }
                            }}
                            cursor="pointer"
                            transition="all 0.2s"
                            _hover={{ transform: "translateY(-4px)", boxShadow: `0 0 20px ${c.color}` }}
                            bg="gray.800"
                            color="white"
                            borderColor={c.color}
                            borderWidth="1px"
                        >
                            <Card.Body>
                                <Flex justify="space-between" align="start">
                                    <VStack align="start" gap={4}>
                                        <Box p={3} borderRadius="lg" bg={c.color} color="gray.900">
                                            <Icon as={c.icon} boxSize={8} />
                                        </Box>
                                        <VStack align="start" gap={1}>
                                            <Heading size="md">{c.title}</Heading>
                                            <Text color="gray.400" fontSize="sm">{c.desc}</Text>
                                        </VStack>
                                    </VStack>

                                    {info && (
                                        <VStack align="end">
                                            <Badge colorPalette="gray" variant="solid">Lvl {info.level}</Badge>
                                            <Button size="xs" variant="outline" mt={2}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedFacility({ id: c.id, name: c.title, type: c.type as FacilityType });
                                                }}>
                                                Manage
                                            </Button>
                                        </VStack>
                                    )}
                                </Flex>
                            </Card.Body>
                        </Card.Root>
                    );
                })}
            </SimpleGrid>

            {/* FACILITY UPGRADE MODAL */}
            <Dialog.Root open={!!selectedFacility} onOpenChange={() => setSelectedFacility(null)}>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content bg="gray.900" borderColor="gray.700">
                        <Dialog.Header>
                            <Dialog.Title>Manage {selectedFacility?.name}</Dialog.Title>
                        </Dialog.Header>
                        <Dialog.Body>
                            {selectedFacility?.type && (() => {
                                const type = selectedFacility.type;
                                const level = upgrades.getLevel(type);
                                const cost = upgrades.getUpgradeCost(type, level);
                                const nextDesc = cost !== null ? upgrades.getUpgradeDescription(type, level + 1) : "Max Level Reached";
                                const currentRp = services.research?.system.points ?? 0;
                                const canAfford = cost !== null && currentRp >= cost;

                                return (
                                    <VStack align="stretch" gap={4}>
                                        <Box p={4} bg="gray.800" borderRadius="md">
                                            <Text color="gray.400" fontSize="sm">CURRENT STATUS</Text>
                                            <Heading size="lg" mb={1}>Level {level}</Heading>
                                            {/* Show current capability */}
                                            {type === "trackingStation" && <Text>Active Flights: {upgrades.getMaxActiveRockets(level)}</Text>}
                                            {type === "vab" && <Text>Templates: Tier {level}</Text>}
                                            {type === "software" && <Text>Storage: {upgrades.getMaxScripts(level) === 999 ? "Unlimited" : upgrades.getMaxScripts(level)} Scripts</Text>}
                                            {type === "comms" && <Text>Storage: {upgrades.getMaxKVKeys(level) === 999 ? "Unlimited" : upgrades.getMaxKVKeys(level)} Keys</Text>}
                                        </Box>

                                        {cost !== null ? (
                                            <Box p={4} borderWidth="1px" borderColor={canAfford ? "green.600" : "red.600"} borderRadius="md" bg={canAfford ? "green.900/20" : "red.900/10"}>
                                                <Text fontWeight="bold" color={canAfford ? "green.300" : "red.300"} mb={1}>NEXT UPGRADE</Text>
                                                <Text mb={2}>{nextDesc}</Text>
                                                <Text mb={4} fontWeight="bold">Cost: {cost} RP</Text>
                                                <Button
                                                    w="full"
                                                    colorScheme={canAfford ? "green" : "red"}
                                                    disabled={!canAfford}
                                                    onClick={() => {
                                                        if (canAfford) {
                                                            services.research?.system.addPoints(-cost);
                                                            upgrades.upgrade(type);
                                                            setUpdater(prev => prev + 1);
                                                        }
                                                    }}>
                                                    Upgrade
                                                </Button>
                                            </Box>
                                        ) : (
                                            <Text color="yellow.400" fontStyle="italic">This facility is at maximum level.</Text>
                                        )}
                                    </VStack>
                                );
                            })()}
                        </Dialog.Body>
                        <Dialog.CloseTrigger />
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>
        </Flex>
    );
}
