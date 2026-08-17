# 发布工具维护约束

- 当前目录本身是 Unity Package Manager Git 包根目录，必须保留根目录 `package.json`；工具代码放在 `Editor/`，编辑器测试放在 `Tests/Editor/`。
- 发布包与测试仓库中的 `Tools/Assets/UIReactTool` 同时维护；修改后使用 `scripts/Sync-Copies.ps1` 明确同步方向，禁止恢复为 `Assets/UIReactTool` 嵌套结构。
- 不复制、不修改 UnityBaseFramework 源码；目标项目必须通过已有程序集提供框架类型。
- 代码、脚本注释和文档使用中文；代码文件统一使用 CRLF 行尾。
- 不把测试项目的业务 Prefab、场景、框架快照、字体资产、`node_modules` 或构建缓存放入发布目录。
- 发布前至少验证 Unity 工具程序集编译和 React 预览构建，并检查 `git diff --check`。
