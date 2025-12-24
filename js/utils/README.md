# Utils 工具函数重构说明

## 📋 概述

原 `utils.js` 文件包含 800+ 行代码，混杂了 8 类不同功能。现已按功能域拆分为独立模块，提高代码可维护性和可测试性。

## 🗂️ 新的文件结构

```
js/utils/
├── index.js          # 统一导出文件（向后兼容）
├── ui.js             # UI 交互组件
├── format.js         # 格式化工具
├── storage.js        # 存储管理
├── filesystem.js     # 文件系统操作
├── network.js        # 网络请求
├── common.js         # 通用工具
└── README.md         # 本文档
```

## 📦 模块详细说明

### 1. **ui.js** - UI 交互组件
负责所有用户界面交互功能

**导出函数：**
- `showToast(message, type, duration)` - 显示 Toast 通知
- `showConfirm(title, message, confirmText, cancelText)` - 显示确认对话框
- `showChoice(title, message, choices)` - 显示多选对话框
- `showPrompt(title, message, defaultValue, confirmText, cancelText)` - 显示输入对话框
- `setButtonLoading(button, loading)` - 设置按钮加载状态

**使用示例：**
```javascript
import { showToast, showConfirm } from './utils/ui.js';

showToast('操作成功', 'success');
const confirmed = await showConfirm('确认删除', '此操作不可恢复');
```

### 2. **format.js** - 格式化工具
处理日期、时间、文本等格式化需求

**导出函数：**
- `formatDate(date)` - 格式化日期为 YYYY-MM-DD
- `formatTime(date)` - 格式化时间为 HH:MM
- `countChars(text)` - 计算字符数
- `countWords(text)` - 计算字数（中英文混合）

**使用示例：**
```javascript
import { formatDate, countWords } from './utils/format.js';

const today = formatDate(); // "2024-12-24"
const wordCount = countWords('Hello 世界'); // 3
```

### 3. **storage.js** - 存储管理
封装 Chrome Storage API 和缓存管理

**导出函数：**
- `getCachedSettings()` - 获取缓存的设置（带缓存优化）
- `setCachedSettings(settings)` - 保存设置到 Chrome Storage

**使用示例：**
```javascript
import { getCachedSettings, setCachedSettings } from './utils/storage.js';

const settings = await getCachedSettings();
await setCachedSettings({ ...settings, theme: 'dark' });
```

### 4. **filesystem.js** - 文件系统操作
处理 File System Access API 和 IndexedDB 持久化

**导出函数：**
- `saveDirectoryHandle(handle)` - 保存目录句柄到 IndexedDB
- `getSavedDirectoryHandle()` - 获取已保存的目录句柄
- `clearSavedDirectoryHandle()` - 清除已保存的目录句柄
- `getSavedDirectoryName()` - 获取已保存目录的名称
- `saveFileHandle(handle)` - 保存文件句柄
- `detectTargetDirFromHandle(dirHandle)` - 自动检测目标目录

**使用示例：**
```javascript
import { saveDirectoryHandle, getSavedDirectoryHandle } from './utils/filesystem.js';

const dirHandle = await window.showDirectoryPicker();
await saveDirectoryHandle(dirHandle);

// 下次使用时
const savedHandle = await getSavedDirectoryHandle();
```

### 5. **network.js** - 网络请求
处理 GitHub API 和 PicGo 图片上传

**导出函数：**
- `githubPutFile({ owner, repo, path, branch, message, contentBase64, token })` - 上传文件到 GitHub
- `parseRepoUrl(input)` - 解析仓库 URL
- `encodeBase64Utf8(str)` - UTF-8 字符串转 Base64
- `uploadToPicGo(endpoint, blob, token, options)` - 上传图片到 PicGo

**使用示例：**
```javascript
import { githubPutFile, parseRepoUrl, uploadToPicGo } from './utils/network.js';

const { owner, repo } = parseRepoUrl('https://github.com/user/repo');
await githubPutFile({ owner, repo, path: 'test.md', contentBase64: '...', token: '...' });

const imageUrl = await uploadToPicGo('http://localhost:36677/upload', blob, token);
```

### 6. **common.js** - 通用工具
通用的辅助函数

**导出函数：**
- `debounce(func, wait)` - 防抖函数

**使用示例：**
```javascript
import { debounce } from './utils/common.js';

const debouncedSave = debounce(() => {
  console.log('保存中...');
}, 500);
```

### 7. **index.js** - 统一导出
提供向后兼容的统一导出接口

**使用示例：**
```javascript
// 方式 1: 从 index.js 导入（推荐，向后兼容）
import { showToast, formatDate, getCachedSettings } from './utils/index.js';

// 方式 2: 从具体模块导入（更明确）
import { showToast } from './utils/ui.js';
import { formatDate } from './utils/format.js';
```

## 🔄 迁移指南

### 旧代码（使用 utils.js）
```javascript
import { showToast, formatDate, getCachedSettings } from './utils.js';
```

### 新代码（使用重构后的模块）
```javascript
// 选项 1: 使用 index.js（最简单，完全兼容）
import { showToast, formatDate, getCachedSettings } from './utils/index.js';

// 选项 2: 按需导入（更清晰）
import { showToast } from './utils/ui.js';
import { formatDate } from './utils/format.js';
import { getCachedSettings } from './utils/storage.js';
```

## ✅ 功能完整性检查

所有原 `utils.js` 中的功能均已迁移，无功能丢失：

### UI 功能 (5个)
- ✅ showToast
- ✅ showConfirm
- ✅ showChoice
- ✅ showPrompt
- ✅ setButtonLoading

### 格式化功能 (4个)
- ✅ formatDate
- ✅ formatTime
- ✅ countChars
- ✅ countWords

### 存储功能 (2个)
- ✅ getCachedSettings
- ✅ setCachedSettings

### 文件系统功能 (6个)
- ✅ saveDirectoryHandle
- ✅ getSavedDirectoryHandle
- ✅ clearSavedDirectoryHandle
- ✅ getSavedDirectoryName
- ✅ saveFileHandle
- ✅ detectTargetDirFromHandle

### 网络功能 (4个)
- ✅ githubPutFile
- ✅ parseRepoUrl
- ✅ encodeBase64Utf8
- ✅ uploadToPicGo

### 通用功能 (1个)
- ✅ debounce

**总计：22 个函数，全部迁移完成**

## 🎯 优势

1. **职责清晰**：每个文件只负责一类功能
2. **易于维护**：修改某类功能只需关注对应文件
3. **便于测试**：可以独立测试每个模块
4. **按需加载**：可以只导入需要的模块，减少打包体积
5. **向后兼容**：通过 index.js 保持与旧代码的兼容性
6. **可扩展性**：新增功能时可以轻松添加到对应模块

## 📝 注意事项

1. 原 `utils.js` 文件已保留，可以逐步迁移
2. 所有模块都使用 ES6 模块语法
3. 文件系统模块会自动暴露函数到 `window` 对象（用于 options.js）
4. 存储模块会自动监听 Chrome Storage 变化并更新缓存

## 🔗 相关文件

- 原文件：`js/utils.js`
- 新模块：`js/utils/*.js`
- 使用示例：参考 `js/editor.js`、`js/options.js` 等文件
