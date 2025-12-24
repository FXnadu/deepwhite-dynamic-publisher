/**
 * Options Page - 设置页面主入口
 * 使用模块化架构，各功能由独立管理器负责
 */
import { showToast, setButtonLoading } from './utils/index.js';
import { SettingsManager } from './modules/options/SettingsManager.js';
import { GitHubManager } from './modules/options/GitHubManager.js';
import { PicGoManager } from './modules/options/PicGoManager.js';
import { PathManager } from './modules/options/PathManager.js';
import { FolderPickerManager } from './modules/options/FolderPickerManager.js';
import { UIController } from './modules/options/UIController.js';

(async function init() {
  // 获取 DOM 元素
  const repoUrl = document.getElementById("repoUrl");
  const branch = document.getElementById("branch");
  const targetDir = document.getElementById("targetDir");
  const commitPrefix = document.getElementById("commitPrefix");
  const picgoEndpointInput = document.getElementById("picgoEndpoint");
  const picgoAutoUploadInput = null; // 移除自动上传选项
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
  const folderNameEl = document.getElementById("folderName");
  const githubTokenInput = document.getElementById("githubToken");
  const testConnectionBtn = document.getElementById("testConnection");
  const testResultEl = document.getElementById("testResult");
  const pushControlsEl = document.getElementById("pushControls");
  const targetDirSummaryRootEl = document.getElementById("targetDirSummaryRoot");
  const targetDirSummaryFullEl = document.getElementById("targetDirSummaryFull");

  const DEFAULT_TARGET_DIR = "src/content/posts/dynamic/journals";

  // 检查必要的 DOM 元素
  if (!repoUrl || !branch || !targetDir || !commitPrefix || !saveBtn) {
    console.error("缺少必要的DOM元素");
    return;
  }

  // 初始化管理器
  const settingsManager = new SettingsManager();
  const pathManager = new PathManager();
  const uiController = new UIController(pathManager);
  const githubManager = new GitHubManager();
  const picgoManager = new PicGoManager();
  const folderPickerManager = new FolderPickerManager(pathManager);

  // 初始化 UI 控制器
  uiController.init({
    targetDirSummaryRootEl,
    targetDirSummaryFullEl,
    targetDirInput: targetDir,
    repoUrlInput: repoUrl,
    pushToGithub,
    advancedToggle,
    advancedSection
  });

  // 初始化 GitHub 管理器
  githubManager.init(githubTokenInput, testConnectionBtn, testResultEl);

  // 初始化 PicGo 管理器
  picgoManager.init(
    picgoEndpointInput,
    picgoTokenInput,
    picgoAutoUploadInput,
    picgoUploadFormatSelect,
    testPicgoBtn,
    testPicgoResultEl
  );

  // 初始化文件夹选择器
  folderPickerManager.init(pickFolderBtn, folderNameEl);

  // 加载设置
  const settings = await settingsManager.load();
  repoUrl.value = settings.repoUrl || "FXnadu/deepwhite-11ty";
  branch.value = settings.branch || "main";
  targetDir.value = pathManager.sanitizePathValue(settings.targetDir || '', { silent: true }) || DEFAULT_TARGET_DIR;
  commitPrefix.value = settings.commitPrefix || "dynamic:";
  
  // 加载 PicGo 设置
  picgoManager.loadSettings(settings);
  
  // 加载 GitHub Token
  await githubManager.loadToken();
  
  // 设置推送开关
  if (pushToGithub) {
    pushToGithub.checked = !!settings.push;
  }
  
  // 更新 UI 状态
  uiController.updateTargetDirSummary();
  uiController.setupAdvancedToggle();
  uiController.setupInputValidation([commitPrefix]);
  uiController.setupTestControls(pushControlsEl, testConnectionBtn, testResultEl);

  // 加载保存的文件夹
  const savedHandle = await folderPickerManager.loadSavedFolder();
  if (savedHandle) {
    await folderPickerManager.detectAndSuggestPath(
      savedHandle,
      targetDir,
      settings.targetDir,
      DEFAULT_TARGET_DIR,
      () => uiController.updateTargetDirSummary()
    );
  }
  uiController.updateTargetDirSummary();

  // PicGo 测试连接按钮
  if (testPicgoBtn) {
    testPicgoBtn.addEventListener('click', async () => {
      await picgoManager.testConnection();
    });
  }

  // GitHub 测试连接按钮
  if (testConnectionBtn) {
    testConnectionBtn.addEventListener('click', async () => {
      await githubManager.testConnection(
        repoUrl.value,
        branch.value,
        pathManager,
        targetDir,
        () => uiController.updateTargetDirSummary()
      );
    });
  }

  // 选择本地文件夹按钮
  if (pickFolderBtn) {
    pickFolderBtn.addEventListener('click', async () => {
      await folderPickerManager.pickFolder(
        targetDir,
        () => uiController.updateTargetDirSummary()
      );
    });
  }

  // 保存按钮事件
  saveBtn.addEventListener("click", async () => {
    const cleanTargetDir = pathManager.sanitizePathValue(targetDir.value);
    
    // 只在输入框有值且需要清理时才更新显示
    if (targetDir.value.trim() && cleanTargetDir !== targetDir.value.trim()) {
      targetDir.value = cleanTargetDir;
    }
    
    uiController.updateTargetDirSummary();

    const nextSettings = {
      repoUrl: repoUrl.value.trim() || "FXnadu/deepwhite-11ty",
      branch: branch.value.trim() || "main",
      targetDir: cleanTargetDir || DEFAULT_TARGET_DIR,
      commitPrefix: commitPrefix.value.trim() || "dynamic:",
      push: !!(pushToGithub && pushToGithub.checked),
      ...picgoManager.getSettings()
    };

    // 验证设置
    const errors = settingsManager.validateSettings(nextSettings);
    if (errors.length > 0) {
      showToast(errors[0], "error");
      return;
    }

    setButtonLoading(saveBtn, true);
    
    try {
      await settingsManager.save(nextSettings);
      await githubManager.saveToken(githubTokenInput.value.trim() || "");
      uiController.showSaveSuccess(savedHint);
    } catch (error) {
      console.error("保存失败:", error);
      uiController.showSaveError(savedHint, error);
    } finally {
      setButtonLoading(saveBtn, false);
    }
  });
})();
