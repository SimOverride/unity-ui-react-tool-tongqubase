using System;
using System.IO;
using TMPro;
using TongquBase;
using UIReactTool.Parsing;
using UnityEditor;
using UnityEngine;
using UnityEngine.UI;

namespace UIReactTool.Generation
{
    /// <summary>
    /// 根据组件名创建框架 Prefab 实例或基础 uGUI/TMP 控件。
    /// </summary>
    internal static class UIReactElementFactory
    {
        public static GameObject Create(UIReactNode node, Transform parent, UIReactToolSettings settings)
        {
            string componentName = node.ComponentName;
            string objectName = node.GetAttribute("data-name", componentName + "Node");
            GameObject instance = TryInstantiateComponentPrefab(componentName, parent, settings);
            if (instance == null)
                instance = CreateBuiltin(componentName, objectName);

            instance.name = objectName;
            if (parent != null)
                instance.transform.SetParent(parent, false);

            ApplyDefaultFont(instance, settings.DefaultTmpFont);
            ApplyAttributes(instance, node, componentName);
            AddBindingMarker(instance, node, componentName);
            return instance;
        }

        public static void ApplyPrefabChild(Transform componentRoot, UIReactNode node)
        {
            if (componentRoot == null)
                throw new ArgumentNullException(nameof(componentRoot));

            Transform child = componentRoot.Find(node.PrefabChildPath);
            if (child == null)
                throw new InvalidOperationException($"组件 {componentRoot.name} 中不存在 Prefab 子路径：{node.PrefabChildPath}");

            ApplyRectTransform(child.gameObject, node);
            ApplyCommonState(child.gameObject, node);
            ApplyLayout(child.gameObject, node);
        }

        public static Transform ResolveChildParent(GameObject componentRoot)
        {
            if (componentRoot == null)
                throw new ArgumentNullException(nameof(componentRoot));

            // ScrollRect 的声明子节点属于滚动内容，而不是遮罩或组件外壳。
            // 同一规则同时适用于内建列表和项目提供的自定义滚动组件 Prefab。
            ScrollRect scrollRect = componentRoot.GetComponent<ScrollRect>() ??
                                    componentRoot.GetComponentInChildren<ScrollRect>(true);
            return scrollRect != null && scrollRect.content != null
                ? scrollRect.content
                : componentRoot.transform;
        }

        private static GameObject TryInstantiateComponentPrefab(string componentName, Transform parent, UIReactToolSettings settings)
        {
            string folder = settings.ComponentPrefabFolder.TrimEnd('/');
            string assetPath = folder + "/" + componentName + ".prefab";
            GameObject prefab = AssetDatabase.LoadAssetAtPath<GameObject>(assetPath);
            if (prefab == null)
                return null;

            return PrefabUtility.InstantiatePrefab(prefab, parent) as GameObject;
        }

        private static GameObject CreateBuiltin(string componentName, string objectName)
        {
            switch (componentName)
            {
                case "UIRootPanel":
                case "UINode":
                case "UIPrefabLoader":
                case "UIInputSwitcher":
                    return CreateRectObject(objectName);
                case "UIImage":
                    return CreateImage(objectName);
                case "UITextMesh":
                    return CreateText(objectName);
                case "UIButton":
                    return CreateButton(objectName);
                case "UIInputField":
                case "UIInputFieldTextMesh":
                    return CreateInputField(objectName);
                case "UIToggle":
                    return CreateToggle(objectName);
                case "UISlider":
                    return CreateSlider(objectName);
                case "UIEventArea":
                    return CreateEventArea(objectName);
                case "UIListView":
                    return CreateScrollView(objectName, false, false);
                case "UISimpleListView":
                    return CreateScrollView(objectName, true, false);
                case "UIGridView":
                case "UISimpleGridView":
                    return CreateScrollView(objectName, false, true);
                default:
                    throw new NotSupportedException($"未找到组件 Prefab，且没有内建生成器：{componentName}");
            }
        }

        private static GameObject CreateRectObject(string name)
        {
            return new GameObject(name, typeof(RectTransform));
        }

        private static GameObject CreateImage(string name)
        {
            var gameObject = CreateRectObject(name);
            gameObject.AddComponent<Image>();
            return gameObject;
        }

        private static GameObject CreateText(string name)
        {
            var gameObject = CreateRectObject(name);
            var text = gameObject.AddComponent<TextMeshProUGUI>();
            text.raycastTarget = false;
            text.alignment = TextAlignmentOptions.Center;
            text.text = name;
            return gameObject;
        }

        private static GameObject CreateButton(string name)
        {
            var gameObject = CreateImage(name);
            var button = gameObject.AddComponent<Button>();
            button.targetGraphic = gameObject.GetComponent<Image>();

            GameObject labelObject = CreateText("Text (TMP)");
            labelObject.transform.SetParent(gameObject.transform, false);
            Stretch(labelObject.GetComponent<RectTransform>(), 8f, 8f, 4f, 4f);
            return gameObject;
        }

        private static GameObject CreateInputField(string name)
        {
            var gameObject = CreateImage(name);
            var inputField = gameObject.AddComponent<TMP_InputField>();

            GameObject viewportObject = CreateRectObject("Text Area");
            viewportObject.transform.SetParent(gameObject.transform, false);
            var viewport = viewportObject.GetComponent<RectTransform>();
            Stretch(viewport, 10f, 10f, 6f, 6f);
            viewportObject.AddComponent<RectMask2D>();

            GameObject placeholderObject = CreateText("Placeholder");
            placeholderObject.transform.SetParent(viewport, false);
            Stretch(placeholderObject.GetComponent<RectTransform>(), 0f, 0f, 0f, 0f);
            var placeholder = placeholderObject.GetComponent<TextMeshProUGUI>();
            placeholder.text = "请输入内容";
            placeholder.fontStyle = FontStyles.Italic;
            placeholder.color = new Color(1f, 1f, 1f, 0.5f);

            GameObject textObject = CreateText("Text");
            textObject.transform.SetParent(viewport, false);
            Stretch(textObject.GetComponent<RectTransform>(), 0f, 0f, 0f, 0f);
            var text = textObject.GetComponent<TextMeshProUGUI>();
            text.text = string.Empty;

            inputField.textViewport = viewport;
            inputField.textComponent = text;
            inputField.placeholder = placeholder;
            inputField.targetGraphic = gameObject.GetComponent<Image>();
            return gameObject;
        }

        private static GameObject CreateToggle(string name)
        {
            var gameObject = CreateRectObject(name);
            var toggle = gameObject.AddComponent<Toggle>();

            GameObject backgroundObject = CreateImage("Background");
            backgroundObject.transform.SetParent(gameObject.transform, false);
            var backgroundRect = backgroundObject.GetComponent<RectTransform>();
            backgroundRect.anchorMin = new Vector2(0f, 0.5f);
            backgroundRect.anchorMax = new Vector2(0f, 0.5f);
            backgroundRect.pivot = new Vector2(0f, 0.5f);
            backgroundRect.sizeDelta = new Vector2(20f, 20f);

            GameObject checkmarkObject = CreateImage("Checkmark");
            checkmarkObject.transform.SetParent(backgroundObject.transform, false);
            Stretch(checkmarkObject.GetComponent<RectTransform>(), 3f, 3f, 3f, 3f);

            GameObject labelObject = CreateText("Label");
            labelObject.transform.SetParent(gameObject.transform, false);
            Stretch(labelObject.GetComponent<RectTransform>(), 28f, 0f, 0f, 0f);
            labelObject.GetComponent<TextMeshProUGUI>().alignment = TextAlignmentOptions.MidlineLeft;

            toggle.targetGraphic = backgroundObject.GetComponent<Image>();
            toggle.graphic = checkmarkObject.GetComponent<Image>();
            return gameObject;
        }

        private static GameObject CreateSlider(string name)
        {
            var gameObject = CreateRectObject(name);
            var slider = gameObject.AddComponent<Slider>();

            GameObject backgroundObject = CreateImage("Background");
            backgroundObject.transform.SetParent(gameObject.transform, false);
            Stretch(backgroundObject.GetComponent<RectTransform>(), 0f, 0f, 7f, 7f);

            GameObject fillAreaObject = CreateRectObject("Fill Area");
            fillAreaObject.transform.SetParent(gameObject.transform, false);
            Stretch(fillAreaObject.GetComponent<RectTransform>(), 5f, 15f, 5f, 5f);
            GameObject fillObject = CreateImage("Fill");
            fillObject.transform.SetParent(fillAreaObject.transform, false);
            Stretch(fillObject.GetComponent<RectTransform>(), 0f, 0f, 0f, 0f);

            GameObject handleAreaObject = CreateRectObject("Handle Slide Area");
            handleAreaObject.transform.SetParent(gameObject.transform, false);
            Stretch(handleAreaObject.GetComponent<RectTransform>(), 10f, 10f, 0f, 0f);
            GameObject handleObject = CreateImage("Handle");
            handleObject.transform.SetParent(handleAreaObject.transform, false);
            var handleRect = handleObject.GetComponent<RectTransform>();
            handleRect.sizeDelta = new Vector2(20f, 20f);

            slider.fillRect = fillObject.GetComponent<RectTransform>();
            slider.handleRect = handleRect;
            slider.targetGraphic = handleObject.GetComponent<Image>();
            return gameObject;
        }

        private static GameObject CreateEventArea(string name)
        {
            var gameObject = CreateImage(name);
            var image = gameObject.GetComponent<Image>();
            image.color = Color.clear;
            image.raycastTarget = true;
            return gameObject;
        }

        private static GameObject CreateScrollView(string name, bool verticalLayout, bool gridLayout)
        {
            var gameObject = CreateImage(name);
            var scrollRect = gameObject.AddComponent<ScrollRect>();

            GameObject viewportObject = CreateImage("Viewport");
            viewportObject.transform.SetParent(gameObject.transform, false);
            var viewport = viewportObject.GetComponent<RectTransform>();
            Stretch(viewport, 0f, 0f, 0f, 0f);
            viewportObject.AddComponent<RectMask2D>();

            GameObject contentObject = CreateRectObject("Content");
            contentObject.transform.SetParent(viewport, false);
            var content = contentObject.GetComponent<RectTransform>();
            content.anchorMin = new Vector2(0f, 1f);
            content.anchorMax = new Vector2(1f, 1f);
            content.pivot = new Vector2(0.5f, 1f);
            content.sizeDelta = new Vector2(0f, 300f);
            if (gridLayout)
                contentObject.AddComponent<GridLayoutGroup>();
            else if (verticalLayout)
                contentObject.AddComponent<VerticalLayoutGroup>();

            scrollRect.viewport = viewport;
            scrollRect.content = content;
            scrollRect.horizontal = false;
            scrollRect.vertical = true;
            return gameObject;
        }

        private static void ApplyAttributes(GameObject gameObject, UIReactNode node, string componentName)
        {
            ApplyRectTransform(gameObject, node);
            ApplyCommonState(gameObject, node);
            ApplyText(gameObject, node, componentName);
            ApplyImage(gameObject, node);
            ApplySelectable(gameObject, node);
            ApplyLayout(gameObject, node);
            ApplyScroll(gameObject, node);
        }

        private static void ApplyDefaultFont(GameObject gameObject, TMP_FontAsset defaultFont)
        {
            if (defaultFont == null)
                return;

            // 默认字体覆盖本次生成组件中的 TMP 文本；目标项目可在工具窗口改为其他字体。
            TMP_Text[] texts = gameObject.GetComponentsInChildren<TMP_Text>(true);
            for (int i = 0; i < texts.Length; i++)
                texts[i].font = defaultFont;
        }

        private static void ApplyRectTransform(GameObject gameObject, UIReactNode node)
        {
            RectTransform rect = gameObject.GetComponent<RectTransform>();
            if (rect == null)
                rect = gameObject.AddComponent<RectTransform>();

            if (UIReactValueParser.TryVector4(node.GetAttribute("data-anchors"), out Vector4 anchors))
            {
                rect.anchorMin = new Vector2(anchors.x, anchors.y);
                rect.anchorMax = new Vector2(anchors.z, anchors.w);
            }
            else
            {
                if (UIReactValueParser.TryVector2(node.GetAttribute("data-anchor-min"), out Vector2 anchorMin))
                    rect.anchorMin = anchorMin;
                if (UIReactValueParser.TryVector2(node.GetAttribute("data-anchor-max"), out Vector2 anchorMax))
                    rect.anchorMax = anchorMax;
            }

            if (UIReactValueParser.TryVector2(node.GetAttribute("data-pivot"), out Vector2 pivot))
                rect.pivot = pivot;
            if (UIReactValueParser.TryVector3(node.GetAttribute("data-pos"), out Vector3 position))
                rect.anchoredPosition3D = position;
            if (UIReactValueParser.TryVector2(node.GetAttribute("data-size"), out Vector2 size))
                rect.sizeDelta = size;
            if (UIReactValueParser.TryVector3(node.GetAttribute("data-rot"), out Vector3 rotation))
                rect.localEulerAngles = rotation;
            if (UIReactValueParser.TryVector3(node.GetAttribute("data-scale"), out Vector3 scale))
                rect.localScale = scale;
        }

        private static void ApplyCommonState(GameObject gameObject, UIReactNode node)
        {
            if (UIReactValueParser.TryBool(node.GetAttribute("data-visible"), out bool visible))
                gameObject.SetActive(visible);

            if (UIReactValueParser.TryFloat(node.GetAttribute("data-alpha"), out float alpha))
            {
                // Unity 的 Component 使用重载的 null 判断；不能用 ?? 掩盖已失效的组件代理，否则访问 alpha 会抛出 MissingComponentException。
                CanvasGroup canvasGroup = gameObject.GetComponent<CanvasGroup>();
                if (canvasGroup == null)
                    canvasGroup = gameObject.AddComponent<CanvasGroup>();
                canvasGroup.alpha = Mathf.Clamp01(alpha);
            }
        }

        private static void ApplyText(GameObject gameObject, UIReactNode node, string componentName)
        {
            string textValue = node.GetAttribute("data-text", node.Text);
            TMP_Text text = gameObject.GetComponent<TMP_Text>();
            if (text == null && componentName == "UIButton")
                text = gameObject.transform.Find("Text (TMP)")?.GetComponent<TMP_Text>();
            if (text == null && componentName == "UIToggle")
                text = gameObject.transform.Find("Label")?.GetComponent<TMP_Text>();

            if (text != null)
            {
                if (!string.IsNullOrEmpty(textValue))
                    text.text = textValue;
                else if (componentName == "UIButton" || componentName == "UIToggle")
                    // 图片按钮和复合控件未声明静态文本时，不保留内建模板的占位字样。
                    text.text = string.Empty;
                if (UIReactValueParser.TryColor(node.GetInheritedAttribute("data-color"), out Color color))
                    text.color = color;
                if (UIReactValueParser.TryFloat(node.GetInheritedAttribute("data-font-size"), out float fontSize))
                    text.fontSize = Mathf.Max(1f, fontSize);
                if (UIReactValueParser.TryBool(node.GetInheritedAttribute("data-enable-word-wrapping"), out bool wordWrapping))
                    text.enableWordWrapping = wordWrapping;
                if (Enum.TryParse(node.GetInheritedAttribute("data-font-style"), true, out FontStyles fontStyle))
                    text.fontStyle = fontStyle;
                if (UIReactValueParser.TryColor(node.GetInheritedAttribute("data-outline-color"), out Color outlineColor))
                    text.outlineColor = outlineColor;
                if (UIReactValueParser.TryFloat(node.GetInheritedAttribute("data-outline-width"), out float outlineWidth))
                    text.outlineWidth = Mathf.Clamp01(outlineWidth / 10f);
                text.alignment = ParseAlignment(
                    node.GetInheritedAttribute("data-text-align"),
                    node.GetInheritedAttribute("data-vertical-align"),
                    text.alignment);
            }

            TMP_InputField inputField = gameObject.GetComponent<TMP_InputField>();
            if (inputField != null && inputField.placeholder is TMP_Text placeholder)
                placeholder.text = node.GetAttribute("data-placeholder", placeholder.text);
        }

        private static void ApplyImage(GameObject gameObject, UIReactNode node)
        {
            Image image = gameObject.GetComponent<Image>();
            if (image == null)
                return;

            string spritePath = node.GetAttribute("data-sprite").Replace('\\', '/');
            if (!string.IsNullOrWhiteSpace(spritePath))
            {
                if (!spritePath.StartsWith("Assets/", StringComparison.Ordinal))
                    throw new InvalidDataException($"data-sprite 必须使用 Assets 下的项目相对路径：{spritePath}");

                Sprite sprite = AssetDatabase.LoadAssetAtPath<Sprite>(spritePath);
                if (sprite == null)
                    throw new InvalidDataException($"未找到 Sprite 或资源未按 Sprite 导入：{spritePath}");
                image.sprite = sprite;
            }

            if (UIReactValueParser.TryColor(node.GetAttribute("data-color"), out Color color))
                image.color = color;
            if (UIReactValueParser.TryBool(node.GetAttribute("data-preserve-aspect"), out bool preserveAspect))
                image.preserveAspect = preserveAspect;
            if (Enum.TryParse(node.GetAttribute("data-image-type"), true, out Image.Type imageType))
                image.type = imageType;
            if (Enum.TryParse(node.GetAttribute("data-fill-method"), true, out Image.FillMethod fillMethod))
                image.fillMethod = fillMethod;
            if (UIReactValueParser.TryInt(node.GetAttribute("data-fill-origin"), out int fillOrigin))
                image.fillOrigin = fillOrigin;
            if (UIReactValueParser.TryFloat(node.GetAttribute("data-fill-amount"), out float fillAmount))
                image.fillAmount = Mathf.Clamp01(fillAmount);
        }

        private static void ApplySelectable(GameObject gameObject, UIReactNode node)
        {
            Selectable selectable = gameObject.GetComponent<Selectable>();
            if (selectable != null && UIReactValueParser.TryBool(node.GetAttribute("data-interactable"), out bool interactable))
                selectable.interactable = interactable;

            Toggle toggle = gameObject.GetComponent<Toggle>();
            if (toggle != null && UIReactValueParser.TryBool(node.GetAttribute("data-is-on"), out bool isOn))
                toggle.isOn = isOn;

            Slider slider = gameObject.GetComponent<Slider>();
            if (slider != null)
            {
                if (UIReactValueParser.TryFloat(node.GetAttribute("data-min"), out float min))
                    slider.minValue = min;
                if (UIReactValueParser.TryFloat(node.GetAttribute("data-max"), out float max))
                    slider.maxValue = max;
                string valueText = node.GetAttribute("data-value", node.GetAttribute("data-default-value"));
                if (UIReactValueParser.TryFloat(valueText, out float value))
                    slider.value = value;
                if (Enum.TryParse(node.GetAttribute("data-direction"), true, out Slider.Direction direction))
                    slider.direction = direction;
            }
        }

        private static void ApplyLayout(GameObject gameObject, UIReactNode node)
        {
            string layoutType = node.GetAttribute("data-layout-group");
            ScrollRect scrollRect = gameObject.GetComponent<ScrollRect>();
            GameObject layoutTarget = scrollRect != null && scrollRect.content != null
                ? scrollRect.content.gameObject
                : gameObject;

            if (string.Equals(layoutType, "Grid", StringComparison.OrdinalIgnoreCase))
            {
                ApplyGridLayout(layoutTarget, node);
                return;
            }

            HorizontalOrVerticalLayoutGroup layout = null;
            if (string.Equals(layoutType, "Horizontal", StringComparison.OrdinalIgnoreCase))
                layout = layoutTarget.GetComponent<HorizontalLayoutGroup>() ?? layoutTarget.AddComponent<HorizontalLayoutGroup>();
            else if (string.Equals(layoutType, "Vertical", StringComparison.OrdinalIgnoreCase))
                layout = layoutTarget.GetComponent<VerticalLayoutGroup>() ?? layoutTarget.AddComponent<VerticalLayoutGroup>();

            if (layout == null)
                return;

            if (UIReactValueParser.TryFloat(node.GetAttribute("data-layout-spacing"), out float spacing))
                layout.spacing = spacing;
            if (UIReactValueParser.TryVector4(node.GetAttribute("data-layout-padding"), out Vector4 padding))
                layout.padding = new RectOffset(Mathf.RoundToInt(padding.x), Mathf.RoundToInt(padding.y), Mathf.RoundToInt(padding.z), Mathf.RoundToInt(padding.w));
            if (Enum.TryParse(node.GetAttribute("data-layout-child-alignment"), true, out TextAnchor alignment))
                layout.childAlignment = alignment;
            if (UIReactValueParser.TryBool(node.GetAttribute("data-layout-child-control-width"), out bool controlWidth))
                layout.childControlWidth = controlWidth;
            if (UIReactValueParser.TryBool(node.GetAttribute("data-layout-child-control-height"), out bool controlHeight))
                layout.childControlHeight = controlHeight;
            if (UIReactValueParser.TryBool(node.GetAttribute("data-layout-child-force-expand-width"), out bool expandWidth))
                layout.childForceExpandWidth = expandWidth;
            if (UIReactValueParser.TryBool(node.GetAttribute("data-layout-child-force-expand-height"), out bool expandHeight))
                layout.childForceExpandHeight = expandHeight;
        }

        private static void ApplyGridLayout(GameObject layoutTarget, UIReactNode node)
        {
            GridLayoutGroup grid = layoutTarget.GetComponent<GridLayoutGroup>() ?? layoutTarget.AddComponent<GridLayoutGroup>();

            if (UIReactValueParser.TryVector2(node.GetAttribute("data-layout-cell-size"), out Vector2 cellSize))
                grid.cellSize = cellSize;
            if (UIReactValueParser.TryVector2(node.GetAttribute("data-layout-spacing"), out Vector2 spacing))
                grid.spacing = spacing;
            else
            {
                if (UIReactValueParser.TryFloat(node.GetAttribute("data-column-space"), out float columnSpace))
                    grid.spacing = new Vector2(columnSpace, grid.spacing.y);
                if (UIReactValueParser.TryFloat(node.GetAttribute("data-row-space"), out float rowSpace))
                    grid.spacing = new Vector2(grid.spacing.x, rowSpace);
            }
            if (UIReactValueParser.TryVector4(node.GetAttribute("data-layout-padding"), out Vector4 padding))
                grid.padding = new RectOffset(Mathf.RoundToInt(padding.x), Mathf.RoundToInt(padding.y), Mathf.RoundToInt(padding.z), Mathf.RoundToInt(padding.w));
            if (Enum.TryParse(node.GetAttribute("data-layout-child-alignment"), true, out TextAnchor alignment))
                grid.childAlignment = alignment;
            if (Enum.TryParse(node.GetAttribute("data-layout-constraint"), true, out GridLayoutGroup.Constraint constraint))
                grid.constraint = constraint;
            if (UIReactValueParser.TryInt(node.GetAttribute("data-layout-constraint-count"), out int count))
                grid.constraintCount = Mathf.Max(1, count);
            if (Enum.TryParse(node.GetAttribute("data-layout-start-corner"), true, out GridLayoutGroup.Corner corner))
                grid.startCorner = corner;
            if (Enum.TryParse(node.GetAttribute("data-layout-start-axis"), true, out GridLayoutGroup.Axis axis))
                grid.startAxis = axis;
        }

        private static void ApplyScroll(GameObject gameObject, UIReactNode node)
        {
            ScrollRect scrollRect = gameObject.GetComponent<ScrollRect>();
            if (scrollRect == null)
                return;

            string direction = node.GetAttribute("data-scroll-direction");
            if (string.Equals(direction, "Horizontal", StringComparison.OrdinalIgnoreCase))
            {
                scrollRect.horizontal = true;
                scrollRect.vertical = false;
            }
            else if (string.Equals(direction, "Both", StringComparison.OrdinalIgnoreCase))
            {
                scrollRect.horizontal = true;
                scrollRect.vertical = true;
            }

            GridLayoutGroup grid = scrollRect.content != null ? scrollRect.content.GetComponent<GridLayoutGroup>() : null;
            if (grid != null)
            {
                if (UIReactValueParser.TryFloat(node.GetAttribute("data-row-space"), out float rowSpace))
                    grid.spacing = new Vector2(grid.spacing.x, rowSpace);
                if (UIReactValueParser.TryFloat(node.GetAttribute("data-column-space"), out float columnSpace))
                    grid.spacing = new Vector2(columnSpace, grid.spacing.y);
                if (UIReactValueParser.TryInt(node.GetAttribute("data-cell-count-per-row-or-column"), out int count))
                {
                    grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
                    grid.constraintCount = Mathf.Max(1, count);
                }
                if (Enum.TryParse(node.GetAttribute("data-start-corner"), true, out GridLayoutGroup.Corner corner))
                    grid.startCorner = corner;
            }
        }

        private static void AddBindingMarker(GameObject gameObject, UIReactNode node, string componentName)
        {
            string bindingKey = node.GetAttribute("data-bind");
            if (string.IsNullOrWhiteSpace(bindingKey))
                return;

            UIBindMarker marker = gameObject.GetComponent<UIBindMarker>() ?? gameObject.AddComponent<UIBindMarker>();
            marker.Key = bindingKey;
            marker.Comment = "由 UI React 工具根据 data-bind 自动生成。";

            Component target = ResolveBindingTarget(gameObject, componentName, out UIBindComponentType componentType);
            marker.ComponentType = componentType;
            marker.TargetComponent = target;
        }

        private static Component ResolveBindingTarget(GameObject gameObject, string componentName, out UIBindComponentType type)
        {
            Button button = gameObject.GetComponent<Button>();
            if (button != null) { type = UIBindComponentType.Button; return button; }
            Toggle toggle = gameObject.GetComponent<Toggle>();
            if (toggle != null) { type = UIBindComponentType.Toggle; return toggle; }
            Slider slider = gameObject.GetComponent<Slider>();
            if (slider != null) { type = UIBindComponentType.Slider; return slider; }
            ScrollRect scroll = gameObject.GetComponent<ScrollRect>();
            if (scroll != null) { type = UIBindComponentType.ScrollRect; return scroll; }
            TMP_InputField input = gameObject.GetComponent<TMP_InputField>();
            if (input != null) { type = UIBindComponentType.TMPInputField; return input; }
            TMP_Text text = gameObject.GetComponent<TMP_Text>();
            if (text != null) { type = UIBindComponentType.TMPText; return text; }
            Image image = gameObject.GetComponent<Image>();
            if (image != null) { type = UIBindComponentType.Image; return image; }

            type = UIBindComponentType.RectTransform;
            return gameObject.GetComponent<RectTransform>();
        }

        private static TextAlignmentOptions ParseAlignment(string horizontal, string vertical, TextAlignmentOptions fallback)
        {
            string horizontalValue = string.IsNullOrEmpty(horizontal) ? "Center" : horizontal;
            string verticalValue = string.IsNullOrEmpty(vertical) ? "Middle" : vertical;
            bool centered = string.Equals(horizontalValue, "Center", StringComparison.OrdinalIgnoreCase);
            string name;
            if (string.Equals(verticalValue, "Top", StringComparison.OrdinalIgnoreCase))
                name = centered ? "Top" : "Top" + horizontalValue;
            else if (string.Equals(verticalValue, "Bottom", StringComparison.OrdinalIgnoreCase))
                name = centered ? "Bottom" : "Bottom" + horizontalValue;
            else
                name = centered ? "Center" : "Midline" + horizontalValue;

            return Enum.TryParse(name, true, out TextAlignmentOptions parsed) ? parsed : fallback;
        }

        private static void Stretch(RectTransform rect, float left, float right, float top, float bottom)
        {
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.one;
            rect.offsetMin = new Vector2(left, bottom);
            rect.offsetMax = new Vector2(-right, -top);
        }
    }
}

