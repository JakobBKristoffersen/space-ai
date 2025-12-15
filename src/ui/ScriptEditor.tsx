import React, { useEffect, useRef, useImperativeHandle } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { javascript, javascriptLanguage } from "@codemirror/lang-javascript";
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap, startCompletion, type Completion, type CompletionSource, type CompletionContext } from "@codemirror/autocomplete";
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { bracketMatching, syntaxHighlighting, defaultHighlightStyle, syntaxTree } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";

// --- Basic JS/TS linter using the parser error nodes ---
const basicJsLinter = (view: EditorView): Diagnostic[] => {
  const diags: Diagnostic[] = [];
  try {
    const tree = syntaxTree(view.state);
    tree.iterate({
      enter: (node) => {
        // In Lezer parsers, error nodes have name "⚠" or isError flag; CM exposes via type.isError
        if ((node as any).type?.isError) {
          diags.push({
            from: node.from,
            to: node.to,
            severity: "error",
            message: "Syntax error",
          });
        }
      }
    });
  } catch { }

  // Heuristic lint: discourage while(true)
  try {
    const text = view.state.doc.toString();
    const r = /while\s*\(\s*true\s*\)\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = r.exec(text))) {
      diags.push({
        from: m.index,
        to: m.index + m[0].length,
        severity: "warning",
        message: "Unbounded loop detected: consider a guard or break",
      });
    }
  } catch { }

  return diags;
};

// --- RocketAPI + Telemetry completions ---
const rocketApiMethodCompletions: Completion[] = [
  {
    label: "getSnapshot",
    type: "function",
    detail: "RocketAPI",
    apply: "getSnapshot()",
  },
  {
    label: "setEnginePower",
    type: "function",
    detail: "RocketAPI",
    apply: "setEnginePower(1)",
  },
  {
    label: "turnLeft",
    type: "function",
    detail: "RocketAPI",
    apply: "turnLeft(0.001)",
  },
  {
    label: "turnRight",
    type: "function",
    detail: "RocketAPI",
    apply: "turnRight(0.001)",
  },
  {
    label: "log",
    type: "function",
    detail: "RocketAPI",
    apply: "log(\"hello\")",
  },
];

function makeTelemetryCompletions(keys: string[] | undefined): Completion[] {
  return (keys ?? []).slice().sort().map(k => ({
    label: k,
    type: "property",
    detail: "telemetry",
  }));
}

function rocketApiCompletionSource(telemetryKeys?: string[]): CompletionSource {
  return (ctx: CompletionContext) => {
    const { state, pos } = ctx;
    const line = state.doc.lineAt(pos);
    const before = line.text.slice(0, pos - line.from);

    // Offer API methods after `api.`
    const apiDot = /(?:^|[\s\(\[,;])api\.([\w$]*)$/;
    const mApi = before.match(apiDot);
    if (mApi) {
      const typed = mApi[1] ?? "";
      const from = pos - typed.length;
      return {
        from,
        options: rocketApiMethodCompletions,
        validFor: /[\w$]*/,
      };
    }

    // Offer telemetry keys after `api.getSnapshot().data.` or alias `snap.`
    const dataDot = /(?:api\.getSnapshot\(\)\.data|snap)\.([\w$]*)$/;
    const mData = before.match(dataDot);
    if (mData) {
      const typed = mData[1] ?? "";
      const from = pos - typed.length;
      return {
        from,
        options: makeTelemetryCompletions(telemetryKeys),
        validFor: /[\w$]*/,
      };
    }

    // Offer memory API after `api.memory.`
    const memDot = /api\.memory\.([\w$]*)$/;
    const mMem = before.match(memDot);
    if (mMem) {
      const typed = mMem[1] ?? "";
      const from = pos - typed.length;
      const memCompletions: Completion[] = [
        { label: "get", type: "method", detail: "memory" },
        { label: "set", type: "method", detail: "memory" },
        { label: "remove", type: "method", detail: "memory" },
        { label: "clear", type: "method", detail: "memory" },
      ];
      return { from, options: memCompletions, validFor: /[\w$]*/ };
    }

    return null;
  };
}

export interface ScriptEditorProps {
  /** Initial content to load when the editor is created. */
  initialValue?: string;
  /** Optional controlled value; when provided, updates the editor when it changes. */
  value?: string;
  /** Optional theme: "dark" | "light". */
  theme?: "dark" | "light";
  /** Disable editing (read-only) when true. */
  disabled?: boolean;
  /** Called on content changes. */
  onChange?: (value: string) => void;
  /** Called to handle Compile action (e.g., Mod-Enter). */
  onCompile?: () => void;
  /** Optional: telemetry keys to suggest after api.getSnapshot().data. or snap. */
  telemetryKeys?: string[];
}

export interface ScriptEditorRef {
  compile: () => Promise<string>;
}

/**
 * Minimal CodeMirror wrapper specialized for JavaScript editing.
 * - Provides syntax highlighting, autocomplete, lint gutter, bracket matching.
 * - Exposes onChange and a compile keybinding (Mod-Enter).
 */
const ScriptEditor = React.forwardRef<ScriptEditorRef, ScriptEditorProps>(({ initialValue, value, theme = "dark", onChange, onCompile, telemetryKeys, disabled }, ref) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const themeCompartment = useRef(new Compartment()).current;
  const completionCompartment = useRef(new Compartment()).current;
  const editableCompartment = useRef(new Compartment()).current;

  useImperativeHandle(ref, () => ({
    compile: async () => {
      return viewRef.current?.state.doc.toString() ?? "";
    }
  }));

  useEffect(() => {
    if (!hostRef.current) return;
    if (viewRef.current) return; // already mounted

    const modEnterKeymap = keymap.of([{
      key: "Mod-Enter",
      preventDefault: true,
      run: () => {
        onCompile?.();
        return true;
      }
    }]);

    const state = EditorState.create({
      doc: (value ?? initialValue ?? ""),
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...completionKeymap, ...searchKeymap, ...closeBracketsKeymap]),
        modEnterKeymap,
        javascript({ jsx: false, typescript: true }),
        syntaxHighlighting(defaultHighlightStyle),
        completionCompartment.of(autocompletion({
          override: [rocketApiCompletionSource(telemetryKeys)],
          activateOnTyping: true,
        })),
        lintGutter(),
        linter(basicJsLinter),
        closeBrackets(),
        bracketMatching(),
        highlightSelectionMatches(),
        themeCompartment.of(theme === "dark" ? oneDark : []),
        editableCompartment.of(EditorView.editable.of(!disabled)),
        keymap.of([
          { key: "Ctrl-Space", run: startCompletion },
          { key: "Mod-Space", run: startCompletion },
        ]),
        EditorView.updateListener.of((v) => {
          if (v.docChanged) {
            const val = v.state.doc.toString();
            onChange?.(val);
          }
        }),
        EditorView.theme({
          ".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace", fontSize: "13px" },
          "&": { height: "100%" },
          ".cm-tooltip": { zIndex: 2000 },
          ".cm-tooltip-autocomplete": { zIndex: 2000 },
        }),
      ],
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [hostRef]);

  // Theme switching support (future use)
  useEffect(() => {
    const v = viewRef.current;
    if (!v) return;
    v.dispatch({ effects: themeCompartment.reconfigure(theme === "dark" ? oneDark : []) });
  }, [theme]);

  // React to external disabled prop (editable/read-only)
  useEffect(() => {
    const v = viewRef.current;
    if (!v) return;
    v.dispatch({ effects: editableCompartment.reconfigure(EditorView.editable.of(!disabled)) });
  }, [disabled]);

  // Update completion source when telemetry keys change
  useEffect(() => {
    const v = viewRef.current;
    if (!v) return;
    v.dispatch({
      effects: completionCompartment.reconfigure(autocompletion({
        override: [rocketApiCompletionSource(telemetryKeys)],
        activateOnTyping: true,
      }))
    });
  }, [telemetryKeys]);

  // Keep document in sync when the controlled `value` prop changes
  useEffect(() => {
    const v = viewRef.current;
    if (!v) return;
    if (value == null) return;
    const cur = v.state.doc.toString();
    if (cur !== value) {
      v.dispatch({ changes: { from: 0, to: cur.length, insert: value } });
    }
  }, [value]);

  return <div ref={hostRef} style={{ width: "100%", height: "100%" }} />;
});

export default ScriptEditor;
