import React, { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import Editor, { Monaco } from "@monaco-editor/react";
import { ROCKET_API_DTS } from "./editor/rocketApiTypes";

export interface MonacoScriptEditorProps {
    initialValue?: string;
    value?: string;
    theme?: "dark" | "light";
    disabled?: boolean;
    onChange?: (value: string) => void;
    onCompile?: () => void;
    telemetryKeys?: string[];
    language?: "typescript" | "python";
    files?: { name: string, code: string }[];
    currentFileName?: string;
}

export interface MonacoScriptEditorRef {
    compile: () => Promise<string>;
}

const MonacoScriptEditor = React.memo(forwardRef<MonacoScriptEditorRef, MonacoScriptEditorProps>(
    ({ value, initialValue, theme = "dark", onChange, onCompile, telemetryKeys, disabled, language = "typescript", files = [], currentFileName = "main.ts" }, ref) => {
        const editorRef = useRef<any>(null);
        const monacoRef = useRef<Monaco | null>(null);

        // Manage background models for other files
        useEffect(() => {
            const monaco = monacoRef.current;
            if (!monaco || language !== "typescript") return;

            // Sync other files to models
            files.forEach(f => {
                if (f.name === currentFileName) return; // Skip current (managed by Editor)

                const uri = monaco.Uri.parse(`file:///${f.name}`);
                let model = monaco.editor.getModel(uri);
                if (!model) {
                    model = monaco.editor.createModel(f.code, "typescript", uri);
                } else {
                    // Update content if different (and not currently being edited in main view theoretically)
                    if (model.getValue() !== f.code) {
                        model.setValue(f.code);
                    }
                }
            });
        }, [files, currentFileName, language]);

        // Expose compile via ref
        useImperativeHandle(ref, () => ({
            compile: async () => {
                const model = editorRef.current?.getModel();
                if (!model) return value || "";

                if (language === "python") {
                    return model.getValue();
                }

                // TypeScript -> JavaScript transpilation & Bundling
                if (language === "typescript") {
                    const worker = await monacoRef.current?.languages.typescript.getTypeScriptWorker();
                    if (!worker) return model.getValue();

                    // Helper to get JS for a URI
                    const getEmittedJS = async (uri: any) => {
                        const client = await worker(uri);
                        const output = await client.getEmitOutput(uri.toString());
                        if (output && output.outputFiles && output.outputFiles.length > 0) {
                            return output.outputFiles[0].text;
                        }
                        return "";
                    };

                    const mainJs = await getEmittedJS(model.uri);

                    // Simple regex to find required modules (imports)
                    // Matches "require('STRING')" produced by TS CommonJS emit
                    // OR look at the source imports? 
                    // TS CommonJS emit turns `import ... from "./foo"` into `require("./foo")`
                    // We can scan the JS output for `require`.

                    const visited = new Set<string>();
                    const bundleParts: string[] = [];
                    const queue: string[] = [];

                    // Extract requires from mainJs
                    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
                    let match;
                    while ((match = requireRegex.exec(mainJs)) !== null) {
                        queue.push(match[1]);
                    }

                    while (queue.length > 0) {
                        const rawPath = queue.shift()!;
                        // Normalize path: "./foo" -> "foo.ts"? 
                        // We stored models as `file:///foo.ts`
                        // Import of `./foo` usually maps to `foo` or `foo.ts` relative to current.
                        // Simplified assumption: all files flat, names match import path + .ts or check files map.

                        // normalize: remove ./, add .ts if missing
                        let cleanName = rawPath.replace(/^\.\//, "");
                        if (!cleanName.endsWith(".ts") && !cleanName.endsWith(".js")) cleanName += ".ts";

                        if (visited.has(cleanName)) continue;
                        visited.add(cleanName);

                        // Find dependency content
                        // Check active model first? Or props?
                        // Prefer props/models
                        const bgFile = files.find(f => f.name === cleanName || f.name === rawPath || f.name === rawPath + ".ts");

                        if (bgFile) {
                            // Compile it
                            const uri = monacoRef.current!.Uri.parse(`file:///${bgFile.name}`);
                            const js = await getEmittedJS(uri);

                            // Wrap in define
                            // define("foo", ...)
                            // Use original rawPath for ID to match require call
                            const moduleCode = `
define("${rawPath}", function(require, module, exports) {
${js}
});`;
                            bundleParts.push(moduleCode);

                            // Scan deps of this module
                            let subMatch;
                            while ((subMatch = requireRegex.exec(js)) !== null) {
                                queue.push(subMatch[1]);
                            }
                        }
                    }

                    // Bootloader
                    const bootloader = `
const __modules__ = {};
function require(id) {
    if (__modules__[id]) return __modules__[id];
    throw new Error("Module not found: " + id);
}
function define(id, factory) {
    const module = { exports: {} };
    factory(require, module, module.exports);
    __modules__[id] = module.exports;
}
`;
                    const shim = `
const exports = {};
const module = { exports };
`;

                    return bootloader + bundleParts.join("\n") + shim + mainJs;
                }

                return model.getValue();
            },
        }));

        const handleEditorDidMount = (editor: any, monaco: Monaco) => {
            editorRef.current = editor;
            monacoRef.current = monaco;

            // Configure TypeScript
            monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                target: monaco.languages.typescript.ScriptTarget.ES2020,
                allowNonTsExtensions: true,
                moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
                module: monaco.languages.typescript.ModuleKind.CommonJS,
                noEmit: false,
                typeRoots: ["node_modules/@types"],
            });

            // Inject RocketAPI types
            monaco.languages.typescript.typescriptDefaults.addExtraLib(
                ROCKET_API_DTS,
                "ts:filename/rocketApi.d.ts"
            );

            // Add keybinding for Compile (Cmd/Ctrl + Enter)
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
                onCompile?.();
            });

            // Python Autocompletion
            const hasProvider = (window as any).__monaco_rocket_python_provider_registered_v3;
            if (language === "python" && !hasProvider) {
                (window as any).__monaco_rocket_python_provider_registered_v3 = true;

                // Parse suggestions once
                let suggestions: any[] = [];
                try {
                    suggestions = parseDtsToCompletionItems(monaco, ROCKET_API_DTS);
                    console.log("Python RocketAPI suggestions parsed:", suggestions);
                } catch (e) {
                    console.error("Failed to parse RocketAPI DTS:", e);
                }

                monaco.languages.registerCompletionItemProvider("python", {
                    triggerCharacters: ['.'],
                    provideCompletionItems: (model: any, position: any) => {
                        const word = model.getWordUntilPosition(position);
                        const range = {
                            startLineNumber: position.lineNumber,
                            endLineNumber: position.lineNumber,
                            startColumn: word.startColumn,
                            endColumn: word.endColumn,
                        };

                        const lineContent = model.getLineContent(position.lineNumber);
                        // Get text before the *start* of the current word being typed
                        const textUntilWordStart = lineContent.substring(0, word.startColumn - 1);

                        // Check for `api.` (allows spaces before)
                        // OR if we are just starting to type after a dot that belongs to api
                        if (textUntilWordStart.trim().endsWith("api.")) {
                            // Clone and apply range to all suggestions
                            const items = suggestions.map(s => ({ ...s, range }));
                            return { suggestions: items };
                        }

                        // Check for `import`
                        const textBeforeCursor = lineContent.substring(0, position.column - 1);
                        if (textBeforeCursor.includes("import ") && !textBeforeCursor.includes(".")) {
                            return {
                                suggestions: [
                                    { label: "RocketAPI", kind: monaco.languages.CompletionItemKind.Class, insertText: "RocketAPI", documentation: "RocketAPI Class", range }
                                ]
                            };
                        }

                        return { suggestions: [] };
                    }
                });
            }
        };

        function parseDtsToCompletionItems(monaco: Monaco, dts: string): any[] {
            const items: any[] = [];
            // Handle both CRLF and LF
            const lines = dts.split(/\r?\n/);
            let currentDoc: string[] = [];
            let collectingDoc = false;

            // Regex for methods: log(msg: unknown): void;
            // Captures: name, args
            const methodRegex = /^\s*(\w+)\s*\((.*)\)\s*:\s*.*$/;

            // Regex for properties: readonly data: ...;
            // Captures: name
            const propRegex = /^\s*(?:readonly\s+)?(\w+)\s*:\s*.*$/;

            for (const rawLine of lines) {
                const trimmed = rawLine.trim();
                if (!trimmed) continue;

                // JSDoc handling
                if (trimmed.startsWith('/**')) {
                    collectingDoc = true;
                    currentDoc = [];
                    continue; // Start of doc
                }
                if (trimmed.startsWith('*/') || trimmed.endsWith('*/')) {
                    collectingDoc = false;
                    continue; // End of doc
                }
                if (collectingDoc) {
                    // clean up "* Text" -> "Text"
                    currentDoc.push(trimmed.replace(/^\*\s?/, ''));
                    continue;
                }

                // Match Method
                const methodMatch = trimmed.match(methodRegex);
                if (methodMatch) {
                    const name = methodMatch[1];
                    const argsStr = methodMatch[2]; // e.g. "value: number" or "a: number, b: number"

                    // Generate snippet with placeholders
                    // Split args by comma, ignoring nested stuff if possible (simple split works for now as args are simple)
                    let snippetArgs = "";
                    if (argsStr.trim().length > 0) {
                        const args = argsStr.split(',');
                        snippetArgs = args.map((arg, idx) => {
                            const [argName] = arg.split(':').map(s => s.trim());
                            return `\${${idx + 1}:${argName}}`;
                        }).join(', ');
                    }

                    items.push({
                        label: name,
                        kind: monaco.languages.CompletionItemKind.Method,
                        insertText: `${name}(${snippetArgs})`,
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: currentDoc.join('\n'),
                        // range will be applied at provider time
                    });
                    currentDoc = []; // Consume doc
                    continue;
                }

                // Match Property
                const propMatch = trimmed.match(propRegex);
                if (propMatch) {
                    const name = propMatch[1];
                    // Skip if it looks like a method declaration (safety check, though regex diff helps)
                    if (name === "declare" || name === "interface") continue;

                    items.push({
                        label: name,
                        kind: monaco.languages.CompletionItemKind.Property,
                        insertText: name,
                        documentation: currentDoc.join('\n'),
                    });
                    currentDoc = [];
                    continue;
                }
            }

            return items;
        }

        // Update Telemetry keys dynamically
        useEffect(() => {
            if (!monacoRef.current) return;
            const monaco = monacoRef.current;

            // Update the extra lib with new telemetry keys if needed
            // Currently structured as part of the static definition, but we could generate dynamic d.ts
            // For now, static 'RocketAPI' definition covers the main API.
            // Dynamic keys like `api.getSnapshot().data.foo` are hard to type strictly without generating d.ts on the fly.
            // We can append to the d.ts

            const telemetryTypeFields = (telemetryKeys || []).map(k => `${k}: number;`).join("\n    ");
            const dynamicDts = ROCKET_API_DTS.replace(
                "readonly data: Record<string, any>;",
                `readonly data: {
            ${telemetryTypeFields}
            [key: string]: any;
        };`
            );

            monaco.languages.typescript.typescriptDefaults.setExtraLibs([
                { content: dynamicDts, filePath: "ts:filename/rocketApi.d.ts" }
            ]);

        }, [telemetryKeys]);

        return (
            <div style={{ width: "100%", height: "100%" }}>
                <Editor
                    height="100%"
                    path={currentFileName}
                    defaultLanguage={language}
                    language={language}
                    value={value}
                    defaultValue={initialValue}
                    theme={theme === "dark" ? "vs-dark" : "light"}
                    options={{
                        readOnly: disabled,
                        minimap: { enabled: false },
                        fontSize: 13,
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                    }}
                    onChange={(val) => onChange?.(val || "")}
                    onMount={handleEditorDidMount}
                />
            </div>
        );
    }
));

export default MonacoScriptEditor;
