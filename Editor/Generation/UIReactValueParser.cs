using System;
using System.Globalization;
using UnityEngine;

namespace UIReactTool.Generation
{
    /// <summary>
    /// 解析 TSX data 属性中的 Unity 数值格式。
    /// </summary>
    internal static class UIReactValueParser
    {
        public static bool TryVector2(string value, out Vector2 result)
        {
            if (TryFloats(value, 2, out float[] values))
            {
                result = new Vector2(values[0], values[1]);
                return true;
            }

            result = default;
            return false;
        }

        public static bool TryVector3(string value, out Vector3 result)
        {
            if (TryFloats(value, 3, out float[] values))
            {
                result = new Vector3(values[0], values[1], values[2]);
                return true;
            }

            result = default;
            return false;
        }

        public static bool TryVector4(string value, out Vector4 result)
        {
            if (TryFloats(value, 4, out float[] values))
            {
                result = new Vector4(values[0], values[1], values[2], values[3]);
                return true;
            }

            result = default;
            return false;
        }

        public static bool TryColor(string value, out Color result)
        {
            if (TryVector4(value, out Vector4 rgba))
            {
                result = new Color(rgba.x, rgba.y, rgba.z, rgba.w);
                return true;
            }

            if (ColorUtility.TryParseHtmlString(value, out result))
                return true;

            result = default;
            return false;
        }

        public static bool TryFloat(string value, out float result)
        {
            return float.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out result);
        }

        public static bool TryInt(string value, out int result)
        {
            return int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out result);
        }

        public static bool TryBool(string value, out bool result)
        {
            return bool.TryParse(value, out result);
        }

        private static bool TryFloats(string value, int expectedCount, out float[] result)
        {
            result = null;
            if (string.IsNullOrWhiteSpace(value))
                return false;

            string trimmed = value.Trim().TrimStart('(').TrimEnd(')');
            string[] parts = trimmed.Split(',');
            if (parts.Length != expectedCount)
                return false;

            var values = new float[expectedCount];
            for (int i = 0; i < expectedCount; i++)
            {
                if (!float.TryParse(parts[i].Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out values[i]))
                    return false;
            }

            result = values;
            return true;
        }
    }
}

