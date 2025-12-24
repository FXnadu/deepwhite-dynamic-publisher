/**
 * Utils 统一导出文件
 * 提供向后兼容的统一导出接口
 */

// UI 工具
export {
  showToast,
  showConfirm,
  showChoice,
  showPrompt,
  setButtonLoading,
  openSettingsPage
} from './ui.js';

// 格式化工具
export {
  formatDate,
  formatTime,
  countChars,
  countWords
} from './format.js';

// 存储工具
export {
  getCachedSettings,
  setCachedSettings
} from './storage.js';

// 文件系统工具
export {
  saveDirectoryHandle,
  getSavedDirectoryHandle,
  clearSavedDirectoryHandle,
  getSavedDirectoryName,
  saveFileHandle,
  detectTargetDirFromHandle
} from './filesystem.js';

// 网络工具
export {
  githubPutFile,
  parseRepoUrl,
  encodeBase64Utf8,
  uploadToPicGo
} from './network.js';

// 通用工具
export {
  debounce
} from './common.js';
