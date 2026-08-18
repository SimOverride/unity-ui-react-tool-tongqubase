using System;
using System.IO;
using UnityEditor;
using UnityEngine;

using PackageManagerInfo = UnityEditor.PackageManager.PackageInfo;

namespace UIReactTool.Preview
{
    /// <summary>
    /// 负责从工具包中按白名单初始化 React 预览工程，避免复制测试项目业务内容和本地构建产物。
    /// </summary>
    internal static class UIReactPreviewTemplate
    {
        private static readonly string[] TemplateFiles =
        {
            "index.html",
            "package.json",
            "package-lock.json",
            "tsconfig.json",
            "vite.config.ts"
        };

        private const string SourceDirectoryName = "src";
        private const string SamplePath = "Generated/SampleDialog/SampleDialog.tsx";
        // 该标记只由初始化器写入，模板源目录中不提供，避免手工整目录复制绕过工具流程。
        private const string TemplateMarkerFile = ".uirect-template.json";
        private const string TemplateMarkerContent = "{\"template\":\"UIReactTool.ReactPreview\",\"schemaVersion\":1}";
        private const string UnityEnvironmentFile = ".env.local";

        public static void Initialize(string targetPath)
        {
            string targetRoot = NormalizePath(targetPath);
            string templateRoot = FindTemplateRoot();
            if (PathsEqual(targetRoot, templateRoot) || IsPathInside(targetRoot, templateRoot))
                throw new InvalidOperationException("React 工程目录不能指向工具包内的 ReactPreview 模板。");
            if (IsPathInside(targetRoot, GetUnityProjectRoot()))
                throw new InvalidOperationException("React 工程目录必须位于 Unity 项目目录之外，建议放在 Unity 项目同级的 UIReact 目录。");

            Directory.CreateDirectory(targetRoot);
            for (int i = 0; i < TemplateFiles.Length; i++)
                CopyFile(Path.Combine(templateRoot, TemplateFiles[i]), Path.Combine(targetRoot, TemplateFiles[i]));

            CopyDirectoryFiles(
                Path.Combine(templateRoot, SourceDirectoryName),
                Path.Combine(targetRoot, SourceDirectoryName));
            CopyFile(
                Path.Combine(templateRoot, SamplePath.Replace('/', Path.DirectorySeparatorChar)),
                Path.Combine(targetRoot, SamplePath.Replace('/', Path.DirectorySeparatorChar)));
            WriteUnityProjectEnvironment(targetRoot, GetUnityProjectRoot());
            WriteTemplateMarker(targetRoot);

            Debug.Log("[UI React 工具] 已按白名单初始化 ReactPreview 模板。未复制 node_modules、dist、缓存或测试业务页面。");
        }

        public static void Validate(string targetPath)
        {
            string targetRoot = NormalizePath(targetPath);
            if (!Directory.Exists(targetRoot))
                throw new DirectoryNotFoundException("React 工程目录不存在，请先使用“初始化 ReactPreview 模板”或配置已有工程：" + targetRoot);
            if (IsPathInside(targetRoot, GetUnityProjectRoot()))
                throw new InvalidOperationException("React 工程目录必须位于 Unity 项目目录之外，不能放在 Unity 项目 Assets 或其他子目录中。");

            string markerPath = Path.Combine(targetRoot, TemplateMarkerFile);
            if (!File.Exists(markerPath) || !string.Equals(File.ReadAllText(markerPath).Trim(), TemplateMarkerContent, StringComparison.Ordinal))
                throw new InvalidDataException("React 工程不是由 UI React 工具初始化的模板，请使用“初始化 ReactPreview 模板”创建，不能直接复制 ReactPreview 目录。");

            for (int i = 0; i < TemplateFiles.Length; i++)
            {
                string filePath = Path.Combine(targetRoot, TemplateFiles[i]);
                if (!File.Exists(filePath))
                    throw new FileNotFoundException("React 工程缺少模板文件，请重新初始化或检查目录配置：" + TemplateFiles[i], filePath);
            }

            string mainPath = Path.Combine(targetRoot, SourceDirectoryName, "main.tsx");
            if (!File.Exists(mainPath))
                throw new FileNotFoundException("React 工程缺少预览入口 src/main.tsx，请重新初始化模板。", mainPath);

            // Unity 工具启动 npm 时会传入同一变量；这里同步本地配置，保证手动 npm 构建也指向当前项目。
            WriteUnityProjectEnvironment(targetRoot, GetUnityProjectRoot());
        }

        private static string FindTemplateRoot()
        {
            string packageRoot = TryFindPackageRoot();
            if (!string.IsNullOrWhiteSpace(packageRoot))
            {
                string packageTemplate = Path.Combine(packageRoot, "ReactPreview");
                if (Directory.Exists(packageTemplate))
                    return NormalizePath(packageTemplate);
            }

            string unityProjectRoot = GetUnityProjectRoot();
            string workspaceRoot = Directory.GetParent(unityProjectRoot)?.FullName ?? unityProjectRoot;
            string workspaceTemplate = Path.Combine(workspaceRoot, "UIReactTool", "ReactPreview");
            if (Directory.Exists(workspaceTemplate))
                return NormalizePath(workspaceTemplate);

            throw new DirectoryNotFoundException("找不到 UIReactTool/ReactPreview 模板，请确认工具包内容完整。");
        }

        private static string GetUnityProjectRoot()
        {
            return Directory.GetParent(Application.dataPath)?.FullName ?? Application.dataPath;
        }

        private static string TryFindPackageRoot()
        {
            try
            {
                PackageManagerInfo package = PackageManagerInfo.FindForAssembly(typeof(UIReactPreviewTemplate).Assembly);
                return package?.resolvedPath;
            }
            catch (Exception exception)
            {
                Debug.LogWarning("[UI React 工具] 无法通过 UPM 定位模板，改用工作区路径：" + exception.Message);
                return string.Empty;
            }
        }

        private static void CopyDirectoryFiles(string sourceRoot, string targetRoot)
        {
            if (!Directory.Exists(sourceRoot))
                throw new DirectoryNotFoundException("React 模板缺少 src 目录：" + sourceRoot);

            foreach (string sourceFile in Directory.GetFiles(sourceRoot, "*", SearchOption.AllDirectories))
            {
                string relativePath = sourceFile.Substring(sourceRoot.Length).TrimStart(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
                if (ShouldSkip(relativePath))
                    continue;

                CopyFile(sourceFile, Path.Combine(targetRoot, relativePath));
            }
        }

        private static bool ShouldSkip(string relativePath)
        {
            string normalized = relativePath.Replace('\\', '/');
            return normalized.EndsWith(".meta", StringComparison.OrdinalIgnoreCase) ||
                   normalized.EndsWith(".tsbuildinfo", StringComparison.OrdinalIgnoreCase) ||
                   normalized.StartsWith("node_modules/", StringComparison.OrdinalIgnoreCase) ||
                   normalized.StartsWith("dist/", StringComparison.OrdinalIgnoreCase) ||
                   normalized.StartsWith(".vite/", StringComparison.OrdinalIgnoreCase);
        }

        private static void CopyFile(string sourcePath, string targetPath)
        {
            if (!File.Exists(sourcePath))
                throw new FileNotFoundException("React 模板缺少文件：" + sourcePath, sourcePath);

            string targetDirectory = Path.GetDirectoryName(targetPath);
            if (!string.IsNullOrWhiteSpace(targetDirectory))
                Directory.CreateDirectory(targetDirectory);
            File.Copy(sourcePath, targetPath, true);
        }

        private static void WriteTemplateMarker(string targetRoot)
        {
            // 标记内容保持固定，便于预览、生成入口快速判断目录来源。
            string markerPath = Path.Combine(targetRoot, TemplateMarkerFile);
            File.WriteAllText(markerPath, TemplateMarkerContent + Environment.NewLine);
        }

        private static void WriteUnityProjectEnvironment(string targetRoot, string unityProjectRoot)
        {
            string normalizedProjectRoot = unityProjectRoot.Replace('\\', '/').Replace("\"", "\\\"");
            string content = "UNITY_PROJECT_PATH=\"" + normalizedProjectRoot + "\"" + Environment.NewLine;
            string environmentPath = Path.Combine(targetRoot, UnityEnvironmentFile);
            if (!File.Exists(environmentPath) || !string.Equals(File.ReadAllText(environmentPath), content, StringComparison.Ordinal))
                File.WriteAllText(environmentPath, content);
        }

        private static string NormalizePath(string path)
        {
            if (string.IsNullOrWhiteSpace(path))
                throw new InvalidDataException("React 工程目录不能为空。");
            return Path.GetFullPath(path.Trim());
        }

        private static bool PathsEqual(string left, string right)
        {
            return string.Equals(
                NormalizePath(left).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar),
                NormalizePath(right).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar),
                StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsPathInside(string candidate, string root)
        {
            string normalizedCandidate = NormalizePath(candidate).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
            string normalizedRoot = NormalizePath(root).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;
            return normalizedCandidate.StartsWith(normalizedRoot, StringComparison.OrdinalIgnoreCase);
        }
    }
}
