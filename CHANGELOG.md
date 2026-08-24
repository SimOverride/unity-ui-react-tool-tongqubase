# CHANGELOG

## 2026-08-24

### 修复

- `.unitypackage` 安装到 `Assets/UIReactTool` 后可以正确定位并初始化 ReactPreview 模板。
- npm 启动命令按编辑器平台选择：Windows 使用 `npm.cmd`，macOS 和 Linux 使用 `npm`。

## 2026-08-18

### 变更

- 转换器默认使用 Responsive 根布局；生成根节点填充挂载层，FixedReference 改为显式配置选项。
- React 预览与 Unity 生成统一使用 1680 逻辑高度，并补充 GridLayoutGroup 与列表布局属性。
- 修正 Prefab 子节点布局属性应用到现有 ScrollRect Content 的流程。

## 2026-08-17

### 变更

- 发布目录整理为 Unity Package Manager Git 包结构，根目录新增 `package.json`，工具源码位于 `Editor/`，编辑器测试位于 `Tests/Editor/`。
- 发布包可通过 `https://github.com/SimOverride/unity-ui-react-tool-tongqubase.git` 添加到目标项目；测试项目副本仍由同步脚本维护在 `Tools/Assets/UIReactTool`。
- 补齐发布包清单、README 和变更记录的 `.meta` 文件，避免 Unity 导入 UPM 包时重新生成资源 GUID。
- 新增 ReactPreview 白名单初始化入口，约束使用方复制行为并跳过 node_modules、dist、缓存和测试业务页面。
- ReactPreview 初始化后写入 `.uirect-template.json` 标记，Prefab 生成、依赖安装和预览启动拒绝手工整目录复制的模板。
- 修复新项目预览素材读取错误：初始化自动生成当前项目 `.env.local`，Vite 不再静默回退到仓库 `Tools/`，缺少有效 `UNITY_PROJECT_PATH` 时直接报错。

## 2026-08-12

### 新增

- 建立独立的 Unity UI React Tool 发布目录。
- 提供测试项目使用的 `Tools/Assets/UIReactTool` 工具副本，并由同步脚本映射到发布包根目录。
- 提供不包含测试项目业务资源的 React/Vite 预览模板。
- 提供测试项目副本与发布副本的双向同步脚本。
