"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";

// Folder downloads run in the browser tab and stop as soon as the page is left, so the
// user is warned first. How to resume is explained here rather than in the progress
// modal's own description, so that it is read at the moment the download is about to
// stop rather than while it is running.
const LEAVE_WARNING_TITLE = "Leave this page and stop the download?";
const LEAVE_WARNING_BODY =
  "The files you selected are still being downloaded to your folder, and leaving this page stops the download. To resume it later, start the download again and select the same folder.";
const LEAVE_WARNING_STAY_LABEL = "Stay on this page";
const LEAVE_WARNING_LEAVE_LABEL = "Stop the download and leave";

// Marks the extra history entry the guard pushes, so that it can be recognised later.
const HISTORY_GUARD_KEY = "sdaDownloadGuardEntry";

type StopDownload = () => void;

/**
 * The pending warning. The guard never renders it itself: it is handed to the component
 * showing the dialog for the running download, which asks the question in there instead
 * of stacking a second dialog on top.
 */
export type DownloadGuardWarning = {
  title: string;
  body: string;
  stayLabel: string;
  leaveLabel: string;
  onStay: () => void;
  onLeave: () => void;
};

type DownloadGuardValue = {
  warning: DownloadGuardWarning | null;

  registerDownload: (stopDownload: StopDownload) => () => void;

  // Asks the guard whether a navigation may happen. Returns true when the caller can
  // navigate right away. Returns false when a download is running: the guard then shows
  // the warning and runs `proceed` only if the user chooses to leave.
  requestNavigation: (proceed: () => void) => boolean;
};

const DownloadGuardContext = createContext<DownloadGuardValue | null>(null);

export function useDownloadGuard(): DownloadGuardValue {
  const guard = useContext(DownloadGuardContext);

  if (!guard) {
    throw new Error(
      "useDownloadGuard must be used inside a DownloadGuardProvider.",
    );
  }

  return guard;
}

/**
 * Warns before an in-progress folder download is interrupted.
 *
 * Reloading, closing the tab and leaving the site are caught with `beforeunload`, which
 * shows the browser's own generic prompt. Navigation inside the app never reaches
 * `beforeunload`, so links go through `requestNavigation` (see `GuardedLink`) and the
 * browser Back button is caught through an extra history entry. Those cases show the
 * warning dialog below.
 */
export function DownloadGuardProvider({ children }: { children: ReactNode }) {
  const stopHandlersRef = useRef<Set<StopDownload>>(new Set());
  const pendingNavigationRef = useRef<(() => void) | null>(null);

  // Set once the user has chosen to leave, so that the navigation they confirmed is not
  // caught by the guard a second time.
  const isLeavingRef = useRef(false);

  const [isDownloadActive, setIsDownloadActive] = useState(false);
  const [isWarningOpen, setIsWarningOpen] = useState(false);

  const registerDownload = useCallback((stopDownload: StopDownload) => {
    // A new download re-arms the guard after a previous "stop and leave", and clears a
    // warning left behind by a download that ended while it was on screen.
    isLeavingRef.current = false;
    pendingNavigationRef.current = null;
    setIsWarningOpen(false);
    stopHandlersRef.current.add(stopDownload);
    setIsDownloadActive(true);

    return () => {
      stopHandlersRef.current.delete(stopDownload);
      setIsDownloadActive(stopHandlersRef.current.size > 0);
    };
  }, []);

  const requestNavigation = useCallback((proceed: () => void) => {
    if (isLeavingRef.current || stopHandlersRef.current.size === 0) {
      return true;
    }

    pendingNavigationRef.current = proceed;
    setIsWarningOpen(true);

    return false;
  }, []);

  const stayOnPage = useCallback(() => {
    pendingNavigationRef.current = null;
    setIsWarningOpen(false);
  }, []);

  const stopDownloadsAndLeave = useCallback(() => {
    const proceed = pendingNavigationRef.current;

    pendingNavigationRef.current = null;
    setIsWarningOpen(false);
    isLeavingRef.current = true;

    // Stop the downloads before navigating. A client-side navigation unmounts the
    // download UI without ending the transfers, which would leave them running with no
    // way for the user to see or cancel them.
    for (const stopDownload of [...stopHandlersRef.current]) {
      stopDownload();
    }

    proceed?.();
  }, []);

  // Reloads, tab closes and navigation away from the site. Browsers show their own
  // wording here and ignore any message we set.
  useEffect(() => {
    if (!isDownloadActive) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isLeavingRef.current) return;

      event.preventDefault();
      // Needed by browsers that still expect the legacy `returnValue` opt-in.
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDownloadActive]);

  // The Back button is handled by the router as a client-side navigation, so
  // `beforeunload` never fires for it.
  useEffect(() => {
    if (!isDownloadActive) return;

    // With nothing to go back to, Back cannot leave the page by itself. Pushing an entry
    // would hand it a destination the guard is then unable to honour, since the `go(-2)`
    // below would be out of range: the download would stop without the page changing.
    if (!hasBackDestination()) return;

    // Duplicate the current history entry. The first Back press then lands on the page
    // the user is already on, which gives the guard a chance to ask before the app
    // navigates anywhere.
    pushGuardHistoryEntry();

    const handlePopState = () => {
      // The browser has already moved. When the guard declines - nothing left to
      // interrupt, or the user leaving after confirming - that movement has to stand,
      // since pushing mid-unwind would cost an extra Back press.
      if (
        requestNavigation(() => {
          // Skip both the entry pushed below and the duplicate that was popped.
          window.history.go(-2);
        })
      ) {
        return;
      }

      // Put the position back while the warning is shown: one entry popped, one pushed.
      pushGuardHistoryEntry();
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);

      // Drop the duplicate entry once the download is over, so that Back does not need
      // an extra press afterwards. When the user is on their way out the history stack
      // is already being unwound, so it is left alone.
      if (!isLeavingRef.current && window.history.state?.[HISTORY_GUARD_KEY]) {
        window.history.back();
      }
    };
  }, [isDownloadActive, requestNavigation]);

  // The download can finish while the warning is on screen. There is nothing left to
  // interrupt then, so the warning goes away. The action that triggered it is dropped
  // rather than carried out, because the guard is at that point putting the history
  // stack back the way it was, and moving in it twice would overshoot.
  const isWarningVisible = isWarningOpen && isDownloadActive;

  useEffect(() => {
    if (!isWarningVisible) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        stayOnPage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isWarningVisible, stayOnPage]);

  const warning = useMemo<DownloadGuardWarning | null>(
    () =>
      isWarningVisible
        ? {
            title: LEAVE_WARNING_TITLE,
            body: LEAVE_WARNING_BODY,
            stayLabel: LEAVE_WARNING_STAY_LABEL,
            leaveLabel: LEAVE_WARNING_LEAVE_LABEL,
            onStay: stayOnPage,
            onLeave: stopDownloadsAndLeave,
          }
        : null,
    [isWarningVisible, stayOnPage, stopDownloadsAndLeave],
  );

  const guard = useMemo(
    () => ({ warning, registerDownload, requestNavigation }),
    [warning, registerDownload, requestNavigation],
  );

  return (
    <DownloadGuardContext.Provider value={guard}>
      {children}
    </DownloadGuardContext.Provider>
  );
}

/**
 * Registers a running download with the guard for as long as `isDownloadRunning` is
 * true, so that the user is warned before an action that would interrupt it.
 * `stopDownload` is called when the user chooses to leave anyway.
 *
 * Returns the pending warning while one is being shown. The caller must render it,
 * inside the dialog it already shows for the running download: the guard has no dialog
 * of its own, so ignoring it leaves navigation blocked with nothing on screen.
 */
export function useActiveDownloadGuard(
  isDownloadRunning: boolean,
  stopDownload: StopDownload,
): DownloadGuardWarning | null {
  const { warning, registerDownload } = useDownloadGuard();
  const stopDownloadRef = useRef(stopDownload);

  // Keep the latest callback without re-registering the download.
  useEffect(() => {
    stopDownloadRef.current = stopDownload;
  }, [stopDownload]);

  useEffect(() => {
    if (!isDownloadRunning) return;

    return registerDownload(() => stopDownloadRef.current());
  }, [isDownloadRunning, registerDownload]);

  return isDownloadRunning ? warning : null;
}

type GuardedLinkProps = Omit<
  ComponentProps<typeof Link>,
  "href" | "onNavigate"
> & {
  href: string;
};

/**
 * A `next/link` that asks before it interrupts a running folder download, and navigates
 * normally when no download is running. `onNavigate` only fires for client-side
 * navigation, which is exactly the case `beforeunload` cannot cover.
 */
export function GuardedLink({ href, ...linkProps }: GuardedLinkProps) {
  const { requestNavigation } = useDownloadGuard();
  const router = useRouter();

  return (
    <Link
      href={href}
      {...linkProps}
      onNavigate={(event) => {
        if (requestNavigation(() => router.push(href))) return;

        event.preventDefault();
      }}
    />
  );
}

// The Navigation API is Chrome-only, as is the File System Access API this guard exists
// for, so `canGoBack` is available wherever folder downloads are. `history.length` is
// the fallback for the Chrome versions predating it; it cannot tell a first entry with
// forward entries after it from a real destination, which only costs the accuracy this
// check had before.
type WindowWithNavigation = Window & {
  navigation?: { canGoBack?: boolean };
};

function hasBackDestination(): boolean {
  const { navigation } = window as WindowWithNavigation;

  if (typeof navigation?.canGoBack === "boolean") {
    return navigation.canGoBack;
  }

  return window.history.length > 1;
}

function pushGuardHistoryEntry() {
  // Keeps the current URL and the router's own history state, so that popping the entry
  // renders the page the user is already on.
  window.history.pushState(
    { ...window.history.state, [HISTORY_GUARD_KEY]: true },
    "",
  );
}
