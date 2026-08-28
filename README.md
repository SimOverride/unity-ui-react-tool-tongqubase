# Unity UI React Tool

这是面向 UnityBaseFramework 的 React UI 基础模板工具发布目录，位于 Unity 项目工作区 `UnityTools` 下，与 Unity 项目 `Tools` 同级。
工具把静态 TSX 的层级、锚点、尺寸和基础控件属性转换为 Unity Prefab，并提供同源 React 浏览器预览。开发预览以网页设计画布作为主要调整入口，支持节点拖动、八方向缩放、锚点预设、Anchor Min/Max 与 Pivot 拖动、拉伸边距、参考线吸附、键盘微调、视口缩放和平移，并可管理撤销/重做草稿后显式写回 TSX。生成页面支持轻量 `UIView` 与 MVVM 两种模式，绑定可以自动识别常用组件，也可以显式指定框架类型或项目组件完整类型名。业务逻辑、正式美术资源和 UnityBaseFramework 本体不包含在本发布目录中。

## 目录

- `package.json`：Unity Package Manager 包清单，位于 Git 包根目录。
- `Editor`：编辑器工具源码和程序集定义。
- `Tests/Editor`：编辑器测试程序集。
- `ReactPreview`：由 Unity 工具按白名单初始化到 Unity 项目同级的 React/Vite 预览模板；禁止把整个发布目录直接复制到目标项目。
- `docs/UIReactTool`：设计、开发和使用说明。
- `scripts/Sync-Copies.ps1`：测试项目副本与发布副本的双向同步脚本。

## 通过 Git URL 安装到 Unity 项目

1. 确认目标项目已经接入 UnityBaseFramework，并能提供 `TongquBase`、`TongquBase.Editor` 和 TextMeshPro。
2. 打开 Unity 的 Package Manager，点击左上角 `+`，选择 `Add package from git URL...`。
3. 输入：

   ```text
   https://github.com/SimOverride/unity-ui-react-tool-tongqubase.git
   ```

4. 等待包导入和 Unity 编译完成；菜单 `Tools/UI/从 React 生成 Prefab...` 出现后即表示工具已加载。
5. 在工具窗口中将“React 工程目录”设为 Unity 项目同级的 `UIReact`（也可以选择 Unity 项目目录之外的其他绝对路径），点击“按工具白名单初始化 ReactPreview 模板”；工具只复制构建配置、`src` 和示例 TSX，不复制 `node_modules`、`dist`、缓存或测试业务页面，并写入初始化标记和当前项目的 `.env.local`。
6. 在工具窗口配置 TSX、Prefab 输出目录、脚本目录、组件 Prefab 目录、默认 TMP 字体和界面模式，然后生成 Prefab。根节点可使用 `data-view-mode="Plain|Mvvm"` 逐页覆盖，节点可使用 `data-bind-type` 指定绑定组件。

也可以在 `Packages/manifest.json` 中手动加入 Git 依赖：

```json
"com.simoverride.unity-ui-react-tool": "https://github.com/SimOverride/unity-ui-react-tool-tongqubase.git"
```

如果使用指定分支或标签，可在 URL 末尾追加 `#分支名` 或 `#标签名`。

工具不会复制或修改 UnityBaseFramework，也不会修改组件源 Prefab。外部框架、组件 Prefab、TMP 字体和资源收集目录由目标项目负责配置。

## 预览模板

使用工具初始化后的目标 `UIReact` 目录执行：

```powershell
npm install
npm run dev
```

不要通过文件管理器直接复制整个 `ReactPreview` 目录。需要重新创建或更新模板时，使用 Unity 菜单 `Tools/UI/初始化 ReactPreview 模板`；已有 `Generated` 业务页面不会被删除，但模板文件和 `src` 会被更新。Prefab 生成、预览启动和依赖安装都会校验初始化标记，手工复制的目录会被拒绝。

Unity 工具启动预览时会自动传入 `UNITY_PROJECT_PATH`，使 `data-sprite="Assets/..."` 能读取当前 Unity 项目的资源。初始化器同时把当前项目根目录写入目标工程 `.env.local`，所以手动执行 `npm run dev` 或 `npm run build` 也能使用同一资源目录。没有该配置时工具会直接报错，不再静默回退到发布仓库的 `Tools/`。

`npm run dev` 启动后，可在右侧面板点击“开启画布编辑”。具有唯一 `data-name` 且不受布局组控制的普通节点可以直接拖动和缩放；黄色控制点调整锚点，粉色控制点调整 Pivot，右侧提供 16 个常用预设和拉伸边距输入，修改锚点或轴心默认保持当前矩形。根节点和布局组子节点会显示锁定原因。顶部可切换手机、平板横竖屏、16:9、16:10 和 21:9 等测试分辨率。修改先保存在浏览器草稿中，点击“保存 TSX”才会受限写回 `Generated` 页面；保存完成后需要回到 Unity 重新生成 Prefab。生产构建、节点层级、组件类型和界面模式保持只读。

## 双副本维护

测试项目副本位于 `D:\Unity Projects\UnityTools\Tools\Assets\UIReactTool`，发布包源码位于本目录的 `Editor` 和 `Tests`。默认以测试项目为当前验证源，修改后执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Sync-Copies.ps1 -Direction ToRelease
```

需要把发布副本的改动带回测试项目时执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Sync-Copies.ps1 -Direction ToTest
```

同步脚本会把测试项目的 `Editor`、`Tests` 映射到发布包根目录，并排除测试专用的 `Editor/Acceptance`；同时处理预览模板骨架，不覆盖测试项目的 `GameMenu`、业务脚本、Prefab、场景、`node_modules` 或构建产物。同步后应在测试项目运行编译或 Unity 验收，再提交发布包仓库。

## 依赖与限制

- 目标 Unity 项目需要自行提供 UnityBaseFramework 及其依赖。
- 目标项目需要配置默认 TMP 字体；发布目录不绑定测试项目的字体资产。
- TSX 转换只读取静态 `UIRootPanel` 和静态 `data-*` 属性，不执行运行时 JSX。
- 没有独立状态模型需求时使用普通模式；需要长期状态、频繁数据响应或独立状态测试时使用 MVVM 模式。
- 工具生成的是基础 UI 模板，不替代业务逻辑、资源分包和正式界面验收。
