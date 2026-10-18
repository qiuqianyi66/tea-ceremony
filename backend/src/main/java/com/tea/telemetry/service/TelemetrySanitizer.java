package com.tea.telemetry.service;

import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * 遥测脱敏（契约 §9：入库前必过）。
 * 纯函数、无状态、无依赖：脱敏是最容易写错又最难发现的一层，必须能直接用断言验证，
 * 不能靠起 Spring 上下文才跑得起来。
 *
 * 处理顺序有讲究：先剥 URL query（否则 query 里的邮箱/token 会被后续规则拆成多处残留），
 * 再按 JWT → 邮箱 → 纯数字 ID → 长 token 从「特征最强」到「最宽松」收敛。
 * 长 token 放最后，否则它会把 JWT 和邮箱的片段先吃掉，留下难以解释的残渣。
 */
@Component
public class TelemetrySanitizer {

    /** 绝对 URL 的 query 与 fragment 一并剥离，保留 scheme://host/path。 */
    private static final Pattern URL_QUERY =
            Pattern.compile("(https?://[^\\s?#\"'<>]+)[?#][^\\s\"'<>]*", Pattern.CASE_INSENSITIVE);

    /** 相对路径的 query（如 /share?d=xxx）：契约要求上报只留 pathname。 */
    private static final Pattern PATH_QUERY =
            Pattern.compile("((?:^|\\s)/[A-Za-z0-9_\\-./]*)[?][^\\s\"'<>]*");

    private static final Pattern EMAIL =
            Pattern.compile("[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}");

    /** JWT 形态：三段 base64url，首段固定 eyJ（{" 的 base64）。 */
    private static final Pattern JWT =
            Pattern.compile("\\beyJ[A-Za-z0-9_\\-]*\\.[A-Za-z0-9_\\-]+(?:\\.[A-Za-z0-9_\\-]*)?");

    /** 纯数字 ID：>6 位（订单号/时间戳/自增主键），6 位以内可能是正常业务数字（价格、行号）。 */
    private static final Pattern NUMERIC_ID = Pattern.compile("\\b\\d{7,}\\b");

    /** 连续 24 位以上的 token/哈希（session id、API key、build hash）。 */
    private static final Pattern LONG_TOKEN = Pattern.compile("[A-Za-z0-9_\\-]{24,}");

    public static final String EMAIL_PLACEHOLDER = "<email>";
    public static final String JWT_PLACEHOLDER = "<jwt>";
    public static final String ID_PLACEHOLDER = "<id>";
    public static final String TOKEN_PLACEHOLDER = "<token>";

    /** 不截断的脱敏（用于 route 这类已有长度校验的字段）。 */
    public String sanitize(String raw) {
        return sanitize(raw, Integer.MAX_VALUE);
    }

    /**
     * 脱敏 + 按列宽截断。
     * 截断放在脱敏之后：脱敏可能让文本变长（a@b.cn → &lt;email&gt;），先截断会把占位符切一半。
     */
    public String sanitize(String raw, int maxLength) {
        if (raw == null) {
            return null;
        }
        String text = URL_QUERY.matcher(raw).replaceAll("$1");
        text = PATH_QUERY.matcher(text).replaceAll("$1");
        text = EMAIL.matcher(text).replaceAll(EMAIL_PLACEHOLDER);
        text = JWT.matcher(text).replaceAll(JWT_PLACEHOLDER);
        text = NUMERIC_ID.matcher(text).replaceAll(ID_PLACEHOLDER);
        text = LONG_TOKEN.matcher(text).replaceAll(TOKEN_PLACEHOLDER);
        return truncate(text, maxLength);
    }

    /** 中文与 emoji 都可能占两个 char，截断点落在代理对中间会产出非法 UTF-8（入库直接报错）。 */
    public static String truncate(String text, int maxLength) {
        if (text == null || maxLength <= 0 || text.length() <= maxLength) {
            return text;
        }
        int end = maxLength;
        if (Character.isHighSurrogate(text.charAt(end - 1))) {
            end--;
        }
        return text.substring(0, end);
    }
}
