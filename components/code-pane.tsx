"use client";

import { python } from "@codemirror/lang-python";
import { Prec, StateEffect, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, keymap } from "@codemirror/view";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { indentUnit } from "@codemirror/language";
import { PlayIcon } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useAppState } from "@/store/use-app-state";
import { cn } from "@/lib/utils";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

type SourceLoc = {
  start_line: number;
  start_col: number;
  end_line: number;
  end_col: number;
};

const setHighlight = StateEffect.define<SourceLoc | null>();
const highlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setHighlight)) {
        const loc = effect.value;
        if (!loc) {
          return Decoration.none;
        }
        try {
          const doc = tr.state.doc;
          const startLine = Math.min(loc.start_line, doc.lines);
          const endLine = Math.min(loc.end_line, doc.lines);

          const startLineInfo = doc.line(startLine);
          const endLineInfo = doc.line(endLine);

          const from = startLineInfo.from + loc.start_col;
          const to = endLineInfo.from + loc.end_col;

          const clampedFrom = Math.max(0, Math.min(from, doc.length));
          const clampedTo = Math.max(clampedFrom, Math.min(to, doc.length));

          if (clampedFrom === clampedTo) {
            return Decoration.none;
          }

          const mark = Decoration.mark({ class: "cm-highlight-current" });
          return Decoration.set([mark.range(clampedFrom, clampedTo)]);
        } catch {
          return Decoration.none;
        }
      }
    }
    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const highlightTheme = EditorView.baseTheme({
  ".cm-highlight-current": {
    backgroundColor: "rgba(254, 240, 138, 0.6)",
    borderRadius: "2px",
  },
});

export default function CodePane() {
  const code = useAppState((s) => s.code);
  const setCode = useAppState((s) => s.setCode);
  const lastRunCode = useAppState((s) => s.lastRunCode);
  const run = useAppState((s) => s.run);
  
  const currentLoc = useAppState((s) => {
    const { sourceLocs, currentStep } = s;
    return sourceLocs[currentStep] || null;
  });

  const editorRef = useRef<ReactCodeMirrorRef | null>(null);

  useEffect(() => {
    if (editorRef.current?.view) {
      editorRef.current.view.dispatch({
        effects: setHighlight.of(currentLoc),
      });
    }
  }, [currentLoc]);

  const keymapExtension = useMemo(
    () =>
      Prec.high(
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              run();
              return true; // Prevents newline
            },
          },
        ]),
      ),
    [run],
  );

  const extensions = useMemo(
    () => [
      keymapExtension,
      python(),
      indentUnit.of("    "),
      highlightField,
      highlightTheme,
    ],
    [keymapExtension],
  );

  const isDirty = code !== lastRunCode;

  return (
    <div className="h-full w-full relative group">
      <CodeMirror
        ref={editorRef}
        value={code}
        height="100%"
        extensions={extensions}
        indentWithTab={true}
        onChange={(value) => setCode(value)}
        className="h-full text-base font-mono"
      />
      
      {/* Floating Run Button */}
      <div 
        className={cn(
          "absolute bottom-6 left-1/2 -translate-x-1/2 z-10 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          isDirty 
            ? "opacity-100 translate-y-0 scale-100" 
            : "opacity-0 translate-y-10 scale-95 pointer-events-none"
        )}
      >
        <button
          type="button"
          onClick={run}
          className="flex items-center gap-3 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded-full font-bold shadow-2xl shadow-orange-500/40 ring-4 ring-white transition-all whitespace-nowrap"
        >
          <PlayIcon className="size-4 fill-current" />
          <div className="flex items-center gap-2">
            <span>업데이트하기</span>
            <KbdGroup>
            <Kbd className="text-white opacity-70 bg-white/20   border border-white/20">
              {(navigator.userAgent.includes("Mac")) ? "⌘" : "Ctrl"}
            </Kbd>
            <Kbd data-icon="inline-end" className="text-white opacity-70 bg-white/20 border border-white/20">
            ⏎
            </Kbd>
            </KbdGroup>
          </div>
        </button>
      </div>
    </div>
  );
}
