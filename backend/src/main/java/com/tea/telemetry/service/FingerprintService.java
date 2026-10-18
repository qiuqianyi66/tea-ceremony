package com.tea.telemetry.service;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * 错误指纹（契约 §5，前后端必须逐字一致）。
 * 目标是把同一 bug 的不同实例归并成一条：URL 里的 id、引号里的变量名、数字参数都不该让指纹分叉。
 *
 * 为什么是 FNV-1a 而不是 SHA-256：契约 §5 写明站点跑在 HTTP 上，浏览器拿不到 crypto.subtle，
 * 前端只能用纯 JS 的 FNV-1a；后端必须算同一个值，所以也只能用 FNV-1a。
 * 实现要点与 JS 版对齐：按 UTF-8 字节逐个异或再乘 64 位质数，Java long 的溢出回绕等价于
 * JS 的 BigInt & 0xFFFFFFFFFFFFFFFF 掩码，故两边结果相同。
 */
@Component
public class FingerprintService {

    /** 前端一旦上报合法指纹就直接采用：两端算法若漂移，以前端实测值为准，避免同一 bug 出现两条指纹。 */
    private static final Pattern VALID_FINGERPRINT = Pattern.compile("^[0-9a-f]{16}$");

    private static final Pattern URL = Pattern.compile("https?://[^\\s)]+");
    private static final Pattern UUID =
            Pattern.compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
                    Pattern.CASE_INSENSITIVE);
    private static final Pattern TOKEN = Pattern.compile("[A-Za-z0-9_-]{24,}");
    private static final Pattern QUOTED = Pattern.compile("'[^']*'|\"[^\"]*\"");
    private static final Pattern NUMBER = Pattern.compile("\\b\\d+\\b");

    /** 契约 §5 归一化后截断 300 字符。 */
    public static final int MAX_NORMALIZED_MESSAGE = 300;

    /** 行号漂移 10 行内视为同一处（压缩产物换版后行号会平移）。 */
    public static final int LINE_BUCKET_SIZE = 10;

    private static final long FNV_OFFSET_BASIS = 0xcbf29ce484222325L;
    private static final long FNV_PRIME = 0x100000001b3L;

    public boolean isValidFingerprint(String candidate) {
        return candidate != null && VALID_FINGERPRINT.matcher(candidate).matches();
    }

    /** 契约 §5 第 4-5 步：key = kind|source|bucket|normalizedMessage，再 FNV-1a 64bit 转 16 位小写 hex。 */
    public String compute(String kind, String source, String message, Integer lineno) {
        String key = normalizeKind(kind) + "|" + pathname(source) + "|" + lineBucket(lineno)
                + "|" + normalizeMessage(message);
        return fnv1aHex(key);
    }

    /** 契约 §5 第 1 步：逐条替换再截断 300 字符。 */
    public String normalizeMessage(String message) {
        if (message == null) {
            return "";
        }
        String text = message.trim();
        text = URL.matcher(text).replaceAll("<url>");
        text = UUID.matcher(text).replaceAll("<uuid>");
        text = TOKEN.matcher(text).replaceAll("<token>");
        text = QUOTED.matcher(text).replaceAll("<str>");
        text = NUMBER.matcher(text).replaceAll("<n>");
        return TelemetrySanitizer.truncate(text, MAX_NORMALIZED_MESSAGE);
    }

    /** 契约 §5 第 2 步：source 取 pathname，去掉 hash 与 query。 */
    public String pathname(String source) {
        if (source == null || source.isBlank()) {
            return "";
        }
        String text = source.trim();
        int cut = text.length();
        int query = text.indexOf('?');
        if (query >= 0) {
            cut = query;
        }
        int hash = text.indexOf('#');
        if (hash >= 0 && hash < cut) {
            cut = hash;
        }
        text = text.substring(0, cut);
        if (text.startsWith("http://") || text.startsWith("https://")) {
            try {
                String path = URI.create(text).getPath();
                // 与前端 toPathname 逐字对齐（src/services/telemetry/fingerprint.ts）：无路径时取 "/"
                return path == null || path.isEmpty() ? "/" : path;
            } catch (IllegalArgumentException ex) {
                // 非法 URL（含空格/中文未编码）：已经去掉 query/hash，原样返回比抛异常更稳
                return text;
            }
        }
        return text;
    }

    /** 契约 §5 第 3 步：bucket = floor(lineno / 10) * 10；行号缺失归 0 桶。 */
    public int lineBucket(Integer lineno) {
        if (lineno == null || lineno < 0) {
            return 0;
        }
        return (lineno / LINE_BUCKET_SIZE) * LINE_BUCKET_SIZE;
    }

    private String normalizeKind(String kind) {
        return kind == null || kind.isBlank() ? "error" : kind.trim();
    }

    /** FNV-1a 64bit → 16 位小写 hex（无条件补零，保证长度固定，避免前端 parseInt 差异）。 */
    public static String fnv1aHex(String key) {
        long hash = FNV_OFFSET_BASIS;
        for (byte b : key.getBytes(StandardCharsets.UTF_8)) {
            hash ^= (b & 0xffL);
            hash *= FNV_PRIME;
        }
        return String.format("%016x", hash);
    }
}
