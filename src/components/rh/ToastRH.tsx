"use client";

import { useEffect } from "react";

export function ToastRH({ message, effacer, duree = 3000 }: { message: string | null; effacer: () => void; duree?: number }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(effacer, duree);
    return () => clearTimeout(t);
  }, [message, effacer, duree]);
  if (!message) return null;
  return (
    <div className="rh-toast" role="status">
      {message}
    </div>
  );
}
