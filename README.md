# Deepwhite Dynamic Publisher

Chrome 浏览器扩展，用于快速编写和发布 Deepwhite 11ty 动态日志。

## 安装和测试

### 1. 加载扩展（开发模式）

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/` 或通过菜单：**更多工具** → **扩展程序**
3. 开启右上角的 **开发者模式**（Developer mode）
4. 点击 **加载已解压的扩展程序**（Load unpacked）
5. 选择本项目目录：`/Users/warmwhite/Documents/deepwhite-dynamic-publisher`
6. 扩展应该会出现在扩展列表中

### 2. 测试步骤

#### 测试 Popup 页面
1. 点击浏览器工具栏中的扩展图标
2. 应该会弹出一个小窗口，显示 "Deepwhite dynamic journal"
3. 点击 "打开浮窗编辑器" 按钮
4. 应该会打开一个新的编辑器窗口

#### 测试 Editor 页面
1. 编辑器窗口打开后，测试以下功能：
   - **输入文本**：在文本框中输入内容，应该看到：
     - 实时字数统计更新
     - 草稿状态显示 "已修改（自动保存中…）"
     - 几秒后自动保存
   - **快捷键测试**：
     - `Ctrl+S` (Mac: `Cmd+S`) - 手动保存
     - `Ctrl+Enter` (Mac: `Cmd+Enter`) - 发表文章
   - **清空按钮**：点击清空，应该弹出确认对话框
   - **发表按钮**：点击发表，应该显示预览对话框（模拟模式）

#### 测试 Options 页面
1. 在编辑器页面点击 "设置" 按钮，或：
   - 右键点击扩展图标 → **选项**（Options）
   - 或访问 `chrome://extensions/` → 找到扩展 → 点击 **详细信息** → **扩展程序选项**
2. 测试表单：
   - 修改各个字段
   - 尝试留空必填字段，点击保存应该显示错误提示
   - 正确填写后保存，应该显示成功提示

#### 测试窗口管理
1. 打开编辑器窗口
2. 调整窗口大小和位置
3. 关闭窗口
4. 再次点击扩展图标打开，窗口应该恢复到上次的位置和大小

### 3. 调试方法

#### 查看 Console 日志
- **Popup 页面**：右键点击扩展图标 → **检查弹出内容**（Inspect popup）
- **Editor 页面**：在编辑器窗口中按 `F12` 或右键 → **检查**
- **Options 页面**：在设置页面按 `F12` 或右键 → **检查**
- **Service Worker**：在 `chrome://extensions/` 页面，找到扩展，点击 **service worker** 链接

#### 查看存储数据
在 Console 中运行：
```javascript
// 查看本地存储（草稿、窗口位置等）
chrome.storage.local.get(null, console.log);

// 查看同步存储（设置）
chrome.storage.sync.get(null, console.log);
```

#### 清除存储数据
```javascript
// 清除所有本地存储
chrome.storage.local.clear();

// 清除所有同步存储
chrome.storage.sync.clear();
```

### 4. 常见问题

#### 问题：扩展图标不显示
- 检查 `icons/` 目录下是否有图标文件
- 检查 `manifest.json` 中的图标路径是否正确

#### 问题：点击图标没有反应
- 检查 Service Worker 是否正常运行（在 `chrome://extensions/` 查看）
- 查看 Console 是否有错误信息

#### 问题：ES 模块导入失败
- 确保 HTML 中使用 `<script type="module">` 标签
- 检查文件路径是否正确
- 查看 Console 中的错误信息

#### 问题：窗口无法打开
- 检查 `manifest.json` 中是否有 `windows` 权限
- 检查 Service Worker 中的窗口创建逻辑

### 5. 重新加载扩展

修改代码后，需要重新加载扩展：
1. 在 `chrome://extensions/` 页面
2. 找到扩展，点击 **刷新** 图标（🔄）
3. 或者点击 **移除** 后重新加载

**注意**：重新加载扩展会清除 Service Worker 的状态，但不会清除存储的数据。

## 项目结构

```
deepwhite-dynamic-publisher/
├── manifest.json          # 扩展配置文件
├── popup.html            # 弹出窗口页面
├── editor.html           # 编辑器页面
├── options.html          # 设置页面
├── css/
│   └── common.css        # 公共样式
├── js/
│   ├── utils.js          # 工具函数
│   ├── popup.js          # 弹出窗口逻辑
│   ├── editor.js         # 编辑器逻辑
│   ├── options.js        # 设置页面逻辑
│   └── sw.js             # Service Worker
└── icons/                # 图标文件
```

## 开发说明

- 当前版本为 **Mock 模式**，发表功能仅模拟，不会真正推送到 GitHub
- 所有数据存储在 Chrome 的 `chrome.storage` API 中
- 使用 ES6 模块化开发
- UI 样式对齐 Deepwhite 站点风格

