using System;
using System.IO;
using NUnit.Framework;
using UIReactTool.Preview;
using UnityEngine;

namespace UIReactTool.Tests
{
    /// <summary>
    /// 验证已安装工具包的 ReactPreview 初始化入口。
    /// </summary>
    public sealed class UIReactPreviewTests
    {
        private string targetPath;

        [SetUp]
        public void SetUp()
        {
            targetPath = Path.Combine(Path.GetTempPath(), "UIReactToolTests", Guid.NewGuid().ToString("N"));
        }

        [TearDown]
        public void TearDown()
        {
            if (Directory.Exists(targetPath))
                Directory.Delete(targetPath, true);
        }

        [Test]
        public void Initialize_InstalledTemplate_CopiesRunnablePreviewSkeleton()
        {
            UIReactPreviewTemplate.Initialize(targetPath);

            Assert.That(File.Exists(Path.Combine(targetPath, "package.json")), Is.True);
            Assert.That(File.Exists(Path.Combine(targetPath, "src", "main.tsx")), Is.True);
            Assert.That(File.Exists(Path.Combine(targetPath, "Generated", "SampleDialog", "SampleDialog.tsx")), Is.True);
            Assert.That(File.Exists(Path.Combine(targetPath, ".uirect-template.json")), Is.True);
            Assert.DoesNotThrow(() => UIReactPreviewTemplate.Validate(targetPath));
        }

        [TestCase(RuntimePlatform.WindowsEditor, "npm.cmd")]
        [TestCase(RuntimePlatform.OSXEditor, "npm")]
        [TestCase(RuntimePlatform.LinuxEditor, "npm")]
        public void GetNpmExecutableName_EditorPlatform_ReturnsPlatformCommand(
            RuntimePlatform platform,
            string expectedCommand)
        {
            Assert.That(UIReactPreviewLauncher.GetNpmExecutableName(platform), Is.EqualTo(expectedCommand));
        }
    }
}
