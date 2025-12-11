import React, { useEffect, useState } from "react";
import { Box, Button, Card, SimpleGrid, Heading, HStack, Text, VStack, Badge } from "@chakra-ui/react";
import { useAppCore } from "../app/AppContext";
import { TechTree } from "../research/TechDefinitions";

export default function ResearchPage() {
    const { services } = useAppCore();
    const research = services?.research;
    const [points, setPoints] = useState(0);
    const [unlocked, setUnlocked] = useState<string[]>([]);
    // We need to force update to detect changes if research service changes internally
    const [tick, setTick] = useState(0);

    useEffect(() => {
        if (!research) return;
        const interval = setInterval(() => {
            setPoints(research.system.points);
            setUnlocked([...research.system.unlockedTechs]);
            setTick(t => t + 1);
        }, 500);
        return () => clearInterval(interval);
    }, [research]);

    const handleUnlock = (techId: string) => {
        console.log("Attempting to unlock:", techId);
        if (!research) {
            console.error("Research service not found");
            return;
        }
        const tech = TechTree.find(t => t.id === techId);
        if (!tech) {
            console.error("Tech not found:", techId);
            return;
        }
        console.log("Current points:", research.system.points, "Cost:", tech.costRP);
        if (research.system.unlock(tech)) {
            console.log("Unlock successful");
            research.save(); // persist
            // Optimistic update
            setPoints(research.system.points);
            setUnlocked([...research.system.unlockedTechs]);
        } else {
            console.warn("Unlock failed. verification:", research.system.canUnlock(tech));
        }
    };

    return (
        <VStack align="stretch" gap={4} p={4}>
            <Card.Root variant="elevated">
                <Card.Body>
                    <HStack justify="space-between" align="center">
                        <VStack align="start" gap={0}>
                            <Heading size="md">Research Lab</Heading>
                            <Text color="gray.500" fontSize="sm">Unlock new technologies to enhance your fleet.</Text>
                        </VStack>
                        <HStack>
                            <Text fontSize="lg" fontWeight="bold" color="cyan.400">{points}</Text>
                            <Text fontSize="sm" color="gray.500">Research Points</Text>
                        </HStack>
                    </HStack>
                </Card.Body>
            </Card.Root>

            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
                {TechTree.map(tech => {
                    const isUnlocked = unlocked.includes(tech.id);
                    const canUnlock = !isUnlocked && points >= tech.costRP;

                    return (
                        <Card.Root key={tech.id} variant={isUnlocked ? "subtle" : "outline"} borderColor={isUnlocked ? "green.500/30" : undefined}>
                            <Card.Header>
                                <HStack justify="space-between">
                                    <Heading size="sm">{tech.name}</Heading>
                                    {isUnlocked && <Badge colorPalette="green">Unlocked</Badge>}
                                </HStack>
                            </Card.Header>
                            <Card.Body>
                                <VStack align="stretch" gap={3}>
                                    <Text fontSize="sm" color="gray.500">{tech.description}</Text>

                                    {tech.unlocksParts && tech.unlocksParts.length > 0 && (
                                        <Box>
                                            <Text fontSize="xs" fontWeight="bold" mb={1}>Unlocks parts:</Text>
                                            <HStack wrap="wrap" gap={1}>
                                                {tech.unlocksParts.map(p => (
                                                    <Badge key={p} variant="outline" size="sm">{p}</Badge>
                                                ))}
                                            </HStack>
                                        </Box>
                                    )}

                                    <HStack justify="space-between" mt={2}>
                                        <Text fontWeight="mono" color={isUnlocked ? "gray.500" : (canUnlock ? "cyan.400" : "red.400")}>
                                            {tech.costRP} RP
                                        </Text>
                                        <Button
                                            size="sm"
                                            variant={isUnlocked ? "ghost" : "solid"}
                                            disabled={isUnlocked || !canUnlock}
                                            onClick={() => handleUnlock(tech.id)}
                                        >
                                            {isUnlocked ? "Researched" : "Unlock"}
                                        </Button>
                                    </HStack>
                                </VStack>
                            </Card.Body>
                        </Card.Root>
                    );
                })}
            </SimpleGrid>
        </VStack>
    );
}
