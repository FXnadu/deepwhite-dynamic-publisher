/**
 * EditorCore.js
 * 职责：编辑器核心初始化、模块协调、事件绑定
 */

import { getCachedSettings, setButtonLoading, showToast, formatDate, formatTime } from '../utils/index.js';
import { DEFAULT_SETTINGS } from '../constants.js';
import { loadDraft, loadDraftMeta, createAutoSave } from './DraftManager.js';
import { initHighlight, setupScrollSync, scheduleInputUpdate, 
         updateVisibleHighlightNow } from './MarkdownRenderer.js';
import { setupPasteHandler } from './ImageHandler.js';
import { publish } from './PublishManager.js';
import { setDraftState, updateWordCount, updateFileHint, tick, 
         updatePublishButtonText, setStatus } from './UIManager.js';
import { renderImageGalleryFromText } from './ImageGalleryManager.js';

async function loadSettings() {
  try {
    return await getCachedSettings();
  } catch (error) {
    console.error("加载设置失败:", error);
    return { ...DEFAULT_SETTINGS };
  }
}

export async function initEditor() {
  const editor = document.getElementById("editor");
  if (!editor) return;

  const highlightEl = document.getElementById("editorHighlight");
  const settings = await loadSettings();

  // 加载草稿
  const draft = await loadDraft();
  editor.value = draft;

  // 初始化高亮
  initHighlight(editor, highlightEl, draft);
  updateWordCount(draft);
  
  // 初始化图片画廊
  try { renderImageGalleryFromText(draft); } catch (e) { /* ignore */ }

  // 加载草稿元数据
  const draftMeta = await loadDraftMeta();
  if (draft && draftMeta) {
    const d = new Date(draftMeta);
    setDraftState(`草稿：已保存（本地缓存） · 上次：${formatDate(d)} ${formatTime(d)}`);
  } else if (draft) {
    setDraftState("草稿：已保存（本地缓存）");
  } else {
    setDraftState("草稿：未保存");
  }

  await updateFileHint(settings);

  // 设置自动保存
  const autoSave = createAutoSave();

  // 输入事件
  editor.addEventListener("input", () => {
    const value = editor.value;
    
    scheduleInputUpdate(editor, highlightEl, value, (val) => {
      updateWordCount(val);
    });

    try {
      requestAnimationFrame(() => {
        updateVisibleHighlightNow(editor, highlightEl, value);
      });
    } catch (e) { /* ignore */ }

    autoSave(value);
  });

  // 设置滚动同步
  setupScrollSync(editor, highlightEl);

  // 设置粘贴处理
  setupPasteHandler(editor, loadSettings);

  // 设置按钮
  const settingsBtn = document.getElementById("openSettings");
  if (settingsBtn) {
    settingsBtn.addEventListener("click", async () => {
      const { openSettingsPage } = await import('../utils/ui.js');
      await openSettingsPage();
    });
  }

  // 发表按钮
  const publishAndPushBtn = document.getElementById("publishAndPush");
  if (publishAndPushBtn) {
    updatePublishButtonText(!!(settings && settings.push));
    
    publishAndPushBtn.addEventListener("click", async () => {
      const content = editor.value;
      if (!content || !content.trim()) {
        showToast("内容为空，无法发表", "warning", 1500);
        return;
      }

      // 检查按钮是否已禁用（防止并发）
      if (publishAndPushBtn.disabled) {
        showToast("正在进行发布操作，请稍候…", "warning", 1200);
        return;
      }

      const currentSettings = await loadSettings();
      const originalText = publishAndPushBtn.textContent;
      publishAndPushBtn.textContent = "发布中...";
      setButtonLoading(publishAndPushBtn, true);
      
      try {
        await publish(content, currentSettings);
        // 发布成功后按钮文本会在 publish 函数中处理（清空编辑器后恢复）
      } catch (error) {
        // 发布失败，恢复按钮文本
        publishAndPushBtn.textContent = originalText;
      } finally {
        setButtonLoading(publishAndPushBtn, false);
        // 确保按钮文本恢复
        if (publishAndPushBtn.textContent === "发布中...") {
          publishAndPushBtn.textContent = originalText;
        }
      }
    });
  }

  // 时钟
  tick();
  setInterval(tick, 1000);

  // 快捷键支持
  editor.addEventListener("keydown", (e) => {
    // Ctrl/Cmd + S: 手动保存
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      const value = editor.value;
      autoSave(value);
      showToast("已手动保存", "success", 1500);
    }
    
    // Ctrl/Cmd + Enter: 发表并推送
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (publishAndPushBtn && !publishAndPushBtn.disabled) {
        publishAndPushBtn.click();
      }
    }
  });

  // 监听设置变化
  const SETTINGS_KEY = "dw_settings_v1";
  try {
    chrome.storage.onChanged.addListener(async (changes, area) => {
      if (area === 'sync' && changes[SETTINGS_KEY]) {
        const newSettings = await loadSettings();
        await updateFileHint(newSettings);
        try {
          const newVal = changes[SETTINGS_KEY].newValue;
          if (newVal && typeof newVal.push !== 'undefined') {
            updatePublishButtonText(!!newVal.push);
          }
        } catch (e) { /* ignore */ }
      }
    });
  } catch (e) { /* ignore */ }

  // 监听设置保存消息（跨页面通知）
  try {
    chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
      if (message && (message.type === 'SETTINGS_SAVED' || message.type === 'FOLDER_CHANGED')) {
        const newSettings = await loadSettings();
        await updateFileHint(newSettings);
        if (newSettings && typeof newSettings.push !== 'undefined') {
          updatePublishButtonText(!!newSettings.push);
        }
      }
    });
  } catch (e) { /* ignore */ }

  // 监听本地授权清除事件
  try {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('dw:handleCleared', async () => {
        try {
          showToast('本地授权已解除', 'success', 1600);
          const newSettings = await loadSettings();
          await updateFileHint(newSettings);
        } catch (e) { /* ignore */ }
      });
    }
  } catch (e) { /* ignore */ }

  // 聚焦编辑器
  editor.focus();

  setStatus("就绪");
}
