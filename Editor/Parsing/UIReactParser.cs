using System;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;

namespace UIReactTool.Parsing
{
    /// <summary>
    /// 解析仅包含静态字符串属性的 TSX/JSX UI 标签。
    /// </summary>
    public static class UIReactParser
    {
        private static readonly Regex AttributeRegex = new Regex(
            "(?<name>[A-Za-z_:][A-Za-z0-9_:.-]*)\\s*=\\s*(?<quote>[\\\"'])(?<value>.*?)\\k<quote>",
            RegexOptions.Compiled | RegexOptions.Singleline);

        public static UIReactDocument ParseFile(string sourcePath)
        {
            if (string.IsNullOrWhiteSpace(sourcePath))
                throw new ArgumentException("TSX 文件路径不能为空。", nameof(sourcePath));
            if (!File.Exists(sourcePath))
                throw new FileNotFoundException("未找到 TSX 文件。", sourcePath);

            return Parse(File.ReadAllText(sourcePath), sourcePath);
        }

        public static UIReactDocument Parse(string source, string sourcePath = "")
        {
            if (string.IsNullOrWhiteSpace(source))
                throw new InvalidDataException("TSX 内容为空。\n");

            int index = FindUIRootStart(source);
            if (index < 0)
                throw new InvalidDataException("未找到 data-component=\"UIRootPanel\" 的根标签。");

            var stack = new Stack<UIReactNode>();
            UIReactNode uiRoot = null;

            while (index < source.Length)
            {
                if (source[index] == '{')
                {
                    // React 表达式属于预览运行时，不参与静态 Prefab 模板结构。
                    index = FindExpressionEnd(source, index) + 1;
                    continue;
                }

                if (source[index] != '<')
                {
                    int markupIndex = FindNextMarkupOrExpression(source, index);
                    int textEnd = markupIndex < 0 ? source.Length : markupIndex;
                    AppendText(stack, source.Substring(index, textEnd - index));
                    index = textEnd;
                    if (index >= source.Length)
                        break;
                    continue;
                }

                if (StartsWith(source, index, "<!--"))
                {
                    int commentEnd = source.IndexOf("-->", index + 4, StringComparison.Ordinal);
                    index = commentEnd < 0 ? source.Length : commentEnd + 3;
                    continue;
                }

                int openIndex = index;
                int closeIndex = FindTagEnd(source, openIndex + 1);
                if (closeIndex < 0)
                    throw new InvalidDataException($"TSX 标签未闭合，位置：{openIndex}。");

                string body = source.Substring(openIndex + 1, closeIndex - openIndex - 1).Trim();
                index = closeIndex + 1;

                if (body.Length == 0 || body[0] == '!' || body[0] == '?')
                    continue;

                if (body[0] == '/')
                {
                    string closingTagName = ReadTagName(body.Substring(1));
                    CloseTag(stack, closingTagName);
                    if (stack.Count == 0)
                        break;
                    continue;
                }

                bool selfClosing = body.EndsWith("/", StringComparison.Ordinal);
                if (selfClosing)
                    body = body.Substring(0, body.Length - 1).TrimEnd();

                string tagName = ReadTagName(body);
                if (string.IsNullOrWhiteSpace(tagName) || tagName == ">")
                    continue;

                var node = new UIReactNode(tagName);
                MatchCollection matches = AttributeRegex.Matches(body);
                for (int i = 0; i < matches.Count; i++)
                    node.SetAttribute(matches[i].Groups["name"].Value, matches[i].Groups["value"].Value);

                if (stack.Count > 0)
                    stack.Peek().AddChild(node);
                else
                {
                    if (!string.Equals(node.ComponentName, "UIRootPanel", StringComparison.Ordinal))
                        throw new InvalidDataException("静态解析入口必须是 data-component=\"UIRootPanel\" 的根标签。");
                    uiRoot = node;
                }

                if (!selfClosing)
                    stack.Push(node);
                else if (ReferenceEquals(node, uiRoot))
                    break;
            }

            if (uiRoot == null)
                throw new InvalidDataException("未找到 data-component=\"UIRootPanel\" 的根标签。");
            if (stack.Count > 0)
                throw new InvalidDataException($"TSX 根标签未闭合：{stack.Peek().TagName}。");
            if (string.IsNullOrWhiteSpace(uiRoot.GetAttribute("data-name")))
                throw new InvalidDataException("UIRootPanel 必须声明静态 data-name。");

            return new UIReactDocument(uiRoot, sourcePath);
        }

        private static int FindTagEnd(string source, int startIndex)
        {
            char quote = '\0';
            int expressionDepth = 0;
            for (int i = startIndex; i < source.Length; i++)
            {
                char current = source[i];
                if (quote != '\0')
                {
                    if (current == quote && !IsEscaped(source, i))
                        quote = '\0';
                    continue;
                }

                if (current == '\'' || current == '"' || current == '`')
                    quote = current;
                else if (current == '{')
                    expressionDepth++;
                else if (current == '}' && expressionDepth > 0)
                    expressionDepth--;
                else if (current == '>' && expressionDepth == 0)
                    return i;
            }

            return -1;
        }

        private static string ReadTagName(string body)
        {
            int length = 0;
            while (length < body.Length && !char.IsWhiteSpace(body[length]) && body[length] != '/')
                length++;
            return body.Substring(0, length);
        }

        private static void CloseTag(Stack<UIReactNode> stack, string tagName)
        {
            if (stack.Count == 0)
                throw new InvalidDataException($"发现多余的 TSX 结束标签：{tagName}。");

            UIReactNode node = stack.Pop();
            if (!string.Equals(node.TagName, tagName, StringComparison.OrdinalIgnoreCase))
                throw new InvalidDataException($"TSX 标签层级不匹配：期望 </{node.TagName}>，实际 </{tagName}>。");
        }

        private static void AppendText(Stack<UIReactNode> stack, string value)
        {
            if (stack.Count == 0 || string.IsNullOrWhiteSpace(value))
                return;

            string normalized = Regex.Replace(value, "\\s+", " ").Trim();
            if (normalized.StartsWith("{") && normalized.EndsWith("}"))
                return;

            UIReactNode node = stack.Peek();
            node.Text = string.IsNullOrEmpty(node.Text) ? normalized : node.Text + " " + normalized;
        }

        private static int FindUIRootStart(string source)
        {
            char quote = '\0';
            for (int i = 0; i < source.Length; i++)
            {
                char current = source[i];
                if (quote != '\0')
                {
                    if (current == quote && !IsEscaped(source, i))
                        quote = '\0';
                    continue;
                }

                if (current == '\'' || current == '"' || current == '`')
                {
                    quote = current;
                    continue;
                }

                if (current == '/' && i + 1 < source.Length && source[i + 1] == '/')
                {
                    int lineEnd = source.IndexOf('\n', i + 2);
                    i = lineEnd < 0 ? source.Length : lineEnd;
                    continue;
                }

                if (current == '/' && i + 1 < source.Length && source[i + 1] == '*')
                {
                    int commentEnd = source.IndexOf("*/", i + 2, StringComparison.Ordinal);
                    i = commentEnd < 0 ? source.Length : commentEnd + 1;
                    continue;
                }

                if (current != '<' || i + 1 >= source.Length || !IsTagNameStart(source[i + 1]))
                    continue;

                int closeIndex = FindTagEnd(source, i + 1);
                if (closeIndex < 0)
                    continue;

                string body = source.Substring(i + 1, closeIndex - i - 1);
                MatchCollection matches = AttributeRegex.Matches(body);
                for (int matchIndex = 0; matchIndex < matches.Count; matchIndex++)
                {
                    Match match = matches[matchIndex];
                    if (string.Equals(match.Groups["name"].Value, "data-component", StringComparison.OrdinalIgnoreCase) &&
                        string.Equals(match.Groups["value"].Value, "UIRootPanel", StringComparison.Ordinal))
                        return i;
                }

                i = closeIndex;
            }

            return -1;
        }

        private static int FindNextMarkupOrExpression(string source, int startIndex)
        {
            int markupIndex = source.IndexOf('<', startIndex);
            int expressionIndex = source.IndexOf('{', startIndex);
            if (markupIndex < 0)
                return expressionIndex;
            if (expressionIndex < 0)
                return markupIndex;
            return Math.Min(markupIndex, expressionIndex);
        }

        private static int FindExpressionEnd(string source, int openIndex)
        {
            int depth = 0;
            char quote = '\0';
            for (int i = openIndex; i < source.Length; i++)
            {
                char current = source[i];
                if (quote != '\0')
                {
                    if (current == quote && !IsEscaped(source, i))
                        quote = '\0';
                    continue;
                }

                if (current == '\'' || current == '"' || current == '`')
                {
                    quote = current;
                    continue;
                }

                if (current == '/' && i + 1 < source.Length && source[i + 1] == '/')
                {
                    int lineEnd = source.IndexOf('\n', i + 2);
                    i = lineEnd < 0 ? source.Length : lineEnd;
                    continue;
                }

                if (current == '/' && i + 1 < source.Length && source[i + 1] == '*')
                {
                    int commentEnd = source.IndexOf("*/", i + 2, StringComparison.Ordinal);
                    if (commentEnd < 0)
                        throw new InvalidDataException($"TSX 表达式注释未闭合，位置：{i}。");
                    i = commentEnd + 1;
                    continue;
                }

                if (current == '{')
                    depth++;
                else if (current == '}' && --depth == 0)
                    return i;
            }

            throw new InvalidDataException($"TSX 表达式未闭合，位置：{openIndex}。");
        }

        private static bool IsTagNameStart(char value)
        {
            return char.IsLetter(value) || value == '_';
        }

        private static bool IsEscaped(string source, int index)
        {
            int slashCount = 0;
            for (int i = index - 1; i >= 0 && source[i] == '\\'; i--)
                slashCount++;
            return slashCount % 2 != 0;
        }

        private static bool StartsWith(string source, int index, string value)
        {
            return index >= 0 && index + value.Length <= source.Length &&
                   string.Compare(source, index, value, 0, value.Length, StringComparison.Ordinal) == 0;
        }
    }
}

