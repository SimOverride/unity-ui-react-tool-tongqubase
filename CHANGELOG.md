# CHANGELOG

## 2026-08-17

### 变更

- 发布目录整理为 Unity Package Manager Git 包结构，根目录新增 `package.json`，工具源码位于 `Editor/`，编辑器测试位于 `Tests/Editor/`。
- 发布包可通过 `https://github.com/SimOverride/unity-ui-react-tool-tongqubase.git` 添加到目标项目；测试项目副本仍由同步脚本维护在 `Tools/Assets/UIReactTool`。

## 2026-08-12

### 新增

- 建立独立的 Unity UI React Tool 发布目录。
- 提供测试项目使用的 `Tools/Assets/UIReactTool` 工具副本，并由同步脚本映射到发布包根目录。
- 提供不包含测试项目业务资源的 React/Vite 预览模板。
- 提供测试项目副本与发布副本的双向同步脚本。
