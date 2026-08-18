using System;
using System.Diagnostics;
using System.IO;
using UnityEditor;
using UnityEngine;
using Debug = UnityEngine.Debug;

namespace UIReactTool.Preview
{
    /// <summary>
    /// 管理同级 React 预览工程的依赖安装和 Vite 预览进程。
    /// </summary>
    internal static class UIReactPreviewLauncher
    {
        private static Process previewProcess;

        public static void InstallDependencies(UIReactToolSettings settings)
        {
            ValidateProject(settings.ReactRootPath);
            StartNpm(settings.ReactRootPath, "install", false);
        }

        public static void StartPreview(UIReactToolSettings settings)
        {
            ValidateProject(settings.ReactRootPath);
            string nodeModules = Path.Combine(settings.ReactRootPath, "node_modules");
            if (!Directory.Exists(nodeModules))
                throw new DirectoryNotFoundException("尚未安装 React 预览依赖，请先点击“安装/更新预览依赖”。");

            if (previewProcess == null || previewProcess.HasExited)
                previewProcess = StartNpm(settings.ReactRootPath, $"run dev -- --host 127.0.0.1 --port {settings.PreviewPort} --strictPort", true);

            Application.OpenURL($"http://127.0.0.1:{settings.PreviewPort}");
        }

        private static Process StartNpm(string workingDirectory, string arguments, bool keepReference)
        {
            var startInfo = new ProcessStartInfo
            {
                FileName = "npm.cmd",
                Arguments = arguments,
                WorkingDirectory = workingDirectory,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };

            // React 工程与 Unity 项目同级但目录名可变，通过环境变量提供当前项目资源根目录。
            startInfo.EnvironmentVariables["UNITY_PROJECT_PATH"] = Directory.GetParent(Application.dataPath)?.FullName ?? Application.dataPath;

            Process process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
            process.OutputDataReceived += (_, eventArgs) =>
            {
                if (!string.IsNullOrWhiteSpace(eventArgs.Data))
                    Debug.Log("[UI React 预览] " + eventArgs.Data);
            };
            process.ErrorDataReceived += (_, eventArgs) =>
            {
                if (!string.IsNullOrWhiteSpace(eventArgs.Data))
                    Debug.LogWarning("[UI React 预览] " + eventArgs.Data);
            };
            process.Exited += (_, __) =>
            {
                Debug.Log($"[UI React 预览] npm 进程已结束，退出码：{process.ExitCode}");
                if (!keepReference)
                    process.Dispose();
            };
            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();
            return process;
        }

        private static void ValidateProject(string reactRootPath)
        {
            UIReactPreviewTemplate.Validate(reactRootPath);
        }
    }
}

