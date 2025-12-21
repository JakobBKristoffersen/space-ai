import React, { useState, useEffect } from "react";
import { SpaceCenterHeader } from "../components/SpaceCenterHeader";
import { FaFlask } from "react-icons/fa";
import {
    HStack,
    VStack,
    Text,
    Box,
    Dialog,
    Button
} from "@chakra-ui/react";

import { useAppCore } from "../app/AppContext";
import { ResearchGraph } from "../components/tech/ResearchGraph";
import { GameProgression } from "../game/GameProgression";

interface Props {
    onNavigate: (view: string) => void;
}

export default function ResearchPage({ onNavigate }: Props) {
    const { services } = useAppCore();
    const research = services?.research;
    const [points, setPoints] = useState(0);
    const [unlocked, setUnlocked] = useState<string[]>([]);

    // Tutorial State
    const [showTutorial, setShowTutorial] = useState(() => !localStorage.getItem("tutorial_rnd_seen"));


    useEffect(() => {
        if (!research) return;
        const sync = () => {
            setPoints(research.system.points);
            setUnlocked([...research.system.unlockedTechs]);
        };
        const interval = setInterval(sync, 500);
        sync();
        return () => clearInterval(interval);
    }, [research]);

    const handleUnlock = (techId: string, cost: number) => {
        if (!research) return;

        const techNode = GameProgression.find((t) => t.id === techId);

        if (techNode) {
            // Adapt to legacy TechDefinition type which requires unlocksParts to be string[] (not undefined)
            const techDef = {
                ...techNode,
                unlocksParts: techNode.parts || []
            };

            if (research.system.unlock(techDef)) {
                research.save();
                setPoints(research.system.points);
                setUnlocked([...research.system.unlockedTechs]);
            }
        }
    };

    return (
        <VStack align="stretch" gap={0} h="100vh" w="100vw" bg="gray.950" overflow="hidden">
            {/* ... Header ... */}
            <SpaceCenterHeader
                title="R&D Laboratory"
                icon={FaFlask}
                description="Unlock new technologies."
                onNavigate={onNavigate}
                onInfoClick={() => setShowTutorial(true)}
            >
                <HStack>
                    <Text fontSize="2xl" fontWeight="bold" color="cyan.400" fontFamily="mono">{points}</Text>
                    <Text fontSize="sm" color="gray.500">Research Points</Text>
                </HStack>
            </SpaceCenterHeader>

            <Box flex={1} w="100%" h="100%" overflow="hidden" position="relative">
                <ResearchGraph
                    unlockedTechs={unlocked}
                    researchPoints={points}
                    onUnlock={handleUnlock}
                />
            </Box>

            {/* TUTORIAL DIALOG */}
            <Dialog.Root open={showTutorial} onOpenChange={(e) => setShowTutorial(e.open)}>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content bg="gray.900" borderColor="blue.500" borderWidth="1px">
                        <Dialog.Header>
                            <HStack>
                                <FaFlask color="#4299E1" />
                                <Dialog.Title>Welcome to Research & Development</Dialog.Title>
                            </HStack>
                        </Dialog.Header>
                        <Dialog.Body>
                            <VStack align="start" gap={3}>
                                <Text>
                                    As you complete milestones and gather science data, you earn <Text as="span" color="cyan.400" fontWeight="bold">Research Points (RP)</Text>.
                                </Text>
                                <Text>
                                    Spend your RP here to unlock new technologies, opening up more advanced rocketry components and systems.
                                </Text>
                                <Text color="gray.400" fontSize="sm">
                                    Tip: Start by unlocking "Basic Computing" to gain access to programmable guidance systems.
                                </Text>
                            </VStack>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button onClick={() => {
                                setShowTutorial(false);
                                localStorage.setItem("tutorial_rnd_seen", "true");
                            }} colorPalette="blue">Got it!</Button>
                        </Dialog.Footer>
                        <Dialog.CloseTrigger />
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>
        </VStack>
    );
}
