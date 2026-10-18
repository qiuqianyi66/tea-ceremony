package com.tea.telemetry;

import static org.assertj.core.api.Assertions.assertThat;

import com.tea.telemetry.service.FingerprintService;
import org.junit.jupiter.api.Test;

/**
 * 指纹算法（契约 §5）逐条规则 + 前后端一致性向量。
 * 每条归一化规则单独一例：规则顺序错、正则写错都会让同一 bug 分叉成多条指纹，
 * 而这类错误在业务侧只表现为「错误列表里条目变多了」，很难被发现，必须靠断言钉住。
 */
class FingerprintServiceTest {

    private final FingerprintService service = new FingerprintService();

    private static final String SOURCE = "/assets/index.js";

    @Test
    void messageTrimsWhitespace() {
        assertThat(service.normalizeMessage("  boom  ")).isEqualTo("boom");
    }

    @Test
    void messageReplacesUrl() {
        assertThat(service.normalizeMessage("fetch https://a.com/x?y=1 failed"))
                .isEqualTo("fetch <url> failed");
    }

    @Test
    void messageReplacesUuid() {
        assertThat(service.normalizeMessage("record 3f2504e0-4f89-11d3-9a0c-0305e82c3301 missing"))
                .isEqualTo("record <uuid> missing");
    }

    @Test
    void messageReplacesLongToken() {
        assertThat(service.normalizeMessage("bad key abcdefghijklmnopqrstuvwx"))
                .isEqualTo("bad key <token>");
    }

    @Test
    void messageReplacesQuotedLiteral() {
        assertThat(service.normalizeMessage("Cannot read property 'foo' of undefined"))
                .isEqualTo("Cannot read property <str> of undefined");
        assertThat(service.normalizeMessage("Cannot read property \"bar\" of undefined"))
                .isEqualTo("Cannot read property <str> of undefined");
    }

    @Test
    void messageReplacesStandaloneNumbers() {
        assertThat(service.normalizeMessage("failed after 3 retries at 2026"))
                .isEqualTo("failed after <n> retries at <n>");
    }

    @Test
    void messageTruncatesTo300Chars() {
        // 注意不能用一个 400 字符的连续字母串：那本身就是长 token，会先被替换成 <token>
        String longMessage = "ab ".repeat(130);
        assertThat(service.normalizeMessage(longMessage)).hasSize(300);
    }

    @Test
    void sourceKeepsOnlyPathname() {
        assertThat(service.pathname("/assets/index-bsowGVBP.js")).isEqualTo("/assets/index-bsowGVBP.js");
        assertThat(service.pathname("https://tea.example.com/assets/index.js?v=2#top"))
                .isEqualTo("/assets/index.js");
        assertThat(service.pathname(null)).isEmpty();
    }

    @Test
    void lineNumberIsBucketedByTen() {
        assertThat(service.lineBucket(1234)).isEqualTo(1230);
        assertThat(service.lineBucket(1239)).isEqualTo(1230);
        assertThat(service.lineBucket(1240)).isEqualTo(1240);
        assertThat(service.lineBucket(9)).isZero();
        assertThat(service.lineBucket(null)).isZero();
    }

    @Test
    void fingerprintIsHexOf16LowercaseChars() {
        String fingerprint = service.compute("error", SOURCE, "TypeError: boom", 12);
        assertThat(fingerprint).hasSize(16).matches("[0-9a-f]{16}");
        assertThat(service.isValidFingerprint(fingerprint)).isTrue();
        assertThat(service.isValidFingerprint("1A2B3C4D5E6F7A8B")).isFalse();
        assertThat(service.isValidFingerprint("too-short")).isFalse();
    }

    @Test
    void sameBugFromDifferentInstancesProducesSameFingerprint() {
        // 两个独立实例（模拟前后端各自实现）：同输入必须同码
        FingerprintService other = new FingerprintService();
        String first = service.compute("error", SOURCE, "TypeError: boom at 1", 500);
        String second = other.compute("error", SOURCE, "TypeError: boom at 2", 505);
        assertThat(first).isEqualTo(second);
    }

    @Test
    void differentKindSourceOrBucketProducesDifferentFingerprint() {
        String base = service.compute("error", SOURCE, "boom", 100);
        assertThat(service.compute("unhandledrejection", SOURCE, "boom", 100)).isNotEqualTo(base);
        assertThat(service.compute("error", "/assets/other.js", "boom", 100)).isNotEqualTo(base);
        assertThat(service.compute("error", SOURCE, "boom", 200)).isNotEqualTo(base);
        assertThat(service.compute("error", SOURCE, "other", 100)).isNotEqualTo(base);
    }

    /**
     * 前后端一致性向量（契约 §5 + 任务书硬断言）：
     * 行号 1234 / 1239 同属 1230 桶，message 归一化后都是
     * "TypeError: Cannot read properties of undefined (reading &lt;str&gt;)"，
     * 因此两条必须得到同一个 fingerprint。
     * 末尾的硬编码值 = 前端参考实现 src/services/telemetry/fingerprint.ts 对同一输入的输出，
     * 任一侧的 key 拼接或归一化顺序漂移都会让这条断言失败。
     */
    @Test
    void contractVectorProducesSingleFingerprint() {
        String first = service.compute("error", "/assets/index.js",
                "TypeError: Cannot read properties of undefined (reading 'foo')", 1234);
        String second = service.compute("error", "/assets/index.js",
                "TypeError: Cannot read properties of undefined (reading 'bar')", 1239);

        assertThat(first).isEqualTo(second);
        assertThat(first).isEqualTo("622b302a6b53fcee");
        assertThat(service.normalizeMessage("TypeError: Cannot read properties of undefined (reading 'foo')"))
                .isEqualTo("TypeError: Cannot read properties of undefined (reading <str>)");
        assertThat(service.lineBucket(1234)).isEqualTo(service.lineBucket(1239));
    }

    /** FNV-1a 64bit 标准向量（与前端 fingerprint.spec.ts 的断言同源）：证明字节级实现一致。 */
    @Test
    void fnv1aMatchesFrontendKnownVectors() {
        assertThat(FingerprintService.fnv1aHex("")).isEqualTo("cbf29ce484222325");
        assertThat(FingerprintService.fnv1aHex("a")).isEqualTo("af63dc4c8601ec8c");
        assertThat(FingerprintService.fnv1aHex("foobar")).isEqualTo("85944171f73967e8");
        // 中文按 UTF-8 字节参与运算，不同汉字不撞
        assertThat(FingerprintService.fnv1aHex("茶")).isNotEqualTo(FingerprintService.fnv1aHex("水"));
    }
}
