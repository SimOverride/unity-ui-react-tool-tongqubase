# CHANGELOG

## 2026-08-26

### 新增

- 新增普通 `UIView` 与 MVVM 两种页面模式；MVVM 模式自动创建 View、ViewModel、Model 三个 partial 骨架，并允许根节点通过 `data-view-mode` 覆盖默认模式。
- 新增 `data-bind-type` 和 `data-bind-custom-type`，覆盖框架常用绑定类型及项目自定义组件完整类型名。
- React Unity UI 检查面板显示界面模式、绑定类型和自定义绑定类型。
- React 检查面板新增 TSX 手动调整模式，支持布局、视觉、状态、绑定和布局组属性的实时草稿、撤销、重做、放弃与显式保存。
- React 开发服务新增受限源码写回：只处理 `Generated` 静态节点，使用唯一 `data-name` 定位、源码版本冲突保护和最小范围替换。
- React 预览新增网页设计画布，支持普通节点直接拖动、八方向缩放、5 像素网格及父级/同级参考线吸附；拉伸锚点按边距语义调整。
- 新增方向键微调、Shift 加速、Alt 临时关闭吸附，以及滚轮缩放、适应窗口、空格或中键平移视口。
- 新增 16 个常用锚点预设、Min/Max/Pivot 精确值、边界转比例锚点，以及黄色锚点与粉色 Pivot 画布控制点；调整时默认保持当前矩形。
- 新增平板横竖屏、16:9、16:10 与 21:9 桌面分辨率测试，继续按 UIManager 高度匹配规则换算逻辑画布。
- 画布拖动、缩放、锚点和 Pivot 操作按手势合并为单条撤销记录；根节点和布局组子节点显示受约束原因。

### 变更

- 发布包版本更新为 `0.6.0`。

## 2026-08-24

### 修复

- `.unitypackage` 安装到 `Assets/UIReactTool` 后可以正确定位并初始化 ReactPreview 模板。
- npm 启动命令按编辑器平台选择：Windows 使用 `npm.cmd`，macOS 和 Linux 使用 `npm`。

## 2026-08-18

### 变更

- 转换器默认使用 Responsive 根布局；生成根节点填充挂载层，FixedReference 改为显式配置选项。
- React 预览与 Unity 生成统一使用 1680 逻辑高度，并补充 GridLayoutGroup 与列表布局属性。
- 修正 Prefab 子节点布局属性应用到现有 ScrollRect Content 的流程。

## 2026-08-17

### 变更

- 发布目录整理为 Unity Package Manager Git 包结构，根目录新增 `package.json`，工具源码位于 `Editor/`，编辑器测试位于 `Tests/Editor/`。
- 发布包可通过 `https://github.com/SimOverride/unity-ui-react-tool-tongqubase.git` 添加到目标项目；测试项目副本仍由同步脚本维护在 `Tools/Assets/UIReactTool`。
- 补齐发布包清单、README 和变更记录的 `.meta` 文件，避免 Unity 导入 UPM 包时重新生成资源 GUID。
- 新增 ReactPreview 白名单初始化入口，约束使用方复制行为并跳过 node_modules、dist、缓存和测试业务页面。
- ReactPreview 初始化后写入 `.uirect-template.json` 标记，Prefab 生成、依赖安装和预览启动拒绝手工整目录复制的模板。
- 修复新项目预览素材读取错误：初始化自动生成当前项目 `.env.local`，Vite 不再静默回退到仓库 `Tools/`，缺少有效 `UNITY_PROJECT_PATH` 时直接报错。

## 2026-08-12

### 新增

- 建立独立的 Unity UI React Tool 发布目录。
- 提供测试项目使用的 `Tools/Assets/UIReactTool` 工具副本，并由同步脚本映射到发布包根目录。
- 提供不包含测试项目业务资源的 React/Vite 预览模板。
- 提供测试项目副本与发布副本的双向同步脚本。
