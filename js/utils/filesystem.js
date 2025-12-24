/**
 * 文件系统工具函数
 * 包含 File System Access API 和 IndexedDB 持久化功能
 */

import { FOLDER_DB_KEY, HANDLE_CLEARED_KEY } from '../constants.js';

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
          localStorage.removeItem(FOLDER_DB_KEY);
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
          try { localStorage.setItem(HANDLE_CLEARED_KEY, String(Date.now())); } catch (e) { /* ignore */ }
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
}
