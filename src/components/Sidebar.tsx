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
    const [visitedViews, setVisitedViews] = React.useState<string[]>(() => {
        try {
            const saved = localStorage.getItem("visited_views");
            return saved ? JSON.parse(saved) : ["space_center"]; // Default space center as visited
        } catch {
            return ["space_center"];
        }
    });

    // Mark current view as visited
    React.useEffect(() => {
        if (!visitedViews.includes(currentView)) {
            const next = [...visitedViews, currentView];
            setVisitedViews(next);
            localStorage.setItem("visited_views", JSON.stringify(next));
        }
    }, [currentView]);

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

        const svc: any = (window as any).__services;
        const unsubs: (() => void)[] = [];

        // 1. Science Manager subscription (Milestones)
        if (svc?.getScienceManager?.()?.subscribe) {
            unsubs.push(svc.getScienceManager().subscribe(update));
        }

        // 2. Research Service subscription (Tech Unlocks)
        if (svc?.research?.subscribe) {
            unsubs.push(svc.research.subscribe(update));
        }

        // 3. Fallback polling if services not yet ready or don't support subscribe
        if (unsubs.length === 0) {
            const interval = setInterval(update, 1000);
            unsubs.push(() => clearInterval(interval));
        }

        return () => {
            unsubs.forEach(unsub => unsub());
        };
    }, []);

    const navItems = [
        { id: "space_center", label: "Space Center", icon: FaHome },
        { id: "world_scene", label: "Mission Control", icon: FaGlobe },
        { id: "build", label: "VAB", icon: FaRocket },
        ...(hasUnlocks.scripts ? [{ id: "scripts", label: "Scripts", icon: FaCode }] : []),
        ...(hasUnlocks.rnd ? [{ id: "research", label: "R&D", icon: FaFlask }] : []),
        { id: "science", label: "Science & Achievements", icon: FaFlag, forceBadge: hasClaimable },
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
                <Icon as={FaRocket} color="cyan.400" boxSize={6} />
            </Box>

            <VStack gap={2} w="full">
                {navItems.map((item) => {
                    const isActive = currentView === item.id;
                    const isNew = !visitedViews.includes(item.id);
                    const showBadge = (item as any).forceBadge || isNew;

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
                                {showBadge && (
                                    <Box
                                        position="absolute"
                                        top={0}
                                        right={0}
                                        boxSize={isNew ? 2.5 : 3}
                                        bg={isNew ? "cyan.400" : "red.500"}
                                        borderRadius="full"
                                        borderWidth="2px"
                                        borderColor={bg}
                                        zIndex={1}
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
