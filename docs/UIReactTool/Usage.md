# UI React 工具使用说明

## 打开工具

在 Unity 菜单选择：

`Tools/UI/从 React 生成 Prefab...`

窗口内所有说明和操作按钮均为中文。

## 通过 Git URL 安装

发布包根目录包含 `package.json`，可直接作为 Unity Package Manager Git 包使用：

1. 打开目标 Unity 项目的 Package Manager。
2. 点击左上角 `+`，选择 `Add package from git URL...`。
3. 输入 `https://github.com/SimOverride/unity-ui-react-tool-tongqubase.git` 并等待导入完成。
4. 确认菜单 `Tools/UI/从 React 生成 Prefab...` 和 `Tools/UI/初始化 ReactPreview 模板` 出现，再按本说明配置路径和资源。

也可以在目标项目 `Packages/manifest.json` 的 `dependencies` 中加入：

```json
"com.simoverride.unity-ui-react-tool": "https://github.com/SimOverride/unity-ui-react-tool-tongqubase.git"
```

需要固定分支或标签时，在 URL 末尾追加 `#分支名` 或 `#标签名`。目标项目必须已经提供 UnityBaseFramework、其编辑器程序集和 TextMeshPro；发布包不会复制或修改这些依赖。

## 初始化 ReactPreview

不要直接复制发布目录中的 `ReactPreview`。在工具窗口将 React 工程目录设为 Unity 项目目录之外的目标路径后，点击“按工具白名单初始化 ReactPreview 模板”，或使用菜单 `Tools/UI/初始化 ReactPreview 模板`。

初始化只会复制 `index.html`、构建配置、`src` 和 `Generated/SampleDialog/SampleDialog.tsx`，并跳过 `node_modules`、`dist`、`.vite`、`.tsbuildinfo`、`.meta` 和测试项目业务页面；完成后会写入 `.uirect-template.json` 初始化标记，并生成指向当前 Unity 项目根目录的 `.env.local`。目标目录已有内容时会先确认；已有 `Generated` 业务页面不会被删除。安装依赖、启动预览和生成 Prefab 都会校验该标记，手工复制整个 `ReactPreview` 的目录不会通过校验。

导入新 Unity 项目时不得沿用模板中的 `Tools/` 路径。若手动运行 npm，先检查 `.env.local` 的 `UNITY_PROJECT_PATH` 是否指向当前项目根目录（该目录必须包含 `Assets`）；缺失或无效时 Vite 会直接报错，避免预览显示错误项目的资源。

## 路径配置

默认配置：

- React 工程目录：Unity 项目同级的 `UIReact`；发布模板位于本目录的 `ReactPreview`。
- Prefab 输出目录：`Assets/Prefabs/UI`。
- 界面脚本目录：`Assets/GameScripts/UI/Generated`。
- 界面命名空间：`Game.UI`。
- 组件 Prefab 目录：`Assets/FrameworkAsset/UI/Component`。
- 默认 TMP 字体：由目标项目在工具窗口中选择。
- Prefab 参考分辨率：`750×1680`。
- 界面模式：`Plain`。
- 预览端口：`4173`。

以上目录均可在窗口中修改。Unity 内目录必须以 `Assets` 开头；React 工程目录使用绝对路径。

“默认 TMP 字体”使用 Unity 资源选择框。它会应用到工具创建的 TMP 文本，以及本次生成的组件 Prefab 实例内部 TMP 文本；不会修改组件源 Prefab 或字体资产。

## 编写 TSX

每个界面使用一个带 `data-component="UIRootPanel"` 的根标签，并至少声明：

- `data-name`
- `data-dialog-name`
- 根节点可使用 `data-view-mode="Plain"` 或 `data-view-mode="Mvvm"` 覆盖工具窗口的界面模式
- 根节点可使用 `data-layout-mode="Responsive"` 或 `data-layout-mode="FixedReference"` 覆盖工具窗口的根布局模式；未声明时使用工具窗口配置
- `data-pos="(0, 0, 0)"`
- 响应式根节点使用 Stretch 锚点和零偏移填充挂载层；固定参考根节点使用有效 `data-size`，未声明时回退到工具配置的参考分辨率

每个生成控件必须声明静态 `data-name`、`data-component`、`data-pos` 和 `data-size`。需要逻辑访问的控件添加 `data-bind`。

Unity 使用的属性必须是字符串字面量。组件函数可以包含 Hooks、事件和预览状态，但花括号表达式、条件节点、模板字符串及 `.map()` 结果不会进入 Unity 基础模板；需要生成的层级必须静态写在根面板下。

没有独立状态模型需求时使用 `Plain`；长期持有业务状态、频繁响应数据变化或需要独立测试状态逻辑时使用 `Mvvm`。MVVM 模式首次生成会创建 `<Dialog>`、`<Dialog>ViewModel` 和 `<Dialog>Model` 三个 partial 类型骨架。

`data-bind` 默认按节点上的常用组件自动识别。需要明确目标时添加 `data-bind-type`，可选框架类型包括 `GameObject`、`Transform`、`RectTransform`、`Button`、`Image`、`RawImage`、`Text`、`Toggle`、`Slider`、`ScrollRect`、`InputField`、`CanvasGroup`、`Animator`、`TMPText`、`TMPInputField` 和 `TMPDropdown`。项目组件可直接填写完整类型名：

```tsx
<div
  data-name="InventoryCell"
  data-component="UIInventoryCell"
  data-bind="_inventoryCell"
  data-bind-type="Game.UI.InventoryCell"
/>
```

也可以写成 `data-bind-type="Custom" data-bind-custom-type="Game.UI.InventoryCell"`。显式类型不存在或组件 Prefab 的节点上没有该组件时，生成会直接报错。

列表和网格的静态子节点会自动挂入组件的滚动 Content。组件 Prefab 必须正确配置 ScrollRect 的 Content 引用。普通列表保留条目锚点；需要自动纵向排列时使用简单列表或显式声明纵向布局。需要设置 Content 尺寸、轴心或锚点时，使用 `data-prefab-child-path="Viewport/Content"` 描述该已有子节点；Prefab 子节点也可以声明 `data-layout-group="Vertical"` 或 `data-layout-group="Grid"`。

Grid 布局可使用 `data-layout-cell-size="(128, 65)"`、`data-layout-spacing="(15, 21)"`、`data-layout-padding="(0, 0, 0, 0)"`、`data-layout-constraint="FixedColumnCount"` 和 `data-layout-constraint-count="5"`。布局组只排列其直接子节点，标题、分页按钮等非条目节点应放在布局组外。

图片节点使用 `data-sprite="Assets/Arts/.../image.png"`。路径必须位于当前 Unity 项目的 `Assets` 下，素材导入类型必须为 Sprite。需要保持原始宽高比时添加 `data-preserve-aspect="true"`。

TMP 文本可以使用 `data-font-size`、`data-font-style`、`data-enable-word-wrapping`、`data-outline-color` 和 `data-outline-width`。颜色仍使用归一化 RGBA 四元组。

纯图片按钮可以省略 `data-text`，生成器会清空内建的 `Text (TMP)` 占位内容。作为文字模板使用的按钮即使暂时不指定文字，也应声明 `data-font-size`、`data-color`、`data-font-style`、对齐和描边属性；这些样式会保留在空 TMP 标签上。列表、网格等成组控件可以在静态父标签上统一声明文本表现属性，子控件会继承并可单独覆盖。

## 生成 Prefab

1. 在“TSX 文件”中选择目标 `.tsx`。
2. 点击“生成或更新 Prefab”。
3. 若界面脚本不存在，工具按页面模式生成普通界面脚本或 MVVM 三类型脚本，并等待 Unity 编译。
4. 编译完成后工具自动继续生成 Prefab。
5. 在配置的输出目录检查同名 Prefab。

生成结果会自动添加框架界面组件和绑定收集器。带 `data-bind` 的节点会生成绑定标记和序列化绑定项。

## React 预览

首次使用：

1. 点击“安装/更新预览依赖”。
2. 等待 Unity Console 输出 npm 完成信息。
3. 点击“启动并打开预览”。

也可以在 React 工程目录执行：

```powershell
npm install
npm run dev
```

预览页面会自动发现 `Generated` 下的 TSX，并允许在顶部下拉框切换界面。分辨率下拉框包含 750×1680 设计基准、手机窄屏与大屏、390×844 逻辑像素、平板横竖屏、1920×1080、1920×1200 和 2560×1080；响应式根节点会随逻辑画布宽度变化。布局按照 UIManager 的高度匹配方式（`MatchWidthOrHeight=1`）保持 1680 逻辑高度。工具默认使用响应式根节点；固定参考界面必须在工具配置或根节点中显式选择 FixedReference。

发布模板默认包含 `SampleDialog` 静态示例；业务项目可以在 `Generated` 下添加自己的 TSX 界面。

### 使用网页画布调整 TSX

预览右侧“UI 设计与检查”面板支持检查与画布编辑双模式：

1. 点击“开启画布编辑”，然后在层级或画布中选择节点。只有具有唯一静态 `data-name` 的节点可以写回。
2. 直接拖动节点改变位置，或拖动八个尺寸手柄调整边界。点锚定与拉伸锚定节点都可操作；拉伸轴的结果在右侧显示为边距。移动和尺寸边缘默认吸附到 5 像素网格、画布、父级和同级节点参考线。
3. 拖动黄色锚点控制点调整点锚点或 Anchor Min/Max，拖动粉色控制点调整 Pivot；锚点默认吸附到 0、0.5 和 1，按住 Alt 可临时关闭吸附，当前矩形保持不变。
4. 右侧使用 16 个常用锚点预设或 Min/Max/Pivot 数值进行精确调整。切换预设默认保持当前矩形，可选择同时匹配轴心；拉伸轴使用左、右、上、下边距输入。
5. 使用方向键微调 1 个逻辑像素，按住 Shift 时每次移动 10 个逻辑像素。
6. 使用滚轮或顶部按钮缩放画布；按住空格拖动或使用中键拖动可平移，点击“适应”恢复自动比例。缩放和平移不会修改 TSX。
7. 使用“撤销”“重做”或“放弃”管理当前页面草稿；一次拖动、缩放、锚点或 Pivot 操作只占一条撤销记录。切换页面或关闭标签前，工具会提示未保存修改。
8. 点击“保存 TSX”后，工具只更新 `Generated` 页面中的目标静态属性；然后回到 Unity 执行“生成或更新 Prefab”。

手动调整必须通过 `npm run dev` 或 Unity 工具的预览启动入口使用；生产构建页面保持只读。根节点和布局组控制的子节点会在画布中显示锁定原因。编辑器不允许修改 `data-name`、`data-component`、界面模式和 JSX 层级，也暂不支持多选、批量对齐或跨父级移动。若 IDE、Agent 或其他预览窗口已经修改同一 TSX，保存会拒绝覆盖；放弃草稿并重新加载页面后再继续。

## UnityBaseFramework 资源配置

目标项目必须让资源系统收集 Prefab 输出目录，并使用按文件名生成地址的规则。界面类型名、`data-dialog-name` 和 Prefab 文件名必须一致，框架才能通过界面管理器按类型名加载。

## 目标项目验收

1. 在目标项目打开包含 UIManager 的启动场景。
2. 进入播放模式，确认生成的 Prefab 能由 UIManager 正常加载。
3. 检查根节点为框架界面类型，并确认绑定节点、锚点和分辨率变化符合 TSX 声明。
4. 在 React 预览中至少切换设计基准、手机窄屏、平板横屏、16:9 宽屏和 21:9 超宽屏，确认逻辑高度保持 1680、逻辑宽度按屏幕比例变化，且布局没有依赖浏览器 CSS 的额外修正。
5. 运行时确认响应式页面根节点与 `Layer_50` 的 `RectTransform.rect` 尺寸一致；窄屏重点检查顶部/底部边距、中心控件、底栏和 Grid/列表条目。

## 引用配置说明

需要手动配置：

- 工具窗口中的路径和命名空间。
- 自定义组件库 Prefab。
- 默认 TMP 字体；必须选择目标项目中的 TMP 字体。
- Prefab 参考分辨率；默认使用 `750×1680`。
- 根布局模式；默认使用响应式全屏模式。
- 界面模式；默认使用普通 `UIView`，根节点可以逐页覆盖。
- 目标项目的 YooAsset 收集目录。
- 目标项目启动场景中的 UIManager、资源收集配置和验收 Prefab 引用。

自动获取或自动生成：

- 工具创建节点自身的 RectTransform 和内建 UI 组件。
- 根节点的框架界面组件与绑定收集器。
- `data-bind` 对应的绑定标记和绑定列表。
- React 预览的逻辑画布与手机、平板及桌面多比例适配。

## 常见问题

### 提示找不到自定义组件

检查组件 Prefab 目录中是否存在与 `data-component` 完全同名的 Prefab。未知组件不会静默降级。

### Prefab 生成后框架无法加载

检查 Prefab 名、界面类型名和资源地址是否完全一致，并确认 YooAsset 已收集输出目录。

### React 预览没有界面

检查 TSX 是否位于 React 工程的 `Generated` 目录，以及文件是否具有默认导出组件。

### Unity 与 React 位置不一致

检查锚点、轴心、位置和尺寸是否全部写在静态 `data-*` 属性中，不要用 CSS 修正生成控件布局。

