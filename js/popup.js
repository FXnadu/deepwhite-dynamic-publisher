import { showToast } from './utils.js';
import { safeOpenEditor } from './open.js';

const WIN_KEY = "dw_float_bounds_v1";
const WIN_ID_KEY = "dw_float_id_v1";

function setMsg(text, isErr = false) {
  const el = document.getElementById("msg");
  if (!el) return;
  el.textContent = text;
  el.className = "hint " + (isErr ? "status-err" : "");
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
    
    // Use centralized safe open logic
    await safeOpenEditor();
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
  
});
