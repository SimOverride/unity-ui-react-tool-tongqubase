using NUnit.Framework;
using TongquBase;
using UIReactTool.Generation;
using UIReactTool.Parsing;
using UnityEngine;

namespace UIReactTool.Tests
{
    /// <summary>
    /// 验证界面模式脚本和显式绑定类型的生成规则。
    /// </summary>
    public sealed class UIReactGenerationTests
    {
        [Test]
        public void BuildPlainViewSource_UsesUIView()
        {
            string source = UIReactPrefabGenerator.BuildPlainViewSource("InventoryDialog", "Game.UI");

            StringAssert.Contains("namespace Game.UI", source);
            StringAssert.Contains("InventoryDialog : TongquBase.UIView", source);
        }

        [Test]
        public void BuildMvvmSources_CreateRunnableTypeChain()
        {
            string viewSource = UIReactPrefabGenerator.BuildMvvmViewSource("InventoryDialog", "Game.UI");
            string viewModelSource = UIReactPrefabGenerator.BuildMvvmViewModelSource("InventoryDialog", "Game.UI");
            string modelSource = UIReactPrefabGenerator.BuildMvvmModelSource("InventoryDialog", "Game.UI");

            StringAssert.Contains(
                "InventoryDialog : TongquBase.GenericUIView<InventoryDialogViewModel, InventoryDialogModel>",
                viewSource);
            StringAssert.Contains(
                "InventoryDialogViewModel : TongquBase.GenericUIViewModel<InventoryDialog, InventoryDialogModel>",
                viewModelSource);
            StringAssert.Contains("SetModel(new InventoryDialogModel());", viewModelSource);
            StringAssert.Contains("InventoryDialogModel : TongquBase.BaseModel", modelSource);
        }

        [Test]
        public void ResolveViewMode_RootAttributeOverridesSettings()
        {
            UIReactDocument document = UIReactParser.Parse(
                "<main data-name=\"InventoryDialog\" data-component=\"UIRootPanel\" data-view-mode=\"Mvvm\" />");
            UIReactToolSettings settings = UIReactToolSettings.instance;
            UIReactViewMode previousMode = settings.ViewMode;

            try
            {
                settings.ViewMode = UIReactViewMode.Plain;
                Assert.AreEqual(UIReactViewMode.Mvvm, UIReactPrefabGenerator.ResolveViewMode(document, settings));
            }
            finally
            {
                settings.ViewMode = previousMode;
            }
        }

        [TestCase("GameObject", UIBindComponentType.GameObject)]
        [TestCase("Transform", UIBindComponentType.Transform)]
        [TestCase("RectTransform", UIBindComponentType.RectTransform)]
        [TestCase("Button", UIBindComponentType.Button)]
        [TestCase("Image", UIBindComponentType.Image)]
        [TestCase("RawImage", UIBindComponentType.RawImage)]
        [TestCase("Text", UIBindComponentType.Text)]
        [TestCase("Toggle", UIBindComponentType.Toggle)]
        [TestCase("Slider", UIBindComponentType.Slider)]
        [TestCase("ScrollRect", UIBindComponentType.ScrollRect)]
        [TestCase("InputField", UIBindComponentType.InputField)]
        [TestCase("CanvasGroup", UIBindComponentType.CanvasGroup)]
        [TestCase("Animator", UIBindComponentType.Animator)]
        [TestCase("TMPText", UIBindComponentType.TMPText)]
        [TestCase("TMPInputField", UIBindComponentType.TMPInputField)]
        [TestCase("TMPDropdown", UIBindComponentType.TMPDropdown)]
        public void ParseBindingType_FrameworkType_ReturnsExpectedType(
            string declaredType,
            UIBindComponentType expectedType)
        {
            UIBindComponentType actualType = UIReactElementFactory.ParseBindingType(
                declaredType,
                string.Empty,
                out string customTypeName);

            Assert.AreEqual(expectedType, actualType);
            Assert.IsEmpty(customTypeName);
        }

        [Test]
        public void ParseBindingType_FullTypeName_UsesCustomComponent()
        {
            UIBindComponentType actualType = UIReactElementFactory.ParseBindingType(
                "Game.UI.InventoryCell",
                string.Empty,
                out string customTypeName);

            Assert.AreEqual(UIBindComponentType.Custom, actualType);
            Assert.AreEqual("Game.UI.InventoryCell", customTypeName);
        }

        [Test]
        public void ParseBindingType_CustomWithoutTypeName_ThrowsReadableError()
        {
            var exception = Assert.Throws<System.IO.InvalidDataException>(() =>
                UIReactElementFactory.ParseBindingType("Custom", string.Empty, out _));

            StringAssert.Contains("data-bind-custom-type", exception.Message);
        }

        [Test]
        public void Create_ExplicitGameObjectBinding_WritesMarker()
        {
            UIReactDocument document = UIReactParser.Parse(@"
<main data-name=""Root"" data-component=""UIRootPanel"">
  <div data-name=""InventoryCell"" data-component=""UINode"" data-bind=""_inventoryCell"" data-bind-type=""GameObject"" />
</main>");
            UIReactToolSettings settings = UIReactToolSettings.instance;
            string previousComponentFolder = settings.ComponentPrefabFolder;
            GameObject instance = null;

            try
            {
                settings.ComponentPrefabFolder = "Assets/__UIReactToolTests/MissingComponents";
                instance = UIReactElementFactory.Create(document.Root.Children[0], null, settings);
                UIBindMarker marker = instance.GetComponent<UIBindMarker>();

                Assert.IsNotNull(marker);
                Assert.AreEqual("_inventoryCell", marker.Key);
                Assert.AreEqual(UIBindComponentType.GameObject, marker.ComponentType);
                Assert.IsNull(marker.TargetComponent);
            }
            finally
            {
                settings.ComponentPrefabFolder = previousComponentFolder;
                if (instance != null)
                    UnityEngine.Object.DestroyImmediate(instance);
            }
        }
    }
}
