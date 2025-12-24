/**
 * UIManager.js
 * 职责：UI 状态更新、字数统计、文件路径提示、状态指示器
 */

import { countChars, countWords, formatDate, formatTime, showToast } from '../utils/index.js';

// DOM 缓存（使用 WeakRef 避免内存泄漏，元素被移除后自动失效）
const __domCache = new Map();

export function getEl(id) {
  if (!id) return null;
  
  // 检查缓存
  if (__domCache.has(id)) {
    const cached = __domCache.get(id);
    // 验证元素是否仍在 DOM 中
    if (cached && cached.isConnected) {
      return cached;
    }
    // 元素已失效，清除缓存
    __domCache.delete(id);
  }
  
  const el = document.getElementById(id);
  if (el) {
    __domCache.set(id, el);
  }
  return el;
}

export function setStatus(text, cls = "status-ok") {
  const el = getEl("status");
  if (el) {
    el.textContent = text;
    el.className = cls;
  }
}

export function setDraftState(text) {
  const el = getEl("draftState");
  if (el) {
    el.textContent = text;
  }
}

const SAVED_FLASH_IDLE_MS = 2000;
let __savedFlashTimer = null;

export function flashDraftState() {
  const el = document.getElementById("draftState");
  if (!el) return;
  el.classList.add('saved-flash');
  
  if (__savedFlashTimer) {
    clearTimeout(__savedFlashTimer);
  }
  
  __savedFlashTimer = setTimeout(() => {
    try { el.classList.remove('saved-flash'); } catch (e) {}
    __savedFlashTimer = null;
  }, SAVED_FLASH_IDLE_MS);
}

export function updateWordCount(text) {
  const chars = countChars(text);
  const words = countWords(text);
  const countText = `${chars} 字符 / ${words} 字`;
  const countEl = getEl("wordCount");
  if (countEl) countEl.textContent = countText;
}

export async function updateFileHint(settings) {
  const hintEl = document.getElementById("fileHint");
  if (!hintEl) return;
  
  try {
    const filename = `${formatDate()}.md`;
    const dir = (settings && settings.targetDir) ? settings.targetDir : '';
    const fullPath = dir ? `${dir}/${filename}`.replace(/\/+/g, '/') : filename;
    const suffix = `/${filename}`;
    const displayDir = fullPath.endsWith(suffix) ? fullPath.slice(0, -suffix.length) : fullPath;
    
    hintEl.innerHTML = `
      <span class="hint-file-name">${filename}</span>
      <span style="margin:0 8px;">→</span>
      <span class="hint-file-dir" title="${fullPath}">${displayDir}</span>
      <button id="copyPathBtn" class="copy-path-btn" title="复制完整路径" aria-label="复制完整路径">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="11" height="11" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      </button>
    `;
    
    const copyBtn = document.getElementById('copyPathBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(fullPath);
          } else {
            const ta = document.createElement('textarea');
            ta.value = fullPath;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          }
          showToast('路径已复制到剪贴板', 'success', 1200);
        } catch (err) {
          console.error('复制路径失败', err);
          showToast('复制失败', 'error', 1800);
        }
      });
    }
  } catch (e) {
    const filename = `${formatDate()}.md`;
    hintEl.textContent = `${filename} → src/content/posts/dynamic/journals/`;
  }
}

export function tick() {
  const el = document.getElementById("clock");
  if (el) {
    const now = new Date();
    el.textContent = `${formatDate(now)} ${formatTime(now)}`;
  }
}

export function updatePublishButtonText(shouldPush) {
  const publishAndPushBtn = document.getElementById("publishAndPush");
  if (!publishAndPushBtn) return;
  const text = shouldPush ? "发表并推送" : "保存到本地";
  publishAndPushBtn.textContent = text;
  publishAndPushBtn.title = text;
  publishAndPushBtn.setAttribute('aria-label', text);
}
