import React, { useState, useEffect } from "react";
import { SpaceCenterHeader } from "../components/SpaceCenterHeader";
import { FaFlask } from "react-icons/fa";
import {
    HStack,
    VStack,
    Text,
    Box,
} from "@chakra-ui/react";

import { useAppCore } from "../app/AppContext";
import { ResearchTree } from "../components/ResearchTree";
import { TechTreeDefinition } from "../game/Unlocks";

interface Props {
    onNavigate: (view: string) => void;
}

export default function ResearchPage({ onNavigate }: Props) {
    const { services } = useAppCore();
    const research = services?.research;
    const [points, setPoints] = useState(0);
    const [unlocked, setUnlocked] = useState<string[]>([]);

    useEffect(() => {
        // Debug logging
        // console.log("ResearchPage mounted. Research service:", !!research);
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

        const techNode = TechTreeDefinition.find((t) => t.id === techId);

        if (techNode) {
            // Adapt to legacy TechDefinition type which requires unlocksParts to be string[] (not undefined)
            const techDef = {
                ...techNode,
                unlocksParts: techNode.unlocksParts || []
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
            <SpaceCenterHeader
                title="R&D Laboratory"
                icon={FaFlask}
                description="Unlock new technologies."
                onNavigate={onNavigate}
            >
                <HStack>
                    <Text fontSize="2xl" fontWeight="bold" color="cyan.400" fontFamily="mono">{points}</Text>
                    <Text fontSize="sm" color="gray.500">Research Points</Text>
                </HStack>
            </SpaceCenterHeader>

            <Box flex={1} w="100%" h="100%" overflow="hidden" position="relative">
                <ResearchTree
                    unlockedTechs={unlocked}
                    researchPoints={points}
                    onUnlock={handleUnlock}
                />
            </Box>
        </VStack>
    );
}
