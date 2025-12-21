import { showToast } from './utils.js';

const WIN_KEY = "dw_float_bounds_v1";
const WIN_ID_KEY = "dw_float_id_v1";

async function getWinId() {
  const obj = await chrome.storage.local.get([WIN_ID_KEY]);
  return obj[WIN_ID_KEY] ?? null;
}

async function setWinId(id) {
  await chrome.storage.local.set({ [WIN_ID_KEY]: id });
}

async function clearWinId() {
  await chrome.storage.local.remove([WIN_ID_KEY]);
}

async function getBounds() {
  const obj = await chrome.storage.local.get([WIN_KEY]);
  return obj[WIN_KEY] ?? null;
}

function setMsg(text, isErr = false) {
  const el = document.getElementById("msg");
  if (!el) return;
  el.textContent = text;
  el.className = "hint " + (isErr ? "status-err" : "");
}

async function focusExisting() {
  const id = await getWinId();
  if (id == null) return false;
  try {
    const w = await chrome.windows.get(id);
    if (w?.id != null) {
      await chrome.windows.update(w.id, { focused: true });
      return true;
    }
  } catch (e) {
    await clearWinId();
  }
  return false;
}

let opening = false;
async function openWindow() {
  if (opening) return;
  opening = true;
  
  const openBtn = document.getElementById("open");
  if (openBtn) {
    openBtn.disabled = true;
    openBtn.textContent = "正在打开…";
  }
  
  try {
    setMsg("正在打开编辑器…");
    
    // 先尝试聚焦已存在的窗口
    if (await focusExisting()) {
      setMsg("已聚焦现有编辑器窗口");
      showToast("已打开编辑器", "success", 2000);
      return;
    }
    
    // 打开新窗口
    await chrome.runtime.sendMessage({ type: "dw-open-floating" });
    setMsg("编辑器已打开，可关闭此窗口");
    showToast("编辑器已打开", "success", 2000);
  } catch (error) {
    console.error("打开窗口失败:", error);
    setMsg("打开失败，请重试", true);
    showToast("打开失败: " + error.message, "error", 3000);
  } finally {
    opening = false;
    if (openBtn) {
      openBtn.disabled = false;
      openBtn.textContent = "打开浮窗编辑器";
    }
  }
}

// 初始化
document.addEventListener("DOMContentLoaded", () => {
  const openBtn = document.getElementById("open");
  if (openBtn) {
    openBtn.addEventListener("click", openWindow);
  }
  
  // 自动打开窗口
  openWindow();
});
