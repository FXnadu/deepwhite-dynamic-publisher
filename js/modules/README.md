# Editor.js 模块化重构文档

## 重构概述

原 `editor.js` 文件包含 1200+ 行代码，承担了 10+ 种职责。现已拆分为 **8 个职责单一的模块**。

## 模块架构

```
js/
├── editor-new.js              # 新的入口文件（替代 editor.js）
└── modules/
    ├── EditorCore.js          # 核心协调器
    ├── MarkdownRenderer.js    # Markdown 渲染
    ├── ImageHandler.js        # 图片处理
    ├── ImageGalleryManager.js # 图片画廊 ✨
    ├── DraftManager.js        # 草稿管理
    ├── FileSystemManager.js   # 文件系统
    ├── PublishManager.js      # 发布管理
    └── UIManager.js           # UI 更新
```

## 各模块职责

### 1. EditorCore.js（核心协调器）
**职责：** 编辑器初始化、模块协调、事件绑定
- 初始化编辑器实例
- 协调各模块工作
- 绑定全局事件（input、click 等）
- 管理编辑器生命周期

**导出：**
- `initEditor()` - 编辑器初始化函数

---

### 2. MarkdownRenderer.js（Markdown 渲染器）
**职责：** Markdown 语法高亮、滚动同步
- 轻量级 Markdown 语法高亮
- 虚拟滚动优化（大文件性能）
- 编辑器与高亮层滚动同步
- 可见区域增量渲染

**导出：**
- `initHighlight(editor, highlightEl, initialValue)` - 初始化高亮
- `setupScrollSync(editor, highlightEl)` - 设置滚动同步
- `scheduleInputUpdate(editor, highlightEl, value, onUpdate)` - 调度更新
- `updateHighlight(editor, highlightEl, value)` - 更新高亮
- `updateVisibleHighlightNow(editor, highlightEl, value)` - 立即更新可见区域

---

### 3. ImageHandler.js（图片处理器）
**职责：** 图片上传、粘贴、PicGo 集成、本地保存
- 处理粘贴图片事件
- PicGo 图床上传
- 本地文件系统保存
- 图片文件名生成
- Markdown 图片语法插入

**导出：**
- `handleImageFile(file, settings, opts)` - 处理图片文件
- `setupPasteHandler(editor, settingsLoader)` - 设置粘贴处理

---

### 4. ImageGalleryManager.js（图片画廊管理器）✨ 新增
**职责：** 图片画廊渲染、交互、预览
- 从 Markdown 解析图片 URL
- 渲染图片画廊 UI
- 图片预览模态框
- 图片删除和复制
- 画廊展开/收起交互

**导出：**
- `renderImageGalleryFromText(text)` - 渲染图片画廊
- `insertTextAtCursor(textarea, text)` - 在光标位置插入文本

---

### 5. DraftManager.js（草稿管理器）
**职责：** 草稿保存、加载、自动保存
- Chrome Storage 草稿持久化
- 草稿元数据管理（时间戳）
- 防抖自动保存
- 草稿状态更新

**导出：**
- `saveDraft(value)` - 保存草稿
- `loadDraft()` - 加载草稿
- `loadDraftMeta()` - 加载草稿元数据
- `createAutoSave()` - 创建自动保存函数

---

### 5. FileSystemManager.js（文件系统管理器）
**职责：** 本地文件系统操作（读写文件、目录管理）
- File System Access API 封装
- 目录权限管理
- 文件读写操作
- 用户目录选择
- Blob 文件导出

**导出：**
- `ensureWritableDirectory(dirHandle)` - 确保目录可写
- `getTargetDirectory(dirHandle, targetDirPath)` - 获取目标目录
- `checkExistingLocalFile(filename, targetDirPath)` - 检查文件是否存在
- `writeLocalFile(filename, content, targetDirPath)` - 写入本地文件
- `writeBlobToLocalFile(filename, blob, targetDirPath)` - 写入 Blob
- `writeBlobToUserPickedDirectory(filename, blob, suggestedPath)` - 用户选择目录写入
- `exportBlobAsFile(filename, blob)` - 导出文件

---

### 6. PublishManager.js（发布管理器）
**职责：** 发布流程、GitHub 推送、本地保存
- GitHub API 推送
- 本地文件保存
- 发布流程控制
- 错误处理与重试
- 文件导出备份

**导出：**
- `publish(content, settings)` - 发布内容（GitHub 或本地）

---

### 7. UIManager.js（UI 管理器）
**职责：** UI 状态更新、字数统计、文件路径提示、状态指示器
- 状态栏更新
- 字数统计显示
- 文件路径提示
- 草稿状态指示
- 时钟显示
- 按钮文案更新

**导出：**
- `getEl(id)` - DOM 元素缓存获取
- `setStatus(text, cls)` - 设置状态
- `setDraftState(text)` - 设置草稿状态
- `flashDraftState()` - 闪烁草稿状态指示器
- `updateWordCount(text)` - 更新字数统计
- `updateFileHint(settings)` - 更新文件路径提示
- `tick()` - 更新时钟
- `updatePublishButtonText(shouldPush)` - 更新发布按钮文案

---

## 使用方式

### 更新 HTML 引用

将 `editor.html` 中的脚本引用从：
```html
<script type="module" src="js/editor.js"></script>
```

改为：
```html
<script type="module" src="js/editor-new.js"></script>
```

### 模块依赖关系

```
editor-new.js
    └── EditorCore.js
        ├── DraftManager.js
        │   └── UIManager.js
        ├── MarkdownRenderer.js
        ├── ImageHandler.js
        │   └── FileSystemManager.js
        ├── PublishManager.js
        │   └── FileSystemManager.js
        └── UIManager.js
```

## 重构优势

### 1. 职责单一（Single Responsibility）
每个模块只负责一个明确的功能领域，易于理解和维护。

### 2. 低耦合（Low Coupling）
模块间通过明确的接口通信，减少相互依赖。

### 3. 高内聚（High Cohesion）
相关功能集中在同一模块，提高代码组织性。

### 4. 易测试（Testable）
每个模块可独立测试，无需启动整个编辑器。

### 5. 易扩展（Extensible）
新增功能只需添加新模块或扩展现有模块，不影响其他部分。

### 6. 代码复用（Reusable）
模块可在其他项目中复用（如 FileSystemManager、ImageHandler）。

## 迁移指南

### 保留原文件
原 `editor.js` 已保留，可随时回退。

### 测试清单
- [ ] 编辑器加载
- [ ] 草稿自动保存
- [ ] Markdown 高亮
- [ ] 图片粘贴上传
- [ ] PicGo 集成
- [ ] 本地文件保存
- [ ] GitHub 推送
- [ ] 字数统计
- [ ] 文件路径提示

### 性能对比
模块化后性能应与原版相当或更优（得益于更清晰的代码结构）。

## 后续优化建议

1. **添加单元测试** - 为每个模块编写测试
2. **TypeScript 迁移** - 增加类型安全
3. **配置文件** - 将常量提取到配置文件
4. **错误边界** - 统一错误处理机制
5. **日志系统** - 添加结构化日志
6. **性能监控** - 添加性能指标收集

## 文件大小对比

| 文件 | 行数 | 职责数 |
|------|------|--------|
| editor.js（原） | 1627 | 10+ |
| editor-new.js | 12 | 1 |
| EditorCore.js | ~80 | 1 |
| MarkdownRenderer.js | ~200 | 1 |
| ImageHandler.js | ~150 | 1 |
| DraftManager.js | ~70 | 1 |
| FileSystemManager.js | ~140 | 1 |
| PublishManager.js | ~150 | 1 |
| UIManager.js | ~120 | 1 |

**总计：** ~922 行（7 个模块 + 入口），每个模块职责单一。
