/**
 * FolderPickerManager - 负责本地文件夹选择和管理
 */
import { showToast } from '../../utils/index.js';
import { FOLDER_DB_KEY, HANDLE_CLEARED_KEY } from '../../constants.js';

export class FolderPickerManager {
  constructor(pathManager) {
    this.pathManager = pathManager;
    this.pickButton = null;
    this.folderNameEl = null;
  }

  init(pickButton, folderNameEl) {
    this.pickButton = pickButton;
    this.folderNameEl = folderNameEl;
  }

  updateFolderDisplay(name) {
    if (this.folderNameEl) {
      this.folderNameEl.textContent = name || '未选择';
    }
  }

  async loadSavedFolder() {
    try {
      if (window.getSavedDirectoryHandle) {
        const savedHandle = await window.getSavedDirectoryHandle();
        if (savedHandle) {
          this.pathManager.setCurrentRootName(savedHandle.name || '');
          this.updateFolderDisplay(savedHandle.name || '');
          return savedHandle;
        } else if (window.getSavedDirectoryName) {
          const name = await window.getSavedDirectoryName();
          if (name) {
            this.pathManager.setCurrentRootName(name);
            this.updateFolderDisplay(name);
          }
        }
      } else if (window.getSavedDirectoryName) {
        const name = await window.getSavedDirectoryName();
        if (name) {
          this.pathManager.setCurrentRootName(name);
          this.updateFolderDisplay(name);
        }
      }
    } catch (e) {
      // noop
    }
    return null;
  }

  async pickFolder(targetDirInput, updateCallback) {
    try {
      const dirHandle = await window.showDirectoryPicker();
      
      // save handle via helper on window
      if (window.saveDirectoryHandle) {
        await window.saveDirectoryHandle(dirHandle);
        // clearing the cleared flag because the user just re-authorized a folder
        try { 
          if (typeof localStorage !== 'undefined') localStorage.removeItem(HANDLE_CLEARED_KEY); 
        } catch (e) { /* ignore */ }
      } else {
        // fallback: try storing name in localStorage
        localStorage.setItem(FOLDER_DB_KEY, dirHandle.name || 'selected');
      }
      
      this.pathManager.setCurrentRootName(dirHandle.name || '');
      this.updateFolderDisplay(dirHandle.name || '');
      
      // 通知编辑页面更新显示
      try {
        chrome.runtime.sendMessage({ type: 'FOLDER_CHANGED', folderName: dirHandle.name || '' });
      } catch (e) {
        // Silently ignore if no listeners
      }
      
      // try detect target dir inside picked folder
      try {
        if (window.detectTargetDirFromHandle) {
          const suggested = await window.detectTargetDirFromHandle(dirHandle);
          if (suggested) {
            const normalizedSuggested = this.pathManager.sanitizePathValue(suggested) || suggested;
            targetDirInput.value = normalizedSuggested;
            if (updateCallback) updateCallback();
            
            // Check if we should show suggestion
            try {
              const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(HANDLE_CLEARED_KEY) : null;
              const clearedAt = raw ? parseInt(raw, 10) : 0;
              const now = Date.now();
              const SUPPRESS_WINDOW_MS = 24 * 3600 * 1000;
              
              if (!clearedAt || (now - clearedAt) > SUPPRESS_WINDOW_MS) {
                await this.pathManager.showTargetSuggestionBanner(suggested, targetDirInput, updateCallback);
              }
            } catch (e) {
              await this.pathManager.showTargetSuggestionBanner(suggested, targetDirInput, updateCallback);
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
      const name = e && e.name ? e.name : '';
      const msg = e && e.message ? e.message : String(e);
      
      // 用户主动取消选择，不显示错误提示
      if (name === 'AbortError') {
        return;
      }
      
      console.error("选择文件夹失败:", e);
      
      // If permission-related, clear saved handle
      if (name === 'NotAllowedError' || name === 'SecurityError' || (msg && msg.toLowerCase().includes('permission'))) {
        try {
          if (window.clearSavedDirectoryHandle) await window.clearSavedDirectoryHandle();
        } catch (clearErr) {
          // Silently ignore clear errors
        }
      }
      showToast("选择文件夹失败: " + (msg || name || e), "error");
    }
  }

  async detectAndSuggestPath(savedHandle, targetDirInput, currentTargetDir, defaultDir, updateCallback) {
    if (!savedHandle || !window.detectTargetDirFromHandle) return;
    
    try {
      const suggested = await window.detectTargetDirFromHandle(savedHandle);
      if (suggested && (!currentTargetDir || currentTargetDir === defaultDir)) {
        const normalizedSuggested = this.pathManager.sanitizePathValue(suggested, { silent: true }) || suggested;
        targetDirInput.value = normalizedSuggested;
        
        // Check if we should show suggestion
        try {
          const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(HANDLE_CLEARED_KEY) : null;
          const clearedAt = raw ? parseInt(raw, 10) : 0;
          const now = Date.now();
          const SUPPRESS_WINDOW_MS = 24 * 3600 * 1000;
          
          if (!clearedAt || (now - clearedAt) > SUPPRESS_WINDOW_MS) {
            await this.pathManager.showTargetSuggestionBanner(suggested, targetDirInput, updateCallback);
          }
        } catch (e) {
          await this.pathManager.showTargetSuggestionBanner(suggested, targetDirInput, updateCallback);
        }
        
        if (updateCallback) updateCallback();
      }
    } catch (e) {
      // ignore detection errors
    }
  }
}
