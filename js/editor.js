/**
 * editor.js
 * 编辑器入口文件 - 职责单一，仅负责初始化
 */

import { initEditor } from './modules/EditorCore.js';

// 初始化编辑器
(async function init() {
  try {
    await initEditor();
  } catch (error) {
    console.error("编辑器初始化失败:", error);
  }
})();
