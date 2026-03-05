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

  // Intercept requests directed to the virtual local endpoint
  if (url.hostname === "gradio.local") {
    event.respondWith(handleGradioRequest(event.request));
  }
});

async function handleGradioRequest(request) {
  const clientsList = await self.clients.matchAll({
    includeUncontrolled: true,
    type: "window",
  });

  if (clientsList.length === 0) {
    return new Response("No active window clients found to handle request", {
      status: 503,
    });
  }

  // Pick the first client (in real apps, you might route by client id)
  const client = clientsList[0];

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

    const requestData = {
      type: "GRADIO_FETCH",
      url: request.url,
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
