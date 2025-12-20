import React from "react";
import { HStack, Text } from "@chakra-ui/react";

export interface StatRowProps {
    label: string;
    value: string | number;
    unit?: string;
    color?: string;
}

export const StatRow: React.FC<StatRowProps> = ({ label, value, unit, color = "white" }) => (
    <HStack justify="space-between" w="100%">
        <Text fontSize="xs" color="gray.500">{label}</Text>
        <HStack gap={1}>
            <Text fontSize="sm" fontFamily="mono" color={color}>{value}</Text>
            {unit && <Text fontSize="xs" color="gray.600">{unit}</Text>}
        </HStack>
    </HStack>
);
