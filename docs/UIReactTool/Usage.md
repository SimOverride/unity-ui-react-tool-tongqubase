# UI React 工具使用说明

## 打开工具

在 Unity 菜单选择：

`Tools/UI/从 React 生成 Prefab...`

窗口内所有说明和操作按钮均为中文。

## 路径配置

默认配置：

- React 工程目录：Unity 项目同级的 `UIReact`；发布模板位于本目录的 `ReactPreview`。
- Prefab 输出目录：`Assets/Prefabs/UI`。
- 界面脚本目录：`Assets/GameScripts/UI/Generated`。
- 界面命名空间：`Game.UI`。
- 组件 Prefab 目录：`Assets/FrameworkAsset/UI/Component`。
- 默认 TMP 字体：由目标项目在工具窗口中选择。
- Prefab 参考分辨率：`750×1680`。
- 预览端口：`4173`。

以上目录均可在窗口中修改。Unity 内目录必须以 `Assets` 开头；React 工程目录使用绝对路径。

“默认 TMP 字体”使用 Unity 资源选择框。它会应用到工具创建的 TMP 文本，以及本次生成的组件 Prefab 实例内部 TMP 文本；不会修改组件源 Prefab 或字体资产。

## 编写 TSX

每个界面使用一个带 `data-component="UIRootPanel"` 的根标签，并至少声明：

- `data-name`
- `data-dialog-name`
- 根节点可使用 `data-layout-mode="Responsive"` 或 `data-layout-mode="FixedReference"` 覆盖工具窗口的根布局模式；未声明时使用工具窗口配置
- `data-pos="(0, 0, 0)"`
- 响应式根节点使用 Stretch 锚点和零偏移填充挂载层；固定参考根节点使用有效 `data-size`，未声明时回退到工具配置的参考分辨率

每个生成控件必须声明静态 `data-name`、`data-component`、`data-pos` 和 `data-size`。需要逻辑访问的控件添加 `data-bind`。

Unity 使用的属性必须是字符串字面量。组件函数可以包含 Hooks、事件和预览状态，但花括号表达式、条件节点、模板字符串及 `.map()` 结果不会进入 Unity 基础模板；需要生成的层级必须静态写在根面板下。

列表和网格的静态子节点会自动挂入组件的滚动 Content。组件 Prefab 必须正确配置 ScrollRect 的 Content 引用。普通列表保留条目锚点；需要自动纵向排列时使用简单列表或显式声明纵向布局。需要设置 Content 尺寸、轴心或锚点时，使用 `data-prefab-child-path="Viewport/Content"` 描述该已有子节点。

图片节点使用 `data-sprite="Assets/Arts/.../image.png"`。路径必须位于当前 Unity 项目的 `Assets` 下，素材导入类型必须为 Sprite。需要保持原始宽高比时添加 `data-preserve-aspect="true"`。

TMP 文本可以使用 `data-font-size`、`data-font-style`、`data-enable-word-wrapping`、`data-outline-color` 和 `data-outline-width`。颜色仍使用归一化 RGBA 四元组。

纯图片按钮可以省略 `data-text`，生成器会清空内建的 `Text (TMP)` 占位内容。作为文字模板使用的按钮即使暂时不指定文字，也应声明 `data-font-size`、`data-color`、`data-font-style`、对齐和描边属性；这些样式会保留在空 TMP 标签上。列表、网格等成组控件可以在静态父标签上统一声明文本表现属性，子控件会继承并可单独覆盖。

## 生成 Prefab

1. 在“TSX 文件”中选择目标 `.tsx`。
2. 点击“生成或更新 Prefab”。
3. 若界面脚本不存在，工具先生成脚本并等待 Unity 编译。
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

预览页面会自动发现 `Generated` 下的 TSX，并允许在顶部下拉框切换界面。分辨率下拉框提供多个竖屏设备尺寸；响应式根节点会随逻辑画布宽度变化，布局以 750×1680 为设计基准，按照 UIManager 的高度匹配方式计算逻辑宽度。

发布模板默认包含 `SampleDialog` 静态示例；业务项目可以在 `Generated` 下添加自己的 TSX 界面。

## UnityBaseFramework 资源配置

目标项目必须让资源系统收集 Prefab 输出目录，并使用按文件名生成地址的规则。界面类型名、`data-dialog-name` 和 Prefab 文件名必须一致，框架才能通过界面管理器按类型名加载。

## 目标项目验收

1. 在目标项目打开包含 UIManager 的启动场景。
2. 进入播放模式，确认生成的 Prefab 能由 UIManager 正常加载。
3. 检查根节点为框架界面类型，并确认绑定节点、锚点和分辨率变化符合 TSX 声明。
4. 在 React 预览中切换多个竖屏分辨率，确认布局没有依赖浏览器 CSS 的额外修正。

## 引用配置说明

需要手动配置：

- 工具窗口中的路径和命名空间。
- 自定义组件库 Prefab。
- 默认 TMP 字体；必须选择目标项目中的 TMP 字体。
- Prefab 参考分辨率；默认使用 `750×1680`。
- 根布局模式；默认使用响应式全屏模式。
- 目标项目的 YooAsset 收集目录。
- 目标项目启动场景中的 UIManager、资源收集配置和验收 Prefab 引用。

自动获取或自动生成：

- 工具创建节点自身的 RectTransform 和内建 UI 组件。
- 根节点的框架界面组件与绑定收集器。
- `data-bind` 对应的绑定标记和绑定列表。
- React 预览的逻辑画布与竖屏分辨率适配。

## 常见问题

### 提示找不到自定义组件

检查组件 Prefab 目录中是否存在与 `data-component` 完全同名的 Prefab。未知组件不会静默降级。

### Prefab 生成后框架无法加载

检查 Prefab 名、界面类型名和资源地址是否完全一致，并确认 YooAsset 已收集输出目录。

### React 预览没有界面

检查 TSX 是否位于 React 工程的 `Generated` 目录，以及文件是否具有默认导出组件。

### Unity 与 React 位置不一致

检查锚点、轴心、位置和尺寸是否全部写在静态 `data-*` 属性中，不要用 CSS 修正生成控件布局。

