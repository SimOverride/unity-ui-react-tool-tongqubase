# 发布工具维护约束

- `Assets/UIReactTool` 是可迁移工具副本，必须保持在该目录下并可直接复制到 Unity 项目的 `Assets`。
- 发布副本与测试仓库中的 `Tools/Assets/UIReactTool` 同时维护；修改后使用 `scripts/Sync-Copies.ps1` 明确同步方向。
- 不复制、不修改 UnityBaseFramework 源码；目标项目必须通过已有程序集提供框架类型。
- 代码、脚本注释和文档使用中文；代码文件统一使用 CRLF 行尾。
- 不把测试项目的业务 Prefab、场景、框架快照、字体资产、`node_modules` 或构建缓存放入发布目录。
- 发布前至少验证 Unity 工具程序集编译和 React 预览构建，并检查 `git diff --check`。
