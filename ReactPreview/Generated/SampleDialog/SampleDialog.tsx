export default function SampleDialog() {
  return (
    <main
      data-name="SampleDialogRoot"
      data-component="UIRootPanel"
      data-dialog-name="SampleDialog"
      data-panel-type="Dialog"
      data-pos="(0, 0, 0)"
      data-size="(750, 1680)"
    >
      <section
        data-name="MainPanel"
        data-component="UIImage"
        data-anchors="(0.5, 0.5, 0.5, 0.5)"
        data-pivot="(0.5, 0.5)"
        data-pos="(0, 0, 0)"
        data-size="(620, 900)"
        data-color="(0.12, 0.16, 0.23, 0.98)"
      >
        <span data-name="TitleText" data-component="UITextMesh" data-bind="_titleText" data-anchors="(0.5, 1, 0.5, 1)" data-pivot="(0.5, 1)" data-pos="(0, -60, 0)" data-size="(520, 80)" data-text="UnityBaseFramework UI 工具验收" data-font-size="32" data-enable-word-wrapping="false" data-color="(0.9, 0.95, 1, 1)">UnityBaseFramework UI 工具验收</span>
        <button data-name="CancelButton" data-component="UIButton" data-bind="_cancelButton" data-anchors="(0.5, 0, 0.5, 0)" data-pivot="(0.5, 0)" data-pos="(-130, 50, 0)" data-size="(220, 70)" data-text="取消">取消</button>
        <button data-name="ConfirmButton" data-component="UIButton" data-bind="_confirmButton" data-anchors="(0.5, 0, 0.5, 0)" data-pivot="(0.5, 0)" data-pos="(130, 50, 0)" data-size="(220, 70)" data-text="确认">确认</button>
      </section>
    </main>
  )
}
