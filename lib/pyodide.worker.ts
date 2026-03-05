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
        await pyodide.loadPackage(["ssl", "setuptools", "httpcore"]);

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

import sys
class MockFFmpy:
    class FFmpeg:
        def __init__(self, *args, **kwargs): pass
        def run(self, *args, **kwargs): pass
        def run_async(self, *args, **kwargs): pass

sys.modules["ffmpy"] = MockFFmpy()
micropip.add_mock_package("ffmpy", "0.3.0")

print("Installing Gradio core...")
await micropip.install(["click", "gradio"], keep_going=True)

print("Installing filelock...")
try:
    await micropip.install(["filelock"], keep_going=True)
    print("FINISHED FILELOCK")
except Exception as e:
    print(f"ERROR during filelock install: {e}")

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

# Monkeypatch filelock for huggingface_hub
try:
    import filelock
    if not hasattr(filelock, "BaseFileLock"):
        filelock.BaseFileLock = filelock.SoftFileLock
    if not hasattr(filelock, "FileLock"):
        filelock.FileLock = filelock.SoftFileLock
    print("FINISHED FILELOCK PATCHING")
except Exception as e:
    print(f"ERROR during filelock patching: {e}")

# Monkeypatch anyio to prevent threading errors in fastapi
try:
    import anyio.to_thread
    import asyncio
    async def run_sync_mock(func, *args, cancellable=False, limiter=None):
        return func(*args)
    anyio.to_thread.run_sync = run_sync_mock
    print("FINISHED ANYIO PATCHING")
except Exception as e:
    print(f"ERROR during anyio patching: {e}")

# Monkeypatch click.Choice to be subscriptable for typer
try:
    import click
    if not hasattr(click.Choice, "__class_getitem__"):
        click.Choice.__class_getitem__ = classmethod(lambda cls, item: cls)
    print("FINISHED CLICK PATCHING")
except Exception as e:
    print(f"ERROR during click patching: {e}")

# Monkeypatch threading for gradio
try:
    import threading
    def dummy_start(self):
        print("Mock thread start")
        # In a browser, we cannot block, but gradio tries to run background tasks
        # Let's try to just bypass the start
    threading.Thread.start = dummy_start
    print("FINISHED THREAD PATCHING")
except Exception as e:
    print(f"ERROR during thread patching: {e}")

# Monkeypatch starlette FileResponse to bypass anyio threading deadlocks on large files
try:
    import starlette.responses
    import os
    import stat
    
    async def mock_file_response_call(self, scope, receive, send):
        import js
        js.console.log(f"[FileResponse] serving {self.path}")
        if self.stat_result is None:
            try:
                stat_result = os.stat(self.path)
                self.set_stat_headers(stat_result)
            except FileNotFoundError:
                raise RuntimeError(f"File at path {self.path} does not exist.")
            else:
                mode = stat_result.st_mode
                if not stat.S_ISREG(mode):
                    raise RuntimeError(f"File at path {self.path} is not a file.")
                    
        await send({
            "type": "http.response.start",
            "status": self.status_code,
            "headers": self.raw_headers,
        })
        
        # Read the file synchronously! Bypasses anyio thread starvation in Pyodide
        js.console.log(f"[FileResponse] start reading {self.path}")
        with open(self.path, "rb") as f:
            chunk = f.read(65536)
            while chunk:
                next_chunk = f.read(65536)
                await send({
                    "type": "http.response.body",
                    "body": chunk,
                    "more_body": bool(next_chunk),
                })
                chunk = next_chunk
        js.console.log(f"[FileResponse] finished reading {self.path}")
        if self.background is not None:
            await self.background()

    starlette.responses.FileResponse.__call__ = mock_file_response_call
    print("FINISHED STARLETTE FILERESPONSE PATCHING")
except Exception as e:
    print(f"ERROR during starlette FileResponse patching: {e}")

# Monkeypatch multiprocessing for gradio and uvicorn
try:
    import sys
    import types
    from unittest.mock import MagicMock
    
    if "multiprocessing" not in sys.modules:
        # Create fake package
        mp_pkg = types.ModuleType("multiprocessing")
        mp_pkg.__path__ = [] # Marks it as a package
        mp_pkg.Lock = lambda: MagicMock()
        mp_pkg.allow_connection_pickling = lambda: None
        mp_pkg.Pipe = lambda *args, **kwargs: (MagicMock(), MagicMock())
        
        # Create fake context submodule
        ctx_mod = types.ModuleType("multiprocessing.context")
        ctx_mod.Lock = lambda: MagicMock()
        ctx_mod.SpawnProcess = MagicMock()
        
        # Wire them up
        mp_pkg.context = ctx_mod
        mp_pkg.get_context = lambda method=None: ctx_mod
        
        # Inject into sys.modules
        sys.modules["multiprocessing"] = mp_pkg
        sys.modules["multiprocessing.context"] = ctx_mod
        
    print("FINISHED MULTIPROCESSING PATCHING")
except Exception as e:
    print(f"ERROR during multiprocessing patching: {e}")

# Monkeypatch socket for gradio
try:
    import socket
    if not hasattr(socket, "SO_REUSEADDR"):
        socket.SO_REUSEADDR = 2
    if not hasattr(socket, "SOL_SOCKET"):
        socket.SOL_SOCKET = 1
        
    # Pyodide sockets don't work for binding, so mock bind
    _original_socket = socket.socket
    class MockSocket(_original_socket):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._bound_port = None
            
        def bind(self, address, *args, **kwargs):
            self._bound_port = address[1]
            
        def getsockname(self):
            return ("127.0.0.1", self._bound_port or 7860)
            
        def listen(self, *args, **kwargs):
            pass
            
        def setsockopt(self, *args, **kwargs):
            pass
            
        def close(self):
            pass
            
    socket.socket = MockSocket
    
    print("FINISHED SOCKET PATCHING")
except Exception as e:
    print(f"ERROR during socket patching: {e}")

# Monkeypatch gradio launch to prevent thread lock
try:
    import gradio
    _orig_launch = gradio.Blocks.launch
    def pyodide_launch(self, *args, **kwargs):
        kwargs["prevent_thread_lock"] = True
        return _orig_launch(self, *args, **kwargs)
    gradio.Blocks.launch = pyodide_launch
    print("FINISHED GRADIO LAUNCH PATCHING")
except Exception as e:
    print(f"ERROR during gradio launch patching: {e}")

# Monkeypatch gradio.http_server.start_server to avoid Uvicorn completely
try:
    import gradio.http_server
    from unittest.mock import MagicMock
    def mock_start_server(*args, **kwargs):
        # Return signature: server_name, port, path_to_local_server, server
        return "127.0.0.1", 7860, "http://127.0.0.1:7860/", MagicMock()
    gradio.http_server.start_server = mock_start_server
    print("FINISHED HTTP SERVER PATCHING")
except Exception as e:
    print(f"ERROR during http server patching: {e}")

# Monkeypatch httpx for pyodide jsfetch timeout bug and local ping
try:
    import httpx._transports.jsfetch
    import httpx
    
    _orig_run_sync_with_timeout = httpx._transports.jsfetch._run_sync_with_timeout
    def patched_run_sync_with_timeout(*args, **kwargs):
        new_args = list(args)
        if len(new_args) >= 2 and new_args[1] is None:
            new_args[1] = 0
        if "timeout" in kwargs and kwargs["timeout"] is None:
            kwargs["timeout"] = 0
        return _orig_run_sync_with_timeout(*new_args, **kwargs)
    httpx._transports.jsfetch._run_sync_with_timeout = patched_run_sync_with_timeout
    
    _orig_client_send = httpx.Client.send
    def patched_client_send(self, request, *args, **kwargs):
        if "127.0.0.1:7860" in str(request.url):
            return httpx.Response(200, request=request, content=b"OK")
        return _orig_client_send(self, request, *args, **kwargs)
    httpx.Client.send = patched_client_send
    
    print("FINISHED HTTPX PATCHING")
except Exception as e:
    print(f"ERROR during httpx patching: {e}")

import asyncio
import traceback
import js

async def handle_asgi_request(req_id, method, path, query_string, headers_obj, body_bytes, channels):
    try:
        js.console.log(f"[ASGI] Start processing scope path: {path}")
        headers = [(str(k).encode('utf-8'), str(v).encode('utf-8')) for k, v in headers_obj]
        
        scope = {
            "type": "http",
            "asgi": {"version": "3.0", "spec_version": "2.1"},
            "http_version": "1.1",
            "method": method,
            "scheme": "http",
            "path": path,
            "raw_path": path.encode("utf-8"),
            "query_string": query_string.encode('utf-8'),
            "headers": headers,
            "client": ("127.0.0.1", 12345),
            "server": ("gradio.local", 80),
        }

        async def receive():
            return {
                "type": "http.request",
                "body": bytes(body_bytes),
                "more_body": False
            }

        async def send(message):
            if message["type"] == "http.response.start":
                response_status = message["status"]
                response_headers = []
                for k, v in message.get("headers", []):
                    try:
                        k_str = k.decode("utf-8") if isinstance(k, bytes) else str(k)
                        v_str = v.decode("utf-8") if isinstance(v, bytes) else str(v)
                        response_headers.append([k_str, v_str])
                    except:
                        pass
                channels.send_start(response_status, response_headers)
                        
            elif message["type"] == "http.response.body":
                body_chunk = message.get("body", b"")
                if body_chunk:
                    channels.send_body(body_chunk)
                    
        app = globals().get("demo").app
        await app(scope, receive, send)
        js.console.log(f"[ASGI] App returned successfully for {path}")
    except Exception as e:
        err_msg = f"[ASGI Error for {path}] " + traceback.format_exc()
        js.console.error(err_msg)
    finally:
        channels.send_end()

def dispatch_asgi_request(req_id, method, path, query_string, headers_obj, body_bytes, channels):
    asyncio.create_task(handle_asgi_request(req_id, method, path, query_string, headers_obj, body_bytes, channels))

js.dispatch_asgi_request = dispatch_asgi_request
        `);

        console.log("[Pyodide Worker] Sending INIT_DONE");
        self.postMessage({ type: "INIT_DONE", msgId });
        break;
      }
      case "RUN_CODE": {
        if (!pyodide) {
          throw new Error("Pyodide is not fully initialized yet. Please wait.");
        }
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
        const { url, method, headers, body } = payload;
        if (!gradioApp) {
          throw new Error("Gradio app not running");
        }

        // Parse URL
        const pUrl = new URL(url);
        const path = pUrl.pathname;
        const query_string = pUrl.search.replace(/^\?/, "");

        // Convert JS headers to ASGI format (List[Tuple[bytes, bytes]])
        const asgiHeaders = [];
        let hasHost = false;
        for (const [key, value] of Object.entries(headers || {})) {
          const lKey = key.toLowerCase();
          asgiHeaders.push([lKey, String(value)]);
          if (lKey === "host") {
            hasHost = true;
          }
        }
        if (!hasHost) {
          asgiHeaders.push(["host", pUrl.host || "127.0.0.1:7860"]);
        }

        // Attach JS variables to Python context temporarily
        self.__asgi_reqs = self.__asgi_reqs || {};
        const py_body = body ? new Uint8Array(body) : new Uint8Array();

        const channels = {
          send_start: (status: number, headers_array: any) => {
            try {
              const jsHeaders: Record<string, string> = {};
              for (const item of headers_array) {
                jsHeaders[item[0]] = item[1];
              }
              console.log(
                `[Pyodide Worker] Sending RESPONSE_START for ${url} (Status: ${status})`,
              );
              self.postMessage({
                type: "HTTP_RESPONSE_START",
                msgId,
                payload: { status, headers: jsHeaders },
              });
            } catch (e) {
              console.error(
                `[Pyodide Worker] Error in send_start for ${url}`,
                e,
              );
            }
          },
          send_body: (chunk: any) => {
            try {
              let copy: Uint8Array;
              if (chunk?.toJs) {
                const buf = chunk.toJs();
                copy = new Uint8Array(buf);
                chunk.destroy(); // Free the PyBuffer
              } else {
                copy = new Uint8Array(chunk);
              }
              self.postMessage(
                {
                  type: "HTTP_RESPONSE_CHUNK",
                  msgId,
                  payload: { body: copy },
                },
                [copy.buffer],
              );
            } catch (e) {
              console.error(
                `[Pyodide Worker] Error in send_body for ${url}`,
                e,
              );
            }
          },
          send_end: () => {
            console.log(`[Pyodide Worker] Sending RESPONSE_END for ${url}`);
            self.postMessage({
              type: "HTTP_RESPONSE_END",
              msgId,
            });
            delete self.__asgi_reqs[msgId];
          },
        };

        self.__asgi_reqs[msgId] = {
          method,
          path,
          query_string,
          headers: asgiHeaders,
          channels,
        };

        // Dispatch directly to the Python event loop without parsing overhead!
        try {
          self.dispatch_asgi_request(
            String(msgId),
            method,
            path,
            query_string,
            asgiHeaders,
            py_body,
            channels,
          );
        } catch (e) {
          console.error(
            `[Pyodide Worker] Error dispatching request for ${url}:`,
            e,
          );
          self.postMessage({ type: "ERROR", msgId, error: String(e) });
        }

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
