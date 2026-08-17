using System;
using System.Collections.Generic;

namespace UIReactTool.Parsing
{
    /// <summary>
    /// 表示从 TSX 静态标签中解析出的 UI 文档。
    /// </summary>
    public sealed class UIReactDocument
    {
        public UIReactDocument(UIReactNode root, string sourcePath)
        {
            Root = root ?? throw new ArgumentNullException(nameof(root));
            SourcePath = sourcePath ?? string.Empty;
        }

        public UIReactNode Root { get; }
        public string SourcePath { get; }
        public string DialogName => Root.GetAttribute("data-dialog-name", Root.GetAttribute("data-name", "GeneratedDialog"));
    }

    /// <summary>
    /// 保存一个 JSX 标签及其静态属性和子标签。
    /// </summary>
    public sealed class UIReactNode
    {
        private readonly Dictionary<string, string> attributes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        private readonly List<UIReactNode> children = new List<UIReactNode>();

        public UIReactNode(string tagName)
        {
            TagName = tagName ?? string.Empty;
        }

        public string TagName { get; }
        public string Text { get; set; } = string.Empty;
        public UIReactNode Parent { get; private set; }
        public IReadOnlyDictionary<string, string> Attributes => attributes;
        public IReadOnlyList<UIReactNode> Children => children;
        public string ComponentName => GetAttribute("data-component");
        public string PrefabChildPath => GetAttribute("data-prefab-child-path");

        public bool HasAttribute(string name)
        {
            return !string.IsNullOrEmpty(name) && attributes.ContainsKey(name);
        }

        public string GetAttribute(string name, string fallback = "")
        {
            return !string.IsNullOrEmpty(name) && attributes.TryGetValue(name, out string value) ? value : fallback;
        }

        public string GetInheritedAttribute(string name, string fallback = "")
        {
            // 文本表现允许从静态父层继承，减少重复节点仍保持与具体界面无关。
            for (UIReactNode current = this; current != null; current = current.Parent)
            {
                if (current.HasAttribute(name))
                    return current.GetAttribute(name);
            }

            return fallback;
        }

        internal void SetAttribute(string name, string value)
        {
            if (!string.IsNullOrWhiteSpace(name))
                attributes[name] = value ?? string.Empty;
        }

        internal void AddChild(UIReactNode child)
        {
            if (child != null)
            {
                child.Parent = this;
                children.Add(child);
            }
        }
    }
}

