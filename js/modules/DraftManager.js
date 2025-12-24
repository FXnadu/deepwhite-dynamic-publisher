/**
 * DraftManager.js
 * 职责：草稿的保存、加载、自动保存
 */

import { showToast, debounce, formatDate, formatTime } from '../utils/index.js';
import { setDraftState, setStatus, flashDraftState } from './UIManager.js';

const DRAFT_KEY = "dw_draft_v1";
const DRAFT_META_KEY = "dw_draft_meta_v1";

export async function saveDraft(value) {
  try {
    await chrome.storage.local.set({ [DRAFT_KEY]: value });
    if (value && value.length > 0) {
      const ts = Date.now();
      await chrome.storage.local.set({ [DRAFT_META_KEY]: ts });
    } else {
      await chrome.storage.local.remove([DRAFT_META_KEY]);
    }
  } catch (error) {
    console.error("保存草稿失败:", error);
    showToast("保存草稿失败", "error");
  }
}

export async function loadDraft() {
  try {
    const obj = await chrome.storage.local.get([DRAFT_KEY]);
    return obj[DRAFT_KEY] || "";
  } catch (error) {
    console.error("加载草稿失败:", error);
    return "";
  }
}

export async function loadDraftMeta() {
  try {
    const obj = await chrome.storage.local.get([DRAFT_META_KEY]);
    return obj[DRAFT_META_KEY] || null;
  } catch (error) {
    console.error("加载草稿元信息失败:", error);
    return null;
  }
}

export function createAutoSave() {
  let isSaving = false;
  
  const saveDraftDebounced = debounce(async (value) => {
    await saveDraft(value);
    const now = new Date();
    setDraftState(`草稿：已保存（本地缓存） · 上次：${formatDate(now)} ${formatTime(now)}`);
    setStatus("就绪");
    flashDraftState();
    isSaving = false;
  }, 1000);

  return (value) => {
    if (!isSaving) {
      setDraftState("草稿：已修改（自动保存中…）");
      setStatus("编辑中");
      isSaving = true;
    }

    flashDraftState();
    saveDraftDebounced(value);
  };
}
