import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Card, HStack, Heading, Input, SimpleGrid, Text, VStack } from "@chakra-ui/react";
import ScriptEditor from "../ui/ScriptEditor";
import { useAppCore } from "../app/AppContext";
import { useColorModeValue } from "@/components/ui/color-mode";

interface FileItem { id: string; name: string; updatedAt: number }

export default function ScriptsPage() {
  const { manager, services } = useAppCore();
  const lib = services.scripts as any;

  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [currentName, setCurrentName] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [telemetryKeys, setTelemetryKeys] = useState<string[]>([]);

  // Load library initially
  useEffect(() => {
    if (!lib) return;
    try {
      const list = lib.list();
      setFiles(list);
      if (list.length > 0) {
        setCurrentId(list[0].id);
        setCurrentName(list[0].name);
        setCode(list[0].code);
      }
    } catch { }
  }, [lib]);

  // Telemetry keys for autocompletion
  useEffect(() => {
    const onKeys = (ev: any) => {
      try { setTelemetryKeys(Array.isArray(ev?.detail?.keys) ? ev.detail.keys : []); } catch { setTelemetryKeys([]); }
    };
    window.addEventListener("telemetry-keys" as any, onKeys);
    return () => window.removeEventListener("telemetry-keys" as any, onKeys);
  }, []);

  const selectFile = (id: string) => {
    if (!lib) return;
    const item = lib.getById(id);
    if (!item) return;
    setCurrentId(id);
    setCurrentName(item.name);
    setCode(item.code);
    try {
      sessionStorage.setItem("session:user-script", item.code);
      sessionStorage.setItem("session:current-script-name", item.name);
    } catch { }
  };

  const createNew = () => {
    if (!lib) return;
    const base = "Untitled.js";
    let name = base;
    const existing = lib.list();
    let n = 1;
    while (existing.some((s: any) => s.name === name)) {
      name = base.replace(/(\.\w+)?$/, (m: string) => ` (${n++})${m}`);
    }
    const item = lib.upsertByName(name, code || "function update(api){}\n");
    setFiles(lib.list());
    selectFile(item.id);
  };

  const deleteCurrent = () => {
    if (!lib || !currentId) return;
    const list = lib.list();
    const idx = list.findIndex((x: any) => x.id === currentId);
    if (idx >= 0) { list.splice(idx, 1); lib.saveAll(list); }
    const next = lib.list();
    setFiles(next);
    if (next.length) selectFile(next[0].id); else { setCurrentId(null); setCurrentName(""); setCode(""); }
  };

  const duplicateCurrent = () => {
    if (!lib || !currentId) return;
    const base = currentName;
    let name = `${base} (copy)`;
    const existing = lib.list();
    let n = 1;
    while (existing.some((s: any) => s.name === name)) {
      name = `${base} (copy) (${n++})`;
    }
    const item = lib.upsertByName(name, code);
    setFiles(lib.list());
    selectFile(item.id);
  };

  const save = () => {
    if (!lib) return;
    const name = currentName?.trim() || "Untitled.js";
    lib.upsertByName(name, code);
    setFiles(lib.list());
  };

  const compile = () => {
    try {
      manager?.getRunner().installScript(code, { timeLimitMs: 6 });
    } catch (e: any) {
      alert("Compile error: " + (e?.message ?? String(e)));
    }
  };

  return (
    <SimpleGrid columns={{ base: 1, md: 5 }} gap={3}>
      {/* Left: directory */}
      <Card.Root gridColumn={{ base: "1/2", md: "span 2" }} variant="outline">
        <Card.Header>
          <HStack justify="space-between">
            <Heading size="sm">Scripts</Heading>
            <HStack gap={2}>
              <Button size="xs" onClick={createNew}>Create New</Button>
              <Button size="xs" variant="outline" onClick={duplicateCurrent} disabled={!currentId}>Duplicate</Button>
              <Button size="xs" variant="outline" onClick={deleteCurrent} disabled={!currentId}>Delete</Button>
            </HStack>
          </HStack>
        </Card.Header>
        <Card.Body>
          <VStack align="stretch" gap={2} maxH="60dvh" overflowY="auto">
            {files.length === 0 && <Text color="gray.500">No scripts saved.</Text>}
            {files.map(f => (
              <HStack key={f.id} justify="space-between" borderWidth="1px" rounded="md" p={2} cursor="pointer" onClick={() => selectFile(f.id)} bg={f.id === currentId ? "gray.700/20" : undefined}>
                <Text fontWeight="medium">{f.name}</Text>
                <Text fontSize="xs" color="gray.500">{new Date(f.updatedAt).toLocaleTimeString()}</Text>
              </HStack>
            ))}
          </VStack>
        </Card.Body>
      </Card.Root>

      {/* Right: editor */}
      <Card.Root gridColumn={{ base: "1/2", md: "span 3" }} variant="outline">
        <Card.Header>
          <HStack justify="space-between">
            <Heading size="sm">Editor</Heading>
            <HStack>
              <Input size="sm" value={currentName} onChange={(e) => setCurrentName(e.target.value)} minW={240} placeholder="Script name" />
              <Button size="sm" onClick={save}>Save</Button>
              <Button size="sm" onClick={compile} colorScheme="blue">Compile</Button>
            </HStack>
          </HStack>
        </Card.Header>
        <Card.Body p={0}>
          <Box h="60dvh">
            <ScriptEditor
              value={code}
              telemetryKeys={telemetryKeys}
              onChange={(v) => {
                setCode(v);
                try { sessionStorage.setItem("session:user-script", v); } catch { }
              }}
              onCompile={compile}
              theme={useColorModeValue("light", "dark") === "dark" ? "dark" : "light"}
            />
          </Box>
        </Card.Body>
      </Card.Root>
    </SimpleGrid>
  );
}
