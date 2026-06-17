/** Best-effort landscape lock for mobile / Android — works in browsers too
 *  when the document is fullscreen. Silently no-ops on unsupported platforms. */
export async function lockLandscape(target?: HTMLElement) {
  try {
    const el = target || document.documentElement;
    const so: any = (screen as any).orientation;
    // Requesting fullscreen unlocks the orientation lock API in most browsers.
    if (!document.fullscreenElement && el.requestFullscreen) {
      try { await el.requestFullscreen({ navigationUI: "hide" } as any); } catch {}
    }
    if (so && typeof so.lock === "function") {
      try { await so.lock("landscape"); } catch {}
    }
  } catch {}
}

export async function unlockOrientation() {
  try {
    const so: any = (screen as any).orientation;
    if (so && typeof so.unlock === "function") so.unlock();
    if (document.fullscreenElement && document.exitFullscreen) {
      try { await document.exitFullscreen(); } catch {}
    }
  } catch {}
}
