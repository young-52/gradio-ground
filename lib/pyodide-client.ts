export class PyodideClient {
  private worker: Worker;
  private messageIdCounter = 0;
  private pendingPromises = new Map<
    number,
    {
      resolve: (val: any) => void;
      reject: (err: any) => void;
      onProgress?: (msg: string) => void;
      onHttpStart?: (payload: any) => void;
      onHttpChunk?: (payload: any) => void;
      onHttpEnd?: () => void;
    }
  >();

  constructor() {
    this.worker = new Worker(new URL("./pyodide.worker.ts", import.meta.url), {
      type: "module",
    });

    this.worker.addEventListener("message", (event) => {
      // console.log("[PyodideClient] Received message:", event.data);
      const { type, msgId, payload, error } = event.data;
      const promise = this.pendingPromises.get(msgId);

      if (promise) {
        if (type === "ERROR") {
          promise.reject(new Error(error));
          this.pendingPromises.delete(msgId);
        } else if (type === "PROGRESS") {
          if (promise.onProgress) {
            promise.onProgress(payload);
          }
        } else if (type === "HTTP_RESPONSE_START") {
          promise.onHttpStart?.(payload);
        } else if (type === "HTTP_RESPONSE_CHUNK") {
          promise.onHttpChunk?.(payload);
        } else if (type === "HTTP_RESPONSE_END") {
          promise.onHttpEnd?.();
        } else {
          promise.resolve(payload);
          this.pendingPromises.delete(msgId);
        }
      } else {
        // Handle unprompted messages or broadcasts
      }
    });
  }

  private postMessageAsync(type: string, payload?: any): Promise<any> {
    const msgId = ++this.messageIdCounter;
    return new Promise((resolve, reject) => {
      this.pendingPromises.set(msgId, { resolve, reject });
      this.worker.postMessage({ type, payload, msgId });
    });
  }

  public async initWorker(
    onProgress?: (progress: string) => void,
  ): Promise<void> {
    const msgId = ++this.messageIdCounter;
    return new Promise((resolve, reject) => {
      this.pendingPromises.set(msgId, { resolve, reject, onProgress });
      this.worker.postMessage({ type: "INIT", msgId });
    });
  }

  public async runCode(code: string): Promise<void> {
    await this.postMessageAsync("RUN_CODE", { code });
  }

  public async forwardHttpRequest(requestData: any): Promise<any> {
    const msgId = ++this.messageIdCounter;
    return new Promise((resolve, reject) => {
      let streamController: ReadableStreamDefaultController | null = null;
      let stream: ReadableStream | null = null;

      this.pendingPromises.set(msgId, {
        resolve: () => {}, // unused
        reject,
        onHttpStart: (payload) => {
          stream = new ReadableStream({
            start(controller) {
              streamController = controller;
            },
          });
          resolve({
            status: payload.status,
            headers: payload.headers,
            body: stream,
          });
        },
        onHttpChunk: (payload) => {
          if (streamController) {
            streamController.enqueue(payload.body);
          }
        },
        onHttpEnd: () => {
          if (streamController) {
            streamController.close();
          }
          this.pendingPromises.delete(msgId);
        },
      });

      this.worker.postMessage({ type: "HTTP_REQUEST", payload: requestData, msgId });
    });
  }

  public terminate() {
    this.worker.terminate();
  }
}

// Singleton pattern for the browser context
let pyodideClientInstance: PyodideClient | null = null;
export function getPyodideClient(): PyodideClient {
  if (typeof window === "undefined") {
    throw new Error("getPyodideClient can only be called in the browser");
  }
  if (!pyodideClientInstance) {
    pyodideClientInstance = new PyodideClient();
  }
  return pyodideClientInstance;
}
