"use client";

import { python } from "@codemirror/lang-python";
import { Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { indentUnit } from "@codemirror/language";
import { PlayIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppState } from "@/store/use-app-state";
import { cn } from "@/lib/utils";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useTheme } from "next-themes";
import { githubLight, githubDark } from "@uiw/codemirror-theme-github";

export default function CodePane() {
  const code = useAppState((s) => s.code);
  const setCode = useAppState((s) => s.setCode);
  const lastRunCode = useAppState((s) => s.lastRunCode);
  const run = useAppState((s) => s.run);
  const { resolvedTheme } = useTheme();

  const editorRef = useRef<ReactCodeMirrorRef | null>(null);

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

  const editorTheme = useMemo(() => {
    return [
      resolvedTheme === "dark" ? githubDark : githubLight,
      EditorView.theme({
        "&": {
          backgroundColor: "transparent !important",
          height: "100%",
        },
        ".cm-gutters": {
          backgroundColor: "transparent !important",
          border: "none",
        },
      }),
    ];
  }, [resolvedTheme]);

  const extensions = useMemo(
    () => [
      keymapExtension,
      python(),
      indentUnit.of("    "),
      ...editorTheme,
    ],
    [keymapExtension, editorTheme],
  );

  const isDirty = code !== lastRunCode;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const isMac = mounted && typeof navigator !== "undefined" && navigator.userAgent.includes("Mac");

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
          className="flex items-center gap-3 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded-full font-bold shadow-2xl shadow-orange-500/40 transition-all whitespace-nowrap"
        >
          <PlayIcon className="size-4 fill-current" />
          <div className="flex items-center gap-2">
            <span>업데이트하기</span>
            <KbdGroup>
            <Kbd className="text-white opacity-70 bg-white/20   border border-white/20">
              {isMac ? "⌘" : "Ctrl"}
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
