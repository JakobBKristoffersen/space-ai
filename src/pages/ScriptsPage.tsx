import React, { useState, useRef, useEffect } from "react";
import {
  Flex,
  HStack,
  Box,
  Heading,
  Text,
  Button,
  Icon,
  Card,
  SimpleGrid,
  Input,
  Dialog,
  VStack,
} from "@chakra-ui/react";
import { useAppCore } from "../app/AppContext";
import { useColorModeValue } from "@/components/ui/color-mode";
import MonacoScriptEditor, { MonacoScriptEditorRef } from "../ui/MonacoScriptEditor";
import { AssignButton } from "./scripts/AssignButton";
import { ScriptList, FileItem } from "./scripts/ScriptList";
import { TemplateService } from "./scripts/scriptTemplates";
import { SpaceCenterHeader } from "../components/SpaceCenterHeader";
import { FaCode, FaChevronLeft } from "react-icons/fa";
export default function ScriptsPage({ onNavigate }: { onNavigate?: (v: string) => void }) {
  const { manager, services } = useAppCore();
  const scriptLib = services.scripts as any;
  const activeRocket = manager?.getRocket();

  // Tutorial
  const [showTutorial, setShowTutorial] = useState(() => !localStorage.getItem("tutorial_scripts_seen"));


  // Ref for editor
  const monacoEditorRef = useRef<MonacoScriptEditorRef>(null);

  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [currentName, setCurrentName] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [telemetryKeys, setTelemetryKeys] = useState<string[]>([]);

  const refreshLib = () => {
    if (!scriptLib) return [];
    try {
      const list = scriptLib.list();
      setFiles(list);
      return list;
    } catch { return []; }
  };

  useEffect(() => {
    const list = refreshLib();
    if (list && list.length > 0 && !currentId) {
      selectFile(list[0].id, list);
    }
  }, [scriptLib]);

  useEffect(() => {
    const onKeys = (ev: any) => {
      try { setTelemetryKeys(Array.isArray(ev?.detail?.keys) ? ev.detail.keys : []); } catch { setTelemetryKeys([]); }
    };
    window.addEventListener("telemetry-keys" as any, onKeys);
    return () => window.removeEventListener("telemetry-keys" as any, onKeys);
  }, []);

  const selectFile = (id: string, list = files) => {
    const item = list.find(f => f.id === id);
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
    if (!scriptLib) return;

    // Check Limit
    const upgrades = services.upgrades;
    const lvl = upgrades?.getLevel("software") ?? 1;
    const max = upgrades?.getMaxScripts(lvl) ?? 3;
    const currentCount = scriptLib.list().length;

    if (currentCount >= max) {
      alert(`Storage Full! Upgrade Software Engineering to store more scripts. (${currentCount}/${max})`);
      return;
    }

    const item = TemplateService.createNew(scriptLib);
    const next = refreshLib();
    selectFile(item.id, next);
  };

  const deleteCurrent = () => {
    if (!scriptLib || !currentId) return;
    const list = scriptLib.list();
    const idx = list.findIndex((x: any) => x.id === currentId);
    if (idx >= 0) { list.splice(idx, 1); scriptLib.saveAll(list); }
    const next = refreshLib();
    if (next.length) selectFile(next[0].id, next);
    else { setCurrentId(null); setCurrentName(""); setCode(""); }
  };

  const duplicateCurrent = () => {
    if (!scriptLib || !currentId) return;
    const base = currentName;
    let name = `${base} (copy)`;
    const existing = scriptLib.list();
    let n = 1;
    while (existing.some((s: any) => s.name === name)) {
      name = `${base} (copy) (${n++})`;
    }

    // Check Limit
    const upgrades = services.upgrades;
    const lvl = upgrades?.getLevel("software") ?? 1;
    const max = upgrades?.getMaxScripts(lvl) ?? 3;
    const currentCount = scriptLib.list().length;

    if (currentCount >= max) {
      alert(`Storage Full! Upgrade Software Engineering to store more scripts. (${currentCount}/${max})`);
      return;
    }

    const item = scriptLib.upsertByName(name, code);
    const next = refreshLib();
    selectFile(item.id, next);
  };

  const save = async () => {
    if (!scriptLib) return;
    const name = currentName?.trim() || "Untitled.ts";

    let compiled: string | undefined = undefined;
    try {
      if (monacoEditorRef.current) {
        compiled = await monacoEditorRef.current.compile();
      }
    } catch (e) {
      console.warn("Compile error during save", e);
    }

    scriptLib.upsertByName(name, code, compiled);
    if (name !== currentName) setCurrentName(name);
    refreshLib();
  };

  // Compile helper for checking errors without assigning
  const check = async () => {
    try {
      let output = "";
      output = await monacoEditorRef.current?.compile() || "";

      if (output) alert("Compilation/Analysis OK!\nLength: " + output.length);
      else alert("No output.");
    } catch (e: any) {
      alert("Check Failed: " + e.message);
    }
  };

  const handleAssignSuccess = () => alert("Assigned to Active Rocket!");

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    return (bytes / 1024).toFixed(1) + " KB";
  };

  const editorTheme = useColorModeValue("light", "dark") === "dark" ? "dark" : "light";

  // Reactive Research State
  const [unlockedTechs, setUnlockedTechs] = useState<string[]>(services.research?.system?.unlockedTechs || []);

  useEffect(() => {
    const research = services.research;
    if (!research) return;

    // Sync function
    const sync = () => setUnlockedTechs([...research.system.unlockedTechs]);

    // Initial sync
    sync();

    // Subscribe
    const unsub = research.subscribe(sync);
    return unsub;
  }, [services.research]);

  return (
    <Flex direction="column" h="calc(100vh - 100px)" p={4} gap={4}>
      {/* HEADER */}
      <SpaceCenterHeader
        title="Software Engineering"
        icon={FaCode}
        description="Develop and manage flight software."
        onNavigate={onNavigate}
        onInfoClick={() => setShowTutorial(true)}
        currentView="scripts"
      />

      <SimpleGrid columns={{ base: 1, md: 5 }} gap={3} flex={1} minH={0}>
        <ScriptList
          files={files}
          currentId={currentId}
          onSelect={selectFile}
          onCreateNew={createNew}
          onDelete={deleteCurrent}
          onDuplicate={duplicateCurrent}
        />

        {/* Editor */}
        <Card.Root gridColumn={{ base: "1/2", md: "span 3" }} variant="outline" h="100%">
          <Card.Header pb={2}>
            <HStack justify="space-between">
              <Input size="sm" value={currentName} onChange={(e) => setCurrentName(e.target.value)} maxW="200px" placeholder="Script Name" />
              <Text fontSize="xs" fontFamily="mono" color="gray.500">{formatSize(code.length)}</Text>
              <HStack>
                <AssignButton
                  activeRocket={activeRocket}
                  code={code}
                  name={currentName}
                  monacoRef={monacoEditorRef}
                  onSuccess={handleAssignSuccess}
                />
                <Button size="sm" onClick={save} variant="ghost">Save</Button>
                <Button size="sm" onClick={check} colorScheme="blue" variant="subtle">Check</Button>
              </HStack>
            </HStack>
          </Card.Header>
          <Card.Body p={0} flex={1} minH={0} >
            <MonacoScriptEditor
              ref={monacoEditorRef}
              initialValue={code}
              files={files}
              currentFileName={currentName}
              telemetryKeys={telemetryKeys}
              onChange={(v) => {
                setCode(v);
                try { sessionStorage.setItem("session:user-script", v); } catch { }
              }}
              onSave={save}
              onCompile={save}
              theme={editorTheme}
              unlockedTechs={unlockedTechs}
            />
          </Card.Body>
        </Card.Root>
      </SimpleGrid>

      {/* TUTORIAL DIALOG */}
      <Dialog.Root open={showTutorial} onOpenChange={(e) => setShowTutorial(e.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg="gray.900" borderColor="green.500" borderWidth="1px">
            <Dialog.Header>
              <HStack>
                <FaCode color="#48BB78" />
                <Dialog.Title>Welcome to Software Engineering</Dialog.Title>
              </HStack>
            </Dialog.Header>
            <Dialog.Body>
              <VStack align="start" gap={3}>
                <Text>
                  This is where you write the core logic for your rockets. Use <Text as="span" color="green.400" fontFamily="mono">TypeScript</Text> to program guidance, navigation, and control systems.
                </Text>
                <Text>
                  Start by creating a new script using a <b>Template</b>, then assign it to your rocket in the VAB or on the Launchpad.
                </Text>
                <Text color="gray.400" fontSize="sm">
                  Tip: Use the <code>api</code> object to control engines and read sensors.
                </Text>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button onClick={() => {
                setShowTutorial(false);
                localStorage.setItem("tutorial_scripts_seen", "true");
              }} colorPalette="green">Start Coding</Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger />
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

    </Flex >
  );
}
