import React, { ReactNode } from "react";
import { HStack, VStack, Heading, Text, Button, Icon, Box, Card } from "@chakra-ui/react";
import { FaChevronLeft } from "react-icons/fa";
import { IconType } from "react-icons";

interface SpaceCenterHeaderProps {
    title: string;
    icon?: IconType;
    description?: string;
    onBack?: () => void;
    children?: ReactNode; // Right-aligned actions
    bg?: string;
}

export function SpaceCenterHeader({ title, icon, description, onBack, children, bg = "gray.900" }: SpaceCenterHeaderProps) {
    return (
        <Card.Root variant="elevated" bg="gray.800" borderColor="gray.700" mb={4}>
            <Card.Body py={3}>
                <HStack justify="space-between" align="center">
                    <HStack gap={4}>
                        {onBack && (
                            <Button size="sm" variant="ghost" onClick={onBack} color="gray.400" _hover={{ color: "white", bg: "whiteAlpha.200" }}>
                                <Icon as={FaChevronLeft} mr={1} /> Back
                            </Button>
                        )}
                        {icon && (
                            <Box p={2} bg="whiteAlpha.100" borderRadius="md">
                                <Icon as={icon} color="cyan.400" boxSize={5} />
                            </Box>
                        )}
                        <VStack align="start" gap={0}>
                            <Heading size="sm" color="white">{title}</Heading>
                            {description && <Text color="gray.400" fontSize="xs">{description}</Text>}
                        </VStack>
                    </HStack>

                    <HStack>
                        {children}
                    </HStack>
                </HStack>
            </Card.Body>
        </Card.Root>
    );
}
