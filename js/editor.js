import { showToast, showConfirm, formatDate, formatTime, debounce, countChars, countWords, setButtonLoading, getSavedDirectoryHandle, githubPutFile } from './utils.js';

const DRAFT_KEY = "dw_draft_v1";
const SETTINGS_KEY = "dw_settings_v1";

function setStatus(text, cls = "status-ok") {
  const el = document.getElementById("status");
  if (el) {
    el.textContent = text;
    el.className = cls;
  }
}

function setDraftState(text) {
  const el = document.getElementById("draftState");
  if (el) {
    el.textContent = text;
  }
}

function updateWordCount(text) {
  const chars = countChars(text);
  const words = countWords(text);
  const countText = `${chars} 字符 / ${words} 字`;
  const countEl = document.getElementById("wordCount");
  if (countEl) countEl.textContent = countText;
}

async function updateFileHint() {
  const hintEl = document.getElementById("fileHint");
  if (!hintEl) return;
  try {
    const settings = await loadSettings();
    const filename = `${formatDate()}.md`;
    const dir = (settings && settings.targetDir) ? settings.targetDir : 'src/content/posts/dynamic/journals';
    const path = `${dir}/${filename}`.replace(/\/+/g, '/');
    hintEl.textContent = `${filename} → ${path}`;
  } catch (e) {
    // fallback
    const filename = `${formatDate()}.md`;
    hintEl.textContent = `${filename} → src/content/posts/dynamic/journals/`;
  }
}

async function loadSettings() {
  try {
    const obj = await chrome.storage.sync.get([SETTINGS_KEY]);
    return obj[SETTINGS_KEY] || {
      repoOwner: "FXnadu",
      repoName: "deepwhite-11ty",
      branch: "main",
      targetDir: "src/content/posts/dynamic/journals",
      commitPrefix: "dynamic:",
      simulate: true
    };
  } catch (error) {
    console.error("加载设置失败:", error);
    showToast("加载设置失败", "error");
    return {
      repoOwner: "FXnadu",
      repoName: "deepwhite-11ty",
      branch: "main",
      targetDir: "src/content/posts/dynamic/journals",
      commitPrefix: "dynamic:",
      simulate: true
    };
  }
}

async function saveDraft(value) {
  try {
    await chrome.storage.local.set({ [DRAFT_KEY]: value });
  } catch (error) {
    console.error("保存草稿失败:", error);
    showToast("保存草稿失败", "error");
  }
}

async function loadDraft() {
  try {
    const obj = await chrome.storage.local.get([DRAFT_KEY]);
    return obj[DRAFT_KEY] || "";
  } catch (error) {
    console.error("加载草稿失败:", error);
    return "";
  }
}

function tick() {
  const el = document.getElementById("clock");
  if (el) {
    const now = new Date();
    el.textContent = `${formatDate(now)} ${formatTime(now)}`;
  }
}

// 初始化
(async function init() {
  const editor = document.getElementById("editor");
  if (!editor) return;

  // 加载草稿
  const draft = await loadDraft();
  editor.value = draft;
  updateWordCount(draft);
  await updateFileHint();

  // 自动保存（防抖）
  const saveDraftDebounced = debounce(async (value) => {
    await saveDraft(value);
    setDraftState("草稿：已保存到本地");
    setStatus("就绪");
    showToast("草稿已自动保存", "success", 1500);
  }, 500);

  let isSaving = false;
  editor.addEventListener("input", () => {
    const value = editor.value;
    updateWordCount(value);
    
    if (!isSaving) {
      setDraftState("草稿：已修改（自动保存中…）");
      setStatus("编辑中");
      isSaving = true;
    }
    
    saveDraftDebounced(value);
    
    setTimeout(() => {
      isSaving = false;
    }, 600);
  });

  // 清空草稿
  const clearBtn = document.getElementById("clearDraft");
  if (clearBtn) {
    clearBtn.addEventListener("click", async () => {
      if (editor.value.trim()) {
        const confirmed = await showConfirm(
          "清空草稿",
          "确定要清空当前草稿吗？此操作不可恢复。",
          "清空",
          "取消"
        );
        if (!confirmed) return;
      }
      
      editor.value = "";
      await saveDraft("");
      updateWordCount("");
      setDraftState("草稿：已清空");
      setStatus("就绪");
      editor.focus();
      showToast("草稿已清空", "success");
    });
  }

  // 打开设置
  const settingsBtn = document.getElementById("openSettings");
  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });
  }

  // "发表并推送" 按钮
  const publishAndPushBtn = document.getElementById("publishAndPush");

  async function writeLocalFile(filename, content) {
    const dirHandle = (typeof window.getSavedDirectoryHandle === 'function') ? await window.getSavedDirectoryHandle() : null;
    if (!dirHandle) return { ok: false, reason: 'no_folder' };
    try {
      const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      return { ok: true };
    } catch (e) {
      console.error("本地写入失败:", e);
      return { ok: false, reason: e };
    }
  }


  if (publishAndPushBtn) {
    publishAndPushBtn.addEventListener("click", async () => {
      const settings = await loadSettings();
      const filename = `${formatDate()}.md`;
      const path = `${settings.targetDir}/${filename}`.replace(/\/+/g, '/');
      const body = editor.value.trim();
      if (!body) {
        setStatus("内容为空", "status-warn");
        showToast("请先输入内容", "warning");
        editor.focus();
        return;
      }

      setButtonLoading(publishAndPushBtn, true);
      setStatus("正在保存并推送…", "status-ok");
      try {
        // 1) 本地写入优先（若未选择则保存为草稿）
        const res = await writeLocalFile(filename, body);
        if (res.ok) {
          showToast(`本地已创建 ${filename}`, "success", 1800);
        } else if (res.reason === 'no_folder') {
          await saveDraft(body);
          showToast("未选择本地文件夹，已保存到草稿", "warning");
        } else {
          showToast("本地保存失败（已尝试继续推送）", "warning");
        }

        // 2) 依据 mode 决定是否推送
        if (settings.mode === 'local-and-push') {
          try {
            const tokenObj = await chrome.storage.local.get(['dw_github_token_v1']);
            const token = tokenObj['dw_github_token_v1'];
            if (!token) throw new Error('缺少 GitHub Token，请在设置中填写并保存');

            const contentBase64 = btoa(unescape(encodeURIComponent(body)));
            const commitMessage = `${settings.commitPrefix || 'dynamic:'} ${filename}`;
            await githubPutFile({
              owner: settings.repoOwner,
              repo: settings.repoName,
              path,
              branch: settings.branch,
              message: commitMessage,
              contentBase64,
              token
            });
            showToast("已推送到 GitHub", "success", 2500);
          } catch (e) {
            console.error("推送失败:", e);
            showToast("推送到 GitHub 失败: " + (e.message || e), "error");
          }
        } else if (settings.mode === 'simulate') {
          const preview = `将创建：${path}\n提交信息：${settings.commitPrefix} ${filename}\n\n---\n${body.substring(0, 280)}${body.length > 280 ? "…" : ""}`;
          await showConfirm("发表预览（模拟）", preview, "确认发表", "取消");
          showToast("已模拟发表", "success");
        } else if (settings.mode === 'local-only') {
          showToast("当前 Mode 为仅本地保存，已完成本地保存（未推送）", "success");
        }

        // 清空草稿并更新 UI（本地保存已完成）
        await saveDraft("");
        editor.value = "";
        updateWordCount("");
        setDraftState("草稿：已发表并清空");
        setStatus("已发表（本地+远程）", "status-success");
      } catch (error) {
        console.error("发表失败:", error);
        setStatus("发表失败", "status-err");
        showToast("发表失败: " + (error.message || error), "error");
      } finally {
        setButtonLoading(publishAndPushBtn, false);
      }
    });
  }

  // no separate save-to-file UI: publish button handles local write or draft fallback

  // 时钟更新
  setInterval(tick, 1000);
  tick();

  // 快捷键支持
  editor.addEventListener("keydown", (e) => {
    // Ctrl/Cmd + S: 手动保存
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveDraft(editor.value);
      showToast("已手动保存", "success", 1500);
    }
    
    // Ctrl/Cmd + Enter: 发表并推送（默认）
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (publishAndPushBtn && !publishAndPushBtn.disabled) {
        publishAndPushBtn.click();
      }
    }
  });

  // 监听设置变化，动态更新目标路径提示
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes[SETTINGS_KEY]) {
        updateFileHint().catch(() => {});
      }
    });
  } catch (e) { /* noop for environments without listener */ }

  // 聚焦编辑器
  editor.focus();
})();
