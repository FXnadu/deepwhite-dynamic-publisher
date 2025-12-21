// 工具函数库

/**
 * 显示Toast通知
 * @param {string} message - 消息内容
 * @param {string} type - 类型: 'success' | 'error' | 'warning'
 * @param {number} duration - 显示时长（毫秒）
 */
export function showToast(message, type = 'success', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, duration);
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
    
    modal.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
      </div>
      <div class="modal-body">${message}</div>
      <div class="modal-footer">
        <button class="btn" data-action="cancel">${cancelText}</button>
        <button class="btn btn-primary" data-action="confirm">${confirmText}</button>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    const handleAction = (action) => {
      document.body.removeChild(overlay);
      resolve(action === 'confirm');
    };
    
    modal.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (action) {
        handleAction(action);
      }
    });
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        handleAction('cancel');
      }
    });
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
    button.classList.add('btn-loading');
  } else {
    button.disabled = false;
    button.classList.remove('btn-loading');
  }
}

// -------------------------- File System Handle persistence (IndexedDB) --------------------------
// These helpers persist a DirectoryHandle across sessions using IndexedDB (structuredClone support).
const HANDLE_DB_NAME = 'dw_handles_db';
const HANDLE_STORE = 'handles';

function openHandleDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(HANDLE_STORE)) {
        db.createObjectStore(HANDLE_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
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
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLE_STORE, 'readwrite');
    const store = tx.objectStore(HANDLE_STORE);
    const delReq = store.delete('dir');
    delReq.onsuccess = () => resolve(true);
    delReq.onerror = () => reject(delReq.error);
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
    const txt = await res.text();
    throw new Error(`GitHub API error: ${res.status} ${txt}`);
  }
  return await res.json();
}
