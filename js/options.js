import { showToast, setButtonLoading, parseRepoUrl } from './utils.js';

const SETTINGS_KEY = "dw_settings_v1";
const FOLDER_DB_KEY = "dw_folder_handle_v1";
const TOKEN_KEY = "dw_github_token_v1";

async function load() {
  try {
    const obj = await chrome.storage.sync.get([SETTINGS_KEY]);
    return obj[SETTINGS_KEY] || {
      repoUrl: "FXnadu/deepwhite-11ty",
      branch: "main",
      targetDir: "src/content/posts/dynamic/journals",
      commitPrefix: "dynamic:",
      push: false
    };
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

(async function init() {
  const repoUrl = document.getElementById("repoUrl");
  const branch = document.getElementById("branch");
  const targetDir = document.getElementById("targetDir");
  const commitPrefix = document.getElementById("commitPrefix");
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

  if (!repoUrl || !branch || !targetDir || !commitPrefix || !saveBtn) {
    console.error("缺少必要的DOM元素");
    return;
  }

  // 加载设置
  const s = await load();
  repoUrl.value = s.repoUrl || "FXnadu/deepwhite-11ty";
  branch.value = s.branch || "main";
  targetDir.value = s.targetDir || "src/content/posts/dynamic/journals";
  commitPrefix.value = s.commitPrefix || "dynamic:";
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
  } catch (e) {
    console.warn("无法加载 token:", e);
  }

  // load saved folder name display (helper in utils will persist handle in IDB)
  try {
    // Try to fetch saved DirectoryHandle and detect targetDir
    if (window.getSavedDirectoryHandle) {
      const savedHandle = await window.getSavedDirectoryHandle();
      if (savedHandle) {
        if (folderNameEl) folderNameEl.textContent = savedHandle.name || '';
        if (window.detectTargetDirFromHandle) {
          try {
            const suggested = await window.detectTargetDirFromHandle(savedHandle);
            if (suggested && (!s.targetDir || s.targetDir === 'src/content/posts/dynamic/journals')) {
              targetDir.value = suggested;
              showToast(`建议将 Target Dir 设为：${suggested}`, "success", 2000);
            }
          } catch (e) {
            // ignore detection errors
          }
        }
      } else if (window.getSavedDirectoryName) {
        const name = await window.getSavedDirectoryName();
        if (name && folderNameEl) folderNameEl.textContent = name;
      }
    } else if (window.getSavedDirectoryName) {
      const name = await window.getSavedDirectoryName();
      if (name && folderNameEl) folderNameEl.textContent = name;
    }
  } catch (e) {
    // noop
  }

  // 保存按钮事件
  saveBtn.addEventListener("click", async () => {
    const next = {
      repoUrl: repoUrl.value.trim() || "FXnadu/deepwhite-11ty",
      branch: branch.value.trim() || "main",
      targetDir: targetDir.value.trim() || "src/content/posts/dynamic/journals",
      commitPrefix: commitPrefix.value.trim() || "dynamic:",
      push: !!(pushToGithub && pushToGithub.checked)
    };

    // 验证
    const errors = validateSettings(next);
    if (errors.length > 0) {
      showToast(errors[0], "error");
      return;
    }

    setButtonLoading(saveBtn, true);
    
    try {
      await save(next);
      // save token to local (safer than sync)
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
        } else {
          // fallback: try storing name in localStorage
          localStorage.setItem(FOLDER_DB_KEY, dirHandle.name || 'selected');
        }
        if (folderNameEl) folderNameEl.textContent = dirHandle.name || '';
        // try detect target dir inside picked folder
        try {
          if (window.detectTargetDirFromHandle) {
            const suggested = await window.detectTargetDirFromHandle(dirHandle);
            if (suggested) {
              targetDir.value = suggested;
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
        showToast("选择文件夹失败", "error");
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
        if (folderNameEl) folderNameEl.textContent = '';
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
      if (testResultEl) testResultEl.textContent = '';
      try {
        const tokenObj = await chrome.storage.local.get([TOKEN_KEY]);
        const token = tokenObj[TOKEN_KEY] || '';
        if (!token) {
          if (testResultEl) testResultEl.textContent = '缺少 Token';
          return;
        }
        const parsed = parseRepoUrl(repoUrl.value.trim());
        if (!parsed) {
          if (testResultEl) testResultEl.textContent = '仓库地址格式错误';
          return;
        }
        const api = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;
        const res = await fetch(api, { headers: { Authorization: `token ${token}` } });
        if (res.ok) {
          if (testResultEl) testResultEl.textContent = '连接成功';
        } else if (res.status === 404) {
          if (testResultEl) testResultEl.textContent = '仓库未找到或无权限';
        } else if (res.status === 401) {
          if (testResultEl) testResultEl.textContent = 'Token 无效';
        } else {
          if (testResultEl) testResultEl.textContent = `错误: ${res.status}`;
        }
      } catch (e) {
        console.error('测试连接失败', e);
        if (testResultEl) testResultEl.textContent = '测试失败（查看控制台）';
      }
    });
  }
})();
