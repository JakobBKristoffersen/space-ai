import React, { useState } from "react";
import { Dialog, Button, VStack, HStack, Input, Text, Box, Icon, Separator, Heading } from "@chakra-ui/react";
import { FaCoins, FaFlask, FaTrash, FaUnlock, FaGift, FaRocket } from "react-icons/fa";

export function DebugToolbox() {
    const [addMoneyVal, setAddMoneyVal] = useState("100000");
    const [addRpVal, setAddRpVal] = useState("1000");

    const svcs = (window as any).__services;

    const handleAddMoney = () => {
        const v = Number(addMoneyVal);
        if (!svcs || isNaN(v)) return;
        const current = svcs.getMoney?.() || 0;
        svcs.setMoney?.(current + v);
    };

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
                <Button size="sm" variant="outline" colorScheme="purple" leftIcon={<Icon as={FaGift} />}>Dev Tools</Button>
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
                                        <Icon as={FaCoins} color="green.300" />
                                        <Input
                                            value={addMoneyVal}
                                            onChange={(e: any) => setAddMoneyVal(e.target.value)}
                                            w="120px"
                                            size="sm"
                                            borderColor="gray.600"
                                        />
                                        <Button size="sm" colorScheme="green" onClick={handleAddMoney} flex={1}>
                                            Add Money
                                        </Button>
                                    </HStack>
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
                                            Add Science
                                        </Button>
                                    </HStack>
                                </VStack>
                            </Box>

                            <Separator borderColor="gray.700" />

                            {/* Cheats */}
                            <Box>
                                <Heading size="sm" mb={2} color="gray.400">Cheats</Heading>
                                <VStack gap={2}>
                                    <Button w="full" variant="outline" onClick={handleUnlockAll} leftIcon={<Icon as={FaUnlock} />}>
                                        Unlock Everything (Infinite Money + Tech)
                                    </Button>
                                    <Button w="full" variant="outline" onClick={() => svcs?.debug?.resetToBasicRocket?.()} leftIcon={<Icon as={FaRocket} />}>
                                        Spawn Basic Rocket (Reset Layout)
                                    </Button>
                                    <Button w="full" variant="outline" onClick={() => svcs?.debug?.cheatLoadOrbitScript?.()} leftIcon={<Icon as={FaRocket} />}>
                                        Cheat: Load Orbit Script
                                    </Button>
                                </VStack>
                            </Box>

                            <Separator borderColor="gray.700" />

                            {/* Danger Zone */}
                            <Box>
                                <Heading size="sm" mb={2} color="red.400">Danger Zone</Heading>
                                <Button w="full" colorScheme="red" variant="solid" onClick={handleReset} leftIcon={<Icon as={FaTrash} />}>
                                    Hard Reset Application
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
