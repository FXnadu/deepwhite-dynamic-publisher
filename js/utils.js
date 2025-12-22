// 工具函数库

/**
 * 显示Toast通知
 * @param {string} message - 消息内容
 * @param {string} type - 类型: 'success' | 'error' | 'warning'
 * @param {number} duration - 显示时长（毫秒）
 */
export function showToast(message, type = 'success', duration = 3000) {
  // Ensure a toast container exists for stacking multiple toasts
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    // Styles kept minimal here; main styling lives in CSS
    container.style.position = 'fixed';
    container.style.right = '20px';
    container.style.bottom = '20px';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    container.style.alignItems = 'flex-end';
    container.style.zIndex = '2000';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  // Initial state for animation
  toast.style.opacity = '0';
  toast.style.transform = 'translateX(20px)';
  toast.style.transition = 'opacity 0.18s ease, transform 0.18s ease';

  container.appendChild(toast);

  // Trigger enter animation
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
  });

  const removeToast = () => {
    // exit animation
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => {
      if (container && container.contains(toast)) container.removeChild(toast);
      // remove container when empty
      if (container && container.childElementCount === 0 && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }, 220);
  };

  const timer = setTimeout(removeToast, duration);
  // allow click to dismiss early
  toast.addEventListener('click', () => {
    clearTimeout(timer);
    removeToast();
  });
}

/**
 * 显示确认对话框
 * @param {string} title - 标题
 * @param {string} message - 消息内容
 * @param {string} confirmText - 确认按钮文字
 * @param {string} cancelText - 取消按钮文字
 * @returns {Promise<boolean>}
 */
export function showConfirm(title, message, confirmText = '确认', cancelText = '取消') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', title || '对话框');

    modal.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title" id="modal-title">${title}</h3>
      </div>
      <div class="modal-body">${message}</div>
      <div class="modal-footer">
        <button class="btn" data-action="cancel">${cancelText}</button>
        <button class="btn btn-primary" data-action="confirm">${confirmText}</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Accessibility: focus management
    const previousActive = document.activeElement;
    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = Array.from(modal.querySelectorAll(focusableSelector));
    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];
    if (firstFocusable) firstFocusable.focus();

    const cleanup = () => {
      try { document.body.removeChild(overlay); } catch (e) { /* ignore */ }
      if (previousActive && typeof previousActive.focus === 'function') previousActive.focus();
      overlay.removeEventListener('click', overlayClickHandler);
      modal.removeEventListener('click', modalClickHandler);
      document.removeEventListener('keydown', keydownHandler);
    };

    const handleAction = (action) => {
      cleanup();
      resolve(action === 'confirm');
    };

    const modalClickHandler = (e) => {
      const action = e.target.dataset.action;
      if (action) {
        handleAction(action);
      }
    };

    const overlayClickHandler = (e) => {
      if (e.target === overlay) {
        handleAction('cancel');
      }
    };

    const keydownHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleAction('cancel');
        return;
      }
      if (e.key === 'Tab') {
        // trap focus inside modal
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      }
    };

    modal.addEventListener('click', modalClickHandler);
    overlay.addEventListener('click', overlayClickHandler);
    document.addEventListener('keydown', keydownHandler);
  });
}

/**
 * 显示多选对话框（用于处理存在同名文件时的用户选择）
 * @param {string} title - 标题
 * @param {string} message - 消息内容（可以包含简短的已有文件预览）
 * @param {Array<{id:string,label:string,btnClass?:string}>} choices - 选项列表，返回所选项的 id
 * @returns {Promise<string>} - 解析为所选 choice.id，点击遮罩相当于取消并返回 'cancel'
 */
export function showChoice(title, message, choices = []) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal modal-choice';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', title || '选择对话框');

    const buttonsHtml = choices.map(c => {
      const cls = c.btnClass ? ` ${c.btnClass}` : '';
      return `<button class="btn${cls}" data-choice="${c.id}">${c.label}</button>`;
    }).join('');

    modal.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title" id="modal-title">${title}</h3>
      </div>
      <div class="modal-body">${message}</div>
      <div class="modal-footer choice-footer">
        ${buttonsHtml}
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Accessibility: focus management
    const previousActive = document.activeElement;
    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = Array.from(modal.querySelectorAll(focusableSelector));
    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];
    if (firstFocusable) firstFocusable.focus();

    const cleanup = (choiceId) => {
      try { document.body.removeChild(overlay); } catch (e) { /* ignore */ }
      if (previousActive && typeof previousActive.focus === 'function') previousActive.focus();
      overlay.removeEventListener('click', overlayClickHandler);
      modal.removeEventListener('click', modalClickHandler);
      document.removeEventListener('keydown', keydownHandler);
      resolve(choiceId);
    };

    const modalClickHandler = (e) => {
      const choiceId = e.target.dataset.choice;
      if (choiceId) {
        cleanup(choiceId);
      }
    };

    const overlayClickHandler = (e) => {
      if (e.target === overlay) {
        cleanup('cancel');
      }
    };

    const keydownHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cleanup('cancel');
        return;
      }
      if (e.key === 'Tab') {
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      }
    };

    modal.addEventListener('click', modalClickHandler);
    overlay.addEventListener('click', overlayClickHandler);
    document.addEventListener('keydown', keydownHandler);
  });
}

/**
 * 显示带文本输入的模态对话框
 * @param {string} title
 * @param {string} message
 * @param {string} defaultValue
 * @param {string} confirmText
 * @param {string} cancelText
 * @returns {Promise<string|null>} - 确认返回输入值，取消返回 null
 */
export function showPrompt(title, message, defaultValue = '', confirmText = '确定', cancelText = '取消') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', title || '输入对话框');

    modal.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title" id="modal-title">${title}</h3>
      </div>
      <div class="modal-body">
        <div class="prompt-message">${message}</div>
        <div style="margin-top:10px;"><input id="modal-input" class="input" type="text" value="${defaultValue.replace(/"/g, '&quot;')}" /></div>
      </div>
      <div class="modal-footer">
        <button class="btn" data-action="cancel">${cancelText}</button>
        <button class="btn btn-primary" data-action="confirm">${confirmText}</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const inputEl = modal.querySelector('#modal-input');
    const previousActive = document.activeElement;
    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = Array.from(modal.querySelectorAll(focusableSelector));
    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];
    if (inputEl) inputEl.focus();

    const cleanup = () => {
      try { document.body.removeChild(overlay); } catch (e) { /* ignore */ }
      if (previousActive && typeof previousActive.focus === 'function') previousActive.focus();
      overlay.removeEventListener('click', overlayClickHandler);
      modal.removeEventListener('click', modalClickHandler);
      document.removeEventListener('keydown', keydownHandler);
    };

    const handleAction = (action) => {
      if (action === 'confirm') {
        const val = inputEl ? inputEl.value : '';
        cleanup();
        resolve(val);
      } else {
        cleanup();
        resolve(null);
      }
    };

    const modalClickHandler = (e) => {
      const action = e.target.dataset.action;
      if (action) {
        handleAction(action);
      }
    };

    const overlayClickHandler = (e) => {
      if (e.target === overlay) {
        handleAction('cancel');
      }
    };

    const keydownHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleAction('cancel');
        return;
      }
      if (e.key === 'Enter') {
        // Enter should confirm if input is focused
        if (document.activeElement === inputEl) {
          e.preventDefault();
          handleAction('confirm');
        }
      }
      if (e.key === 'Tab') {
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      }
    };

    modal.addEventListener('click', modalClickHandler);
    overlay.addEventListener('click', overlayClickHandler);
    document.addEventListener('keydown', keydownHandler);
  });
}

/**
 * 格式化日期时间
 * @param {Date} date - 日期对象
 * @returns {string} YYYY-MM-DD格式
 */
export function formatDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 格式化时间
 * @param {Date} date - 日期对象
 * @returns {string} HH:MM格式
 */
export function formatTime(date = new Date()) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// -------------------------- Settings cache (chrome.storage.sync) --------------------------
const SETTINGS_KEY = "dw_settings_v1";
let __settingsCache = null;
let __settingsPromise = null;

export async function getCachedSettings() {
  if (__settingsCache) return __settingsCache;
  if (__settingsPromise) return __settingsPromise;
  __settingsPromise = (async () => {
    try {
      const obj = await chrome.storage.sync.get([SETTINGS_KEY]);
      const s = obj[SETTINGS_KEY] || {
        repoUrl: "FXnadu/deepwhite-11ty",
        branch: "main",
        targetDir: "src/content/posts/dynamic/journals",
        commitPrefix: "dynamic:",
      push: false,
      // PicGo defaults
      picgoEndpoint: "http://localhost:36677/upload",
      picgoToken: "",
      picgoAutoUpload: false,
      picgoUploadFormat: "auto"
      };
      __settingsCache = s;
      return s;
    } catch (e) {
      console.error("加载设置失败（缓存）:", e);
      // return sensible defaults
      const def = {
        repoUrl: "FXnadu/deepwhite-11ty",
        branch: "main",
        targetDir: "src/content/posts/dynamic/journals",
        commitPrefix: "dynamic:",
        push: false,
        picgoEndpoint: "http://localhost:36677/upload",
        picgoToken: "",
        picgoAutoUpload: false,
        picgoUploadFormat: "auto"
      };
      __settingsCache = def;
      return def;
    } finally {
      __settingsPromise = null;
    }
  })();
  return __settingsPromise;
}

export async function setCachedSettings(settings) {
  try {
    await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
    __settingsCache = settings;
    return true;
  } catch (e) {
    console.error("保存设置失败（缓存）:", e);
    throw e;
  }
}

// Keep cache in sync when other contexts modify storage
try {
  if (chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes[SETTINGS_KEY]) {
        __settingsCache = changes[SETTINGS_KEY].newValue || null;
      }
    });
  }
} catch (e) { /* noop in non-chrome environments */ }

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function}
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * 计算字符数（中文算1个字符）
 * @param {string} text - 文本
 * @returns {number}
 */
export function countChars(text) {
  return text.length;
}

/**
 * 计算字数（中文算1个字，英文单词算1个字）
 * @param {string} text - 文本
 * @returns {number}
 */
export function countWords(text) {
  if (!text.trim()) return 0;
  // 中文字符
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
  // 英文单词
  const englishWords = text.replace(/[\u4e00-\u9fa5]/g, '').trim().split(/\s+/).filter(w => w.length > 0);
  return chineseChars.length + englishWords.length;
}

/**
 * 设置按钮加载状态
 * @param {HTMLElement} button - 按钮元素
 * @param {boolean} loading - 是否加载中
 */
export function setButtonLoading(button, loading) {
  if (loading) {
    button.disabled = true;
    try {
      // Force black spinner color and rely on CSS to hide button text
      button.style.setProperty('--btn-loading-color', '#000');
      button.dataset.loadingColor = '#000';
    } catch (e) { /* ignore color detection errors */ }
    button.classList.add('btn-loading');
  } else {
    button.disabled = false;
    button.classList.remove('btn-loading');
    if (button.dataset && button.dataset.loadingColor) {
      try {
        button.style.removeProperty('--btn-loading-color');
      } catch (e) { /* ignore cleanup errors */ }
      delete button.dataset.loadingColor;
    }
  }
}

// -------------------------- File System Handle persistence (IndexedDB) --------------------------
// These helpers persist a DirectoryHandle across sessions using IndexedDB (structuredClone support).
const HANDLE_DB_NAME = 'dw_handles_db';
const HANDLE_STORE = 'handles';

// Cache the opened DB instance to avoid repeated open/upgradeneeded overhead.
let __cachedHandleDB = null;
function openHandleDB() {
  if (__cachedHandleDB) return Promise.resolve(__cachedHandleDB);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(HANDLE_STORE)) {
        db.createObjectStore(HANDLE_STORE);
      }
    };
    req.onsuccess = () => {
      __cachedHandleDB = req.result;
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveDirectoryHandle(handle) {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    const store = tx.objectStore(HANDLE_STORE);
    const putReq = store.put(handle, 'dir');
    putReq.onsuccess = () => resolve(true);
    putReq.onerror = () => reject(putReq.error);
  });
}

export async function getSavedDirectoryHandle() {
  try {
    const db = await openHandleDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE, 'readonly');
      const store = tx.objectStore(HANDLE_STORE);
      const getReq = store.get('dir');
      getReq.onsuccess = () => resolve(getReq.result);
      getReq.onerror = () => reject(getReq.error);
    });
  } catch (e) {
    return null;
  }
}

export async function clearSavedDirectoryHandle() {
  // Close and clear any cached DB handle first to avoid stale references.
  try {
    if (__cachedHandleDB) {
      try { __cachedHandleDB.close(); } catch (e) { /* ignore close errors */ }
      __cachedHandleDB = null;
    }
  } catch (e) {
    // noop
  }

  // Delete the whole database to ensure no leftover data remains. Deleting DB
  // is more robust than deleting a single key because it removes any stale
  // object stores and ensures future opens create a fresh DB.
  return new Promise((resolve, reject) => {
    const delReq = indexedDB.deleteDatabase(HANDLE_DB_NAME);
    delReq.onsuccess = () => {
      // Also remove legacy/localStorage fallback key if present.
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('dw_folder_handle_v1');
        }
      } catch (e) { /* ignore localStorage errors (e.g., in some secure contexts) */ }
      // Notify other parts of the extension that the handle was cleared.
      try {
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          try { window.dispatchEvent(new CustomEvent('dw:handleCleared')); } catch (e) { /* ignore */ }
        }
      } catch (e) { /* ignore */ }
      try {
        if (typeof chrome !== 'undefined' && chrome && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
          try { chrome.runtime.sendMessage({ type: 'dw:handleCleared' }); } catch (e) { /* ignore */ }
        }
      } catch (e) { /* ignore */ }
      // Mark the cleared timestamp in localStorage so other contexts can suppress
      // immediate follow-up suggestions (user intentionally cleared auth).
      try {
        if (typeof localStorage !== 'undefined') {
          try { localStorage.setItem('dw_handle_cleared_v1', String(Date.now())); } catch (e) { /* ignore */ }
        }
      } catch (e) { /* ignore */ }
      resolve(true);
    };
    delReq.onerror = () => reject(delReq.error);
    delReq.onblocked = () => {
      // If deletion is blocked by other open connections, resolve so UI can
      // proceed; callers can retry if necessary.
      resolve(true);
    };
  });
}

// convenience function for options UI
export async function getSavedDirectoryName() {
  const h = await getSavedDirectoryHandle();
  return h ? (h.name || '') : '';
}

/**
 * File handle persistence (IndexedDB)
 * Save a FileSystemFileHandle under key 'file'
 */
export async function saveFileHandle(handle) {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    const store = tx.objectStore(HANDLE_STORE);
    const putReq = store.put(handle, 'file');
    putReq.onsuccess = () => resolve(true);
    putReq.onerror = () => reject(putReq.error);
  });
}

export async function getSavedFileHandle() {
  try {
    const db = await openHandleDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE, 'readonly');
      const store = tx.objectStore(HANDLE_STORE);
      const getReq = store.get('file');
      getReq.onsuccess = () => resolve(getReq.result);
      getReq.onerror = () => reject(getReq.error);
    });
  } catch (e) {
    return null;
  }
}

export async function clearSavedFileHandle() {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    const store = tx.objectStore(HANDLE_STORE);
    const delReq = store.delete('file');
    delReq.onsuccess = () => resolve(true);
    delReq.onerror = () => reject(delReq.error);
  });
}

export async function getSavedFileName() {
  const h = await getSavedFileHandle();
  return h ? (h.name || '') : '';
}

/**
 * Try to detect a reasonable targetDir inside the provided DirectoryHandle.
 * Returns the first matching candidate path (string) or empty string if none found.
 * This helps auto-fill `targetDir` in settings when the user points to a repo root.
 */
export async function detectTargetDirFromHandle(dirHandle) {
  if (!dirHandle) return '';

  const candidates = [
    'src/content/posts/dynamic/journals',
    'src/content/posts/dynamic',
    'src/content/posts',
    'src/content',
    'content/posts/dynamic/journals',
    'posts/dynamic/journals',
    'posts/dynamic',
    'posts'
  ];

  // 1) Fast path: try resolving candidates directly relative to provided handle.
  for (const candidate of candidates) {
    const parts = candidate.split('/');
    let cur = dirHandle;
    let ok = true;
    for (const part of parts) {
      try {
        cur = await cur.getDirectoryHandle(part, { create: false });
      } catch (e) {
        ok = false;
        break;
      }
    }
    if (ok) return candidate;
  }

  // 2) Fallback: perform a breadth-first search up to a limited depth to find candidate paths
  // This handles cases where the user picked a subdirectory (not repo root) or a deeper layout.
  const MAX_DEPTH = 3;
  const queue = [{ handle: dirHandle, pathParts: [] }];

  while (queue.length) {
    const { handle, pathParts } = queue.shift();
    if (pathParts.length >= MAX_DEPTH) continue;
    try {
      // Prefer the standard async iterable returned by handle.entries()
      if (typeof handle.entries === 'function') {
        for await (const entry of handle.entries()) {
          // entry is [name, entryHandle]
          if (!entry || !Array.isArray(entry) || entry.length < 2) continue;
          const entryName = entry[0];
          const entryHandle = entry[1];
          if (!entryHandle || entryHandle.kind !== 'directory') continue;
          const childHandle = entryHandle;
          const childPathParts = pathParts.concat(entryName || '');

          // Try each candidate by checking if it can be resolved starting from this child
          for (const candidate of candidates) {
            const candidateParts = candidate.split('/');
            // quick check: candidate's first segment should match this child's name
            if (candidateParts[0] !== (entryName || '')) continue;
            // attempt to resolve the rest of candidateParts starting from childHandle
            let cur = childHandle;
            let ok = true;
            for (let i = 1; i < candidateParts.length; i++) {
              try {
                cur = await cur.getDirectoryHandle(candidateParts[i], { create: false });
              } catch (e) {
                ok = false;
                break;
              }
            }
            if (ok) {
              // Prefer returning the canonical candidate path when found.
              return candidate;
            }
          }

          // enqueue child for further exploration
          queue.push({ handle: childHandle, pathParts: childPathParts });
        }
      } else if (typeof handle.values === 'function') {
        // Some environments may expose a values() async iterable of handles;
        // support that defensively (older/alternate implementations).
        for await (const entryHandle of handle.values()) {
          if (!entryHandle || entryHandle.kind !== 'directory') continue;
          const entryName = entryHandle.name || '';
          const childHandle = entryHandle;
          const childPathParts = pathParts.concat(entryName);

          for (const candidate of candidates) {
            const candidateParts = candidate.split('/');
            if (candidateParts[0] !== entryName) continue;
            let cur = childHandle;
            let ok = true;
            for (let i = 1; i < candidateParts.length; i++) {
              try {
                cur = await cur.getDirectoryHandle(candidateParts[i], { create: false });
              } catch (e) {
                ok = false;
                break;
              }
            }
            if (ok) return candidate;
          }

          queue.push({ handle: childHandle, pathParts: childPathParts });
        }
      } else {
        // If we can't iterate directory entries, skip exploring this handle.
        continue;
      }
    } catch (e) {
      // ignore directories we can't iterate or permission issues
    }
  }

  return '';
}

// expose helpers to window for simple usage in options.js without bundling
if (typeof window !== 'undefined') {
  window.saveDirectoryHandle = saveDirectoryHandle;
  window.getSavedDirectoryHandle = getSavedDirectoryHandle;
  window.clearSavedDirectoryHandle = clearSavedDirectoryHandle;
  window.getSavedDirectoryName = getSavedDirectoryName;
  window.detectTargetDirFromHandle = detectTargetDirFromHandle;
  window.saveFileHandle = saveFileHandle;
  window.getSavedFileHandle = getSavedFileHandle;
  window.clearSavedFileHandle = clearSavedFileHandle;
  window.getSavedFileName = getSavedFileName;
}

// -------------------------- GitHub Contents API helper --------------------------
/**
 * Create or update a file in a repo via GitHub Contents API.
 * @param {Object} params - { owner, repo, path, branch, message, contentBase64, token }
 * @returns {Promise<Object>}
 */
export async function githubPutFile({ owner, repo, path, branch = 'main', message, contentBase64, token }) {
  if (!token) throw new Error('Missing GitHub token');
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;

  // Try fetch existing file to get sha (if exists)
  let sha = null;
  try {
    const getRes = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
    });
    if (getRes.ok) {
      const json = await getRes.json();
      sha = json.sha;
    }
  } catch (e) {
    // ignore - file might not exist
  }

  const body = {
    message: message || `Add ${path}`,
    content: contentBase64,
    branch
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    // Try to parse JSON error body for clearer messaging, fallback to text.
    let bodyText = '';
    try {
      const txt = await res.text();
      bodyText = txt || '';
      try {
        const parsedErr = bodyText ? JSON.parse(bodyText) : null;
        if (parsedErr && parsedErr.message) {
          throw new Error(`GitHub API error: ${res.status} ${parsedErr.message}`);
        }
      } catch (parseErr) {
        // not JSON or no message field - fall through to using raw text
      }
    } catch (readErr) {
      bodyText = String(readErr);
    }
    // Provide common status hints
    if (res.status === 401) {
      throw new Error(`GitHub API error: 401 Unauthorized. 请检查 token 是否有效.`);
    } else if (res.status === 403) {
      throw new Error(`GitHub API error: 403 Forbidden. 可能是权限不足或速率限制.`);
    } else if (res.status === 404) {
      throw new Error(`GitHub API error: 404 Not Found. 仓库或路径不存在或无权限访问.`);
    }
    throw new Error(`GitHub API error: ${res.status} ${bodyText}`);
  }
  return await res.json();
}

/**
 * Parse repository identifier into owner and repo.
 * Accepts formats:
 * - owner/repo
 * - https://github.com/owner/repo(.git)?
 * - git@github.com:owner/repo.git
 * Returns { owner, repo } or null if invalid.
 */
export function parseRepoUrl(input) {
  if (!input || typeof input !== 'string') return null;
  const s = input.trim();
  // owner/repo
  const m1 = s.match(/^([^\/\s]+)\/([^\/\s]+?)(?:\.git)?$/);
  if (m1) return { owner: m1[1], repo: m1[2] };
  // https://github.com/owner/repo or with .git
  const m2 = s.match(/^https?:\/\/github\.com\/([^\/\s]+)\/([^\/\s]+?)(?:\.git)?(?:\/)?$/i);
  if (m2) return { owner: m2[1], repo: m2[2] };
  // git@github.com:owner/repo.git
  const m3 = s.match(/^git@github\.com:([^\/\s]+)\/([^\/\s]+?)(?:\.git)?$/i);
  if (m3) return { owner: m3[1], repo: m3[2] };
  return null;
}

/**
 * Encode a UTF-8 string into base64 safely (handles large inputs).
 * @param {string} str
 * @returns {string}
 */
export function encodeBase64Utf8(str) {
  if (typeof str !== 'string') str = String(str || '');
  // Preferred approach: use TextEncoder to get UTF-8 bytes and btoa over binary string
  try {
    if (typeof TextEncoder !== 'undefined') {
      const bytes = new TextEncoder().encode(str);
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk);
      }
      return btoa(binary);
    }
  } catch (e) {
    // fallback to legacy transform
  }
  // Fallback for older environments
  return btoa(unescape(encodeURIComponent(str)));
}

/**
 * Upload an image Blob to a PicGo HTTP endpoint.
 * @param {string} endpoint - PicGo HTTP upload endpoint, e.g. http://localhost:36677/upload
 * @param {Blob|File} blob - image blob
 * @param {string} token - optional token to send as Authorization Bearer
 * @returns {Promise<string>} - resolved image URL
 */
export async function uploadToPicGo(endpoint, blob, token, options = {}) {
  if (!endpoint) throw new Error('PicGo endpoint 未配置');
  const forceJson = !!options.forceJson;
  // Auto-prefer JSON when targeting a local PicGo server or when explicitly requested.
  const preferJsonAuto = forceJson || !!options.preferJson || /(^https?:\/\/(?:localhost|127\.0\.0\.1)|:36677)/i.test(endpoint);
  try {
    console.log('uploadToPicGo:start', { endpoint, name: blob && blob.name, type: blob && blob.type, size: blob && blob.size, forceJson, preferJsonAuto });
  } catch (e) {}

  const headersAuth = {};
  if (token) headersAuth['Authorization'] = `Bearer ${token}`;

  const blobToBase64 = async (b) => {
    const arr = await b.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(arr);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  };

  const extractUrl = (obj) => {
    if (!obj) return null;
    if (typeof obj === 'string' && obj.startsWith('http')) return obj;
    if (obj.result && Array.isArray(obj.result) && obj.result.length > 0 && typeof obj.result[0] === 'string' && obj.result[0].startsWith('http')) {
      return obj.result[0];
    }
    if (typeof obj === 'object') {
      if (obj.url && typeof obj.url === 'string' && obj.url.startsWith('http')) return obj.url;
      if (obj.data) {
        if (typeof obj.data === 'string' && obj.data.startsWith('http')) return obj.data;
        if (Array.isArray(obj.data) && obj.data.length && typeof obj.data[0] === 'string' && obj.data[0].startsWith('http')) return obj.data[0];
        if (obj.data.url && typeof obj.data.url === 'string' && obj.data.url.startsWith('http')) return obj.data.url;
      }
    }
    if (Array.isArray(obj)) {
      for (const it of obj) {
        const u = extractUrl(it);
        if (u) return u;
      }
    }
    if (typeof obj === 'object') {
      for (const k of Object.keys(obj)) {
        try {
          const u = extractUrl(obj[k]);
          if (u) return u;
        } catch (e) {}
      }
    }
    return null;
  };

  const attemptJsonUploads = async () => {
    const b64 = await blobToBase64(blob);
    const dataUrl = `data:${blob.type || 'image/png'};base64,${b64}`;
    // small snippet for logging (avoid printing full base64)
    const b64Snippet = b64 ? (b64.slice(0, 120) + (b64.length > 120 ? '...': '')) : '';
    // Try a wide range of JSON field shapes that different PicGo versions/plugins accept.
    const jsonVariants = [
      { base64: b64 },
      { img: dataUrl },
      { images: [dataUrl] },
      { images: [b64] },
      { files: [dataUrl] },
      { files: [b64] },
      { data: dataUrl },
      { data: [dataUrl] }
    ];
    let lastRespSnippet = '';
    console.log('PicGo: attempting JSON upload variants', { variants: jsonVariants.length });
    for (const variant of jsonVariants) {
      try {
        // Log a safe summary of the variant being sent
        const safeVariantSummary = Object.keys(variant).reduce((acc, k) => {
          const v = variant[k];
          if (typeof v === 'string') {
            acc[k] = v.length > 200 ? `${v.slice(0,120)}... (len:${v.length})` : v;
          } else if (Array.isArray(v) && v.length && typeof v[0] === 'string') {
            acc[k] = `${String(v[0]).slice(0,120)}... (arr len:${v.length})`;
          } else {
            acc[k] = v;
          }
          return acc;
        }, {});
        console.log('PicGo: JSON attempt payload summary', safeVariantSummary);
        const headersJson = { 'Content-Type': 'application/json', ...headersAuth };
        const jres = await fetch(endpoint, { method: 'POST', headers: headersJson, body: JSON.stringify(variant) });
        const jbodyText = await jres.text().catch(() => null);
        let jbody = null;
        try { jbody = jbodyText ? JSON.parse(jbodyText) : null; } catch (e) { jbody = jbodyText; }
        try { console.log('PicGo JSON upload response', { status: jres.status, body: jbody, rawTextLen: jbodyText ? jbodyText.length : 0 }); } catch (e) {}
        const found = extractUrl(jbody);
        if (found) {
          console.log('uploadToPicGo:found url via JSON upload', found);
          return { url: found, snippet: null };
        }
        lastRespSnippet = jbody ? (typeof jbody === 'string' ? jbody.slice(0,1000) : JSON.stringify(jbody).slice(0,1000)) : '(no-json-response)';
      } catch (e) {
        lastRespSnippet = String(e).slice(0, 1000);
      }
    }
    return { url: null, snippet: lastRespSnippet };
  };

  // If we prefer JSON (local PicGo or explicit), try JSON upload first.
  if (preferJsonAuto && !forceJson) {
    const jsonTry = await attemptJsonUploads();
    if (jsonTry.url) return jsonTry.url;
    // fallthrough to form-data attempt if JSON didn't produce a URL
  }

  if (forceJson) {
    const jsonOnly = await attemptJsonUploads();
    if (jsonOnly.url) return jsonOnly.url;
    throw new Error(`PicGo JSON 上传未返回图片 URL，响应：${jsonOnly.snippet || '(empty)'}`);
  }

  const fd = new FormData();
  const filename = (blob && blob.name) ? blob.name : `${formatDate()}-pasted.png`;
  fd.append('file', blob, filename);
  fd.append('files[]', blob, filename);
  fd.append('filename', filename);

  let res;
  try {
    // For debugging: produce a small base64 snippet of the blob and log form-data keys being sent.
    try {
      const fdB64 = await blobToBase64(blob);
      console.log('PicGo: form-data upload preview', { filename, contentSnippet: fdB64 ? fdB64.slice(0,120) + (fdB64.length > 120 ? '...' : '') : null, headersAuth });
    } catch (e) { /* ignore preview errors */ }
    res = await fetch(endpoint, { method: 'POST', body: fd, headers: headersAuth });
  } catch (e) {
    console.error('uploadToPicGo fetch error', e);
    throw e;
  }
  try {
    console.log('uploadToPicGo:fetch result', { status: res.status, ok: res.ok });
  } catch (e) {}
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    // If PicGo responded with an error that indicates it expected clipboard data,
    // try JSON variants as a fallback (some PicGo server handlers treat missing file
    // as "upload from clipboard" and will fail).
    const lower = String(txt || '').toLowerCase();
    if (lower.includes('clipboard') || lower.includes('image not found') || lower.includes('upload clipboard')) {
      try {
        const jsonFallback = await attemptJsonUploads();
        if (jsonFallback.url) return jsonFallback.url;
      } catch (e) {
        // fall through to throwing original error below
      }
    }
    throw new Error(`PicGo API error: ${res.status} ${txt}`);
  }

  let json = null;
  let rawText = null;
  try {
    rawText = await res.text();
    try {
      json = rawText ? JSON.parse(rawText) : null;
    } catch (e) {
      json = null;
    }
  } catch (e) {
    json = await res.json().catch(() => null);
  }
  try { console.log('uploadToPicGo:response json', json, 'rawTextLen', rawText ? rawText.length : 0); } catch (e) {}

  let url = extractUrl(json) || null;
  if (!url && rawText) {
    try {
      const m = rawText.match(/https?:\/\/[^\s"']+/i);
      if (m && m[0]) {
        url = m[0].replace(/[,;)]$/, '');
        console.log('uploadToPicGo:found url in raw text fallback', url);
      }
    } catch (e) { /* ignore */ }
  }

  if (url) return url;

  const msgLower = json && json.message ? String(json.message).toLowerCase() : '';
  const jsonAttempt = await attemptJsonUploads();
  if (jsonAttempt.url) return jsonAttempt.url;
  const snippet = jsonAttempt.snippet || (json ? JSON.stringify(json).slice(0, 1000) : rawText ? rawText.slice(0, 1000) : '(empty)');
  const prefix = msgLower && msgLower.includes('json') ? 'PicGo 要求 JSON 上传，但' : '无法从 PicGo 响应中解析图片 URL，响应：';
  throw new Error(`${prefix}${snippet}`);
}

