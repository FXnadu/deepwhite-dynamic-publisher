import { showToast, setButtonLoading, parseRepoUrl, getCachedSettings, setCachedSettings } from './utils.js';

const SETTINGS_KEY = "dw_settings_v1";
const FOLDER_DB_KEY = "dw_folder_handle_v1";
const TOKEN_KEY = "dw_github_token_v1";
const PICGO_TOKEN_KEY = "dw_picgo_token_v1";

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

  // load token
  try {
    const tokenObj = await chrome.storage.local.get([TOKEN_KEY]);
    githubTokenInput.value = tokenObj[TOKEN_KEY] || "";
    const picgoObj = await chrome.storage.local.get([PICGO_TOKEN_KEY]);
    if (picgoTokenInput) picgoTokenInput.value = picgoObj[PICGO_TOKEN_KEY] || "";
  } catch (e) {
    console.warn("无法加载 token:", e);
  }

  // Reveal token plaintext in the input on focus/click; hide on blur
  try {
    if (githubTokenInput) {
      // ensure initial state is masked
      githubTokenInput.type = 'password';

      const showPlaintext = () => {
        try { githubTokenInput.type = 'text'; } catch (e) {}
      };
      const hidePlaintext = () => {
        try { githubTokenInput.type = 'password'; } catch (e) {}
      };

      githubTokenInput.addEventListener('focus', showPlaintext);
      githubTokenInput.addEventListener('click', showPlaintext);
      githubTokenInput.addEventListener('blur', hidePlaintext);
    }
  } catch (e) {
    // noop
  }

  // Token visibility control removed — no-op

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
              showToast(`建议将 Target Dir 设为：${suggested}`, "success", 2000);
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
      picgoAutoUpload: picgoAutoUploadInput ? !!picgoAutoUploadInput.checked : false
    };

    // 验证
    const errors = validateSettings(next);
    if (errors.length > 0) {
      showToast(errors[0], "error");
      return;
    }

    setButtonLoading(saveBtn, true);
    
    try {
      await setCachedSettings(next);
      // save token to local (safer than sync)
      try {
        await chrome.storage.local.set({ [TOKEN_KEY]: githubTokenInput.value.trim() || "" });
        // save picgo token locally (if present)
        try {
          await chrome.storage.local.set({ [PICGO_TOKEN_KEY]: picgoTokenInput ? (picgoTokenInput.value.trim() || "") : "" });
        } catch (e) {
          console.warn("保存 PicGo Token 失败:", e);
        }
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
              showToast(`已保存本地文件夹，建议 Target Dir: ${suggested}`, "success", 2200);
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
        if (window.clearSavedDirectoryHandle) {
          await window.clearSavedDirectoryHandle();
        } else {
          localStorage.removeItem(FOLDER_DB_KEY);
        }
        setCurrentRootName('');
        showToast("已清除本地文件夹设置", "success");
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
