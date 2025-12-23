import { showToast, setButtonLoading, parseRepoUrl, getCachedSettings, setCachedSettings, showConfirm } from './utils.js';
import { SETTINGS_KEY, FOLDER_DB_KEY, TOKEN_KEY, PICGO_TOKEN_KEY, HANDLE_CLEARED_KEY } from './constants.js';

async function load() {
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

async function save(settings) {
  try {
    await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
  } catch (error) {
    console.error("保存设置失败:", error);
    throw error;
  }
}

function validateSettings(settings) {
  const errors = [];
  if (!settings.repoUrl || !settings.repoUrl.trim()) {
    errors.push("仓库地址不能为空");
  } else {
    const parsed = parseRepoUrl(settings.repoUrl.trim());
    if (!parsed) errors.push("仓库地址格式不正确，示例：owner/repo 或 https://github.com/owner/repo");
  }
  
  if (!settings.branch || !settings.branch.trim()) {
    errors.push("分支名称不能为空");
  }
  
  if (!settings.targetDir || !settings.targetDir.trim()) {
    errors.push("目标目录不能为空");
  }
  
  // 验证目标目录格式
  if (settings.targetDir && !/^[a-zA-Z0-9_\-/]+$/.test(settings.targetDir)) {
    errors.push("目标目录格式不正确");
  }
  
  return errors;
}

const ABSOLUTE_PATH_REGEX = /^([A-Za-z]:[\\/]|\\\\|\/)/;

function normalizeRelativePath(value) {
  if (!value) return '';
  return String(value)
    .trim()
    .replace(/\\+/g, '/')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

(async function init() {
  const repoUrl = document.getElementById("repoUrl");
  const branch = document.getElementById("branch");
  const targetDir = document.getElementById("targetDir");
  const commitPrefix = document.getElementById("commitPrefix");
  const picgoEndpointInput = document.getElementById("picgoEndpoint");
  const picgoAutoUploadInput = document.getElementById("picgoAutoUpload");
  const picgoTokenInput = document.getElementById("picgoToken");
  const picgoUploadFormatSelect = document.getElementById("picgoUploadFormat");
  const testPicgoBtn = document.getElementById("testPicgoBtn");
  const testPicgoResultEl = document.getElementById("testPicgoResult");
  const pushToGithub = document.getElementById("pushToGithub");
  const advancedToggle = document.getElementById("advancedToggle");
  const advancedSection = document.getElementById("advancedSection");
  const saveBtn = document.getElementById("save");
  const savedHint = document.getElementById("savedHint");
  const pickFolderBtn = document.getElementById("pickFolder");
  const clearFolderBtn = document.getElementById("clearFolder");
  const folderNameEl = document.getElementById("folderName");
  const githubTokenInput = document.getElementById("githubToken");
  const testConnectionBtn = document.getElementById("testConnection");
  const testResultEl = document.getElementById("testResult");
  let pushControlsEl = document.getElementById("pushControls");
  const targetDirSummaryRootEl = document.getElementById("targetDirSummaryRoot");
  const targetDirSummaryFullEl = document.getElementById("targetDirSummaryFull");
  let currentRootName = '';
  const DEFAULT_TARGET_DIR = "src/content/posts/dynamic/journals";

  // Inline suggestion banner state and rendering.
  // This replaces transient toasts for Target Dir suggestions with a dismissible inline banner
  // that the user can Accept (apply) or Dismiss (persistently ignore this suggested value).
  const SUGGEST_DISMISS_KEY = 'dw_target_suggestion_dismissed_v1';

  const shouldShowSuggestionFor = async (suggested) => {
    try {
      if (!suggested) return false;
      const obj = await chrome.storage.local.get([SUGGEST_DISMISS_KEY]);
      const dismissed = obj && obj[SUGGEST_DISMISS_KEY] ? String(obj[SUGGEST_DISMISS_KEY]) : '';
      // If user previously dismissed this exact suggestion, don't show again.
      if (dismissed && dismissed === suggested) return false;
      return true;
    } catch (e) {
      return true;
    }
  };

  const showTargetSuggestionBanner = async (suggested) => {
    try {
      if (!suggested) return;
      // ensure DOM element exists (create if missing)
      let banner = document.getElementById('targetSuggestion');
      if (!banner) {
        const container = document.createElement('div');
        container.id = 'targetSuggestion';
        container.style.display = 'none';
        container.style.marginTop = '8px';
        container.innerHTML = `
          <div class="hint suggestion-banner" style="display:flex;align-items:center;gap:8px;justify-content:space-between;">
            <div id="targetSuggestionText" style="flex:1;"></div>
            <div style="display:flex;gap:8px;margin-left:12px;">
              <button id="applySuggestionBtn" class="btn btn-primary">采纳</button>
              <button id="dismissSuggestionBtn" class="btn">忽略</button>
            </div>
          </div>
        `;
        const parent = document.getElementById('targetDir')?.closest('.field') || document.querySelector('.container');
        if (parent) parent.appendChild(container);
        banner = container;
      }

      // Skip showing if user previously dismissed this suggestion
      if (!(await shouldShowSuggestionFor(suggested))) {
        banner.style.display = 'none';
        return;
      }

      const textEl = document.getElementById('targetSuggestionText');
      const applyBtn = document.getElementById('applySuggestionBtn');
      const dismissBtn = document.getElementById('dismissSuggestionBtn');
      if (textEl) textEl.textContent = `建议将 Target Dir 设为：${suggested}`;
      banner.style.display = 'block';

      const cleanup = () => {
        try { banner.style.display = 'none'; } catch (e) { /* ignore */ }
        if (applyBtn) applyBtn.removeEventListener('click', onApply);
        if (dismissBtn) dismissBtn.removeEventListener('click', onDismiss);
      };

      const onApply = () => {
        try {
          const normalized = sanitizeTargetDirValue(suggested) || suggested;
          targetDir.value = normalized;
          updateTargetDirSummary();
          // Clear any stored dismissal for this suggestion so it won't be treated as dismissed.
          try { chrome.storage.local.remove(SUGGEST_DISMISS_KEY); } catch (e) { /* ignore */ }
        } finally {
          cleanup();
          showToast('已应用建议的 Target Dir', 'success');
        }
      };

      const onDismiss = async () => {
        try {
          const payload = String(suggested);
          try { await chrome.storage.local.set({ [SUGGEST_DISMISS_KEY]: payload }); } catch (e) { /* ignore */ }
        } finally {
          cleanup();
          showToast('已忽略该建议', 'warning');
        }
      };

      if (applyBtn) {
        applyBtn.removeEventListener('click', onApply);
        applyBtn.addEventListener('click', onApply);
      }
      if (dismissBtn) {
        dismissBtn.removeEventListener('click', onDismiss);
        dismissBtn.addEventListener('click', onDismiss);
      }
    } catch (e) {
      // fail silently
    }
  };

  if (!repoUrl || !branch || !targetDir || !commitPrefix || !saveBtn) {
    console.error("缺少必要的DOM元素");
    return;
  }

  const convertAbsoluteToRelative = (rawPath) => {
    if (!rawPath) return '';
    let normalized = String(rawPath).trim().replace(/\\/g, '/');
    if (currentRootName) {
      const marker = `/${currentRootName}/`;
      const idx = normalized.lastIndexOf(marker);
      if (idx >= 0) {
        normalized = normalized.slice(idx + marker.length);
      }
    }
    const markerCandidates = ['/src/', '/content/', '/posts/'];
    for (const marker of markerCandidates) {
      const idx = normalized.indexOf(marker);
      if (idx >= 0) {
        normalized = normalized.slice(idx + 1);
        break;
      }
    }
    normalized = normalized.replace(/^([A-Za-z]:\/|\/)+/i, '');
    return normalizeRelativePath(normalized);
  };

  const sanitizeTargetDirValue = (value, { silent } = {}) => {
    const trimmed = (value || '').trim();
    if (!trimmed) return '';
    const normalized = normalizeRelativePath(trimmed);
    if (ABSOLUTE_PATH_REGEX.test(trimmed)) {
      const relative = convertAbsoluteToRelative(trimmed) || normalized;
      if (!silent && relative !== normalized) {
        showToast("已将绝对路径转换为仓库相对路径", "warning");
      }
      return relative;
    }
    return normalized;
  };

  const updateTargetDirSummary = () => {
    const rel = sanitizeTargetDirValue(targetDir.value, { silent: true });
    if (targetDirSummaryRootEl) {
      targetDirSummaryRootEl.textContent = currentRootName
        ? `本地根目录：${currentRootName}`
        : "本地根目录：未选择（仅在推送或草稿时使用 Target Dir）";
    }
    if (targetDirSummaryFullEl) {
      if (currentRootName) {
        const display = rel ? `/${rel}` : '/';
        targetDirSummaryFullEl.textContent = `实际写入路径：${currentRootName}${display}`;
      } else {
        targetDirSummaryFullEl.textContent = rel
          ? `远程路径：${rel}`
          : '远程路径：仓库根目录';
      }
    }
  };

  const setCurrentRootName = (name) => {
    currentRootName = name || '';
    if (folderNameEl) {
      folderNameEl.textContent = currentRootName || '未选择';
    }
    updateTargetDirSummary();
  };

  // 加载设置
  const s = await load();
  repoUrl.value = s.repoUrl || "FXnadu/deepwhite-11ty";
  branch.value = s.branch || "main";
  targetDir.value = sanitizeTargetDirValue(s.targetDir, { silent: true }) || DEFAULT_TARGET_DIR;
  commitPrefix.value = s.commitPrefix || "dynamic:";
  if (picgoEndpointInput) picgoEndpointInput.value = s.picgoEndpoint || "";
  if (picgoAutoUploadInput) picgoAutoUploadInput.checked = !!s.picgoAutoUpload;
  if (picgoUploadFormatSelect) picgoUploadFormatSelect.value = s.picgoUploadFormat || 'auto';
  if (picgoTokenInput) picgoTokenInput.value = s.picgoToken || "";
  updateTargetDirSummary();
  targetDir.addEventListener('input', () => updateTargetDirSummary());
  targetDir.addEventListener('blur', () => {
    const sanitized = sanitizeTargetDirValue(targetDir.value);
    if (sanitized !== targetDir.value.trim()) {
      targetDir.value = sanitized;
    }
    updateTargetDirSummary();
  });
  if (pushToGithub) pushToGithub.checked = !!s.push;
  // advanced toggle handler
  if (advancedToggle && advancedSection) {
    advancedToggle.addEventListener('click', () => {
      advancedSection.style.display = advancedSection.style.display === 'none' ? 'block' : 'none';
    });
  }

  // PicGo collapse/expand UI removed — PicGo inputs are visible by default in the main settings area.

  // load GitHub token from local storage; PicGo token is stored in settings (sync)
  try {
    const tokenObj = await chrome.storage.local.get([TOKEN_KEY]);
    githubTokenInput.value = tokenObj[TOKEN_KEY] || "";
  } catch (e) {
    console.warn("无法加载 GitHub token:", e);
  }

  // PicGo connection test handler
  if (testPicgoBtn) {
    testPicgoBtn.addEventListener('click', async () => {
      if (!testPicgoResultEl) return;
      const endpoint = picgoEndpointInput ? (picgoEndpointInput.value || '').trim() : '';
      const token = picgoTokenInput ? (picgoTokenInput.value || '').trim() : '';
      testPicgoResultEl.textContent = '';
      testPicgoResultEl.className = 'hint';
      if (!endpoint) {
        testPicgoResultEl.textContent = '请先填写 PicGo Endpoint';
        testPicgoResultEl.className = 'hint status-err';
        return;
      }
      setButtonLoading(testPicgoBtn, true);
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        // First try a lightweight OPTIONS probe to check reachability without sending payload
        let probeOk = false;
        try {
          const probeRes = await fetch(endpoint, { method: 'OPTIONS', signal: controller.signal });
          // 2xx/3xx/4xx/5xx all indicate the host responded; treat 2xx/3xx as reachable.
          if (probeRes && (probeRes.status >= 200 && probeRes.status < 400)) {
            probeOk = true;
            testPicgoResultEl.textContent = `可访问（HTTP ${probeRes.status}）`;
            testPicgoResultEl.className = 'hint status-success';
          }
        } catch (probeErr) {
          // probe may fail if server disallows OPTIONS; ignore and fall back to POST probe
        } finally {
          clearTimeout(timeout);
        }

        if (!probeOk) {
          // Fallback: try a small POST with synthetic blob to validate upload endpoint
          const fd = new FormData();
          const blob = new Blob(['ping'], { type: 'image/png' });
          fd.append('file', blob, 'dw-ping.png');
          const controller2 = new AbortController();
          const timeout2 = setTimeout(() => controller2.abort(), 8000);
          try {
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch(endpoint, { method: 'POST', body: fd, headers, signal: controller2.signal });
            if (res.ok) {
              testPicgoResultEl.textContent = `可上传（HTTP ${res.status}）`;
              testPicgoResultEl.className = 'hint status-success';
            } else {
              const txt = await res.text().catch(() => '');
              testPicgoResultEl.textContent = `错误 ${res.status}: ${txt ? txt.slice(0, 200) : res.statusText}`;
              testPicgoResultEl.className = 'hint status-err';
            }
          } finally {
            clearTimeout(timeout2);
          }
        }
      } catch (e) {
        if (e && e.name === 'AbortError') {
          testPicgoResultEl.textContent = '请求超时（服务器未响应）';
        } else {
          testPicgoResultEl.textContent = `测试失败：${e && e.message ? e.message : String(e)}`;
        }
        testPicgoResultEl.className = 'hint status-err';
        console.error('PicGo 测试连接失败:', e);
      } finally {
        setButtonLoading(testPicgoBtn, false);
      }
    });
  }

  // load saved folder name display (helper in utils will persist handle in IDB)
  try {
    // Try to fetch saved DirectoryHandle and detect targetDir
    if (window.getSavedDirectoryHandle) {
      const savedHandle = await window.getSavedDirectoryHandle();
      if (savedHandle) {
        setCurrentRootName(savedHandle.name || '');
        if (window.detectTargetDirFromHandle) {
          try {
            const suggested = await window.detectTargetDirFromHandle(savedHandle);
              if (suggested && (!s.targetDir || s.targetDir === DEFAULT_TARGET_DIR)) {
              const normalizedSuggested = sanitizeTargetDirValue(suggested, { silent: true }) || suggested;
              targetDir.value = normalizedSuggested;
              // Suppress the suggestion if the user recently cleared saved handle.
              try {
                const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(HANDLE_CLEARED_KEY) : null;
                const clearedAt = raw ? parseInt(raw, 10) : 0;
                const now = Date.now();
                const SUPPRESS_WINDOW_MS = 24 * 3600 * 1000; // 24 hours
                if (!clearedAt || (now - clearedAt) > SUPPRESS_WINDOW_MS) {
                  // Show an inline suggestion banner allowing accept/dismiss.
                  await showTargetSuggestionBanner(suggested);
                }
              } catch (e) {
                await showTargetSuggestionBanner(suggested);
              }
              updateTargetDirSummary();
            }
          } catch (e) {
            // ignore detection errors
          }
        }
      } else if (window.getSavedDirectoryName) {
        const name = await window.getSavedDirectoryName();
        if (name) setCurrentRootName(name);
      }
    } else if (window.getSavedDirectoryName) {
      const name = await window.getSavedDirectoryName();
      if (name) setCurrentRootName(name);
    }
  } catch (e) {
    // noop
  }

  // 保存按钮事件
  saveBtn.addEventListener("click", async () => {
    const cleanTargetDir = sanitizeTargetDirValue(targetDir.value) || DEFAULT_TARGET_DIR;
    targetDir.value = cleanTargetDir;
    updateTargetDirSummary();

    const next = {
      repoUrl: repoUrl.value.trim() || "FXnadu/deepwhite-11ty",
      branch: branch.value.trim() || "main",
      targetDir: cleanTargetDir,
      commitPrefix: commitPrefix.value.trim() || "dynamic:",
      push: !!(pushToGithub && pushToGithub.checked),
      picgoEndpoint: picgoEndpointInput ? (picgoEndpointInput.value || '').trim() : '',
      picgoAutoUpload: picgoAutoUploadInput ? !!picgoAutoUploadInput.checked : false,
      picgoUploadFormat: picgoUploadFormatSelect ? (picgoUploadFormatSelect.value || 'auto') : 'auto'
    };
    

    // 验证
    const errors = validateSettings(next);
    if (errors.length > 0) {
      showToast(errors[0], "error");
      return;
    }

    setButtonLoading(saveBtn, true);
    
    try {
      // include PicGo token inside settings so other contexts read from same place
      next.picgoToken = picgoTokenInput ? (picgoTokenInput.value || '').trim() : '';
      await setCachedSettings(next);
      // save GitHub token to local (kept separate for security)
      try {
        await chrome.storage.local.set({ [TOKEN_KEY]: githubTokenInput.value.trim() || "" });
      } catch (e) {
        console.warn("保存 GitHub Token 失败:", e);
      }
      if (savedHint) {
        savedHint.textContent = "已保存";
        savedHint.className = "hint status-success";
      }
      showToast("设置已保存", "success");
      
      setTimeout(() => {
        if (savedHint) {
          savedHint.textContent = "";
          savedHint.className = "hint";
        }
      }, 2000);
    } catch (error) {
      console.error("保存失败:", error);
      if (savedHint) {
        savedHint.textContent = "保存失败";
        savedHint.className = "hint status-err";
      }
      showToast("保存失败: " + error.message, "error");
    } finally {
      setButtonLoading(saveBtn, false);
    }
  });

  // 输入框验证提示
  const inputs = [repoUrl, branch, targetDir, commitPrefix];
  inputs.forEach(input => {
    input.addEventListener("blur", () => {
      if (!input.value.trim()) {
        input.style.borderColor = "var(--color-error)";
      } else {
        input.style.borderColor = "";
      }
    });
    
    input.addEventListener("input", () => {
      if (input.style.borderColor) {
        input.style.borderColor = "";
      }
    });
  });
  
  // 选择本地文件夹（File System Access API）
  if (pickFolderBtn) {
    pickFolderBtn.addEventListener("click", async () => {
      try {
        const dirHandle = await window.showDirectoryPicker();
        // save handle via helper on window (implemented in utils.js)
        if (window.saveDirectoryHandle) {
          await window.saveDirectoryHandle(dirHandle);
          // clearing the cleared flag because the user just re-authorized a folder
          try { if (typeof localStorage !== 'undefined') localStorage.removeItem(HANDLE_CLEARED_KEY); } catch (e) { /* ignore */ }
        } else {
          // fallback: try storing name in localStorage
          localStorage.setItem(FOLDER_DB_KEY, dirHandle.name || 'selected');
        }
        setCurrentRootName(dirHandle.name || '');
        // try detect target dir inside picked folder
        try {
          if (window.detectTargetDirFromHandle) {
            const suggested = await window.detectTargetDirFromHandle(dirHandle);
            if (suggested) {
              const normalizedSuggested = sanitizeTargetDirValue(suggested) || suggested;
              targetDir.value = normalizedSuggested;
              updateTargetDirSummary();
              // Don't show suggestion toast if the user recently cleared the saved handle.
              try {
                const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(HANDLE_CLEARED_KEY) : null;
                const clearedAt = raw ? parseInt(raw, 10) : 0;
                const now = Date.now();
                const SUPPRESS_WINDOW_MS = 24 * 3600 * 1000; // suppress for 24 hours after clearing
                  if (!clearedAt || (now - clearedAt) > SUPPRESS_WINDOW_MS) {
                    // Show an inline suggestion banner allowing accept/dismiss.
                    await showTargetSuggestionBanner(suggested);
                  }
              } catch (e) {
                  await showTargetSuggestionBanner(suggested);
              }
            } else {
              showToast("已保存本地文件夹", "success");
            }
          } else {
            showToast("已保存本地文件夹", "success");
          }
        } catch (e) {
          showToast("已保存本地文件夹", "success");
        }
      } catch (e) {
        console.error("选择文件夹失败:", e);
        const name = e && e.name ? e.name : '';
        const msg = e && e.message ? e.message : String(e);
        // If permission-related, clear saved handle so UI reflects state
        if (name === 'NotAllowedError' || name === 'SecurityError' || (msg && msg.toLowerCase().includes('permission'))) {
          try {
            if (window.clearSavedDirectoryHandle) await window.clearSavedDirectoryHandle();
          } catch (clearErr) {
            console.warn("清除已保存目录句柄失败:", clearErr);
          }
        }
        showToast("选择文件夹失败: " + (msg || name || e), "error");
      }
    });
  }

  if (clearFolderBtn) {
    clearFolderBtn.addEventListener("click", async () => {
      try {
        const ok = await showConfirm('解除本地授权', '确定要解除本地文件夹授权并清除已保存的本地句柄吗？此操作不会删除仓库内容，你之后仍可重新授权。', '解除授权', '取消');
        if (!ok) return;
        if (window.clearSavedDirectoryHandle) {
          await window.clearSavedDirectoryHandle();
        } else {
          localStorage.removeItem(FOLDER_DB_KEY);
        }
        setCurrentRootName('');
        showToast("已解除本地授权并清理本地数据", "success");
      } catch (e) {
        console.error("清除失败:", e);
        showToast("清除失败", "error");
      }
    });
  }

  // Test connection button
  if (testConnectionBtn) {
    testConnectionBtn.addEventListener('click', async () => {
      if (!testResultEl) return;
      // show spinner and disable button during network operations
      setButtonLoading(testConnectionBtn, true);
      testResultEl.textContent = '';
      testResultEl.className = 'hint';
      try {
        const tokenObj = await chrome.storage.local.get([TOKEN_KEY]);
        const token = tokenObj[TOKEN_KEY] || '';
        if (!token) {
          testResultEl.textContent = '缺少 Token';
          testResultEl.className = 'hint status-err';
          return;
        }
        const parsed = parseRepoUrl(repoUrl.value.trim());
        if (!parsed) {
          testResultEl.textContent = '仓库地址格式错误';
          testResultEl.className = 'hint status-err';
          return;
        }
        const branchName = (branch.value || '').trim() || 'main';
        const repoApi = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;
        const repoRes = await fetch(repoApi, { headers: { Authorization: `token ${token}` } });
        if (!repoRes.ok) {
          if (repoRes.status === 404) {
            testResultEl.textContent = '仓库未找到或无权限';
          } else if (repoRes.status === 401) {
            testResultEl.textContent = 'Token 无效';
          } else {
            testResultEl.textContent = `错误: ${repoRes.status}`;
          }
          testResultEl.className = 'hint status-err';
          return;
        }
        const branchApi = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/branches/${encodeURIComponent(branchName)}`;
        const branchRes = await fetch(branchApi, { headers: { Authorization: `token ${token}` } });
        if (!branchRes.ok) {
          if (branchRes.status === 404) {
            testResultEl.textContent = `分支 ${branchName} 不存在`;
          } else {
            testResultEl.textContent = `分支检查失败: ${branchRes.status}`;
          }
          testResultEl.className = 'hint status-err';
          return;
        }
        testResultEl.textContent = `仓库 ${parsed.owner}/${parsed.repo} · 分支 ${branchName} 可用`;
        testResultEl.className = 'hint status-success';
        const currentTarget = normalizeRelativePath(targetDir.value || '');
        if (!currentTarget || currentTarget === DEFAULT_TARGET_DIR) {
          // Auto-apply default directory instead of blocking confirm dialog.
          // This avoids a modal popup on test and provides a non-blocking notification.
          targetDir.value = DEFAULT_TARGET_DIR;
          updateTargetDirSummary();
          showToast(`已检测到仓库 ${parsed.owner}/${parsed.repo}，内容目录已自动设为：${DEFAULT_TARGET_DIR}`, 'success', 4000);
        }
      } catch (e) {
        console.error('测试连接失败', e);
        testResultEl.textContent = '测试失败（查看控制台）';
        testResultEl.className = 'hint status-err';
      } finally {
        setButtonLoading(testConnectionBtn, false);
      }
    });
  }

  // Ensure the test controls appear next to the Push toggle and are enabled only when checked.
  try {
    // create pushControls if missing (defensive)
    if (!pushControlsEl) {
      const importantToggle = document.querySelector('.important-toggle');
      if (importantToggle) {
        const newDiv = document.createElement('div');
        newDiv.id = 'pushControls';
        newDiv.style.marginLeft = 'auto';
        newDiv.style.display = 'flex';
        newDiv.style.gap = '8px';
        newDiv.style.alignItems = 'center';
        importantToggle.appendChild(newDiv);
        pushControlsEl = newDiv;
      }
    }

    if (pushControlsEl && testConnectionBtn && testResultEl) {
      // ensure controls are placed in pushControls
      if (testConnectionBtn.parentElement !== pushControlsEl) {
        pushControlsEl.appendChild(testConnectionBtn);
      }
      if (testResultEl.parentElement !== pushControlsEl) {
        pushControlsEl.appendChild(testResultEl);
      }

      // set initial enabled state and keep visible
      const setEnabled = (enabled) => {
        testConnectionBtn.disabled = !enabled;
        testConnectionBtn.classList.toggle('btn-disabled', !enabled);
        if (!enabled) {
          testResultEl.textContent = '';
          testResultEl.className = 'hint';
        }
      };
      setEnabled(!!(pushToGithub && pushToGithub.checked));
      if (pushToGithub) {
        pushToGithub.addEventListener('change', () => {
          setEnabled(pushToGithub.checked);
        });
      }
    }
  } catch (e) {
    // noop
  }
})();
