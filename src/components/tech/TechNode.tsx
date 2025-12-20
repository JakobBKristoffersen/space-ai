import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Box, VStack, HStack, Text, Icon, Badge, Button, Card } from '@chakra-ui/react';
import { FaCheck, FaLock, FaCogs, FaCode } from 'react-icons/fa';
import { ProgressionNode } from '../../game/GameProgression';

export type TechNodeData = {
    node: ProgressionNode;
    isUnlocked: boolean;
    isUnlockable: boolean;
    canAfford: boolean;
    onUnlock: (id: string, cost: number) => void;
};

const TechNode = memo(({ data }: NodeProps<TechNodeData>) => {
    const { node, isUnlocked, isUnlockable, canAfford, onUnlock } = data;

    let borderColor = "gray.700";
    let bg = "gray.900";
    let textColor = "gray.400";

    if (isUnlocked) {
        borderColor = "green.500";
        bg = "rgba(16, 185, 129, 0.1)";
        textColor = "gray.300";
    } else if (isUnlockable) {
        borderColor = canAfford ? "yellow.400" : "orange.700";
        bg = "rgba(236, 201, 75, 0.05)";
        textColor = "gray.400";
    }

    return (
        <Box w="280px">
            <Handle type="target" position={Position.Left} style={{ background: '#555' }} />

            <Card.Root
                variant="outline"
                borderColor={borderColor}
                bg={bg}
                backdropFilter="blur(5px)"
                w="100%"
                minH="120px"
                transition="all 0.2s"
                _hover={{ borderColor: isUnlocked ? "green.400" : (isUnlockable ? "yellow.300" : "gray.600"), transform: 'scale(1.02)' }}
            >
                <Card.Body p={4}>
                    <VStack align="start" gap={2}>
                        <HStack justify="space-between" w="100%">
                            <Text fontWeight="bold" color={isUnlocked ? "green.300" : "white"} fontSize="sm">{node.name}</Text>
                            {isUnlocked && <Icon as={FaCheck} color="green.400" size="xs" />}
                            {!isUnlocked && !isUnlockable && <Icon as={FaLock} color="gray.600" size="xs" />}
                        </HStack>

                        <Text fontSize="xs" color={textColor} lineHeight={1.2}>
                            {node.description}
                        </Text>

                        {/* Unlocked Items */}
                        {(node.parts?.length || node.apiFeatures?.length) ? (
                            <VStack align="start" gap={1} pt={1} w="100%">
                                {node.parts && node.parts.length > 0 && (
                                    <HStack align="start" gap={1} wrap="wrap">
                                        <Icon as={FaCogs} size="xs" color="blue.400" mt={1} />
                                        <Box>
                                            {node.parts.map(c => (
                                                <Badge key={c} size="xs" variant="surface" colorPalette="blue" mr={1} mb={1}>{c}</Badge>
                                            ))}
                                        </Box>
                                    </HStack>
                                )}
                                {node.apiFeatures && node.apiFeatures.length > 0 && (
                                    <HStack align="start" gap={1} wrap="wrap">
                                        <Icon as={FaCode} size="xs" color="purple.400" mt={1} />
                                        <Box>
                                            {node.apiFeatures.map(m => (
                                                <Badge key={m} size="xs" variant="surface" colorPalette="purple" mr={1} mb={1}>{m}</Badge>
                                            ))}
                                        </Box>
                                    </HStack>
                                )}
                            </VStack>
                        ) : null}

                        {!isUnlocked && (
                            <Button
                                size="xs"
                                width="100%"
                                mt={2}
                                disabled={!isUnlockable || !canAfford}
                                colorPalette={isUnlockable && canAfford ? "yellow" : "gray"}
                                variant={isUnlockable ? "solid" : "subtle"}
                                onClick={(e) => {
                                    e.stopPropagation(); // Prevent drag start
                                    onUnlock(node.id, node.costRP);
                                }}
                            >
                                {isUnlockable ? (canAfford ? `Unlock ${node.costRP} RP` : `${node.costRP} RP`) : "Locked"}
                            </Button>
                        )}
                    </VStack>
                </Card.Body>
            </Card.Root>

            <Handle type="source" position={Position.Right} style={{ background: '#555' }} />
        </Box>
    );
});

export default TechNode;
