using System;
using System.IO;
using TMPro;
using UIReactTool.Generation;
using UIReactTool.Preview;
using UnityEditor;
using UnityEngine;

namespace UIReactTool
{
    /// <summary>
    /// 提供 React UI 路径配置、Prefab 生成和浏览器预览入口。
    /// </summary>
    public sealed class UIReactToolWindow : EditorWindow
    {
        private string sourcePath;
        private Vector2 scrollPosition;

        [MenuItem("Tools/UI/从 React 生成 Prefab...", false, 100)]
        public static void Open()
        {
            GetWindow<UIReactToolWindow>("React UI 生成器");
        }

        [MenuItem("Tools/UI/初始化 ReactPreview 模板", false, 101)]
        public static void InitializePreviewTemplateMenu()
        {
            UIReactToolSettings settings = UIReactToolSettings.instance;
            Execute(() => InitializePreviewTemplate(settings));
        }

        private void OnEnable()
        {
            UIReactToolSettings settings = UIReactToolSettings.instance;
            if (string.IsNullOrWhiteSpace(sourcePath))
                sourcePath = FindFirstTsx(settings.ReactRootPath);
        }

        private void OnGUI()
        {
            UIReactToolSettings settings = UIReactToolSettings.instance;
            scrollPosition = EditorGUILayout.BeginScrollView(scrollPosition);

            EditorGUILayout.LabelField("UnityBaseFramework React UI 工具", EditorStyles.boldLabel);
            EditorGUILayout.HelpBox("工具读取 TSX 中的静态 data-* 属性，生成 UIView Prefab，并使用同一布局数据进行 React 浏览器预览。", MessageType.Info);

            EditorGUI.BeginChangeCheck();
            settings.ReactRootPath = DrawAbsoluteFolder("React 工程目录", settings.ReactRootPath);
            settings.PrefabOutputFolder = EditorGUILayout.TextField("Prefab 输出目录", settings.PrefabOutputFolder);
            settings.ViewScriptOutputFolder = EditorGUILayout.TextField("UIView 脚本目录", settings.ViewScriptOutputFolder);
            settings.GeneratedNamespace = EditorGUILayout.TextField("UIView 命名空间", settings.GeneratedNamespace);
            settings.ComponentPrefabFolder = EditorGUILayout.TextField("组件 Prefab 目录", settings.ComponentPrefabFolder);
            settings.DefaultTmpFont = (TMP_FontAsset)EditorGUILayout.ObjectField(
                "默认 TMP 字体",
                settings.DefaultTmpFont,
                typeof(TMP_FontAsset),
                false);
            settings.ReferenceResolution = EditorGUILayout.Vector2Field("Prefab 参考分辨率", settings.ReferenceResolution);
            string[] rootLayoutModeLabels = { "响应式全屏", "固定参考画布" };
            int rootLayoutModeIndex = Mathf.Clamp((int)settings.RootLayoutMode, 0, rootLayoutModeLabels.Length - 1);
            rootLayoutModeIndex = EditorGUILayout.Popup("根布局模式", rootLayoutModeIndex, rootLayoutModeLabels);
            settings.RootLayoutMode = (UIReactRootLayoutMode)Mathf.Clamp(rootLayoutModeIndex, 0, rootLayoutModeLabels.Length - 1);
            string[] viewModeLabels = { "普通 UIView（轻量）", "MVVM（状态驱动）" };
            int viewModeIndex = Mathf.Clamp((int)settings.ViewMode, 0, viewModeLabels.Length - 1);
            viewModeIndex = EditorGUILayout.Popup("界面模式", viewModeIndex, viewModeLabels);
            settings.ViewMode = (UIReactViewMode)Mathf.Clamp(viewModeIndex, 0, viewModeLabels.Length - 1);
            settings.PreviewPort = EditorGUILayout.IntField("预览端口", settings.PreviewPort);
            if (EditorGUI.EndChangeCheck())
                settings.SaveSettings();

            EditorGUILayout.HelpBox(
                settings.ViewMode == UIReactViewMode.Mvvm
                    ? "MVVM 适合长期持有业务状态、频繁响应数据变化或需要独立测试状态逻辑的界面。"
                    : "普通 UIView 适合弹窗、菜单和局部交互；没有明确状态模型需求时优先使用此模式。",
                MessageType.None);

            if (GUILayout.Button("按工具白名单初始化 ReactPreview 模板", GUILayout.Height(24f)))
                Execute(() => InitializePreviewTemplate(settings));

            EditorGUILayout.Space(10f);
            EditorGUILayout.LabelField("生成", EditorStyles.boldLabel);
            EditorGUILayout.BeginHorizontal();
            sourcePath = EditorGUILayout.TextField("TSX 文件", sourcePath ?? string.Empty);
            if (GUILayout.Button("选择...", GUILayout.Width(72f)))
            {
                string selected = EditorUtility.OpenFilePanel("选择 React UI TSX", settings.ReactRootPath, "tsx");
                if (!string.IsNullOrWhiteSpace(selected))
                    sourcePath = selected;
            }
            EditorGUILayout.EndHorizontal();

            using (new EditorGUI.DisabledScope(string.IsNullOrWhiteSpace(sourcePath)))
            {
                if (GUILayout.Button("生成或更新 Prefab", GUILayout.Height(30f)))
                    Execute(() => UIReactGenerationCoordinator.GenerateFromFile(sourcePath));
            }

            EditorGUILayout.Space(10f);
            EditorGUILayout.LabelField("React 预览", EditorStyles.boldLabel);
            EditorGUILayout.BeginHorizontal();
            if (GUILayout.Button("安装/更新预览依赖"))
                Execute(() => UIReactPreviewLauncher.InstallDependencies(settings));
            if (GUILayout.Button("启动并打开预览"))
                Execute(() => UIReactPreviewLauncher.StartPreview(settings));
            EditorGUILayout.EndHorizontal();

            EditorGUILayout.Space(10f);
            EditorGUILayout.HelpBox(
                "默认自动获取：生成节点自身的 RectTransform 和组件。\n" +
                "ReactPreview 应使用上方初始化按钮创建；工具只复制 package.json、src 和示例 TSX，不复制 node_modules、dist、缓存或测试业务页面，并写入初始化标记和当前项目 .env.local。\n" +
                "手动配置：React 工程目录、Prefab 输出目录、UIView 脚本目录、组件 Prefab 目录、默认 TMP 字体、参考分辨率和根布局模式。\n" +
                "界面模式可由 UIRootPanel 的 data-view-mode 覆盖；data-bind-type 可显式选择绑定组件类型。\n" +
                "自定义组件必须在组件目录中提供与 data-component 同名的 Prefab。",
                MessageType.None);

            EditorGUILayout.EndScrollView();
        }

        private static string DrawAbsoluteFolder(string label, string value)
        {
            EditorGUILayout.BeginHorizontal();
            string result = EditorGUILayout.TextField(label, value);
            if (GUILayout.Button("选择...", GUILayout.Width(72f)))
            {
                string selected = EditorUtility.OpenFolderPanel(label, Directory.Exists(value) ? value : string.Empty, string.Empty);
                if (!string.IsNullOrWhiteSpace(selected))
                    result = selected;
            }
            EditorGUILayout.EndHorizontal();
            return result;
        }

        private static string FindFirstTsx(string reactRoot)
        {
            if (string.IsNullOrWhiteSpace(reactRoot) || !Directory.Exists(reactRoot))
                return string.Empty;
            string generatedRoot = Path.Combine(reactRoot, "Generated");
            string[] files = Directory.Exists(generatedRoot)
                ? Directory.GetFiles(generatedRoot, "*.tsx", SearchOption.AllDirectories)
                : Array.Empty<string>();
            return files.Length > 0 ? files[0] : string.Empty;
        }

        private static void InitializePreviewTemplate(UIReactToolSettings settings)
        {
            string targetPath = settings.ReactRootPath;
            if (Directory.Exists(targetPath) && Directory.GetFileSystemEntries(targetPath).Length > 0)
            {
                bool confirmed = EditorUtility.DisplayDialog(
                    "初始化 ReactPreview 模板",
                    "目标目录已有内容。工具只会覆盖模板文件，不会删除 Generated 下的业务页面，但会更新 src、构建配置并写入初始化标记和当前项目 .env.local。是否继续？",
                    "继续",
                    "取消");
                if (!confirmed)
                    return;
            }

            UIReactPreviewTemplate.Initialize(targetPath);
            settings.ReactRootPath = targetPath;
            settings.SaveSettings();
        }

        private static void Execute(Action action)
        {
            try
            {
                action();
            }
            catch (Exception exception)
            {
                Debug.LogException(exception);
                EditorUtility.DisplayDialog("UI React 工具", exception.Message, "确定");
            }
        }
    }
}

