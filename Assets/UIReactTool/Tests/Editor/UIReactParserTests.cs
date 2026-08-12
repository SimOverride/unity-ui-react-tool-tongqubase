using NUnit.Framework;
using UIReactTool.Parsing;

namespace UIReactTool.Tests
{
    /// <summary>
    /// 验证静态 TSX 标签、层级、文本和 data 属性解析。
    /// </summary>
    public sealed class UIReactParserTests
    {
        [Test]
        public void Parse_StaticRootAndChild_ReturnsExpectedDocument()
        {
            const string source = @"
export default function TestDialog() {
  return (
    <main data-name=""Root"" data-component=""UIRootPanel"" data-dialog-name=""TestDialog"" data-pos=""(0, 0, 0)"" data-size=""(750, 1680)"">
      <button data-name=""ConfirmButton"" data-component=""UIButton"" data-bind=""_confirmButton"" data-sprite=""Assets/Arts/UI/confirm.png"" data-font-size=""28"" data-pos=""(0, 0, 0)"" data-size=""(200, 60)"" data-text=""确认"">确认</button>
    </main>
  )
}";

            UIReactDocument document = UIReactParser.Parse(source, "TestDialog.tsx");

            Assert.AreEqual("TestDialog", document.DialogName);
            Assert.AreEqual("UIRootPanel", document.Root.ComponentName);
            Assert.AreEqual(1, document.Root.Children.Count);
            Assert.AreEqual("UIButton", document.Root.Children[0].ComponentName);
            Assert.AreEqual("确认", document.Root.Children[0].Text);
            Assert.AreEqual("_confirmButton", document.Root.Children[0].GetAttribute("data-bind"));
            Assert.AreEqual("Assets/Arts/UI/confirm.png", document.Root.Children[0].GetAttribute("data-sprite"));
            Assert.AreEqual("28", document.Root.Children[0].GetAttribute("data-font-size"));
        }

        [Test]
        public void Parse_TextStyleOnParent_CanBeInheritedByChildControl()
        {
            const string source = @"
<main data-name=""Root"" data-component=""UIRootPanel"">
  <section data-name=""Group"" data-component=""UINode"" data-font-size=""22"" data-color=""(1, 0.5, 0, 1)"">
    <button data-name=""Item"" data-component=""UIButton"" />
  </section>
</main>";

            UIReactDocument document = UIReactParser.Parse(source);
            UIReactNode button = document.Root.Children[0].Children[0];

            Assert.AreEqual("22", button.GetInheritedAttribute("data-font-size"));
            Assert.AreEqual("(1, 0.5, 0, 1)", button.GetInheritedAttribute("data-color"));
        }

        [Test]
        public void Parse_MissingUIRoot_ThrowsReadableError()
        {
            var exception = Assert.Throws<System.IO.InvalidDataException>(() =>
                UIReactParser.Parse("<div data-name=\"Node\" data-component=\"UINode\" />"));

            StringAssert.Contains("UIRootPanel", exception.Message);
        }

        [Test]
        public void Parse_ReactRuntimeSyntax_IgnoresRuntimeCode()
        {
            const string source = @"
type Page = 'main' | 'rank'

export default function RuntimeDialog() {
  const [page, setPage] = useState<Page>('main')
  return (
    <main className={`page ${page}`} data-name=""RuntimeDialog"" data-component=""UIRootPanel"">
      <button data-name=""OpenButton"" data-component=""UIButton"" onClick={() => setPage('rank')}>打开</button>
      {page === 'rank' ? <section data-name=""DynamicPage"" data-component=""UINode"" /> : null}
      <section data-name=""StaticPage"" data-component=""UINode"" />
    </main>
  )
}";

            UIReactDocument document = UIReactParser.Parse(source, "RuntimeDialog.tsx");

            Assert.AreEqual("RuntimeDialog", document.DialogName);
            Assert.AreEqual(2, document.Root.Children.Count);
            Assert.AreEqual("打开", document.Root.Children[0].Text);
            Assert.AreEqual("StaticPage", document.Root.Children[1].GetAttribute("data-name"));
            StringAssert.DoesNotContain("setPage", document.Root.Children[0].Text);
        }

        [Test]
        public void Parse_MismatchedStaticTags_ThrowsReadableError()
        {
            const string source = @"
<main data-name=""Root"" data-component=""UIRootPanel"">
  <section data-name=""Child"" data-component=""UINode""></div>
</main>";

            var exception = Assert.Throws<System.IO.InvalidDataException>(() => UIReactParser.Parse(source));

            StringAssert.Contains("标签层级不匹配", exception.Message);
        }
    }
}

