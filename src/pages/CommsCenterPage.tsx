import React, { useEffect, useState } from 'react';
import { Box, VStack, HStack, Text, Icon, Button, Separator, Grid, GridItem, Dialog } from '@chakra-ui/react';
import { FaSatelliteDish, FaEnvelope, FaGlobe, FaDatabase } from 'react-icons/fa';
import { SpaceCenterHeader } from '../components/SpaceCenterHeader';
import { CommsMessage } from '../game/CommsService';

interface Props {
    onNavigate: (view: string) => void;
}

export const CommsCenterPage: React.FC<Props> = ({ onNavigate }) => {
    const [messages, setMessages] = useState<CommsMessage[]>([]);
    const [kvData, setKvData] = useState<Record<string, any>>({});

    // Tutorial
    const [showTutorial, setShowTutorial] = useState(() => !localStorage.getItem("tutorial_comms_seen"));


    useEffect(() => {
        const svcs: any = (window as any).__services;
        if (!svcs?.comms) return;

        // Initial load
        setMessages(svcs.comms.getMessages());
        setKvData(svcs.comms.getKVStore());

        // Subscribe
        const unsub = svcs.comms.subscribe(() => {
            setMessages([...svcs.comms.getMessages()]);
            setKvData(svcs.comms.getKVStore());
        });

        return unsub;
    }, []);

    const handleRead = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const svcs: any = (window as any).__services;
        svcs?.comms?.markAsRead(id);
    };

    return (
        <VStack align="stretch" h="100%" gap={0} bg="gray.950">
            <SpaceCenterHeader
                title="Communication Center"
                description="Incoming transmissions and remote data storage."
                icon={FaSatelliteDish}
                onNavigate={(page) => onNavigate(page === 'hub' ? 'space_center' : page)}
                onInfoClick={() => setShowTutorial(true)}
                currentView="comms"
            />
            <Box>
                <Grid templateColumns="1fr 350px" gap={6} p={8} maxW="1400px" mx="auto" w="full" h="calc(100vh - 100px)">
                    {/* Inbox Column */}
                    <GridItem overflowY="auto" h="100%">
                        <HStack justify="space-between" mb={6}>
                            <Text fontSize="xl" fontWeight="bold" color="cyan.300">
                                Inbox ({messages.filter(m => !m.read).length} Unread)
                            </Text>
                        </HStack>

                        <VStack gap={4} align="stretch">
                            {messages.length === 0 && (
                                <Box p={10} textAlign="center" color="gray.500" borderWidth={1} borderColor="gray.800" borderRadius="md">
                                    <Icon as={FaGlobe} boxSize={8} mb={4} />
                                    <Text>No messages received.</Text>
                                    <Text fontSize="sm">Launch rockets equipped with Antennas to receive data.</Text>
                                </Box>
                            )}
                            {messages.map(msg => (
                                <Box
                                    key={msg.id}
                                    bg="gray.800"
                                    p={4}
                                    borderRadius="md"
                                    borderLeft="4px solid"
                                    borderLeftColor={msg.read ? "gray.600" : "cyan.400"}
                                    opacity={msg.read ? 0.7 : 1}
                                    transition="all 0.2s"
                                    _hover={{ bg: "gray.750", opacity: 1 }}
                                >
                                    <HStack justify="space-between" mb={2}>
                                        <HStack>
                                            <Icon as={FaEnvelope} color={msg.read ? "gray.500" : "cyan.300"} />
                                            <Text fontWeight="bold" color={msg.sender === "SYSTEM" ? "yellow.300" : "white"}>
                                                {msg.sender}
                                            </Text>
                                            <Text fontSize="xs" color="gray.500">
                                                {new Date(msg.timestamp).toLocaleTimeString()}
                                            </Text>
                                        </HStack>
                                        {!msg.read && (
                                            <Button size="xs" variant="ghost" onClick={(e) => handleRead(msg.id, e)}>
                                                Mark Read
                                            </Button>
                                        )}
                                    </HStack>
                                    <Separator borderColor="gray.700" mb={2} />
                                    <Text fontFamily="mono" fontSize="sm" whiteSpace="pre-wrap">
                                        {msg.content}
                                    </Text>
                                </Box>
                            ))}
                        </VStack>
                    </GridItem>

                    {/* Data Store Column */}
                    <GridItem bg="gray.900" p={4} borderRadius="lg" border="1px solid" borderColor="gray.800" h="100%" overflowY="auto">
                        <HStack mb={4} gap={2}>
                            <Icon as={FaDatabase} color="purple.400" />
                            <Text fontSize="lg" fontWeight="bold" color="purple.300">Mission Data</Text>
                        </HStack>
                        <Separator mb={4} borderColor="gray.700" />

                        {Object.keys(kvData).length === 0 ? (
                            <Text color="gray.500" fontSize="sm" textAlign="center" mt={10}>
                                No data transmitted.
                                <br />
                                Use <code>api.comms.transmitData(key, value)</code> to store mission parameters here.
                            </Text>
                        ) : (
                            <VStack align="stretch" gap={2}>
                                {Object.entries(kvData).map(([key, value]) => (
                                    <HStack key={key} justify="space-between" bg="gray.800" p={2} px={3} borderRadius="md">
                                        <Text fontFamily="mono" color="gray.400" fontSize="sm">{key}</Text>
                                        <Text fontFamily="mono" color="white" fontWeight="bold" fontSize="sm">
                                            {String(value)}
                                        </Text>
                                    </HStack>
                                ))}
                            </VStack>
                        )}
                    </GridItem>
                </Grid>
            </Box>

            {/* TUTORIAL DIALOG */}
            {/* TUTORIAL DIALOG */}
            <Dialog.Root open={showTutorial} onOpenChange={(e) => setShowTutorial(e.open)}>
                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content bg="gray.900" borderColor="cyan.500" borderWidth="1px">
                        <Dialog.Header>
                            <HStack>
                                <FaSatelliteDish color="#63B3ED" />
                                <Dialog.Title>Welcome to Comms Center</Dialog.Title>
                            </HStack>
                        </Dialog.Header>
                        <Dialog.Body>
                            <VStack align="start" gap={3}>
                                <Text>
                                    This facility handles long-range communication with your rockets.
                                </Text>
                                <Text>
                                    <Text as="span" color="cyan.300" fontWeight="bold">Inbox:</Text> Receive status updates and mission reports.
                                </Text>
                                <Text>
                                    <Text as="span" color="purple.300" fontWeight="bold">Data Store:</Text> View key-value data transmitted by your scripts using <code>api.comms.transmitData()</code>.
                                </Text>
                                <Text color="gray.400" fontSize="sm">
                                    Requirement: Rockets must have an Antenna and Line of Sight to Home or a Relay to transmit.
                                </Text>
                            </VStack>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <Button onClick={() => {
                                setShowTutorial(false);
                                localStorage.setItem("tutorial_comms_seen", "true");
                            }} colorPalette="cyan">Open Frequency</Button>
                        </Dialog.Footer>
                        <Dialog.CloseTrigger />
                    </Dialog.Content>
                </Dialog.Positioner>
            </Dialog.Root>
        </VStack>
    );
};
