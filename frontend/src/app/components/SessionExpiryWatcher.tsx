"use client";

import { useEffect } from "react";

export function SessionExpiryWatcher({ expiresAt }: { expiresAt: number }) {
  useEffect(() => {
    const ms = expiresAt - Date.now();
    if (ms <= 0) {
      location.reload();
      return;
    }
    const id = setTimeout(() => location.reload(), ms + 1000);
    return () => clearTimeout(id);
  }, [expiresAt]);

  return null;
}
