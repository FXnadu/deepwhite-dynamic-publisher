(function () {
  const WIN_KEY = "dw_float_bounds_v1";
  const WIN_ID_KEY = "dw_float_id_v1";
  const DEFAULT_WIDTH = 520;
  const DEFAULT_HEIGHT = 680;
  const PAD = 24;

  // 导入封装的存储函数（如果在模块环境中）
  // 由于这是 IIFE，我们保持原有实现，但可以考虑重构为 ES6 模块
  
  async function getStoredWinId() {
    try {
      const obj = await chrome.storage.local.get([WIN_ID_KEY]);
      return obj[WIN_ID_KEY] ?? null;
    } catch (e) {
      console.error("获取窗口 ID 失败:", e);
      return null;
    }
  }

  async function setStoredWinId(id) {
    try {
      if (id === null || id === undefined) {
        await chrome.storage.local.remove([WIN_ID_KEY]);
      } else {
        await chrome.storage.local.set({ [WIN_ID_KEY]: id });
      }
    } catch (e) {
      console.error("保存窗口 ID 失败:", e);
      throw e;
    }
  }

  async function getStoredBounds() {
    try {
      const obj = await chrome.storage.local.get([WIN_KEY]);
      return obj[WIN_KEY] ?? null;
    } catch (e) {
      console.error("获取窗口位置失败:", e);
      return null;
    }
  }

  async function saveBounds(bounds) {
    try {
      await chrome.storage.local.set({ [WIN_KEY]: bounds });
    } catch (e) {
      console.error("保存窗口位置失败:", e);
      throw e;
    }
  }

  async function focusExisting() {
    const id = await getStoredWinId();
    if (id == null) return false;
    try {
      const win = await chrome.windows.get(id);
      if (win?.id != null) {
        await chrome.windows.update(win.id, { focused: true });
        return true;
      }
    } catch (e) {
      await chrome.storage.local.remove([WIN_ID_KEY]);
    }
    return false;
  }

  async function computeCreateData() {
    const saved = await getStoredBounds();
    const width = Number.isFinite(saved?.width) ? saved.width : DEFAULT_WIDTH;
    const height = Number.isFinite(saved?.height) ? saved.height : DEFAULT_HEIGHT;

    let left = Number.isFinite(saved?.left) ? saved.left : undefined;
    let top = Number.isFinite(saved?.top) ? saved.top : undefined;
    if (left === undefined || top === undefined) {
      try {
        const cur = await chrome.windows.getLastFocused();
        if (cur && typeof cur.left === "number" && typeof cur.width === "number") {
          left = Math.max(0, cur.left + cur.width - width - PAD);
        }
        if (cur && typeof cur.top === "number") {
          top = Math.max(0, cur.top + PAD);
        }
      } catch (e) { /* noop */ }
    }

    const url = chrome.runtime.getURL("editor.html");
    const data = { url, type: "popup", width, height };
    if (typeof left === "number") data.left = left;
    if (typeof top === "number") data.top = top;
    return data;
  }

  // attach to global
  try {
    self.windowManager = self.windowManager || {};
    Object.assign(self.windowManager, {
      WIN_KEY,
      WIN_ID_KEY,
      DEFAULT_WIDTH,
      DEFAULT_HEIGHT,
      PAD,
      getStoredWinId,
      setStoredWinId,
      getStoredBounds,
      saveBounds,
      focusExisting,
      computeCreateData
    });
  } catch (e) {
    // ignore
  }
})();


