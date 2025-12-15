
import React from "react";
import { Box, Button, Card, HStack, Heading, Text, VStack } from "@chakra-ui/react";
import { TemplateService } from "./scriptTemplates";

export interface FileItem { id: string; name: string; updatedAt: number; code: string }

interface ScriptListProps {
    files: FileItem[];
    currentId: string | null;
    useMonaco: boolean;
    setUseMonaco: (val: boolean) => void;
    onSelect: (id: string) => void;
    onCreateNew: (lang: "typescript" | "python") => void;
    onCreateMultiSeed: () => void;
    onDelete: () => void;
    onDuplicate: () => void;
}

export function ScriptList({
    files,
    currentId,
    useMonaco,
    setUseMonaco,
    onSelect,
    onCreateNew,
    onCreateMultiSeed,
    onDelete,
    onDuplicate
}: ScriptListProps) {

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + " B";
        return (bytes / 1024).toFixed(1) + " KB";
    };

    return (
        <Card.Root gridColumn={{ base: "1/2", md: "span 2" }} variant="outline" h="100%">
            <Card.Header pb={2}>
                <VStack align="stretch" gap={2}>
                    <HStack justify="space-between">
                        <Heading size="sm">Scripts Directory</Heading>
                        <HStack gap={1}>
                            <Button size="xs" onClick={() => onCreateNew("typescript")}>+TS</Button>
                            <Button size="xs" variant="surface" colorPalette="cyan" onClick={onCreateMultiSeed}>Seed Import</Button>
                            {/* <Button size="xs" onClick={() => onCreateNew("python")}>+Py</Button> */}
                        </HStack>
                    </HStack>
                    <HStack justify="space-between">
                        <Text fontSize="xs">Editor:</Text>
                        <HStack gap={2}>
                            <Button
                                size="xs"
                                variant={!useMonaco ? "solid" : "ghost"}
                                onClick={() => setUseMonaco(false)}
                            >
                                Standard
                            </Button>
                            <Button
                                size="xs"
                                variant={useMonaco ? "solid" : "ghost"}
                                onClick={() => setUseMonaco(true)}
                            >
                                Monaco
                            </Button>
                        </HStack>
                    </HStack>
                </VStack>
            </Card.Header>
            <Card.Body p={0} overflowY="auto" flex={1} minH={0}>
                {files.length === 0 && <Box p={4}><Text color="gray.500">No scripts.</Text></Box>}
                <VStack align="stretch" gap={0} separator={<Box borderBottomWidth="1px" borderColor="gray.200" _dark={{ borderColor: "gray.700" }} />}>
                    {files.map(f => (
                        <Box
                            key={f.id}
                            p={2}
                            cursor="pointer"
                            bg={f.id === currentId ? "cyan.400/20" : "transparent"}
                            _hover={{ bg: f.id === currentId ? "cyan.400/25" : "gray.100/10" }}
                            onClick={() => onSelect(f.id)}
                        >
                            <HStack justify="space-between">
                                <VStack align="start" gap={0}>
                                    <Text fontWeight="medium" fontSize="sm">{f.name}</Text>
                                    <Text fontSize="xs" color="gray.500">{new Date(f.updatedAt).toLocaleDateString()} {new Date(f.updatedAt).toLocaleTimeString()}</Text>
                                </VStack>
                                <Text fontSize="xs" fontFamily="mono" color="gray.500">{formatSize(f.code.length)}</Text>
                            </HStack>
                        </Box>
                    ))}
                </VStack>
            </Card.Body>
            <Card.Footer pt={2}>
                <HStack>
                    <Button size="xs" variant="ghost" colorPalette="red" onClick={onDelete} disabled={!currentId}>Delete</Button>
                    <Button size="xs" variant="ghost" onClick={onDuplicate} disabled={!currentId}>Duplicate</Button>
                </HStack>
            </Card.Footer>
        </Card.Root>
    );
}
