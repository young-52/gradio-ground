// @ts-nocheck
/* eslint-disable no-restricted-globals */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Define paths that belong to the local Gradio server
  const isGradioRoute =
    url.pathname.startsWith("/_gradio_local/") ||
    url.pathname === "/_gradio_local" ||
    url.pathname.startsWith("/assets/") ||
    url.pathname === "/theme.css" ||
    url.pathname === "/info";

  if (isGradioRoute) {
    // Intercept and route to Pyodide
    event.respondWith(handleGradioRequest(event.request));
  }
});

async function handleGradioRequest(request) {
  const clientsList = await self.clients.matchAll({
    includeUncontrolled: true,
    type: "window",
  });

  if (clientsList.length === 0) {
    console.error("[SW] No active window clients found to handle request");
    return new Response("No active window clients found to handle request", {
      status: 503,
    });
  }

  // Find the Next.js host client (the top-level window, not the iframe)
  let client = clientsList.find((c) => c.frameType === "top-level");
  if (!client) {
    client = clientsList[0];
  }

  console.log(
    `[SW] Intercepting request to ${request.url}, routing to client: ${client.url}`,
  );

  return new Promise((resolve) => {
    const messageChannel = new MessageChannel();

    messageChannel.port1.onmessage = (event) => {
      if (!event.data) {
        resolve(new Response("Empty response from Worker", { status: 500 }));
        return;
      }

      const { status, headers, body } = event.data;

      resolve(
        new Response(body, {
          status: status || 200,
          headers: new Headers(headers || {}),
        }),
      );
    };

    // Re-write URL so Python ASGI app sees it as root (/)
    let reqUrl = new URL(request.url);
    reqUrl.pathname = reqUrl.pathname.replace(/^\/_gradio_local/, "") || "/";

    const requestData = {
      type: "GRADIO_FETCH",
      url: reqUrl.toString(),
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: null,
    };

    if (["POST", "PUT", "PATCH"].includes(request.method)) {
      request
        .arrayBuffer()
        .then((buffer) => {
          requestData.body = buffer;
          client.postMessage(requestData, [
            messageChannel.port2,
            buffer.slice(0),
          ]); // Transfer buffer (need clone depending on setup)
        })
        .catch((err) => {
          resolve(
            new Response(`Failed to read request body: ${err.message}`, {
              status: 500,
            }),
          );
        });
    } else {
      client.postMessage(requestData, [messageChannel.port2]);
    }
  });
}
