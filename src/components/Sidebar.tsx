import React from "react";
import { VStack, IconButton, Icon, Box, Flex, Text } from "@chakra-ui/react";
import { FaHome, FaGlobe, FaRocket, FaCode, FaFlask, FaFlag, FaSatelliteDish } from "react-icons/fa";
import { useColorModeValue } from "@/components/ui/color-mode";
import { Tooltip } from "@/components/ui/tooltip";
import { TechIds } from "../game/GameIds";

interface SidebarProps {
    currentView: string;
    onNavigate: (view: string) => void;
}

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
    const bg = useColorModeValue("gray.900", "gray.900");
    const borderColor = useColorModeValue("gray.800", "gray.700");

    const [hasClaimable, setHasClaimable] = React.useState(false);
    const [hasUnlocks, setHasUnlocks] = React.useState({ scripts: false, rnd: false, comms: false });

    React.useEffect(() => {
        const update = () => {
            const svc: any = (window as any).__services;
            if (!svc) return;

            // Milestones Claimable Check
            if (svc.getMilestones) {
                const ms: any[] = svc.getMilestones();
                const anyClaimable = ms.some((m: any) => m.isCompleted && !m.isClaimed);
                setHasClaimable(anyClaimable);
            }

            // Unlocks Check
            const system = svc.research?.system;
            const sm = svc.getScienceManager ? svc.getScienceManager() : null;

            const scripts = system?.isUnlocked ? system.isUnlocked(TechIds.BASIC_COMPUTING) : false;
            const rnd = (sm?.getCompletedIds?.().length ?? 0) > 0;
            const comms = system?.isUnlocked ? system.isUnlocked(TechIds.COMMS_BASIC) : false;

            setHasUnlocks({ scripts, rnd, comms });
        };

        // Initial check
        update();

        // Poll every 1s (simple, robust) or subscribe if available
        // Manager has subscribe, let's try to use it if accessible, else poll
        const svc: any = (window as any).__services;
        let unsubscribe: (() => void) | undefined;

        if (svc?.getScienceManager?.()?.subscribe) {
            unsubscribe = svc.getScienceManager().subscribe(update);
        } else {
            const interval = setInterval(update, 1000);
            unsubscribe = () => clearInterval(interval);
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    const navItems = [
        { id: "space_center", label: "Space Center", icon: FaHome },
        { id: "world_scene", label: "Launch Control", icon: FaGlobe },
        { id: "build", label: "VAB", icon: FaRocket },
        ...(hasUnlocks.scripts ? [{ id: "scripts", label: "Scripts", icon: FaCode }] : []),
        ...(hasUnlocks.rnd ? [{ id: "research", label: "R&D", icon: FaFlask }] : []),
        { id: "science", label: "Science & Milestones", icon: FaFlag, showBadge: hasClaimable },
        ...(hasUnlocks.comms ? [{ id: "comms", label: "Comms", icon: FaSatelliteDish }] : []),
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
                            <Box position="relative">
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
                                {(item as any).showBadge && (
                                    <Box
                                        position="absolute"
                                        top={0}
                                        right={0}
                                        boxSize={3}
                                        bg="red.500"
                                        borderRadius="full"
                                        borderWidth="2px"
                                        borderColor={bg}
                                    />
                                )}
                            </Box>
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
