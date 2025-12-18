import React, { useMemo } from 'react';
import { Box, Button, Card, Center, Grid, Heading, HStack, Icon, Text, Tooltip, VStack, Badge } from '@chakra-ui/react';
import { FaCheck, FaFlask, FaLock, FaRocket, FaCode, FaCogs } from 'react-icons/fa';
import { TechTreeDefinition, TechNode } from '../game/Unlocks';

// Helper to determine connectivity for SVG lines
// We assume nodes are placed on a 2D Grid: col=Tier, row=Row
const CELL_W = 350; // Increased spacing width
const CELL_H = 220; // Increased spacing height

export function ResearchTree({ unlockedTechs, researchPoints, onUnlock }: { unlockedTechs: string[], researchPoints: number, onUnlock: (id: string, cost: number) => void }) {

    // Sort nodes to render in layers
    const nodes = TechTreeDefinition;

    // Calculate lines
    // We want the tree centered vertically relative to the screen center
    // Let's assume Row 0 is at 50% height.
    // X start can be set to 100px padding.
    const START_X = 100;

    const getPos = (tier: number, row: number) => {
        const x = START_X + tier * CELL_W;
        // Adjusted vertical center to 350px so it appears near top-middle without scrolling
        return { x: x, y: 350 + row * CELL_H };
    };

    const lines = useMemo(() => {
        const svgLines: React.ReactNode[] = [];
        nodes.forEach(node => {
            if (!node.parentIds) return;
            node.parentIds.forEach(pid => {
                const parent = nodes.find(n => n.id === pid);
                if (parent) {
                    const start = getPos(parent.tier, parent.row);
                    const end = getPos(node.tier, node.row);

                    // Card is ~280px wide now? 
                    // Start: Right side of parent (Shift X by Card Width)
                    // Let's say Card Width is 260px
                    const CARD_W = 260;

                    const x1 = start.x + CARD_W;
                    const y1 = start.y + 70; // Center of card vertical (~140h/2)

                    const x2 = end.x;
                    const y2 = end.y + 70;

                    // Bezier curve
                    const mx = (x1 + x2) / 2;
                    const path = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;

                    const active = unlockedTechs.includes(parent.id);

                    svgLines.push(
                        <path key={`${pid}-${node.id}`} d={path} fill="none" stroke={active ? "#4FD1C5" : "#4A5568"} strokeWidth="2" opacity={0.6} />
                    );
                }
            });
        });
        return svgLines;
    }, [nodes, unlockedTechs]);

    return (
        <Box w="100%" h="100%" overflow="auto" position="relative" bg="gray.950">
            {/* Inner canvas large enough to hold larger layouts */}
            <Box position="absolute" top={0} left={0} minW="2500px" minH="1200px">

                {/* Connections Layer */}
                <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
                    {lines}
                </svg>

                {/* Nodes Layer */}
                {nodes.map(node => {
                    const isUnlocked = unlockedTechs.includes(node.id);
                    const isUnlockable = !isUnlocked && node.parentIds.every(pid => unlockedTechs.includes(pid));
                    const canAfford = researchPoints >= node.costRP;

                    const pos = getPos(node.tier, node.row);

                    return (
                        <Box key={node.id} position="absolute" left={`${pos.x}px`} top={`${pos.y}px`} w="260px" zIndex={1}>
                            <TechCard
                                node={node}
                                isUnlocked={isUnlocked}
                                isUnlockable={isUnlockable}
                                canAfford={canAfford}
                                onUnlock={() => onUnlock(node.id, node.costRP)}
                            />
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
}

function TechCard({ node, isUnlocked, isUnlockable, canAfford, onUnlock }: { node: TechNode, isUnlocked: boolean, isUnlockable: boolean, canAfford: boolean, onUnlock: () => void }) {

    let borderColor = "gray.700";
    let bg = "gray.900";
    let textColor = "gray.400";

    if (isUnlocked) {
        borderColor = "green.500";
        bg = "rgba(16, 185, 129, 0.1)";
        textColor = "gray.300";
    }
    else if (isUnlockable) {
        borderColor = canAfford ? "yellow.400" : "orange.700";
        bg = "rgba(236, 201, 75, 0.05)";
        textColor = "gray.400";
    }

    return (
        <Card.Root
            variant="outline"
            borderColor={borderColor}
            bg={bg}
            backdropFilter="blur(5px)"
            w="100%"
            minH="140px"
            transition="all 0.2s"
            _hover={{ transform: 'scale(1.02)', borderColor: isUnlocked ? "green.400" : (isUnlockable ? "yellow.300" : "gray.600"), zIndex: 10 }}
        >
            <Card.Body p={4}>
                <VStack align="start" gap={3}>
                    <HStack justify="space-between" w="100%">
                        <Text fontWeight="bold" color={isUnlocked ? "green.300" : "white"}>{node.name}</Text>
                        {isUnlocked && <Icon as={FaCheck} color="green.400" />}
                        {!isUnlocked && !isUnlockable && <Icon as={FaLock} color="gray.600" />}
                    </HStack>

                    <Text fontSize="sm" color={textColor} lineHeight={1.2}>
                        {node.description}
                    </Text>

                    {/* Unlocked Items */}
                    {(node.unlockedComponents || node.unlockedMethods) && (
                        <VStack align="start" gap={1} pt={1} w="100%">
                            {node.unlockedComponents && node.unlockedComponents.length > 0 && (
                                <HStack align="start" gap={1} wrap="wrap">
                                    <Icon as={FaCogs} size="xs" color="blue.400" mt={1} />
                                    <Box>
                                        {node.unlockedComponents.map(c => (
                                            <Badge key={c} size="sm" variant="surface" colorPalette="blue" mr={1} mb={1}>{c}</Badge>
                                        ))}
                                    </Box>
                                </HStack>
                            )}
                            {node.unlockedMethods && node.unlockedMethods.length > 0 && (
                                <HStack align="start" gap={1} wrap="wrap">
                                    <Icon as={FaCode} size="xs" color="purple.400" mt={1} />
                                    <Box>
                                        {node.unlockedMethods.map(m => (
                                            <Badge key={m} size="sm" variant="surface" colorPalette="purple" mr={1} mb={1}>{m}</Badge>
                                        ))}
                                    </Box>
                                </HStack>
                            )}
                        </VStack>
                    )}

                    {!isUnlocked && (
                        <Button
                            size="sm"
                            width="100%"
                            mt={2}
                            disabled={!isUnlockable || !canAfford}
                            colorPalette={isUnlockable && canAfford ? "yellow" : "gray"}
                            variant={isUnlockable ? "solid" : "subtle"}
                            onClick={onUnlock}
                        >
                            {isUnlockable ? (canAfford ? `Unlock ${node.costRP} RP` : `${node.costRP} RP`) : "Locked"}
                        </Button>
                    )}
                </VStack>
            </Card.Body>
        </Card.Root>
    )
}
