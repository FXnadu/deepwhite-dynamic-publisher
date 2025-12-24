function ensureActionHasNoPopup() {
  try {
    chrome.action.setPopup({ popup: "" });
  } catch (e) {
    // noop - some hosts may not support setting popup at SW startup
  }
}

ensureActionHasNoPopup();

chrome.runtime.onInstalled.addListener((details) => {
  ensureActionHasNoPopup();
});

// Load shared window manager (defines `self.windowManager`)
try {
  importScripts('./windowManager.js');
} catch (e) {
  // ignore - if importScripts fails, code below will try to access windowManager safely
}

// Debounce timer to avoid frequent writes during continuous bounds changes
let _dw_bounds_save_timer = null;
const _DW_BOUNDS_DEBOUNCE_MS = 500;

async function focusExisting(){
  try {
    if (typeof self.windowManager === 'object' && typeof self.windowManager.focusExisting === 'function') {
      return await self.windowManager.focusExisting();
    }
    // fallback: perform local logic
    const idObj = await chrome.storage.local.get(['dw_float_id_v1']);
    const id = idObj['dw_float_id_v1'] ?? null;
    if (id == null) return false;
    try {
      const win = await chrome.windows.get(id);
      if (win?.id != null) {
        await chrome.windows.update(win.id, { focused: true });
        return true;
      }
    } catch (e) {
      await chrome.storage.local.remove(['dw_float_id_v1']);
    }
    return false;
  } catch (e) {
    return false;
  }
}

async function computeCreateData(){
  const wm = (typeof self !== 'undefined' && self.windowManager) ? self.windowManager : null;
  const saved = wm && typeof wm.getStoredBounds === 'function'
    ? await wm.getStoredBounds()
    : (await chrome.storage.local.get(['dw_float_bounds_v1']))['dw_float_bounds_v1'] ?? null;
  const width = Number.isFinite(saved?.width) ? saved.width : (wm && wm.DEFAULT_WIDTH ? wm.DEFAULT_WIDTH : 520);
  const height = Number.isFinite(saved?.height) ? saved.height : (wm && wm.DEFAULT_HEIGHT ? wm.DEFAULT_HEIGHT : 680);

  let left = Number.isFinite(saved?.left) ? saved.left : undefined;
  let top = Number.isFinite(saved?.top) ? saved.top : undefined;
  const PAD = (wm && typeof wm.PAD === 'number') ? wm.PAD : 24;
  if(left === undefined || top === undefined){
    try{
      const cur = await chrome.windows.getLastFocused();
      if(cur && typeof cur.left === "number" && typeof cur.width === "number"){
        left = Math.max(0, cur.left + cur.width - width - PAD);
      }
      if(cur && typeof cur.top === "number"){
        top = Math.max(0, cur.top + PAD);
      }
    }catch(e){ /* noop */ }
  }

  const url = chrome.runtime.getURL("editor.html");
  const data = { url, type: "popup", width, height };
  if(typeof left === "number") data.left = left;
  if(typeof top === "number") data.top = top;
  return data;
}

let opening = false;
async function openFloatingWindow(){
  if(opening) return;
  opening = true;
  try{
    if(await focusExisting()) return;
    const createData = await computeCreateData();
    try {
      const win = await chrome.windows.create(createData);
      if (win?.id == null) throw new Error("windows.create returned no id");
      // persist created win id via windowManager if available
      try {
        const wm2 = (typeof self !== 'undefined' && self.windowManager) ? self.windowManager : null;
        if (wm2 && typeof wm2.setStoredWinId === 'function') {
          await wm2.setStoredWinId(win.id);
        } else {
          await chrome.storage.local.set({ ['dw_float_id_v1']: win.id });
        }
      } catch (e) { /* ignore */ }
      try {
        const info = await chrome.windows.get(win.id);
        try {
          const wm3 = (typeof self !== 'undefined' && self.windowManager) ? self.windowManager : null;
          const bounds = { left: info.left, top: info.top, width: info.width, height: info.height };
          if (wm3 && typeof wm3.saveBounds === 'function') {
            await wm3.saveBounds(bounds);
          } else {
            await chrome.storage.local.set({ ['dw_float_bounds_v1']: bounds });
          }
        } catch (e) { /* ignore */ }
      } catch (e) { /* ignore */ }
    } catch (err) {
      // Some platforms or environments may reject creating popup windows.
      // Fallback: open the editor in a normal tab so user still gets the editor page.
      try {
        const url = chrome.runtime.getURL("editor.html");
        // Defensive check: ensure URL is a non-empty string and looks like an extension URL.
        if (typeof url === "string" && url.length > 0 && url.includes("editor.html")) {
          try {
            await chrome.tabs.create({ url });
          } catch (tabErr) {
            // Log and swallow tab creation errors to avoid unexpected browser behavior.
            try { console.error("dw-sw: fallback tabs.create failed", tabErr); } catch (e) { /* noop */ }
          }
        } else {
          // If URL is invalid, do not attempt to open a tab. Log for diagnostics.
          try { console.error("dw-sw: invalid fallback URL for editor, skipping tabs.create", url); } catch (e) { /* noop */ }
        }
      } catch (tabErr) {
        // If even tab creation flow fails unexpectedly, rethrow the original windows.create error
        throw err;
      }
    }
  }finally{
    opening = false;
  }
}

chrome.action.onClicked.addListener(() => {
  openFloatingWindow();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "dw-open-floating") {
    // Defensive: only accept this message from the same extension context.
    // This avoids accidental opens if a foreign extension or page tries to send messages.
    try {
      if (sender && typeof sender.id === "string" && sender.id !== chrome.runtime.id) {
        sendResponse({ ok: false, reason: "forbidden-sender" });
        return;
      }
    } catch (e) { /* ignore sender inspection errors */ }

    openFloatingWindow();
    sendResponse({ ok: true });
    return;
  }
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  try {
    const wm = (typeof self !== 'undefined' && self.windowManager) ? self.windowManager : null;
    const storedId = wm && typeof wm.getStoredWinId === 'function' ? await wm.getStoredWinId() : (await chrome.storage.local.get(['dw_float_id_v1']))['dw_float_id_v1'] ?? null;
    if (storedId === windowId) {
      if (wm && typeof wm.setStoredWinId === 'function') {
        try { await wm.setStoredWinId(null); } catch (e) { /* ignore */ }
      } else {
        await chrome.storage.local.remove(['dw_float_id_v1']);
      }
    }
  } catch (e) {
    // noop
  }
});

chrome.windows.onBoundsChanged.addListener((window) => {
  // debounce writes: schedule a save after short inactivity period
  try {
    if (_dw_bounds_save_timer) clearTimeout(_dw_bounds_save_timer);
    _dw_bounds_save_timer = setTimeout(async () => {
      try {
        const wm = (typeof self !== 'undefined' && self.windowManager) ? self.windowManager : null;
        const storedId = wm && typeof wm.getStoredWinId === 'function' ? await wm.getStoredWinId() : (await chrome.storage.local.get(['dw_float_id_v1']))['dw_float_id_v1'] ?? null;
        if (storedId === window.id) {
          const { left, top, width, height } = window;
          if ([left, top, width, height].every(Number.isFinite)) {
            const bounds = { left, top, width, height };
            if (wm && typeof wm.saveBounds === 'function') {
              await wm.saveBounds(bounds);
            } else {
              await chrome.storage.local.set({ ['dw_float_bounds_v1']: bounds });
            }
          }
        }
      } catch (e) {
        // noop - avoid throwing inside service worker timer
      }
    }, _DW_BOUNDS_DEBOUNCE_MS);
  } catch (e) {
    // noop
  }
});
