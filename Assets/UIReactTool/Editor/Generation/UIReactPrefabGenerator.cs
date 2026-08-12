using System;
using System.IO;
using System.Text;
using TongquBase;
using UIReactTool.Parsing;
using UnityEditor;
using UnityEngine;

namespace UIReactTool.Generation
{
    /// <summary>
    /// 把解析后的静态 UI 文档转换为 UnityBaseFramework UIView Prefab。
    /// </summary>
    public static class UIReactPrefabGenerator
    {
        public static string Generate(UIReactDocument document, Type viewType, UIReactToolSettings settings)
        {
            if (document == null)
                throw new ArgumentNullException(nameof(document));
            if (viewType == null || !typeof(UIView).IsAssignableFrom(viewType))
                throw new ArgumentException("生成类型必须继承 TongquBase.UIView。", nameof(viewType));
            if (settings == null)
                throw new ArgumentNullException(nameof(settings));

            EnsureAssetFolder(settings.PrefabOutputFolder);
            string prefabPath = settings.PrefabOutputFolder.TrimEnd('/') + "/" + viewType.Name + ".prefab";
            GameObject root = null;

            try
            {
                root = BuildNode(document.Root, null, null, settings);
                if (root == null)
                    throw new InvalidOperationException("没有生成 UIRootPanel 根对象。");

                RectTransform rootRect = root.GetComponent<RectTransform>();
                NormalizeRootRect(rootRect, document.Root, settings);
                if (!document.Root.HasAttribute("data-pos"))
                    rootRect.anchoredPosition3D = Vector3.zero;

                UIView existingView = root.GetComponent<UIView>();
                if (existingView != null && existingView.GetType() != viewType)
                    throw new InvalidOperationException($"根组件 Prefab 已挂载 {existingView.GetType().FullName}，不能改为 {viewType.FullName}。");
                if (existingView == null)
                    root.AddComponent(viewType);

                UIBindCollector collector = root.GetComponent<UIBindCollector>() ?? root.AddComponent<UIBindCollector>();
                UIBindEditorBuilder.Rebuild(collector);

                GameObject savedPrefab = PrefabUtility.SaveAsPrefabAsset(root, prefabPath);
                if (savedPrefab == null)
                    throw new InvalidOperationException("Unity 未能保存生成的 Prefab。");

                AssetDatabase.SaveAssets();
                AssetDatabase.ImportAsset(prefabPath, ImportAssetOptions.ForceUpdate);
                Debug.Log($"[UI React 工具] 已生成 Prefab：{prefabPath}", savedPrefab);
                return prefabPath;
            }
            finally
            {
                if (root != null)
                    UnityEngine.Object.DestroyImmediate(root);
            }
        }

        public static Type ResolveViewType(string dialogName, string generatedNamespace)
        {
            string fullName = string.IsNullOrWhiteSpace(generatedNamespace)
                ? dialogName
                : generatedNamespace.Trim() + "." + dialogName;

            foreach (System.Reflection.Assembly assembly in AppDomain.CurrentDomain.GetAssemblies())
            {
                Type type = assembly.GetType(fullName, false);
                if (type != null)
                    return type;
            }

            return null;
        }

        public static string EnsureViewScript(string dialogName, UIReactToolSettings settings)
        {
            if (!IsValidIdentifier(dialogName))
                throw new InvalidDataException($"data-dialog-name 不是有效的 C# 类型名：{dialogName}");
            if (!IsValidNamespace(settings.GeneratedNamespace))
                throw new InvalidDataException($"生成命名空间无效：{settings.GeneratedNamespace}");

            EnsureAssetFolder(settings.ViewScriptOutputFolder);
            string scriptPath = settings.ViewScriptOutputFolder.TrimEnd('/') + "/" + dialogName + ".cs";
            if (File.Exists(scriptPath))
                return scriptPath;

            var builder = new StringBuilder(512);
            builder.AppendLine("// 此脚本由 UI React 工具生成，可在 partial 类的其他文件中编写界面逻辑。");
            if (!string.IsNullOrWhiteSpace(settings.GeneratedNamespace))
            {
                builder.Append("namespace ").Append(settings.GeneratedNamespace.Trim()).AppendLine();
                builder.AppendLine("{");
                builder.Append("    public partial class ").Append(dialogName).AppendLine(" : TongquBase.UIView");
                builder.AppendLine("    {");
                builder.AppendLine("        // 组件绑定由根节点上的 UIBindCollector 提供。");
                builder.AppendLine("    }");
                builder.AppendLine("}");
            }
            else
            {
                builder.Append("public partial class ").Append(dialogName).AppendLine(" : TongquBase.UIView");
                builder.AppendLine("{");
                builder.AppendLine("    // 组件绑定由根节点上的 UIBindCollector 提供。");
                builder.AppendLine("}");
            }

            File.WriteAllText(scriptPath, builder.ToString().Replace("\r\n", "\n").Replace("\n", "\r\n"), new UTF8Encoding(false));
            AssetDatabase.ImportAsset(scriptPath, ImportAssetOptions.ForceUpdate);
            Debug.Log($"[UI React 工具] 已创建 UIView 脚本，编译后会继续生成 Prefab：{scriptPath}");
            return scriptPath;
        }

        private static GameObject BuildNode(UIReactNode node, Transform parent, Transform nearestComponentRoot, UIReactToolSettings settings)
        {
            if (!string.IsNullOrWhiteSpace(node.PrefabChildPath))
            {
                if (nearestComponentRoot == null)
                    throw new InvalidOperationException($"data-prefab-child-path 缺少所属组件：{node.PrefabChildPath}");

                UIReactElementFactory.ApplyPrefabChild(nearestComponentRoot, node);
                for (int i = 0; i < node.Children.Count; i++)
                    BuildNode(node.Children[i], parent, nearestComponentRoot, settings);
                return null;
            }

            if (string.IsNullOrWhiteSpace(node.ComponentName))
            {
                GameObject first = null;
                for (int i = 0; i < node.Children.Count; i++)
                {
                    GameObject child = BuildNode(node.Children[i], parent, nearestComponentRoot, settings);
                    if (first == null && child != null)
                        first = child;
                }
                return first;
            }

            GameObject current = UIReactElementFactory.Create(node, parent, settings);
            Transform childParent = UIReactElementFactory.ResolveChildParent(current);
            for (int i = 0; i < node.Children.Count; i++)
                BuildNode(node.Children[i], childParent, current.transform, settings);
            return current;
        }

        private static void NormalizeRootRect(RectTransform rootRect, UIReactNode rootNode, UIReactToolSettings settings)
        {
            if (rootRect == null)
                throw new InvalidOperationException("UIRootPanel 缺少 RectTransform。");

            UIReactRootLayoutMode layoutMode = settings.RootLayoutMode;
            if (!Enum.IsDefined(typeof(UIReactRootLayoutMode), layoutMode))
                layoutMode = UIReactRootLayoutMode.Responsive;
            string layoutModeValue = rootNode.GetAttribute("data-layout-mode");
            if (!string.IsNullOrWhiteSpace(layoutModeValue) &&
                (!Enum.TryParse(layoutModeValue, true, out layoutMode) ||
                 !Enum.IsDefined(typeof(UIReactRootLayoutMode), layoutMode)))
                throw new InvalidDataException($"UIRootPanel 的 data-layout-mode 无效：{layoutModeValue}。可选值为 Responsive 或 FixedReference。");

            if (layoutMode == UIReactRootLayoutMode.Responsive)
            {
                // 响应式根节点填充 UIManager 层级，CanvasScaler 只负责整体像素缩放，内部锚点负责位置适配。
                rootRect.anchorMin = Vector2.zero;
                rootRect.anchorMax = Vector2.one;
                rootRect.offsetMin = Vector2.zero;
                rootRect.offsetMax = Vector2.zero;
                rootRect.sizeDelta = Vector2.zero;
                rootRect.pivot = new Vector2(0.5f, 0.5f);
                return;
            }

            // 固定参考布局保持中心锚点和设计尺寸，用于明确需要留边或裁剪的界面。
            Vector2 referenceResolution = settings.ReferenceResolution;
            if (UIReactValueParser.TryVector2(rootNode.GetAttribute("data-size"), out Vector2 declaredSize) &&
                declaredSize.x > 0f && declaredSize.y > 0f)
                referenceResolution = declaredSize;

            rootRect.anchorMin = rootRect.pivot;
            rootRect.anchorMax = rootRect.pivot;
            rootRect.sizeDelta = referenceResolution;
        }

        private static void EnsureAssetFolder(string assetFolder)
        {
            string normalized = assetFolder.Replace('\\', '/').TrimEnd('/');
            if (AssetDatabase.IsValidFolder(normalized))
                return;
            if (!normalized.StartsWith("Assets/", StringComparison.Ordinal))
                throw new InvalidDataException($"目录必须位于 Assets 下：{assetFolder}");

            string[] parts = normalized.Split('/');
            string current = parts[0];
            for (int i = 1; i < parts.Length; i++)
            {
                string next = current + "/" + parts[i];
                if (!AssetDatabase.IsValidFolder(next))
                    AssetDatabase.CreateFolder(current, parts[i]);
                current = next;
            }
        }

        private static bool IsValidIdentifier(string value)
        {
            if (string.IsNullOrWhiteSpace(value) || !(char.IsLetter(value[0]) || value[0] == '_'))
                return false;
            for (int i = 1; i < value.Length; i++)
            {
                if (!char.IsLetterOrDigit(value[i]) && value[i] != '_')
                    return false;
            }
            return true;
        }

        private static bool IsValidNamespace(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return true;
            string[] parts = value.Split('.');
            for (int i = 0; i < parts.Length; i++)
            {
                if (!IsValidIdentifier(parts[i]))
                    return false;
            }
            return true;
        }
    }
}

