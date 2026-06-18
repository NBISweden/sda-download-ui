"use client";

import { useEffect } from "react";

// Check every 20 days at most to check if the session has expired, and reload if so.
// This is a workaround to the 32-bit timeout limitation in html spec.
const MAX_DELAY = 20 * 24 * 60 * 60 * 1000; // 20 days in ms

export function SessionExpiryWatcher({ expiresAt }: { expiresAt: number }) {
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;

    const schedule = () => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        location.reload();
        return;
      }
      const delay = Math.min(remaining + 1000, MAX_DELAY);
      timerId = setTimeout(schedule, delay);
    };

    schedule();
    return () => clearTimeout(timerId);
  }, [expiresAt]);

  return null;
}
