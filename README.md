# Unity UI React Tool

这是面向 UnityBaseFramework 的 React UI 基础模板工具发布目录。
工具把静态 TSX 的层级、锚点、尺寸和基础控件属性转换为 Unity Prefab，并提供同源 React 浏览器预览。业务逻辑、正式美术资源和 UnityBaseFramework 本体不包含在本发布目录中。

## 目录

- `Assets/UIReactTool`：复制到目标 Unity 项目的 `Assets/UIReactTool`。
- `ReactPreview`：可复制到 Unity 项目同级并改名为 `UIReact` 的 React/Vite 预览模板。
- `docs/UIReactTool`：设计、开发和使用说明。
- `scripts/Sync-Copies.ps1`：测试项目副本与发布副本的双向同步脚本。

## 安装到 Unity 项目

1. 确认目标项目已经接入 UnityBaseFramework，并能提供 `TongquBase`、`TongquBase.Editor` 和 TextMeshPro。
2. 将 `Assets/UIReactTool` 复制到目标项目的 `Assets` 目录。
3. 将 `ReactPreview` 复制到 Unity 项目同级，通常命名为 `UIReact`；也可以在 Unity 菜单的工具窗口中配置其他绝对路径。
4. 等待 Unity 编译完成，在菜单 `Tools/UI/从 React 生成 Prefab...` 中配置 TSX、Prefab 输出目录、脚本目录、组件 Prefab 目录和默认 TMP 字体。
5. 使用工具生成 Prefab，再按目标项目的资源收集规则收集生成目录。

工具不会复制或修改 UnityBaseFramework，也不会修改组件源 Prefab。外部框架、组件 Prefab、TMP 字体和资源收集目录由目标项目负责配置。

## 预览模板

在 `ReactPreview` 目录执行：

```powershell
npm install
npm run dev
```

Unity 工具启动预览时会自动传入 `UNITY_PROJECT_PATH`，使 `data-sprite="Assets/..."` 能读取当前 Unity 项目的资源。手动启动时可以设置该环境变量指向目标 Unity 项目目录。

## 双副本维护

测试项目副本位于 `D:\Unity Projects\UnityTools\Tools\Assets\UIReactTool`，发布副本位于本目录的 `Assets/UIReactTool`。默认以测试项目为当前验证源，修改后执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Sync-Copies.ps1 -Direction ToRelease
```

需要把发布副本的改动带回测试项目时执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Sync-Copies.ps1 -Direction ToTest
```

同步脚本只处理工具源码、程序集和预览模板骨架，不覆盖测试项目的 `GameMenu`、业务脚本、Prefab、场景、`node_modules` 或构建产物。同步后应在两边分别运行编译或 Unity 验收。

## 依赖与限制

- 目标 Unity 项目需要自行提供 UnityBaseFramework 及其依赖。
- 目标项目需要配置默认 TMP 字体；发布目录不绑定测试项目的字体资产。
- TSX 转换只读取静态 `UIRootPanel` 和静态 `data-*` 属性，不执行运行时 JSX。
- 工具生成的是基础 UI 模板，不替代业务逻辑、资源分包和正式界面验收。
