"use client";

import { useEffect } from "react";

export default function SWRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("[SW] Registered with scope:", registration.scope);
          })
          .catch((error) => {
            console.error("[SW] Registration failed:", error);
          });
      });
    }
  }, []);

  return null;
}
