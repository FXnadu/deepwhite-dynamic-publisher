/**
 * SettingsManager - 负责设置的加载、保存和验证
 */
import { getCachedSettings, setCachedSettings } from '../../utils/storage.js';
import { parseRepoUrl } from '../../utils/index.js';
import { SETTINGS_KEY, DEFAULT_SETTINGS } from '../../constants.js';

export class SettingsManager {
  constructor() {
    this.defaultSettings = { ...DEFAULT_SETTINGS };
  }

  async load() {
    try {
      const settings = await getCachedSettings();
      
      // 迁移旧配置：优先使用 githubDir，其次 localDir
      if (!settings.targetDir) {
        if (settings.githubDir) {
          settings.targetDir = settings.githubDir;
        } else if (settings.localDir) {
          settings.targetDir = settings.localDir;
        }
      }
      
      return settings;
    } catch (error) {
      console.error("加载设置失败:", error);
      return { ...this.defaultSettings };
    }
  }

  async save(settings) {
    try {
      await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
      await setCachedSettings(settings);
      
      // 通知编辑页面设置已保存
      try {
        chrome.runtime.sendMessage({ type: 'SETTINGS_SAVED' });
      } catch (e) {
        // Silently ignore if no listeners
      }
    } catch (error) {
      console.error("保存设置失败:", error);
      throw error;
    }
  }

  validateSettings(settings) {
    const errors = [];
    
    // 只有启用推送时才验证仓库地址
    if (settings.push) {
      if (!settings.repoUrl || !settings.repoUrl.trim()) {
        errors.push("启用推送时，仓库地址不能为空");
      } else {
        const parsed = parseRepoUrl(settings.repoUrl.trim());
        if (!parsed) errors.push("仓库地址格式不正确，示例：owner/repo 或 https://github.com/owner/repo");
      }
      
      if (!settings.branch || !settings.branch.trim()) {
        errors.push("启用推送时，分支名称不能为空");
      }
      
      if (!settings.targetDir || !settings.targetDir.trim()) {
        errors.push("启用推送时，保存路径不能为空");
      }
    }
    
    // 验证目标目录格式
    if (settings.targetDir && !/^[a-zA-Z0-9_\-/]+$/.test(settings.targetDir)) {
      errors.push("保存路径格式不正确");
    }
    
    return errors;
  }
}
