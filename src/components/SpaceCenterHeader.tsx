import { HStack, VStack, Heading, Text, Button, Icon, Box } from "@chakra-ui/react";
import { FaChevronLeft, FaHome, FaRocket, FaCode, FaGlobe } from "react-icons/fa";
import { IconType } from "react-icons";

interface SpaceCenterHeaderProps {
    title: string;
    icon?: IconType;
    description?: string;
    onBack?: () => void;
    onNavigate?: (page: string) => void;
    currentView?: string;
    children?: ReactNode; // Right-aligned actions
    bg?: string;
}

export function SpaceCenterHeader({ title, icon, description, onBack, onNavigate, currentView, children, bg = "gray.900" }: SpaceCenterHeaderProps) {
    return (
        <Box px={4} py={2} bg={bg} borderBottomWidth="1px" borderColor="gray.800">
            <HStack justify="space-between">
                <HStack>
                    {icon && <Icon as={icon} color="cyan.400" />}
                    <Heading size="md" color="white">{title}</Heading>
                    {description && <Text fontSize="sm" color="gray.500">{description}</Text>}
                </HStack>
                <HStack gap={2}>
                    {children}

                    {onNavigate && (
                        <>
                            <Box w="1px" h="20px" bg="gray.700" mx={1} />
                            <Button size="xs" variant={currentView === "space_center" ? "subtle" : "ghost"} colorPalette="cyan" onClick={() => onNavigate("space_center")}>
                                <Icon as={FaHome} mr={1} /> Hub
                            </Button>
                            <Button size="xs" variant={currentView === "build" ? "subtle" : "ghost"} colorPalette="cyan" onClick={() => onNavigate("build")}>
                                <Icon as={FaRocket} mr={1} /> VAB
                            </Button>
                            <Button size="xs" variant={currentView === "scripts" ? "subtle" : "ghost"} colorPalette="cyan" onClick={() => onNavigate("scripts")}>
                                <Icon as={FaCode} mr={1} /> Scripts
                            </Button>
                            <Button size="xs" variant={currentView === "world_scene" ? "subtle" : "ghost"} colorPalette="cyan" onClick={() => onNavigate("world_scene")}>
                                <Icon as={FaGlobe} mr={1} /> Launch
                            </Button>
                        </>
                    )}

                    {!onNavigate && onBack && (
                        <Button size="xs" variant="ghost" onClick={onBack}>
                            <Icon as={FaChevronLeft} mr={1} /> Back
                        </Button>
                    )}
                </HStack>
            </HStack>
        </Box>
    );
}
