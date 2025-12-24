# Options 模块说明

本目录包含设置页面的模块化组件，每个模块负责特定的功能领域。

## 模块结构

### SettingsManager.js
**职责**: 设置的加载、保存和验证
- `load()` - 从存储加载设置
- `save(settings)` - 保存设置到存储
- `validateSettings(settings)` - 验证设置的有效性

### GitHubManager.js
**职责**: GitHub 相关功能
- `init()` - 初始化 GitHub Token 输入框和测试按钮
- `loadToken()` - 加载 GitHub Token
- `saveToken(token)` - 保存 GitHub Token
- `testConnection()` - 测试 GitHub 仓库连接

### PicGoManager.js
**职责**: PicGo 图床配置和连接测试
- `init()` - 初始化 PicGo 相关输入框
- `loadSettings(settings)` - 加载 PicGo 设置
- `getSettings()` - 获取当前 PicGo 设置
- `testConnection()` - 测试 PicGo 服务连接

### PathManager.js
**职责**: 路径处理、规范化和建议
- `normalizeRelativePath(value)` - 规范化相对路径
- `convertAbsoluteToRelative(rawPath)` - 转换绝对路径为相对路径
- `sanitizePathValue(value)` - 清理和验证路径值
- `showTargetSuggestionBanner()` - 显示路径建议横幅

### FolderPickerManager.js
**职责**: 本地文件夹选择和管理
- `init()` - 初始化文件夹选择按钮
- `loadSavedFolder()` - 加载已保存的文件夹
- `pickFolder()` - 打开文件夹选择对话框
- `detectAndSuggestPath()` - 检测并建议目标路径

### UIController.js
**职责**: UI 交互逻辑
- `updateLocalDirSummary()` - 更新本地目录摘要显示
- `setupPushToggle()` - 设置推送开关的显示逻辑
- `setupAdvancedToggle()` - 设置高级选项折叠展开
- `setupInputValidation()` - 设置输入框验证
- `showSaveSuccess()` / `showSaveError()` - 显示保存结果

## 主入口文件

`js/options.js` 是设置页面的主入口，负责：
1. 初始化所有管理器
2. 加载设置并填充表单
3. 绑定事件处理器
4. 协调各模块之间的交互

## 模块间依赖关系

```
options.js (主入口)
├── SettingsManager (设置管理)
├── PathManager (路径处理)
│   └── 被 FolderPickerManager 使用
├── UIController (UI 控制)
│   └── 依赖 PathManager
├── GitHubManager (GitHub 管理)
├── PicGoManager (PicGo 管理)
└── FolderPickerManager (文件夹选择)
    └── 依赖 PathManager
```

## 优势

1. **单一职责**: 每个模块只负责一个功能领域
2. **易于维护**: 修改某个功能不会影响其他模块
3. **易于测试**: 每个模块可以独立测试
4. **代码复用**: 模块可以在其他地方复用
5. **清晰结构**: 代码组织更加清晰，易于理解
