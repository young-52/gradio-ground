"use client";

import { useAppState } from "@/store/use-app-state";

export default function VizPane() {
  const { runCount } = useAppState();

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
      <div className="max-w-md space-y-4">
        <h3 className="text-xl font-semibold">Custom Wasm Bridge 🚀</h3>
        <p className="text-muted-foreground">
          Future home of the custom Pyodide 0.27.5+ Web Worker execution
          environment.
        </p>
        <div className="text-sm border rounded p-4 bg-muted/50 text-left overflow-x-auto">
          <p className="text-xs text-muted-foreground uppercase mb-2 tracking-wider font-semibold">
            Current State
          </p>
          <pre className="text-xs whitespace-pre-wrap font-mono">
            {`Run Count: ${runCount}`}
          </pre>
        </div>
      </div>
    </div>
  );
}
