"use client";

import { useEffect, useState } from "react";
import { useAppState } from "@/store/use-app-state";

export default function VizPane() {
  const { code } = useAppState();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex w-full h-full items-center justify-center">
        <div className="text-muted-foreground animate-pulse">Loading preview...</div>
      </div>
    );
  }

  return (
    <div className="flex w-full h-full items-center justify-center">
      <gradio-lite>
        <gradio-requirements>
          {/* TODO: Support external requirements */}
        </gradio-requirements>
        <gradio-file name="app.py" entrypoint>
          {code}
        </gradio-file>
      </gradio-lite>
    </div>
  );
}
