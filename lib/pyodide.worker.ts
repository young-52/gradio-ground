// @ts-nocheck
/// <reference lib="webworker" />

let pyodide: any = null;
let gradioApp: any = null;

self.addEventListener("message", async (event) => {
  const { type, payload, msgId } = event.data;

  try {
    switch (type) {
      case "INIT": {
        self.postMessage({
          type: "PROGRESS",
          msgId,
          payload: "Loading Pyodide runtime...",
        });
        self.importScripts(
          "https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.js",
        );
        pyodide = await self.loadPyodide({
          stdout: (text: string) => {
            console.log("[Pyodide stdout]", text);
            self.postMessage({ type: "PROGRESS", msgId, payload: text });
          },
          stderr: (text: string) => {
            console.error("[Pyodide stderr]", text);
            self.postMessage({
              type: "PROGRESS",
              msgId,
              payload: `ERR: ${text}`,
            });
          },
        });

        self.postMessage({
          type: "PROGRESS",
          msgId,
          payload: "Loading Pyodide standard packages...",
        });
        await pyodide.loadPackage(["ssl", "setuptools"]);

        self.postMessage({
          type: "PROGRESS",
          msgId,
          payload: "Loading micropip...",
        });
        await pyodide.loadPackage("micropip");

        // Monkeypatch micropip & configure mock packages, then install wheels with keep_going=True
        await pyodide.runPythonAsync(`
import micropip.transaction
orig_check = micropip.transaction.Transaction.check_version_satisfied

def workaround_check(self, req):
    try:
        return orig_check(self, req)
    except ValueError as e:
        if "typing-extensions" in str(e) or "huggingface-hub" in str(e) or "pydantic" in str(e):
            print(f"Bypassing version check for {req}")
            return True, "100.0.0"
        raise e

micropip.transaction.Transaction.check_version_satisfied = workaround_check

# Mock ffmpy like @gradio/lite does to prevent hangs
micropip.add_mock_package("ffmpy", "0.3.0")

gradio_wheel = "https://cdn.jsdelivr.net/npm/@gradio/lite@5.45.0/dist/assets/gradio-5.45.0-cp312-none-any.whl"
client_wheel = "https://cdn.jsdelivr.net/npm/@gradio/lite@5.45.0/dist/assets/gradio_client-1.13.0-py3-none-any.whl"

print("Installing Gradio core...")
await micropip.install([gradio_wheel, client_wheel], keep_going=True)

print("Installing openai...")
try:
    await micropip.install(["openai"], keep_going=True)
    print("FINISHED OPENAI")
except Exception as e:
    print(f"ERROR during openai install: {e}")

print("Installing fastapi...")
try:
    await micropip.install(["fastapi"], keep_going=True)
    print("FINISHED FASTAPI")
except Exception as e:
    print(f"ERROR during fastapi install: {e}")
        `);

        console.log("[Pyodide Worker] Sending INIT_DONE");
        self.postMessage({ type: "INIT_DONE", msgId });
        break;
      }
      case "RUN_CODE": {
        const { code } = payload;
        // Clean up previous app if needed
        gradioApp = null;
        await pyodide.runPythonAsync(code);
        gradioApp = pyodide.runPython(
          "demo.app if 'demo' in globals() else None",
        );
        if (!gradioApp) {
          throw new Error(
            "Gradio 'demo' instance not found in globals. Please define 'demo = gr.Blocks()'.",
          );
        }
        self.postMessage({ type: "RUN_DONE", msgId });
        break;
      }
      case "HTTP_REQUEST": {
        // We'll implement the ASGI bridge forward logic here later.
        // For now, just echo success if gradioApp exists.
        if (!gradioApp) {
          throw new Error("Gradio app not running");
        }
        self.postMessage({
          type: "HTTP_RESPONSE",
          msgId,
          payload: { status: 200, body: "ASGI not fully implemented yet" },
        });
        break;
      }
      default:
        console.warn(`[Pyodide Worker] Unknown message type: ${type}`);
    }
  } catch (error: any) {
    console.error(`[Pyodide Worker] Error in ${type}:`, error);
    self.postMessage({
      type: "ERROR",
      msgId,
      error: error.message || String(error),
    });
  }
});
