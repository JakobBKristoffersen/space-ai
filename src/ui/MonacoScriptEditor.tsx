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
    // language prop removed as it is always typescript
    files?: { name: string, code: string }[];
    currentFileName?: string;
}

export interface MonacoScriptEditorRef {
    compile: () => Promise<string>;
}

const MonacoScriptEditor = React.memo(forwardRef<MonacoScriptEditorRef, MonacoScriptEditorProps>(
    ({ value, initialValue, theme = "dark", onChange, onCompile, telemetryKeys, disabled, files = [], currentFileName = "main.ts" }, ref) => {
        const editorRef = useRef<any>(null);
        const monacoRef = useRef<Monaco | null>(null);

        // Manage background models for other files
        useEffect(() => {
            const monaco = monacoRef.current;
            if (!monaco) return;

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
        }, [files, currentFileName]);

        // Expose compile via ref
        useImperativeHandle(ref, () => ({
            compile: async () => {
                const model = editorRef.current?.getModel();
                if (!model) return value || "";

                // TypeScript -> JavaScript transpilation & Bundling
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
        };

        // Update Telemetry keys dynamically
        useEffect(() => {
            if (!monacoRef.current) return;
            const monaco = monacoRef.current;

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
                    defaultLanguage="typescript"
                    language="typescript"
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
