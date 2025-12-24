/**
 * 存储工具函数
 * 包含 Chrome Storage API 的封装和缓存管理
 */

import { SETTINGS_KEY, DEFAULT_SETTINGS } from '../constants.js';

// -------------------------- Settings cache (chrome.storage.sync) --------------------------
let __settingsCache = null;
let __settingsPromise = null;

export async function getCachedSettings() {
  if (__settingsCache) return __settingsCache;
  if (__settingsPromise) return __settingsPromise;
  __settingsPromise = (async () => {
    try {
      const obj = await chrome.storage.sync.get([SETTINGS_KEY]);
      let s = obj[SETTINGS_KEY] || { ...DEFAULT_SETTINGS };
      
      // 向后兼容：迁移旧的 localDir/githubDir 配置到 targetDir
      if (!s.targetDir && (s.localDir || s.githubDir)) {
        // 优先使用 githubDir，其次 localDir
        s.targetDir = s.githubDir || s.localDir || DEFAULT_SETTINGS.targetDir;
        // 保存迁移后的配置
        try {
          await chrome.storage.sync.set({ [SETTINGS_KEY]: s });
        } catch (e) {
          console.warn("迁移配置失败:", e);
        }
      }
      
      __settingsCache = s;
      return s;
    } catch (e) {
      console.error("加载设置失败（缓存）:", e);
      __settingsCache = { ...DEFAULT_SETTINGS };
      return __settingsCache;
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

// -------------------------- GitHub Token (chrome.storage.local) --------------------------
const TOKEN_KEY = 'dw_github_token_v1';

/**
 * 获取 GitHub Token
 * @returns {Promise<string>} GitHub Token，如果不存在返回空字符串
 */
export async function getGitHubToken() {
  try {
    const obj = await chrome.storage.local.get([TOKEN_KEY]);
    return obj[TOKEN_KEY] || '';
  } catch (e) {
    console.error("获取 GitHub Token 失败:", e);
    return '';
  }
}

/**
 * 保存 GitHub Token
 * @param {string} token - GitHub Token
 * @returns {Promise<boolean>} 是否保存成功
 */
export async function setGitHubToken(token) {
  try {
    await chrome.storage.local.set({ [TOKEN_KEY]: token || '' });
    return true;
  } catch (e) {
    console.error("保存 GitHub Token 失败:", e);
    throw e;
  }
}

// -------------------------- Window State (chrome.storage.local) --------------------------
const WIN_ID_KEY = 'dw_float_id_v1';
const WIN_BOUNDS_KEY = 'dw_float_bounds_v1';

/**
 * 获取保存的窗口 ID
 * @returns {Promise<number|null>} 窗口 ID，如果不存在返回 null
 */
export async function getStoredWindowId() {
  try {
    const obj = await chrome.storage.local.get([WIN_ID_KEY]);
    return obj[WIN_ID_KEY] ?? null;
  } catch (e) {
    console.error("获取窗口 ID 失败:", e);
    return null;
  }
}

/**
 * 保存窗口 ID
 * @param {number|null} windowId - 窗口 ID
 * @returns {Promise<boolean>} 是否保存成功
 */
export async function setStoredWindowId(windowId) {
  try {
    if (windowId === null || windowId === undefined) {
      await chrome.storage.local.remove([WIN_ID_KEY]);
    } else {
      await chrome.storage.local.set({ [WIN_ID_KEY]: windowId });
    }
    return true;
  } catch (e) {
    console.error("保存窗口 ID 失败:", e);
    throw e;
  }
}

/**
 * 获取保存的窗口位置和大小
 * @returns {Promise<{left:number, top:number, width:number, height:number}|null>}
 */
export async function getStoredWindowBounds() {
  try {
    const obj = await chrome.storage.local.get([WIN_BOUNDS_KEY]);
    return obj[WIN_BOUNDS_KEY] ?? null;
  } catch (e) {
    console.error("获取窗口位置失败:", e);
    return null;
  }
}

/**
 * 保存窗口位置和大小
 * @param {{left:number, top:number, width:number, height:number}} bounds - 窗口位置和大小
 * @returns {Promise<boolean>} 是否保存成功
 */
export async function setStoredWindowBounds(bounds) {
  try {
    await chrome.storage.local.set({ [WIN_BOUNDS_KEY]: bounds });
    return true;
  } catch (e) {
    console.error("保存窗口位置失败:", e);
    throw e;
  }
}
