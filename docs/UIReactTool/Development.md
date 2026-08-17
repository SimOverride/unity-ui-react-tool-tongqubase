# UI React 工具开发说明

## 项目结构

- Unity 工具程序集：发布包根目录 `Editor/`；测试项目同步副本为 `Tools/Assets/UIReactTool/Editor`。
- 编辑器测试程序集：发布包根目录 `Tests/Editor/`；测试项目同步副本为 `Tools/Assets/UIReactTool/Tests/Editor/`。
- 包清单：发布包根目录 `package.json`，包名为 `com.simoverride.unity-ui-react-tool`，用于 Unity Package Manager Git URL 安装。
- 解析逻辑：读取静态 TSX 标签、属性、文本和父子层级。
- 生成逻辑：创建 RectTransform、uGUI/TMP 控件、布局组、绑定标记和 Prefab。
- React 预览工程模板：`ReactPreview`，安装到目标项目后通常命名为同级的 `UIReact`。
- 当前预览样例：`ReactPreview/Generated/SampleDialog/SampleDialog.tsx`。
- Unity 验收场景、业务脚本和 Prefab 不属于发布工具目录，由目标项目维护。
- 默认 Prefab 输出：目标 Unity 项目的 `Assets/Prefabs/UI`。

## 框架依赖

目标项目必须自行提供与工具程序集匹配的 UnityBaseFramework、UniTask、DOTween、YooAsset、Newtonsoft Json 和 TextMeshPro 依赖。

发布目录不包含框架源码或快照。工具本体通过公开框架类型接入，不包含对框架源文件的补丁。通过 Git URL 安装时，目标项目仍需自行提供 `TongquBase`、`TongquBase.Editor` 等框架程序集。

## 生成流程

1. 编辑器窗口读取项目配置与 TSX 文件。
2. 解析器先定位静态根面板，再提取其静态标签、静态字符串属性和可见文本；组件函数外围代码及花括号表达式被跳过。
3. 根标签提供界面类型名；若类型不存在，先生成继承框架界面基类的 partial 脚本。
4. Unity 完成脚本编译和域重载后，挂起任务自动恢复。
5. 生成器按组件名查找可配置组件目录中的同名 Prefab。
6. 未找到 Prefab 时，基础组件由内建 uGUI/TMP 工厂创建；未知组件抛出错误。
7. 生成器按根布局模式规范化根节点：响应式模式使用全屏锚点和零偏移，固定参考模式使用 TSX 有效尺寸或工具配置参考分辨率；随后应用内部 RectTransform、图片 Sprite、文本字号与描边、颜色、交互状态、滑块、切换、滚动和布局组属性。
8. 带 ScrollRect 的内建或自定义组件使用其实际 Content 作为声明子节点挂载点；普通列表保留条目声明的锚点，简单列表和网格才提供默认布局组。
9. 生成器把配置的默认 TMP 字体应用到本次生成组件及组件 Prefab 内的 TMP 文本。
10. `data-bind` 转换为框架绑定标记，根对象添加绑定收集器并重建绑定列表。
11. Prefab 以界面类型名保存到配置目录。

内建按钮和切换控件始终保留其 TMP 标签对象。节点未声明静态文本时，生成器会把模板占位文本清空，但仍应用字号、颜色、字形、对齐和描边属性，便于后续业务直接填入内容。文本表现属性会沿静态 TSX 父层继承，子节点显式属性优先，可在列表或网格容器上统一定义模板样式。

发布版本不会绑定测试项目字体资产。迁移到其他项目后应在工具窗口选择目标项目的默认 TMP 字体。

## 当前内建组件

- 根面板与普通节点。
- 图片、TMP 文本、按钮、事件区域。
- TMP 输入框、切换、滑块。
- 列表、简单列表、网格、简单网格。
- Prefab 加载节点和输入切换节点的中性容器结构。

项目专用组件通过同名 Prefab 扩展。Prefab 内部节点调整使用 `data-prefab-child-path`，路径相对最近的生成组件根节点解析。

## React 预览

预览工程使用 React、TypeScript 和 Vite。入口通过 `import.meta.glob` 自动发现 `Generated` 下的界面。布局运行时读取与 Unity 相同的锚点、轴心、位置和尺寸属性，并将 Unity 的底部原点坐标转换为浏览器顶部原点坐标。Stretch 锚点使用轴心在锚点区间内插值得到参考点，与 RectTransform 一致。

预览工具提供 750×1680、720×1600、828×1792 和 390×844 四个竖屏设备尺寸。画布按 UIManager 主画布的高度匹配方式保持 1680 逻辑高度，并根据设备宽高比调整逻辑宽度。响应式 Prefab 根节点填充 UIManager 层级，Unity 运行时整体缩放由目标项目的 UIManager CanvasScaler 负责，工具不在 Prefab 内重复添加 Canvas 或手动缩放。

若界面选择固定参考布局，应在根标签声明 `data-layout-mode="FixedReference"`，使 Unity 生成和 React 预览同时保持固定参考尺寸；未声明时由工具配置决定 Unity 生成模式，React 预览按响应式模式处理。

`data-sprite` 使用 `Assets/` 开头的 Unity 项目相对路径。Unity 启动预览时通过环境变量传入项目根目录；Vite 开发服务只读提供资源，生产构建只复制 TSX 实际引用的图片。

预览样式只负责识别控件和提供基本可读性；布局不从生成组件 CSS 获取。

## 框架资源接入

目标项目需要在已有资源收集配置中加入实际 Prefab 输出目录，并按项目规则为 Prefab 生成资源地址。界面类型名、`data-dialog-name` 和 Prefab 文件名必须一致，框架才能通过界面管理器加载。

## 验收边界

发布目录只验证工具程序集编译、静态 TSX 解析、Prefab 生成和 React 预览构建。GameLauncher、UIManager 挂载、字体、组件 Prefab 和资源系统的运行时验收必须在目标项目中完成。

## 已知限制

- 不执行动态 JSX；动态表达式中的条件节点、循环节点和文本不会进入 Unity 模板。
- 文本资源编号和字体资源编号尚未接入具体业务资源解析器；图片目前按直接项目路径加载，尚未接入资源地址或图集子 Sprite 解析。
- 输入切换和 Prefab 加载器在缺少项目专用同名 Prefab 时只生成中性 RectTransform 容器。
- Prefab 覆盖保存属于确定性资源生成操作，Unity 不提供对文件覆盖的完整 Undo；应使用版本控制恢复旧资源。

