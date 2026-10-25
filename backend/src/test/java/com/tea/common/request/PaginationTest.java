package com.tea.common.request;

import com.tea.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Pagination 边界校验单测（原 TastingRecord/Tea 两处内联校验的等价迁移）。
 */
class PaginationTest {

    @Test
    void validBoundsPass() {
        assertThatCode(() -> Pagination.requireValid(1, 1)).doesNotThrowAnyException();
        assertThatCode(() -> Pagination.requireValid(999, 100)).doesNotThrowAnyException();
    }

    @Test
    void pageBelowOneRejected() {
        assertThatThrownBy(() -> Pagination.requireValid(0, 20))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("page 必须 ≥ 1");
    }

    @Test
    void sizeBelowOneRejected() {
        assertThatThrownBy(() -> Pagination.requireValid(1, 0))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("size 必须在 1-100 之间");
    }

    @Test
    void sizeAboveHundredRejected() {
        assertThatThrownBy(() -> Pagination.requireValid(1, 101))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("size 必须在 1-100 之间");
    }
}
