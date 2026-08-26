# UI React 工具开发说明

## 项目结构

- Unity 工具程序集：发布包根目录 `Editor/`；测试项目同步副本为 `Tools/Assets/UIReactTool/Editor`。
- 编辑器测试程序集：发布包根目录 `Tests/Editor/`；测试项目同步副本为 `Tools/Assets/UIReactTool/Tests/Editor/`。
- 包清单：发布包根目录 `package.json`，包名为 `com.simoverride.unity-ui-react-tool`，用于 Unity Package Manager Git URL 安装。
- 解析逻辑：读取静态 TSX 标签、属性、文本和父子层级。
- 生成逻辑：创建 RectTransform、uGUI/TMP 控件、布局组、绑定标记和 Prefab。
- React 预览工程模板：`ReactPreview`，安装到目标项目后通常命名为同级的 `UIReact`。
- React 手动调整：浏览器画布持有选择、拖拽、吸附、视口和未保存草稿，本地 Vite 服务只对 `Generated/**/*.tsx` 执行受限属性写回。
- ReactPreview 由编辑器初始化器按固定白名单复制 `index.html`、构建配置、`src` 和 SampleDialog；复制时跳过 `.meta`、`node_modules`、`dist`、`.vite` 和 `tsbuildinfo`，并在目标目录写入 `.uirect-template.json` 标记和当前项目的 `.env.local`。Prefab 生成、预览启动与依赖安装必须通过标记校验。
- 当前预览样例：`ReactPreview/Generated/SampleDialog/SampleDialog.tsx`。
- Unity 验收场景、业务脚本和 Prefab 不属于发布工具目录，由目标项目维护。
- 默认 Prefab 输出：目标 Unity 项目的 `Assets/Prefabs/UI`。

## 框架依赖

目标项目必须自行提供与工具程序集匹配的 UnityBaseFramework、UniTask、DOTween、YooAsset、Newtonsoft Json 和 TextMeshPro 依赖。

发布目录不包含框架源码或快照。工具本体通过公开框架类型接入，不包含对框架源文件的补丁。通过 Git URL 安装时，目标项目仍需自行提供 `TongquBase`、`TongquBase.Editor` 等框架程序集。

## 生成流程

1. 编辑器窗口读取项目配置与 TSX 文件。
2. ReactPreview 初始化入口从 UPM 包路径或工作区发布目录定位模板，并只复制允许的模板文件；初始化完成后写入 `.uirect-template.json` 标记，预览启动和 Prefab 生成前检查标记、构建配置和 `src/main.tsx`。
3. 解析器先定位静态根面板，再提取其静态标签、静态字符串属性和可见文本；组件函数外围代码及花括号表达式被跳过。
4. 根标签提供界面类型名和可选界面模式；未声明模式时使用工具配置。若类型不存在，普通模式生成一个轻量界面 partial 脚本，MVVM 模式生成 View、ViewModel、Model 三个可扩展 partial 脚本。
5. Unity 完成脚本编译和域重载后，挂起任务自动恢复。
6. 生成器按组件名查找可配置组件目录中的同名 Prefab。
7. 未找到 Prefab 时，基础组件由内建 uGUI/TMP 工厂创建；未知组件抛出错误。
8. 生成器按根布局模式规范化根节点：响应式模式使用全屏锚点、零偏移、零位置和单位变换，固定参考模式使用 TSX 有效尺寸或工具配置参考分辨率并居中；随后应用内部 RectTransform、图片 Sprite、文本字号与描边、颜色、交互状态、滑块、切换、滚动和布局组属性。
9. 带 ScrollRect 的内建或自定义组件使用其实际 Content 作为声明子节点挂载点；普通列表保留条目声明的锚点，简单列表和网格才提供默认布局组。Prefab 子节点声明的布局属性会直接应用到现有 Content。
10. 生成器把配置的默认 TMP 字体应用到本次生成组件及组件 Prefab 内的 TMP 文本。
11. `data-bind` 转换为框架绑定标记；`data-bind-type` 显式指定框架组件枚举或项目组件完整类型名，未声明时按节点上的常用组件自动识别。根对象添加绑定收集器并重建绑定列表。
12. Prefab 以界面类型名保存到配置目录。

## 界面模式

- `Plain` 生成继承 `TongquBase.UIView` 的单个界面脚本，适合弹窗、菜单和局部交互。
- `Mvvm` 生成基于 `GenericUIView`、`GenericUIViewModel` 和 `BaseModel` 的三段类型链。生成的 ViewModel 会创建 Model 并触发框架数据绑定流程，使用者在其他 partial 文件中实现状态和绑定逻辑。
- 工具设置提供项目默认模式；根节点 `data-view-mode` 可以按页面覆盖。已有界面类型必须与所选模式匹配。

## 绑定类型

自动识别覆盖按钮、切换、滑块、滚动、TMP/旧版输入框、TMP 下拉框、TMP/旧版文本、图片、RawImage、CanvasGroup、Animator 和 RectTransform。显式 `data-bind-type` 支持框架 `UIBindComponentType` 的全部值；项目自定义组件可直接填写完整类型名，或使用 `Custom` 配合 `data-bind-custom-type`。显式类型无法解析或节点缺少对应组件时立即终止本次生成。

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

预览工程使用 React、TypeScript 和 Vite。入口通过 `import.meta.glob` 自动发现 `Generated` 下的界面。Vite 只从 `UNITY_PROJECT_PATH` 环境变量或目标工程 `.env.local` 读取 Unity 项目根目录，不再设置仓库 `Tools/` 默认值；目录缺失或不含 `Assets` 时在启动阶段报错。布局运行时读取与 Unity 相同的锚点、轴心、位置和尺寸属性，并将 Unity 的底部原点坐标转换为浏览器顶部原点坐标。Stretch 锚点使用轴心在锚点区间内插值得到参考点，与 RectTransform 一致。

预览工具提供 750×1680、720×1600、828×1792 和 390×844 四个竖屏设备尺寸。画布按 UIManager 主画布的高度匹配方式保持 1680 逻辑高度，并根据设备宽高比调整逻辑宽度；目标 CanvasScaler 使用 `MatchWidthOrHeight=1`。响应式 Prefab 根节点填充 UIManager 层级，Unity 运行时整体缩放由目标项目的 UIManager CanvasScaler 负责，工具不在 Prefab 内重复添加 Canvas 或手动缩放。

若界面选择固定参考布局，应在根标签声明 `data-layout-mode="FixedReference"`，使 Unity 生成和 React 预览同时保持固定参考尺寸；未声明时由工具配置决定 Unity 生成模式，React 预览按响应式模式处理。

`data-sprite` 使用 `Assets/` 开头的 Unity 项目相对路径。Unity 启动预览时通过环境变量传入项目根目录；Vite 开发服务只读提供资源，生产构建只复制 TSX 实际引用的图片。

预览样式只负责识别控件和提供基本可读性；布局不从生成组件 CSS 获取。

预览入口把画布视口与 UI 逻辑画布分离：自动适应比例、用户缩放和平移只作用于外层视口。画布编辑器通过浏览器节点边界读取当前转换结果，把指针位移除去视口缩放后转换为逻辑坐标，再把浏览器向下为正的纵轴反向换算为 Unity Anchored Position。尺寸调整根据活动边、轴心和实际尺寸变化同时计算位置与 Size Delta。

画布编辑器直接更新预览 DOM，让布局转换立即重算。拖动过程由 `requestAnimationFrame` 合并预览更新，松开后把全部位置和尺寸变化提交为一条会话内撤销命令。移动和尺寸边缘可吸附到 5 像素网格、画布、父级及同级节点的边缘或中心；按住 Alt 临时跳过吸附。方向键每次移动 1 个逻辑像素，Shift 配合方向键移动 10 个逻辑像素。

当前自由操作只开放给具有唯一静态 `data-name` 的点锚定普通节点。根节点由画布和根布局模式控制；拉伸锚点节点需要边距语义；布局组子节点的位置由父级控制，因此三者在画布中显示锁定原因并保留精确属性检查入口。

右侧精确面板的字段变化同样更新预览 DOM，字段失焦后形成一条撤销命令。保存时，浏览器把按节点和属性合并后的修改提交给 Vite 本地接口。接口要求工程初始化标记有效、页面位于 `Generated`、`data-name` 唯一且目标属性在允许列表中，然后通过 TypeScript AST 定位静态 JSX 属性，只替换目标源码范围。`data-text` 写回时同步直接 JSX 文本，保证热更新后的浏览器显示与 Unity 输入一致。

页面加载时返回源码 SHA-256 版本。保存请求必须携带同一版本；IDE、Agent 或其他窗口先修改源码后，服务返回冲突而不覆盖文件。写回先落到页面同目录临时文件再替换原文件，Vite 随后通过热更新重新加载。浏览器生产构建没有本地编辑接口，只保留只读检查能力。

## 框架资源接入

目标项目需要在已有资源收集配置中加入实际 Prefab 输出目录，并按项目规则为 Prefab 生成资源地址。界面类型名、`data-dialog-name` 和 Prefab 文件名必须一致，框架才能通过界面管理器加载。

## 验收边界

发布目录只验证工具程序集编译、静态 TSX 解析、Prefab 生成和 React 预览构建。GameLauncher、UIManager 挂载、字体、组件 Prefab 和资源系统的运行时验收必须在目标项目中完成；目标项目应覆盖 750×1680、720×1600、828×1792 和 390×844，并检查 `GameMenu_MainPage` 的 `RectTransform.rect` 与 `Layer_50` 一致。

## 已知限制

- 不执行动态 JSX；动态表达式中的条件节点、循环节点和文本不会进入 Unity 模板。
- 文本资源编号和字体资源编号尚未接入具体业务资源解析器；图片目前按直接项目路径加载，尚未接入资源地址或图集子 Sprite 解析。
- 输入切换和 Prefab 加载器在缺少项目专用同名 Prefab 时只生成中性 RectTransform 容器。
- Prefab 覆盖保存属于确定性资源生成操作，Unity 不提供对文件覆盖的完整 Undo；应使用版本控制恢复旧资源。
- 当前手动调整不修改 `data-name`、`data-component`、界面模式或 JSX 层级，也不提供多选、批量对齐、跨父级移动、拉伸锚点边距手柄或布局组专用操纵器。

