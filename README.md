# Unity UI React Tool

这是面向 UnityBaseFramework 的 React UI 基础模板工具发布目录，位于 Unity 项目工作区 `UnityTools` 下，与 Unity 项目 `Tools` 同级。
工具把静态 TSX 的层级、锚点、尺寸和基础控件属性转换为 Unity Prefab，并提供同源 React 浏览器预览。业务逻辑、正式美术资源和 UnityBaseFramework 本体不包含在本发布目录中。

## 目录

- `package.json`：Unity Package Manager 包清单，位于 Git 包根目录。
- `Editor`：编辑器工具源码和程序集定义。
- `Tests/Editor`：编辑器测试程序集。
- `ReactPreview`：可复制到 Unity 项目同级并改名为 `UIReact` 的 React/Vite 预览模板。
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
5. 将 `ReactPreview` 复制到 Unity 项目同级，通常命名为 `UIReact`；也可以在工具窗口中配置其他绝对路径。
6. 在工具窗口配置 TSX、Prefab 输出目录、脚本目录、组件 Prefab 目录和默认 TMP 字体，然后生成 Prefab。

也可以在 `Packages/manifest.json` 中手动加入 Git 依赖：

```json
"com.simoverride.unity-ui-react-tool": "https://github.com/SimOverride/unity-ui-react-tool-tongqubase.git"
```

如果使用指定分支或标签，可在 URL 末尾追加 `#分支名` 或 `#标签名`。

工具不会复制或修改 UnityBaseFramework，也不会修改组件源 Prefab。外部框架、组件 Prefab、TMP 字体和资源收集目录由目标项目负责配置。

## 预览模板

在 `ReactPreview` 目录执行：

```powershell
npm install
npm run dev
```

Unity 工具启动预览时会自动传入 `UNITY_PROJECT_PATH`，使 `data-sprite="Assets/..."` 能读取当前 Unity 项目的资源。手动启动时可以设置该环境变量指向目标 Unity 项目目录。

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
- 工具生成的是基础 UI 模板，不替代业务逻辑、资源分包和正式界面验收。
