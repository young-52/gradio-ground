"use client";

import { useEffect, useRef, useState } from "react";
import { useAppState } from "@/store/use-app-state";

export default function VizPane() {
  const { code, runCount } = useAppState();
  const [mounted, setMounted] = useState(false);
  const gradioRef = useRef<any>(null);
  const codeRef = useRef(code);
  const [initialCode] = useState(code);

  // Keep codeRef in sync with the latest code state
  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  useEffect(() => {
    console.info("[VizPane] Mounted");
    setMounted(true);
    return () => console.info("[VizPane] Unmounted");
  }, []);

  // Update code without remounting the entire worker
  useEffect(() => {
    if (mounted && gradioRef.current && runCount > 0) {
      console.info("[VizPane] runCount changed:", runCount);
      // Try calling run_code on the element or its controller
      if (typeof gradioRef.current.run_code === "function") {
        console.info("[VizPane] Calling element.run_code()");
        gradioRef.current.run_code(codeRef.current);
      } else if (
        gradioRef.current.controller &&
        typeof gradioRef.current.controller.run_code === "function"
      ) {
        console.info("[VizPane] Calling element.controller.run_code()");
        gradioRef.current.controller.run_code(codeRef.current);
      } else {
        console.warn(
          "[VizPane] Could not find run_code method. This might cause the worker to not update.",
        );
      }
    }
  }, [runCount, mounted]);

  if (!mounted) {
    return (
      <div className="w-full h-full">
        <div className="flex items-center justify-center">
          <div className="text-muted-foreground animate-pulse">
            Loading preview...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <gradio-lite ref={gradioRef}>
        <gradio-requirements>
          {/* TODO: Support external requirements */}
        </gradio-requirements>
        <gradio-file name="app.py" entrypoint>
          {initialCode}
        </gradio-file>
      </gradio-lite>
    </div>
  );
}
