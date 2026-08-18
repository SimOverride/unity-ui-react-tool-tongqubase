using System;
using UIReactTool.Parsing;
using UIReactTool.Preview;
using UnityEditor;
using UnityEditor.Callbacks;
using UnityEngine;

namespace UIReactTool.Generation
{
    /// <summary>
    /// 在首次生成 UIView 脚本导致域重载后恢复 Prefab 生成任务。
    /// </summary>
    public static class UIReactGenerationCoordinator
    {
        private const string PendingRequestKey = "UIReactTool.PendingGeneration";

        [Serializable]
        private sealed class PendingRequest
        {
            public string SourcePath;
        }

        public static string GenerateFromFile(string sourcePath, bool showDialog = true)
        {
            UIReactToolSettings settings = UIReactToolSettings.instance;
            settings.SaveSettings();
            UIReactPreviewTemplate.Validate(settings.ReactRootPath);
            UIReactDocument document = UIReactParser.ParseFile(sourcePath);
            Type viewType = UIReactPrefabGenerator.ResolveViewType(document.DialogName, settings.GeneratedNamespace);

            if (viewType == null)
            {
                UIReactPrefabGenerator.EnsureViewScript(document.DialogName, settings);
                SessionState.SetString(PendingRequestKey, JsonUtility.ToJson(new PendingRequest { SourcePath = sourcePath }));
                AssetDatabase.Refresh(ImportAssetOptions.ForceUpdate);
                if (showDialog)
                    EditorUtility.DisplayDialog("UI React 工具", "已创建 UIView 脚本。Unity 编译完成后会自动继续生成 Prefab。", "确定");
                return string.Empty;
            }

            string prefabPath = UIReactPrefabGenerator.Generate(document, viewType, settings);
            if (showDialog)
                EditorUtility.DisplayDialog("UI React 工具", "Prefab 生成完成：\n" + prefabPath, "确定");
            return prefabPath;
        }

        [DidReloadScripts]
        private static void ResumeAfterScriptsReloaded()
        {
            string json = SessionState.GetString(PendingRequestKey, string.Empty);
            if (string.IsNullOrWhiteSpace(json))
                return;

            SessionState.EraseString(PendingRequestKey);
            PendingRequest request = JsonUtility.FromJson<PendingRequest>(json);
            if (request == null || string.IsNullOrWhiteSpace(request.SourcePath))
                return;

            EditorApplication.delayCall += () =>
            {
                try
                {
                    GenerateFromFile(request.SourcePath, false);
                }
                catch (Exception exception)
                {
                    Debug.LogException(exception);
                    EditorUtility.DisplayDialog("UI React 工具", "编译后继续生成失败：\n" + exception.Message, "确定");
                }
            };
        }
    }
}

