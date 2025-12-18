import React from "react";
import { VStack, IconButton, Icon, Box, Flex, Text } from "@chakra-ui/react";
import { FaHome, FaGlobe, FaRocket, FaCode, FaFlask, FaFlag, FaSatelliteDish } from "react-icons/fa";
import { useColorModeValue } from "@/components/ui/color-mode";
import { Tooltip } from "@/components/ui/tooltip";

interface SidebarProps {
    currentView: string;
    onNavigate: (view: string) => void;
}

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
    const bg = useColorModeValue("gray.900", "gray.900");
    const borderColor = useColorModeValue("gray.800", "gray.700");

    const navItems = [
        { id: "space_center", label: "Space Center", icon: FaHome },
        { id: "world_scene", label: "Launch Control", icon: FaGlobe },
        { id: "build", label: "VAB", icon: FaRocket },
        { id: "scripts", label: "Scripts", icon: FaCode },
        { id: "research", label: "R&D", icon: FaFlask },
        { id: "science", label: "Science", icon: FaFlag },
        { id: "comms", label: "Comms", icon: FaSatelliteDish },
    ];

    return (
        <Flex
            direction="column"
            h="100vh"
            w="60px"
            bg={bg}
            borderRightWidth="1px"
            borderColor={borderColor}
            align="center"
            py={4}
            gap={4}
            zIndex={100}
        >
            <Box mb={2}>
                {/* Logo or Top Icon placeholder if needed */}
                <Icon as={FaRocket} color="cyan.400" boxSize={6} />
            </Box>

            <VStack gap={2} w="full">
                {navItems.map((item) => {
                    const isActive = currentView === item.id;
                    return (
                        <Tooltip key={item.id} content={item.label} positioning={{ placement: "right" }} showArrow>
                            <IconButton
                                aria-label={item.label}
                                variant={isActive ? "solid" : "ghost"}
                                colorPalette={isActive ? "cyan" : "gray"}
                                color={isActive ? "cyan.900" : "gray.400"}
                                onClick={() => onNavigate(item.id)}
                                size="lg"
                                borderRadius="xl"
                                _hover={{
                                    bg: isActive ? "cyan.400" : "gray.800",
                                    color: isActive ? "cyan.900" : "white",
                                }}
                            >
                                <Icon as={item.icon} boxSize={5} />
                            </IconButton>
                        </Tooltip>
                    );
                })}
            </VStack>

            <Box mt="auto">
                {/* Bottom items if any (Settings, etc) */}
            </Box>
        </Flex>
    );
}
