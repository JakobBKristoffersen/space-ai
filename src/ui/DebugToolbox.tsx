import React, { useState } from "react";
import { Dialog, Button, VStack, HStack, Input, Text, Box, Icon, Separator, Heading } from "@chakra-ui/react";
import { FaCoins, FaFlask, FaTrash, FaUnlock, FaGift, FaRocket } from "react-icons/fa";

export function DebugToolbox() {
    const [addRpVal, setAddRpVal] = useState("1000");

    const svcs = (window as any).__services;

    const handleAddRp = () => {
        const v = Number(addRpVal);
        if (!svcs || isNaN(v)) return;
        const research = svcs.research;
        if (research && research.system) {
            research.system.addPoints(v);
            research.save(); // ensure persistence
        }
    };

    const handleReset = () => {
        if (svcs?.resetAll) svcs.resetAll();
    };

    const handleUnlockAll = () => {
        if (svcs?.debug?.unlockAll) svcs.debug.unlockAll();
    };

    return (
        <Dialog.Root>
            <Dialog.Trigger asChild>
                <Button size="sm" variant="outline" colorScheme="purple"><Icon as={FaGift} mr={2} /> Dev Tools</Button>
            </Dialog.Trigger>
            <Dialog.Backdrop />
            <Dialog.Positioner>
                <Dialog.Content bg="gray.800" borderColor="gray.700" color="white">
                    <Dialog.Header>
                        <Dialog.Title>Developer Toolbox</Dialog.Title>
                    </Dialog.Header>
                    <Dialog.Body>
                        <VStack align="stretch" gap={6}>

                            {/* Resources */}
                            <Box>
                                <Heading size="sm" mb={2} color="gray.400">Resources</Heading>
                                <VStack gap={3}>
                                    <HStack>
                                        <Icon as={FaFlask} color="cyan.300" />
                                        <Input
                                            value={addRpVal}
                                            onChange={(e: any) => setAddRpVal(e.target.value)}
                                            w="120px"
                                            size="sm"
                                            borderColor="gray.600"
                                        />
                                        <Button size="sm" colorScheme="cyan" onClick={handleAddRp} flex={1}>
                                            Add Research Points
                                        </Button>
                                    </HStack>
                                </VStack>
                            </Box>

                            <Separator borderColor="gray.700" />

                            {/* Cheats */}
                            <Box>
                                <Heading size="sm" mb={2} color="gray.400">Cheats</Heading>
                                <VStack gap={2}>
                                    <Button w="full" variant="outline" onClick={handleUnlockAll}>
                                        <Icon as={FaUnlock} mr={2} /> Unlock Everything (Infinite Money + Tech)
                                    </Button>
                                    <Button w="full" variant="outline" onClick={() => svcs?.debug?.resetToBasicRocket?.()}>
                                        <Icon as={FaRocket} mr={2} /> Spawn Basic Rocket (Reset Layout)
                                    </Button>
                                    <Button w="full" variant="outline" onClick={() => svcs?.debug?.cheatLoadOrbitScript?.()}>
                                        <Icon as={FaRocket} mr={2} /> Cheat: Load Orbit Script
                                    </Button>
                                </VStack>
                            </Box>

                            <Separator borderColor="gray.700" />

                            {/* Danger Zone */}
                            <Box>
                                <Heading size="sm" mb={2} color="red.400">Danger Zone</Heading>
                                <Button w="full" colorScheme="red" variant="solid" onClick={handleReset}>
                                    <Icon as={FaTrash} mr={2} /> Hard Reset Application
                                </Button>
                                <Text fontSize="xs" color="gray.500" mt={1}>
                                    Clears all data and reloads the page. Cannot be undone.
                                </Text>
                            </Box>

                        </VStack>
                    </Dialog.Body>
                    <Dialog.CloseTrigger />
                </Dialog.Content>
            </Dialog.Positioner>
        </Dialog.Root>
    );
}
