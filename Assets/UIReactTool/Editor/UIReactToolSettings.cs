using System.IO;
using TMPro;
using UnityEditor;
using UnityEngine;

namespace UIReactTool
{
    /// <summary>
    /// 生成界面根节点在父级 UI 层中的布局策略。
    /// </summary>
    public enum UIReactRootLayoutMode
    {
        /// <summary>
        /// 根节点填充父级 UI 层，内部节点通过锚点适配分辨率。
        /// </summary>
        Responsive,

        /// <summary>
        /// 根节点保持参考分辨率并居中，超出部分由父级显示区域裁剪或留边。
        /// </summary>
        FixedReference
    }

    /// <summary>
    /// 保存当前 Unity 项目的 UI React 工具路径配置。
    /// </summary>
    [FilePath("ProjectSettings/UIReactToolSettings.asset", FilePathAttribute.Location.ProjectFolder)]
    public sealed class UIReactToolSettings : ScriptableSingleton<UIReactToolSettings>
    {
        [SerializeField] private string reactRootPath;
        [SerializeField] private string prefabOutputFolder = "Assets/Prefabs/UI";
        [SerializeField] private string viewScriptOutputFolder = "Assets/GameScripts/UI/Generated";
        [SerializeField] private string generatedNamespace = "Game.UI";
        [SerializeField] private string componentPrefabFolder = "Assets/FrameworkAsset/UI/Component";
        [SerializeField] private TMP_FontAsset defaultTmpFont;
        [SerializeField] private Vector2 referenceResolution = new Vector2(750f, 1680f);
        [SerializeField] private UIReactRootLayoutMode rootLayoutMode = UIReactRootLayoutMode.Responsive;
        [SerializeField] private int previewPort = 4173;

        public string ReactRootPath
        {
            get
            {
                if (string.IsNullOrWhiteSpace(reactRootPath))
                    reactRootPath = GetDefaultReactRootPath();
                return reactRootPath;
            }
            set => reactRootPath = NormalizeAbsolutePath(value);
        }

        public string PrefabOutputFolder
        {
            get => prefabOutputFolder;
            set => prefabOutputFolder = NormalizeAssetFolder(value, "Assets/Prefabs/UI");
        }

        public string ViewScriptOutputFolder
        {
            get => viewScriptOutputFolder;
            set => viewScriptOutputFolder = NormalizeAssetFolder(value, "Assets/GameScripts/UI/Generated");
        }

        public string GeneratedNamespace
        {
            get => generatedNamespace;
            set => generatedNamespace = value == null ? string.Empty : value.Trim();
        }

        public string ComponentPrefabFolder
        {
            get => componentPrefabFolder;
            set => componentPrefabFolder = NormalizeAssetFolder(value, "Assets/FrameworkAsset/UI/Component");
        }

        public TMP_FontAsset DefaultTmpFont
        {
            get
            {
                // 测试项目未保存显式配置时，按资源名称查找项目内导入的微软雅黑字体，不绑定固定目录。
                if (defaultTmpFont == null)
                {
                    string[] guids = AssetDatabase.FindAssets("msyh SDF t:TMP_FontAsset");
                    if (guids.Length > 0)
                        defaultTmpFont = AssetDatabase.LoadAssetAtPath<TMP_FontAsset>(AssetDatabase.GUIDToAssetPath(guids[0]));
                }

                return defaultTmpFont;
            }
            set => defaultTmpFont = value;
        }

        public Vector2 ReferenceResolution
        {
            get
            {
                // 固定参考布局和 React 预览都需要有效的参考尺寸。
                if (referenceResolution.x <= 0f || referenceResolution.y <= 0f)
                    referenceResolution = new Vector2(750f, 1680f);
                return referenceResolution;
            }
            set => referenceResolution = new Vector2(Mathf.Max(1f, value.x), Mathf.Max(1f, value.y));
        }

        public UIReactRootLayoutMode RootLayoutMode
        {
            get => rootLayoutMode;
            set => rootLayoutMode = value;
        }

        public int PreviewPort
        {
            get => previewPort;
            set => previewPort = Mathf.Clamp(value, 1024, 65535);
        }

        public void SaveSettings()
        {
            Save(true);
        }

        public static string GetDefaultReactRootPath()
        {
            string unityProjectRoot = Directory.GetParent(Application.dataPath)?.FullName ?? Application.dataPath;
            string workspaceRoot = Directory.GetParent(unityProjectRoot)?.FullName ?? unityProjectRoot;
            return Path.GetFullPath(Path.Combine(workspaceRoot, "UIReact"));
        }

        private static string NormalizeAbsolutePath(string value)
        {
            return string.IsNullOrWhiteSpace(value)
                ? GetDefaultReactRootPath()
                : Path.GetFullPath(value.Trim());
        }

        private static string NormalizeAssetFolder(string value, string fallback)
        {
            if (string.IsNullOrWhiteSpace(value))
                return fallback;

            string normalized = value.Trim().Replace('\\', '/').TrimEnd('/');
            return normalized.StartsWith("Assets/") || normalized == "Assets" ? normalized : fallback;
        }
    }
}

