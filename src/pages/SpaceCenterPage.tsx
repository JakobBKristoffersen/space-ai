import React, { useEffect, useState } from "react";
import { SimpleGrid, Card, Heading, Text, VStack, Icon, Flex, Box, Dialog, Button, Badge, Separator, HStack } from "@chakra-ui/react";
import { FaRocket, FaSatelliteDish, FaFlag, FaFlask, FaCode, FaBuilding, FaArrowUp, FaCoins } from "react-icons/fa";
import { useAppCore } from "../app/AppContext";
import { FacilityType } from "../app/services/UpgradesService";

interface Props {
    onNavigate: (view: string) => void;
}

export default function SpaceCenterPage({ onNavigate }: Props) {
    const { services } = useAppCore();
    const [updater, setUpdater] = useState(0); // force refresh

    const [selectedFacility, setSelectedFacility] = useState<{ id: string, name: string, type?: FacilityType } | null>(null);

    const upgrades = services.upgrades;

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
        if (type === "launchPad") desc = `Lvl ${level} (Max ${upgrades.getMaxLaunchMass(level) / 1000}t)`;
        if (type === "trackingStation") desc = `Lvl ${level} (Max ${upgrades.getMaxActiveRockets(level)} Missions)`;
        if (type === "vab") desc = `Lvl ${level} (T${level} Templates)`;

        return { level, desc };
    };

    const cards = [
        { id: "world_scene", title: "Launch Control", icon: FaSatelliteDish, desc: "Monitor active missions.", color: "purple.400", type: "trackingStation" },
        { id: "comms", title: "Comms Center", icon: FaSatelliteDish, desc: "View incoming data.", color: "cyan.500" },
        { id: "build", title: "VAB (Vehicle Assembly Building)", icon: FaRocket, desc: "Construct rockets.", color: "cyan.400", type: "vab" },
        { id: "facility_pad", title: "Launch Pad", icon: FaArrowUp, desc: "Manage launch capabilities.", color: "red.400", type: "launchPad" },
        { id: "science", title: "Science Data", icon: FaFlag, desc: "View research goals and data.", color: "orange.400", type: "missionControl" },
        { id: "research", title: "R&D Lab", icon: FaFlask, desc: "Unlock technologies.", color: "blue.400", type: "researchCenter" },
        { id: "scripts", title: "Software Engineering", icon: FaCode, desc: "Develop flight software.", color: "green.400" }, // No upgrade yet
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
                                if (c.id === "facility_pad") {
                                    // Special case: Launch Pad isn't a "page", just a facility for upgrades?
                                    // Or maybe we treat it as just opening the modal.
                                    setSelectedFacility({ id: c.id, name: c.title, type: c.type as FacilityType });
                                } else if (c.type) {
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
                                            {type === "launchPad" && <Text>Max Launch Mass: {(upgrades.getMaxLaunchMass(level) / 1000).toFixed(0)}t</Text>}
                                            {type === "trackingStation" && <Text>Active Flights: {upgrades.getMaxActiveRockets(level)}</Text>}
                                            {type === "vab" && <Text>Templates: Tier {level}</Text>}
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
