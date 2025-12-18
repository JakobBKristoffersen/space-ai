import { HStack, Heading, Text, Button, Icon, Box } from "@chakra-ui/react";
import { FaChevronLeft } from "react-icons/fa";
import { IconType } from "react-icons";
import { ReactNode } from "react";
import React from "react";

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
                    <Box w="1px" h="20px" bg="gray.700" mx={1} />
                </HStack>
                <HStack gap={2}>
                    {children}
                </HStack>
                <HStack gap={2}>
                    {onNavigate && (
                        <>
                            {/* Navigation is now handled by the Sidebar */}
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
