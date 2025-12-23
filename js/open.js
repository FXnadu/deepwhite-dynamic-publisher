function _wm() {
  if (typeof window !== 'undefined' && window.windowManager) return window.windowManager;
  if (typeof self !== 'undefined' && self.windowManager) return self.windowManager;
  return null;
}

let opening = false;
export async function safeOpenEditor(){
  if(opening) return;
  opening = true;
  try{
    const mgr = _wm();
    if (mgr && (await mgr.focusExisting())) return;
    const createData = mgr ? await mgr.computeCreateData() : null;
    try {
      const win = await chrome.windows.create(createData);
      if (win?.id == null) throw new Error("windows.create returned no id");
      const mgr2 = _wm();
      if (mgr2 && typeof mgr2.setStoredWinId === 'function') await mgr2.setStoredWinId(win.id);
      try {
        const info = await chrome.windows.get(win.id);
        const mgr3 = _wm();
        if (mgr3 && typeof mgr3.saveBounds === 'function') await mgr3.saveBounds({ left: info.left, top: info.top, width: info.width, height: info.height });
      } catch (e) { /* ignore */ }
    } catch (err) {
      // Fallback to tab, but defensively validate URL first.
      try {
        const url = chrome.runtime.getURL("editor.html");
        if (typeof url === "string" && url.length > 0 && url.includes("editor.html")) {
          try {
            await chrome.tabs.create({ url });
          } catch (tabErr) {
            try { console.error("dw-open: fallback tabs.create failed", tabErr); } catch (e) { /* noop */ }
          }
        } else {
          try { console.error("dw-open: invalid fallback URL for editor, skipping tabs.create", url); } catch (e) { /* noop */ }
        }
      } catch (tabErr) {
        // swallow to avoid noisy failures in callers
      }
    }
  } finally {
    opening = false;
  }
}


