# 发布工具维护约束

- 当前目录本身是 Unity Package Manager Git 包根目录，必须保留根目录 `package.json`；工具代码放在 `Editor/`，编辑器测试放在 `Tests/Editor/`。
- 发布包与测试仓库中的 `Tools/Assets/UIReactTool` 同时维护；修改后使用 `scripts/Sync-Copies.ps1` 明确同步方向，禁止恢复为 `Assets/UIReactTool` 嵌套结构。
- ReactPreview 必须由 Unity 工具按白名单初始化到目标目录并生成 `.uirect-template.json` 标记；不得手工整目录复制发布包中的 ReactPreview，也不得复制 node_modules、dist、缓存或测试业务页面。
- ReactPreview 目标目录必须位于 Unity 项目目录之外，默认使用 Unity 项目同级的 `UIReact`。
- 导入或迁移到新 Unity 项目时，Agent 必须先识别当前 Unity 项目根目录（目录必须包含 `Assets`），然后直接创建或覆盖 React 工程 `.env.local` 中的 `UNITY_PROJECT_PATH`；不得只提示使用者手动修改，也不得保留发布仓库或测试仓库的 `Tools/` 回退路径。优先通过 Unity 工具初始化自动写入，手动运行 npm 前必须再次核对该路径。
- 不复制、不修改 UnityBaseFramework 源码；目标项目必须通过已有程序集提供框架类型。
- 普通界面使用 `UIView`；具有独立状态模型、频繁状态更新或需要独立测试状态逻辑的界面使用 MVVM `BaseUIView` 体系。Agent 必须说明推荐理由，由用户确认界面模式。
- 显式绑定使用 `data-bind-type` 覆盖框架常用组件或项目组件完整类型名；自定义组件不得静默退化为 `RectTransform`。
- React 手动调整必须写回 `Generated` 下的 TSX，生成 Prefab 不得持有无法从 TSX 重建的人工布局修改。首版编辑器只允许修改具有唯一静态 `data-name` 节点的受支持属性，使用显式保存和源码版本冲突保护，不修改节点名称、组件类型、界面模式或 JSX 层级。
- 网页手动调整以画布直接操作为主，拖动和缩放必须换算为 TSX 静态布局数据；画布视口的缩放和平移只属于编辑会话，不得写入 TSX。根节点、拉伸锚点节点及布局组控制的子节点在未提供对应约束操纵器前不得自由拖动。
- 代码、脚本注释和文档使用中文；代码文件统一使用 CRLF 行尾。
- 不把测试项目的业务 Prefab、场景、框架快照、字体资产、`node_modules` 或构建缓存放入发布目录。
- 发布前至少验证 Unity 工具程序集编译和 React 预览构建，并检查 `git diff --check`。
