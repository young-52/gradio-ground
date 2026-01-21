const CACHE_NAME = "gradio-lite-packages-v1";
const WHL_REGEX = /\.whl$/;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Cache only .whl files from any origin
  if (WHL_REGEX.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          console.log("[SW] Serving from cache:", url.href);
          return cachedResponse;
        }

        return fetch(event.request).then((response) => {
          // Check if we received a valid response
          if (
            !response ||
            response.status !== 200 ||
            (response.type !== "basic" && response.type !== "cors")
          ) {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            console.log("[SW] Caching new wheel:", url.href);
            cache.put(event.request, responseToCache);
          });

          return response;
        });
      }),
    );
  }
});
