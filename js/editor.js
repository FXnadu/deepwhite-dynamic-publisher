import { showToast, showConfirm, showChoice, showPrompt, formatDate, formatTime, debounce, countChars, countWords, setButtonLoading, getSavedDirectoryHandle, clearSavedDirectoryHandle, githubPutFile, parseRepoUrl, getCachedSettings } from './utils.js';

const DRAFT_KEY = "dw_draft_v1";
const DRAFT_META_KEY = "dw_draft_meta_v1"; // stores lastSavedAt timestamp (ms since epoch)
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

// (恢复草稿 功能已移除 — 相关按钮与逻辑在 HTML/JS 中被删除)

let __savedFlashTimer = null;
const SAVED_FLASH_IDLE_MS = 2000; // keep indicator visible for this long after last activity
function flashDraftState() {
  const el = document.getElementById("draftState");
  if (!el) return;
  el.classList.add('saved-flash');
  // reset hide timer so repeated calls (typing or saves) prolong the indicator
  if (__savedFlashTimer) {
    clearTimeout(__savedFlashTimer);
  }
  __savedFlashTimer = setTimeout(() => {
    try { el.classList.remove('saved-flash'); } catch (e) {}
    __savedFlashTimer = null;
  }, SAVED_FLASH_IDLE_MS);
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
    const fullPath = `${dir}/${filename}`.replace(/\/+/g, '/');
    // display directory only (avoid repeating filename)
    const suffix = `/${filename}`;
    const displayDir = fullPath.endsWith(suffix) ? fullPath.slice(0, -suffix.length) : fullPath;
    // Render filename + dir and a copy button (copies full path)
    hintEl.innerHTML = `
      <span class="hint-file-name">${filename}</span>
      <span style="margin:0 8px;">→</span>
      <span class="hint-file-dir" title="${fullPath}">${displayDir}</span>
      <button id="copyPathBtn" class="copy-path-btn" title="复制完整路径" aria-label="复制完整路径">📋</button>
    `;
    // Attach copy handler
    const copyBtn = document.getElementById('copyPathBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(fullPath);
          } else {
            // fallback
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
    // fallback
    const filename = `${formatDate()}.md`;
    hintEl.textContent = `${filename} → src/content/posts/dynamic/journals/`;
  }
}

async function loadSettings() {
  try {
    return await getCachedSettings();
  } catch (error) {
    console.error("加载设置失败:", error);
    showToast("加载设置失败", "error");
    return {
      repoUrl: "FXnadu/deepwhite-11ty",
      branch: "main",
      targetDir: "src/content/posts/dynamic/journals",
      commitPrefix: "dynamic:",
      push: false
    };
  }
}

async function saveDraft(value) {
  try {
    await chrome.storage.local.set({ [DRAFT_KEY]: value });
    if (value && value.length > 0) {
      const ts = Date.now();
      await chrome.storage.local.set({ [DRAFT_META_KEY]: ts });
    } else {
      // remove meta when draft cleared
      await chrome.storage.local.remove([DRAFT_META_KEY]);
    }
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

async function loadDraftMeta() {
  try {
    const obj = await chrome.storage.local.get([DRAFT_META_KEY]);
    return obj[DRAFT_META_KEY] || null;
  } catch (error) {
    console.error("加载草稿元信息失败:", error);
    return null;
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

  // --- Lightweight Markdown highlight rendering ---
  // Render simple markdown tokens (heading hashes, inline code, bold) into the overlay.
  const highlightEl = document.getElementById("editorHighlight");

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Measure and cache line height for the editor textarea (used to compute visible lines)
  let __cachedLineHeight = null;
  function getLineHeight() {
    if (__cachedLineHeight) return __cachedLineHeight;
    try {
      const style = window.getComputedStyle(editor);
      let lh = parseFloat(style.lineHeight);
      if (Number.isFinite(lh) && lh > 0) {
        __cachedLineHeight = lh;
        return lh;
      }
    } catch (e) { /* ignore */ }
    // Fallback: create a hidden measurement element
    try {
      const div = document.createElement('div');
      div.style.position = 'absolute';
      div.style.visibility = 'hidden';
      div.style.whiteSpace = 'pre';
      div.style.font = window.getComputedStyle(editor).font;
      div.textContent = 'A';
      document.body.appendChild(div);
      const measured = div.getBoundingClientRect().height;
      document.body.removeChild(div);
      __cachedLineHeight = measured || 16;
      return __cachedLineHeight;
    } catch (e) {
      __cachedLineHeight = 16;
      return 16;
    }
  }

  function renderHighlight(text) {
    if (!text && text !== "") return "";
    // preserve trailing newline for correct height
    let escaped = escapeHtml(text);
    if (escaped.endsWith("\n")) escaped = escaped.replace(/\n$/," \n");

    // Headings: color the leading hashes (e.g., "## ")
    escaped = escaped.replace(/^([ \t]*)(#{1,6})(?=\s)/gm, (m, p1, hashes) => {
      return p1 + `<span class="md-sym md-heading">${hashes}</span>`;
    });

    // Inline code: wrap backticks + content
    escaped = escaped.replace(/`([^`\n]+)`/g, (m, code) => {
      return `<span class="md-code">\`${escapeHtml(code)}\`</span>`;
    });

    // Bold **text** — color the surrounding ** markers
    escaped = escaped.replace(/\*\*([^\*\n]+)\*\*/g, (m, inner) => {
      return `<span class="md-sym md-bold">**</span>${escapeHtml(inner)}<span class="md-sym md-bold">**</span>`;
    });

    // Links [text](url) — color the brackets and parens lightly
    escaped = escaped.replace(/\[([^\]\n]+)\]\(([^\)\n]+)\)/g, (m, t, u) => {
      return `<span class="md-link">[${escapeHtml(t)}](${escapeHtml(u)})</span>`;
    });

    // preserve line breaks
    escaped = escaped.replace(/\n/g, "<br/>");
    return escaped;
  }

  // Performance: throttle highlight/wordcount updates to avoid doing heavy work on every keystroke.
  const HIGHLIGHT_MAX_CHARS = 50000; // if document larger than this, skip full highlight
  let __inputUpdateTimer = null;
  let __lastInputValue = "";
  let __idleCallbackId = null;
  function scheduleInputUpdate(value) {
    __lastInputValue = value;
    if (__inputUpdateTimer) {
      clearTimeout(__inputUpdateTimer);
    }
    // short debounce to batch rapid typing
    __inputUpdateTimer = setTimeout(() => {
      __inputUpdateTimer = null;
      // update lightweight UI (word count) promptly in rAF
      requestAnimationFrame(() => {
        updateWordCount(__lastInputValue);
      });

      // schedule heavy highlight work in idle period to avoid jank
      const doHighlight = () => {
        try {
          if (!highlightEl) return;
          if (__lastInputValue.length <= HIGHLIGHT_MAX_CHARS) {
            updateHighlight(__lastInputValue);
          } else {
            // for extremely large documents, avoid heavy HTML generation and show truncated hint
            const truncated = escapeHtml(__lastInputValue.slice(0, 2000)).replace(/\n/g, "<br/>");
            highlightEl.innerHTML = `${truncated}<br/><div style="color:var(--color-meta);font-size:12px;margin-top:6px;">（高亮已禁用：文件过大）</div>`;
          }
        } catch (e) {
          // ignore rendering errors
        }
      };

      if (typeof requestIdleCallback === 'function') {
        if (__idleCallbackId) {
          cancelIdleCallback(__idleCallbackId);
          __idleCallbackId = null;
        }
        __idleCallbackId = requestIdleCallback(() => {
          __idleCallbackId = null;
          doHighlight();
          // also update image gallery based on markdown in idle time
          renderImageGalleryFromText(__lastInputValue);
        }, { timeout: 600 });
      } else {
        // fallback: run in next animation frame (less ideal)
        requestAnimationFrame(() => { doHighlight(); renderImageGalleryFromText(__lastInputValue); });
      }
    }, 150);
  }

  function updateHighlight(value) {
    if (!highlightEl) return;
    const text = value || "";
    // If small enough, render full highlight as before
    if (text.length <= HIGHLIGHT_MAX_CHARS) {
      highlightEl.innerHTML = renderHighlight(text);
      return;
    }

    // For very large documents, only render visible lines to avoid heavy work.
    try {
      const lineHeight = getLineHeight();
      const totalLines = text.split('\n').length;
      const startLine = Math.max(0, Math.floor(editor.scrollTop / lineHeight));
      const visibleLines = Math.max(1, Math.ceil(editor.clientHeight / lineHeight) + 2); // small buffer
      const endLine = Math.min(totalLines, startLine + visibleLines);
      const lines = text.split('\n');
      const chunk = lines.slice(startLine, endLine).join('\n');
      const topPad = startLine * lineHeight;
      const bottomPad = Math.max(0, (totalLines - endLine) * lineHeight);
      const rendered = renderHighlight(chunk || "");
      highlightEl.innerHTML = `<div style="height:${topPad}px"></div>${rendered}<div style="height:${bottomPad}px"></div>`;
    } catch (e) {
      // Fallback to empty highlight to avoid throwing during scroll
      highlightEl.textContent = "";
    }
  }
  // sync scroll
  if (highlightEl) {
    // throttle scroll synchronization to animation frames; avoid redundant DOM writes
    let __scrolling = false;
    let __lastScrollTop = -1;
    let __lastScrollLeft = -1;
    let __lastVisibleStartLine = -1;
    const SCROLL_EPSILON = 1; // pixels
    editor.addEventListener("scroll", () => {
      if (__scrolling) return;
      __scrolling = true;
      requestAnimationFrame(() => {
        try {
          const scrollTop = editor.scrollTop;
          const scrollLeft = editor.scrollLeft;
          // skip if effectively unchanged
          if (Math.abs(scrollTop - __lastScrollTop) >= SCROLL_EPSILON) {
            highlightEl.scrollTop = scrollTop;
            __lastScrollTop = scrollTop;
          }
          if (Math.abs(scrollLeft - __lastScrollLeft) >= SCROLL_EPSILON) {
            highlightEl.scrollLeft = scrollLeft;
            __lastScrollLeft = scrollLeft;
          }

          // For very large docs, only update visible chunk when visible start line changes
          if (editor.value && editor.value.length > HIGHLIGHT_MAX_CHARS) {
            try {
              const lineHeight = getLineHeight();
              const startLine = Math.max(0, Math.floor(scrollTop / lineHeight));
              if (startLine !== __lastVisibleStartLine) {
                __lastVisibleStartLine = startLine;
                updateHighlight(editor.value);
              }
            } catch (e) {
              // ignore
            }
          }
        } finally {
          __scrolling = false;
        }
      });
    }, { passive: true });
  }
  // --- end highlight helpers ---

  // 加载草稿
  const draft = await loadDraft();
  editor.value = draft;
  // initialize highlight layer with draft
  updateHighlight(draft);
  updateWordCount(draft);
  // load draft metadata (last saved timestamp) and update draftState UI
  const draftMeta = await loadDraftMeta();
  if (draft && draftMeta) {
    const d = new Date(draftMeta);
    setDraftState(`草稿：已保存（本地缓存） · 上次：${formatDate(d)} ${formatTime(d)}`);
  } else if (draft) {
    setDraftState("草稿：已保存（本地缓存）");
  } else {
    setDraftState("草稿：未保存");
  }
  await updateFileHint();

  // 自动保存（防抖）
  const saveDraftDebounced = debounce(async (value) => {
    await saveDraft(value);
    // 显示更明确的文案并带上时间戳
    const now = new Date();
    setDraftState(`草稿：已保存（本地缓存） · 上次：${formatDate(now)} ${formatTime(now)}`);
    setStatus("就绪");
    // 使用轻量的局部提示代替频繁的 toast，避免干扰与性能开销
    flashDraftState();
    // (恢复草稿 按钮已移除)
  }, 1000);

  let isSaving = false;
  editor.addEventListener("input", () => {
    const value = editor.value;
    // Schedule expensive updates (wordcount + highlight) to a debounced rAF batch.
    scheduleInputUpdate(value);

    if (!isSaving) {
      setDraftState("草稿：已修改（自动保存中…）");
      setStatus("编辑中");
      isSaving = true;
    }

    // show the saved-flash indicator immediately while typing; it will be kept visible
    // until the user is idle for SAVED_FLASH_IDLE_MS (configured in flashDraftState).
    flashDraftState();
    saveDraftDebounced(value);

    setTimeout(() => {
      isSaving = false;
    }, 600);
  });

  // Paste image handling (PicGo)
  editor.addEventListener('paste', async (e) => {
    try {
      const items = (e.clipboardData && e.clipboardData.items) ? Array.from(e.clipboardData.items) : [];
      if (!items.length) return;
      for (const item of items) {
        if (item && item.type && item.type.indexOf('image') === 0) {
          const file = item.getAsFile();
          if (!file) continue;
          e.preventDefault();
          const settings = await loadSettings();
          const endpoint = settings.picgoEndpoint;
          const token = settings.picgoToken;
          const auto = !!settings.picgoAutoUpload;
          showToast("检测到图片，开始处理…", "success", 1000);

          if (auto && endpoint) {
            setStatus("图片上传中…", "status-ok");
            try {
              const url = await uploadToPicGo(endpoint, file, token);
              const ta = document.getElementById('editor');
              insertTextAtCursor(ta, `![](${url})\n`);
              renderImageGalleryFromText(ta.value);
              showToast("图片上传成功", "success", 1600);
            } catch (err) {
              console.error("PicGo 上传失败:", err);
              showToast("图片上传失败，尝试保存到本地", "warning", 1800);
              // fallback: try saving to local images folder inside targetDir
              try {
                const now = new Date();
                const hh = String(now.getHours()).padStart(2,'0');
                const mm = String(now.getMinutes()).padStart(2,'0');
                const ss = String(now.getSeconds()).padStart(2,'0');
                const imgName = `${formatDate(now)}-${hh}${mm}${ss}.png`;
                const saveRes = await writeLocalFile(imgName, file, (settings.targetDir || 'src/content/posts/dynamic/journals') + '/images');
                if (saveRes && saveRes.ok) {
                  const ta = document.getElementById('editor');
                  insertTextAtCursor(ta, `![](${saveRes.path || imgName})\n`);
                  renderImageGalleryFromText(ta.value);
                  showToast("图片已保存到本地", "success", 1600);
                } else {
                  // as last resort, prompt download
                  exportBlobAsFile(imgName, file);
                }
              } catch (e) {
                console.error("本地保存图片失败:", e);
                exportBlobAsFile(`${formatDate()}-pasted.png`, file);
              }
            } finally {
              setStatus("就绪", "status-ok");
            }
          } else {
            // not auto-upload: ask user
            const choice = await showChoice('检测到图片', '检测到剪贴板图片，选择操作：', [
              { id: 'upload', label: '上传到 PicGo', btnClass: 'btn-primary' },
              { id: 'local', label: '保存到本地', btnClass: '' },
              { id: 'cancel', label: '取消', btnClass: '' }
            ]);
            if (choice === 'upload' && endpoint) {
              try {
                const url = await uploadToPicGo(endpoint, file, token);
                const ta = document.getElementById('editor');
                insertTextAtCursor(ta, `![](${url})\n`);
                renderImageGalleryFromText(ta.value);
                showToast("图片上传成功", "success", 1600);
              } catch (err) {
                console.error("PicGo 上传失败:", err);
                showToast("上传失败，已导出图片", "warning", 1800);
                exportBlobAsFile(`${formatDate()}-pasted.png`, file);
              }
            } else if (choice === 'local') {
              try {
                const now = new Date();
                const hh = String(now.getHours()).padStart(2,'0');
                const mm = String(now.getMinutes()).padStart(2,'0');
                const ss = String(now.getSeconds()).padStart(2,'0');
                const imgName = `${formatDate(now)}-${hh}${mm}${ss}.png`;
                const saveRes = await writeLocalFile(imgName, file, (settings.targetDir || 'src/content/posts/dynamic/journals') + '/images');
                if (saveRes && saveRes.ok) {
                  const ta = document.getElementById('editor');
                  insertTextAtCursor(ta, `![](${saveRes.path || imgName})\n`);
                  renderImageGalleryFromText(ta.value);
                  showToast("图片已保存到本地", "success", 1600);
                } else {
                  exportBlobAsFile(imgName, file);
                }
              } catch (e) {
                console.error("保存本地图片失败:", e);
                exportBlobAsFile(`${formatDate()}-pasted.png`, file);
              }
            } else {
              // cancelled
            }
          }
          break;
        }
      }
    } catch (e) {
      console.error("处理粘贴图片时出错:", e);
    }
  });

  // 清空草稿按钮已从 UI 中移除，相关逻辑随之删除。

  // 恢复草稿功能已移除（按钮与相关逻辑从 UI 与脚本中清理）

  // 打开设置
  const settingsBtn = document.getElementById("openSettings");
  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });
  }

  // "发表并推送" 按钮
  const publishAndPushBtn = document.getElementById("publishAndPush");

  // 更新按钮文案（根据设置中的 push 字段）
  function updatePublishButtonText(shouldPush) {
    if (!publishAndPushBtn) return;
    const text = shouldPush ? "发表并推送" : "保存到本地";
    publishAndPushBtn.textContent = text;
    publishAndPushBtn.title = text;
    publishAndPushBtn.setAttribute('aria-label', text);
  }

  // 初始化按钮文案（来自设置）
  (async function initPublishButton() {
    try {
      const settingsNow = await loadSettings();
      updatePublishButtonText(!!(settingsNow && settingsNow.push));
    } catch (err) {
      console.error("初始化发表按钮失败:", err);
    }
  })();
  // Ensure publish button is not stuck in loading state on init
  try {
    if (publishAndPushBtn) {
      // remove any leftover loading class and re-enable button text/interaction
      publishAndPushBtn.classList.remove('btn-loading');
      publishAndPushBtn.disabled = false;
      // enforce button text from settings one more time
      (async () => {
        try {
          const s = await loadSettings();
          updatePublishButtonText(!!(s && s.push));
        } catch (e) { /* ignore */ }
      })();
    }
  } catch (e) { /* ignore init cleanup errors */ }

  async function ensureWritableDirectory(dirHandle) {
    if (typeof dirHandle.requestPermission === 'function') {
      const permission = await dirHandle.requestPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        return { ok: false, reason: 'permission_denied' };
      }
    }
    return { ok: true };
  }

  async function getTargetDirectory(dirHandle, targetDirPath) {
    const segments = (targetDirPath || '').split('/').map(s => s.trim()).filter(Boolean);
    let current = dirHandle;
    for (const segment of segments) {
      current = await current.getDirectoryHandle(segment, { create: true });
    }
    return { dir: current, subPath: segments.join('/') };
  }
  /**
   * 检查目标目录下是否存在同名文件，若存在读取其内容并返回
   * @param {string} filename
   * @param {string} targetDirPath
   * @returns {Promise<{exists:boolean, content?:string, path?:string}>}
   */
  async function checkExistingLocalFile(filename, targetDirPath) {
    const dirHandle = (typeof window.getSavedDirectoryHandle === 'function') ? await window.getSavedDirectoryHandle() : null;
    if (!dirHandle) return { exists: false };
    try {
      const { dir: targetDir, subPath } = await getTargetDirectory(dirHandle, targetDirPath);
      try {
        const fileHandle = await targetDir.getFileHandle(filename, { create: false });
        const file = await fileHandle.getFile();
        const text = await file.text();
        const relativePath = subPath ? `${subPath}/${filename}` : filename;
        return { exists: true, content: text, path: relativePath };
      } catch (e) {
        // file doesn't exist or inaccessible
        return { exists: false };
      }
    } catch (e) {
      return { exists: false };
    }
  }

  async function writeLocalFile(filename, content, targetDirPath) {
    const dirHandle = (typeof window.getSavedDirectoryHandle === 'function') ? await window.getSavedDirectoryHandle() : null;
    if (!dirHandle) return { ok: false, reason: 'no_folder' };
    try {
      const writableCheck = await ensureWritableDirectory(dirHandle);
      if (!writableCheck.ok) {
        return writableCheck;
      }

      const { dir: targetDir, subPath } = await getTargetDirectory(dirHandle, targetDirPath);
      const fileHandle = await targetDir.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      const relativePath = subPath ? `${subPath}/${filename}` : filename;
      return { ok: true, path: relativePath };
    } catch (e) {
      console.error("本地写入失败:", e);
      const name = e && e.name ? e.name : null;
      const msg = e && e.message ? e.message : String(e);
      // If it's a permission/security related DOMException, clear the saved handle so user can re-pick
      if (name === 'NotAllowedError' || name === 'SecurityError' || (msg && msg.toLowerCase().includes('permission'))) {
        try {
          // prefer imported helper, fallback to window-exposed helper if available
          if (typeof clearSavedDirectoryHandle === 'function') {
            await clearSavedDirectoryHandle();
          } else if (window && typeof window.clearSavedDirectoryHandle === 'function') {
            await window.clearSavedDirectoryHandle();
          }
        } catch (clearErr) {
          // ignore errors while clearing handle
          console.warn('清除已保存的目录句柄失败:', clearErr);
        }
        return { ok: false, reason: 'permission_denied', error: `${name}: ${msg}` };
      }
      return { ok: false, reason: msg || e };
    }
  }

  // prevent concurrent publish operations
  let __publishLock = false;

  // helper: export current draft as a downloadable .md file
  function exportDraftAsFile(filename, content) {
    try {
      const blob = new Blob([content || ""], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `${formatDate()}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast("草稿已导出", "success", 1400);
    } catch (e) {
      console.error("导出草稿失败", e);
      showToast("导出草稿失败", "error");
    }
  }

  // helper: export a Blob/File directly
  function exportBlobAsFile(filename, blob) {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `${formatDate()}.bin`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast("文件已导出", "success", 1200);
    } catch (e) {
      console.error("导出文件失败", e);
      showToast("导出文件失败", "error");
    }
  }

  // insert text at cursor position in textarea
  function insertTextAtCursor(textarea, text) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = textarea.value;
    textarea.value = val.slice(0, start) + text + val.slice(end);
    const cursor = start + text.length;
    textarea.selectionStart = textarea.selectionEnd = cursor;
    textarea.focus();
    updateWordCount(textarea.value);
    updateHighlight(textarea.value);
  }

  // Parse markdown image URLs from text: ![alt](url)
  function parseImageUrlsFromText(text) {
    if (!text) return [];
    const urls = [];
    const re = /!\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      try {
        const u = m[1].trim();
        if (u) urls.push(u);
      } catch (e) { /* ignore */ }
    }
    return urls;
  }

  // Render the image gallery from an array of URLs
  function renderImageGalleryFromText(text) {
    try {
      const gallery = document.getElementById('imageGallery');
      if (!gallery) return;
      const urls = parseImageUrlsFromText(text);
      // dedupe while preserving order
      const seen = new Set();
      const unique = [];
      for (const u of urls) {
        if (!seen.has(u)) {
          seen.add(u);
          unique.push(u);
        }
      }
      // limit to last 40 images
      const list = unique.slice(-40);
      gallery.innerHTML = '';
      for (const u of list) {
        const item = document.createElement('div');
        item.className = 'image-item';
        const a = document.createElement('a');
        a.href = u;
        a.target = '_blank';
        const img = document.createElement('img');
        img.src = u;
        img.alt = '';
        a.appendChild(img);
        const meta = document.createElement('div');
        meta.className = 'meta';
        // controls: copy link & delete (delete shown as cross)
        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.gap = '6px';
        controls.style.marginTop = '6px';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn btn-icon';
        copyBtn.title = '复制图片链接';
        copyBtn.textContent = '📋';
        copyBtn.addEventListener('click', async (ev) => {
          ev.preventDefault();
          try {
            if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(u);
            } else {
              const ta = document.createElement('textarea');
              ta.value = u;
              document.body.appendChild(ta);
              ta.select();
              document.execCommand('copy');
              document.body.removeChild(ta);
            }
            showToast('图片链接已复制', 'success', 1200);
          } catch (err) {
            console.error('复制图片链接失败', err);
            showToast('复制失败', 'error', 1500);
          }
        });

        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-icon btn-text-danger';
        delBtn.title = '从文档中删除该图片';
        delBtn.textContent = '✖';
        delBtn.addEventListener('click', async (ev) => {
          ev.preventDefault();
          const ok = await showConfirm('删除图片', '确定要从文档中删除该图片链接吗？此操作可恢复（撤销）', '删除', '取消');
          if (!ok) return;
          try {
            const ta = document.getElementById('editor');
            if (!ta) return;
            const original = ta.value;
            const updated = removeImageMarkdownFromText(original, u);
            ta.value = updated;
            updateWordCount(updated);
            updateHighlight(updated);
            renderImageGalleryFromText(updated);
            await saveDraft(updated);
            showToast('图片链接已从文档中移除', 'success', 1400);
          } catch (e) {
            console.error('删除图片失败', e);
            showToast('删除失败', 'error', 1500);
          }
        });

        controls.appendChild(copyBtn);
        controls.appendChild(delBtn);
        meta.appendChild(controls);
        // clicking image opens preview
        img.addEventListener('click', (ev) => {
          ev.preventDefault();
          showImagePreview(u);
        });
        item.appendChild(a);
        item.appendChild(meta);
        gallery.appendChild(item);
      }
      if (list.length === 0) {
        gallery.innerHTML = '';
      }
    } catch (e) {
      console.error('渲染图片画廊失败', e);
    }
  }

  // Show full-size image preview modal
  function showImagePreview(url) {
    try {
      const overlay = document.createElement('div');
      overlay.className = 'image-preview-overlay';
      overlay.tabIndex = -1;

      const modal = document.createElement('div');
      modal.className = 'image-preview-modal';
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      modal.appendChild(img);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      const remove = () => {
        try { document.body.removeChild(overlay); } catch (e) { /* ignore */ }
        document.removeEventListener('keydown', onKey);
      };

      const onKey = (e) => {
        if (e.key === 'Escape') remove();
      };

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) remove();
      });
      document.addEventListener('keydown', onKey);
      // focus for accessibility
      overlay.focus();
    } catch (e) {
      console.error('打开图片预览失败', e);
    }
  }

  // Remove markdown image occurrences referencing a given URL from text
  function removeImageMarkdownFromText(text, url) {
    if (!text || !url) return text;
    // Remove only the first matching markdown image occurrence for the exact URL.
    // This avoids accidentally removing other content when regex matches are ambiguous.
    const re = /!\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
    let match;
    while ((match = re.exec(text)) !== null) {
      const foundUrl = (match[1] || '').trim();
      if (!foundUrl) continue;
      // match exact or decoded variants
      if (foundUrl === url || decodeURIComponent(foundUrl) === url || foundUrl === decodeURIComponent(url)) {
        const start = match.index;
        const end = re.lastIndex;
        let before = text.slice(0, start);
        let after = text.slice(end);
        // remove a single surrounding newline to avoid leaving extra blank lines
        before = before.replace(/[\t ]+$/g, '');
        after = after.replace(/^[\t ]+/g, '');
        // If there is a blank line boundary, remove one newline to tidy layout
        if (before.endsWith('\n') && after.startsWith('\n')) {
          after = after.replace(/^\n/, '');
        }
        const result = (before + after).replace(/\n{3,}/g, '\n\n');
        return result;
      }
    }
    // nothing removed
    return text;
  }

  if (publishAndPushBtn) {
    publishAndPushBtn.addEventListener("click", async () => {
      // prevent concurrent publishes
      if (__publishLock) {
        showToast("正在进行发布操作，请稍候…", "warning", 1200);
        return;
      }
      __publishLock = true;
      const settings = await loadSettings();
      const filename = `${formatDate()}.md`;
      const path = `${settings.targetDir}/${filename}`.replace(/\/+/g, '/');
      const body = editor.value.trim();
      if (!body) {
        setStatus("内容为空", "status-warn");
        showToast("请先输入内容", "warning");
        editor.focus();
        __publishLock = false;
        return;
      }

      let localSaveOk = false;
      let pushOk = !settings.push;

      setButtonLoading(publishAndPushBtn, true);
      setStatus("正在保存并推送…", "status-ok");
    try {
        // 1) 检查是否已存在同名本地文件，若存在则提示用户选择：覆盖 / 追加 / 新建文件 / 取消
        const existing = await checkExistingLocalFile(filename, settings.targetDir);
        let writeBody = body;
        let writeFilename = filename;
        if (existing.exists) {
          // 显示已有内容预览（最多前 800 字）
          const preview = (existing.content || '').slice(0, 800).replace(/</g, '&lt;').replace(/>/g, '&gt;');
          // Improved conflict handling: allow view diff and editable suggested filename
          let resolved = false;
          while (!resolved) {
            const choice = await showChoice(
              '检测到同名文件',
              `目标路径已存在同名文件：<br/><code>${existing.path}</code><br/><div class="choice-preview">${preview}${(existing.content || '').length > 800 ? '\n\n…（已截断）' : ''}</div><br/>请选择操作：`,
              [
                { id: 'overwrite', label: '覆盖（直接替换）', btnClass: 'btn-danger' },
                { id: 'append', label: '追加到文件末尾', btnClass: '' },
                { id: 'newfile', label: '另存为新文件（保留原文件）', btnClass: 'btn-primary' },
                { id: 'viewdiff', label: '查看差异', btnClass: '' },
                { id: 'cancel', label: '取消操作', btnClass: '' }
              ]
            );

            if (!choice || choice === 'cancel') {
              setStatus('已取消：未写入文件', 'status-warn');
              showToast('已取消写入', 'warning');
              setButtonLoading(publishAndPushBtn, false);
              return;
            }

            if (choice === 'append') {
              writeBody = (existing.content || '') + '\n\n' + body;
              resolved = true;
            } else if (choice === 'newfile') {
              // 提示用户输入/确认建议的文件名
              const now = new Date();
              const hh = String(now.getHours()).padStart(2, '0');
              const mm = String(now.getMinutes()).padStart(2, '0');
              const ss = String(now.getSeconds()).padStart(2, '0');
              const suggested = `${formatDate(now)}-${hh}${mm}${ss}.md`;
              try {
                const input = await showPrompt('另存为新文件', `请输入文件名（包含扩展名 .md）：`, suggested, '确定', '取消');
                if (input && input.trim()) {
                  writeFilename = input.trim();
                  resolved = true;
                } else {
                  // 用户取消或未输入，返回上一级选择
                  continue;
                }
              } catch (e) {
                // fallback to suggested
                writeFilename = suggested;
                resolved = true;
              }
            } else if (choice === 'viewdiff') {
              // show a simple preview diff: original vs new (truncated)
              const safeOriginal = (existing.content || '').slice(0, 1500).replace(/</g, '&lt;').replace(/>/g, '&gt;');
              const safeNew = (body || '').slice(0, 1500).replace(/</g, '&lt;').replace(/>/g, '&gt;');
              await showConfirm('差异预览', `<div class="choice-preview"><strong>已存在文件（前1500字符）：</strong>\n\n${safeOriginal}\n\n<strong>当前草稿（前1500字符）：</strong>\n\n${safeNew}</div>`, '返回', '关闭');
              // loop continues to let user choose again
            } else {
              // overwrite -> proceed
              resolved = true;
            }
          }
        }

        const res = await writeLocalFile(writeFilename, writeBody, settings.targetDir);
        if (res.ok) {
          localSaveOk = true;
          const localPath = res.path || writeFilename;
          showToast(`本地已创建 ${localPath}`, "success", 1800);
          // 显示更简单的状态，不展示具体本地路径
          setStatus("已保存到本地", "status-ok");

          // Optimistic UI: clear editor visuals immediately but keep a backup of content.
          const backup = editor.value;
          try {
            editor.value = "";
            updateWordCount("");
            try { updateHighlight(""); } catch (_) {}
            try { renderImageGalleryFromText(""); } catch (_) {}
            // try persist empty draft; if it fails restore backup to avoid data loss
            try {
              await saveDraft("");
              setDraftState("草稿：已发表并清空");
            } catch (saveErr) {
              console.warn("保存空草稿失败，恢复原内容以避免数据丢失:", saveErr);
              // restore content and UI
              editor.value = backup;
              updateWordCount(backup);
              try { updateHighlight(backup); } catch (_) {}
              try { renderImageGalleryFromText(backup); } catch (_) {}
              setDraftState("草稿：已保存（恢复原内容）");
            }
          } catch (clearErr) {
            console.warn("清空编辑器视觉内容时出错:", clearErr);
          }
        } else {
          // 本地写入失败：提供用户可选操作（重试 / 导出草稿 / 打开设置 / 取消）
          try {
            const detail = res && (res.error || res.errorDetails || res.reason) ? (res.error || res.errorDetails || res.reason) : '未知错误';
            const localChoice = await showChoice(
              '本地保存失败',
              `本地保存失败：<br/><code>${detail}</code><br/><br/>你可以重试保存、导出当前草稿或打开设置检查权限。`,
              [
                { id: 'retry', label: '重试保存', btnClass: 'btn-primary' },
                { id: 'export', label: '导出草稿', btnClass: '' },
                { id: 'settings', label: '打开设置', btnClass: '' },
                { id: 'cancel', label: '取消', btnClass: '' }
              ]
            );
            if (localChoice === 'retry') {
              const retryRes = await writeLocalFile(writeFilename, writeBody, settings.targetDir);
              if (retryRes && retryRes.ok) {
                localSaveOk = true;
                showToast(`本地已创建 ${retryRes.path || writeFilename}`, "success", 1600);
                setStatus("已保存到本地", "status-ok");
                // same optimistic clear as above
                const backupRetry = editor.value;
                try {
                  editor.value = "";
                  updateWordCount("");
                  try { updateHighlight(""); } catch (_) {}
                  try { renderImageGalleryFromText(""); } catch (_) {}
                  try {
                    await saveDraft("");
                    setDraftState("草稿：已发表并清空");
                  } catch (saveErr2) {
                    console.warn("保存空草稿失败（重试分支），恢复原内容:", saveErr2);
                    editor.value = backupRetry;
                    updateWordCount(backupRetry);
                    try { updateHighlight(backupRetry); } catch (_) {}
                    try { renderImageGalleryFromText(backupRetry); } catch (_) {}
                    setDraftState("草稿：已保存（恢复原内容）");
                  }
                } catch (e) { /* ignore */ }
              } else {
                await saveDraft(body);
                setStatus("本地保存失败，已暂存草稿", "status-warn");
              }
            } else if (localChoice === 'export') {
              exportDraftAsFile(writeFilename, writeBody);
              await saveDraft(body);
              setStatus("已导出草稿，未写入本地", "status-warn");
            } else if (localChoice === 'settings') {
              chrome.runtime.openOptionsPage();
              await saveDraft(body);
              setStatus("已保存草稿，打开设置以修复权限", "status-warn");
              return;
            } else {
              await saveDraft(body);
              setStatus("已保存草稿，未写入本地", "status-warn");
            }
          } catch (e) {
            console.error("处理本地写入失败时出错:", e);
            await saveDraft(body);
            setStatus("本地保存失败，已暂存草稿", "status-warn");
          }
        }

        // 2) 依据 mode 决定是否推送
        if (settings.push) {
          try {
            const tokenObj = await chrome.storage.local.get(['dw_github_token_v1']);
            const token = tokenObj['dw_github_token_v1'];
            if (!token) {
              // 提供更友好的引导：提示并可直接打开设置
              try {
                const choice = await showChoice(
                  '缺少 GitHub Token',
                  '当前未配置 GitHub Token，扩展需要 token 用于通过 GitHub API 提交文件。Token 将保存在扩展存储，存在一定风险，请确保来源可信。是否现在打开设置填写 token？',
                  [
                    { id: 'open', label: '打开设置', btnClass: 'btn-primary' },
                    { id: 'cancel', label: '取消', btnClass: '' }
                  ]
                );
                if (choice === 'open') {
                  chrome.runtime.openOptionsPage();
                }
              } catch (e) { /* ignore UI errors */ }
              throw new Error('缺少 GitHub Token，请在设置中填写并保存');
            }

            const contentBase64 = btoa(unescape(encodeURIComponent(body)));
            const commitMessage = `${settings.commitPrefix || 'dynamic:'} ${filename}`;
            const parsed = parseRepoUrl(settings.repoUrl || '');
            if (!parsed) throw new Error('无效的仓库地址，请在设置中使用 owner/repo 或完整 URL');
            await githubPutFile({
              owner: parsed.owner,
              repo: parsed.repo,
              path,
              branch: settings.branch,
              message: commitMessage,
              contentBase64,
              token
            });
            showToast("已推送到 GitHub", "success", 2500);
            pushOk = true;
          } catch (e) {
            console.error("推送失败:", e);
            // 给用户可选操作：重试推送 / 导出草稿 / 打开设置 / 取消
            try {
              const pushChoice = await showChoice(
                '远程推送失败',
                `推送到 GitHub 失败：<br/><code>${e && e.message ? e.message : String(e)}</code><br/><br/>你可以重试推送、导出草稿或打开设置检查 token。`,
                [
                  { id: 'retry', label: '重试推送', btnClass: 'btn-primary' },
                  { id: 'export', label: '导出草稿', btnClass: '' },
                  { id: 'settings', label: '打开设置', btnClass: '' },
                  { id: 'cancel', label: '取消', btnClass: '' }
                ]
              );
              if (pushChoice === 'retry') {
                try {
                  const tokenObj2 = await chrome.storage.local.get(['dw_github_token_v1']);
                  const token2 = tokenObj2['dw_github_token_v1'];
                  if (!token2) throw new Error('缺少 GitHub Token，请在设置中填写并保存');
                  const contentBase642 = btoa(unescape(encodeURIComponent(body)));
                  const commitMessage2 = `${settings.commitPrefix || 'dynamic:'} ${filename}`;
                  const parsed2 = parseRepoUrl(settings.repoUrl || '');
                  if (!parsed2) throw new Error('无效的仓库地址，请在设置中使用 owner/repo 或完整 URL');
                  await githubPutFile({
                    owner: parsed2.owner,
                    repo: parsed2.repo,
                    path,
                    branch: settings.branch,
                    message: commitMessage2,
                    contentBase64: contentBase642,
                    token: token2
                  });
                  showToast("重试推送成功", "success", 1600);
                  pushOk = true;
                } catch (re) {
                  console.error("重试推送失败:", re);
                  showToast("重试推送失败: " + (re && re.message ? re.message : String(re)), "error");
                  await saveDraft(body);
                  setStatus("远程推送失败，已保存草稿", "status-warn");
                  pushOk = false;
                }
              } else if (pushChoice === 'export') {
                exportDraftAsFile(filename, body);
                await saveDraft(body);
                setStatus("已导出草稿，未完成远程推送", "status-warn");
                pushOk = false;
              } else if (pushChoice === 'settings') {
                chrome.runtime.openOptionsPage();
                await saveDraft(body);
                setStatus("已保存草稿，打开设置以修复 token", "status-warn");
                return;
              } else {
                await saveDraft(body);
                setStatus("已保存草稿，未完成远程推送", "status-warn");
                pushOk = false;
              }
            } catch (uiErr) {
              console.error("处理推送失败交互时出错:", uiErr);
              showToast("推送失败: " + (e && e.message ? e.message : String(e)), "error");
              await saveDraft(body);
              pushOk = false;
              setStatus("远程推送失败，请检查 GitHub 配置或 token", "status-warn");
            }
          }
        } else {
          // settings.push === false -> local-only
          showToast("当前为仅本地保存，已完成本地保存（未推送）", "success");
        }

        // 注意：草稿清空逻辑已移动到本地写入成功分支，避免在写入失败时丢失内容

        const finalStatus = (() => {
          if (!localSaveOk) return "本地保存未完成，请检查设置";
          if (settings.push) {
            return pushOk ? "已发表（本地+远程）" : "本地保存完成，远程推送失败";
          }
          return "已保存到本地";
        })();
        const finalClass = (!localSaveOk || (settings.push && !pushOk)) ? "status-warn" : "status-success";
        setStatus(finalStatus, finalClass);
      } catch (error) {
        console.error("发表失败:", error);
        setStatus("发表失败", "status-err");
        showToast("发表失败: " + (error.message || error), "error");
      } finally {
        setButtonLoading(publishAndPushBtn, false);
        __publishLock = false;
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
        try {
          const newVal = changes[SETTINGS_KEY].newValue;
          if (newVal && typeof newVal.push !== 'undefined') {
            updatePublishButtonText(!!newVal.push);
          }
        } catch (e) { /* ignore */ }
      }
    });
  } catch (e) { /* noop for environments without listener */ }

  // 聚焦编辑器
  editor.focus();
})();
