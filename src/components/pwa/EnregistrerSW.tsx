"use client";

import { useEffect } from "react";

/** Enregistre le service worker (nécessaire pour l'installation sur l'écran d'accueil). */
export function EnregistrerSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
