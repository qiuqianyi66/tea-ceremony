package com.tea.telemetry;

import static org.assertj.core.api.Assertions.assertThat;

import com.tea.telemetry.service.TelemetrySanitizer;
import org.junit.jupiter.api.Test;

/**
 * 脱敏规则（契约 §9）：URL query / 邮箱 / JWT / ≥24 位长 token / >6 位纯数字 ID。
 * 反向用例同样重要：正常中文茶名与业务数字（行号、价格）不能被吃掉，否则错误信息失去可读性。
 */
class TelemetrySanitizerTest {

    private final TelemetrySanitizer sanitizer = new TelemetrySanitizer();

    @Test
    void stripsUrlQueryAndFragment() {
        assertThat(sanitizer.sanitize("GET https://tea.example.com/share?d=secret#frag failed"))
                .isEqualTo("GET https://tea.example.com/share failed");
    }

    @Test
    void stripsRelativePathQuery() {
        assertThat(sanitizer.sanitize("failed at /brew?step=3&token=abc"))
                .isEqualTo("failed at /brew");
    }

    @Test
    void replacesEmail() {
        assertThat(sanitizer.sanitize("用户 yan.ha+tea@example.co 登录失败"))
                .isEqualTo("用户 <email> 登录失败");
    }

    @Test
    void replacesJwt() {
        String jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
        assertThat(sanitizer.sanitize("Authorization: " + jwt)).isEqualTo("Authorization: <jwt>");
    }

    @Test
    void replacesLongToken() {
        String token = "abcdefghijklmnopqrstuvwxyz012345";
        assertThat(sanitizer.sanitize("session " + token + " expired"))
                .isEqualTo("session <token> expired");
    }

    @Test
    void replacesNumericIdLongerThanSixDigits() {
        assertThat(sanitizer.sanitize("order 20261017001 not found"))
                .isEqualTo("order <id> not found");
    }

    @Test
    void keepsShortNumbersAndLineNumbers() {
        assertThat(sanitizer.sanitize("line 123 col 45 price 268"))
                .isEqualTo("line 123 col 45 price 268");
    }

    @Test
    void keepsChineseTeaNamesIntact() {
        String message = "冲泡西湖龙井 时水温过高，茶汤苦涩";
        assertThat(sanitizer.sanitize(message)).isEqualTo(message);
    }

    @Test
    void nullStaysNull() {
        assertThat(sanitizer.sanitize(null)).isNull();
        assertThat(sanitizer.sanitize(null, 10)).isNull();
    }

    @Test
    void truncatesToColumnWidthAfterSanitizing() {
        String longText = "茶".repeat(30);
        assertThat(sanitizer.sanitize(longText, 10)).hasSize(10);
    }

    @Test
    void truncationNeverSplitsSurrogatePair() {
        String emoji = "🍵🍵🍵";
        // 🍵 占 2 个 char；上限 3 会落在第二个 emoji 中间，必须退到 2 以免产出非法 UTF-8
        assertThat(sanitizer.sanitize(emoji, 3)).isEqualTo("🍵");
    }

    @Test
    void combinedMessageSanitizesAllCategories() {
        String raw = "user a@b.co failed at https://x.io/p?k=v 1700000000000 "
                + "abcdefghijklmnopqrstuvwxyz12";
        assertThat(sanitizer.sanitize(raw))
                .isEqualTo("user <email> failed at https://x.io/p <id> <token>");
    }
}
