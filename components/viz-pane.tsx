"use client";

import { useEffect, useState } from "react";
import { getPyodideClient } from "@/lib/pyodide-client";
import { useAppState } from "@/store/use-app-state";

export default function VizPane() {
  const {
    code,
    runCount,
    pyodideStatus,
    pyodideProgress,
    pyodideError,
    setPyodideStatus,
    setPyodideProgress,
    setPyodideError,
  } = useAppState();
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);

  // Initialize Worker
  useEffect(() => {
    const init = async () => {
      if (pyodideStatus !== "idle") return;

      setPyodideStatus("loading");
      try {
        const client = getPyodideClient();
        await client.initWorker((msg) => {
          setPyodideProgress(msg);
        });
        setPyodideStatus("ready");
      } catch (err: any) {
        setPyodideStatus("error");
        setPyodideError(err.message || String(err));
      }
    };
    init();
  }, [pyodideStatus, setPyodideStatus, setPyodideProgress, setPyodideError]);

  // Run Code
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      // Use the actual current state to avoid dependency loops
      const currentStatus = useAppState.getState().pyodideStatus;
      
      if (
        runCount === 0 ||
        currentStatus === "loading" ||
        currentStatus === "idle"
      )
        return;

      setPyodideStatus("running");
      setPyodideError(null);
      setIframeSrc(null); // Force reload iframe content

      try {
        const client = getPyodideClient();
        const currentCode = useAppState.getState().code;
        await client.runCode(currentCode);
        if (mounted) {
          setPyodideStatus("ready");
          // Add a cache buster so iframe reloads
          setIframeSrc(`/_gradio_local/?t=${Date.now()}`);
        }
      } catch (err: any) {
        if (mounted) {
          setPyodideStatus("error");
          setPyodideError(err.message || String(err));
        }
      }
    };
    run();

    return () => {
      mounted = false;
    };
  }, [runCount, setPyodideStatus, setPyodideError]); // Run only on runCount changes

  // Forward Fetch Requests from Service Worker
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === "GRADIO_FETCH") {
        console.log("[VizPane] Received GRADIO_FETCH for:", event.data.url);
        const client = getPyodideClient();
        const port = event.ports[0];
        try {
          // Send request down to worker
          const response = await client.forwardHttpRequest(event.data);
          console.log("[VizPane] Got HTTP_RESPONSE for:", event.data.url, "Status:", response.status);
          port.postMessage(response, response.body ? [response.body] : []);
        } catch (err: any) {
          console.error("[VizPane] Error forwarding request:", err);
          port.postMessage({
            status: 500,
            body: `Error forwarding: ${String(err)}`,
          });
        }
      }
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleMessage as any);
    }
    return () => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handleMessage as any);
      }
    };
  }, []);  if (pyodideStatus === "loading") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4">
        <div className="text-muted-foreground animate-pulse mb-2">
          Loading Pyodide Worker (0.27.5+)...
        </div>
        <div className="text-sm text-muted-foreground/80">
          {pyodideProgress}
        </div>
      </div>
    );
  }

  if (pyodideStatus === "error") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4">
        <div className="text-destructive font-semibold mb-2">Error</div>
        <pre className="text-sm bg-destructive/10 text-destructive p-4 rounded max-w-full overflow-auto">
          {pyodideError}
        </pre>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative flex flex-col">
      {pyodideStatus === "running" && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10 backdrop-blur-sm">
          <div className="text-muted-foreground font-medium animate-pulse">
            Running code...
          </div>
        </div>
      )}

      {iframeSrc ? (
        <iframe
          src={iframeSrc}
          className="w-full h-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title="Gradio Playground"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-center p-4">
          <div className="max-w-md space-y-4">
            <h3 className="text-xl font-semibold">Custom Wasm Bridge 🚀</h3>
            <p className="text-muted-foreground">
              Pyodide is {pyodideStatus}. Click "Run" to test your Gradio app.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
