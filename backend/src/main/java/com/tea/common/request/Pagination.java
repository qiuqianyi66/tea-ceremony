package com.tea.common.request;

import com.tea.common.exception.BadRequestException;

/**
 * 分页参数边界校验（编码规范：page 1-based、size ≤ 100）。
 * TastingRecordService / TeaService 原各自粘贴同一份校验，收敛为单一来源。
 */
public final class Pagination {

    public static final int MAX_SIZE = 100;

    private Pagination() {
    }

    /** page ≥ 1 且 1 ≤ size ≤ 100，否则抛 BadRequestException（消息与原两处逐字一致）。 */
    public static void requireValid(int page, int size) {
        if (page < 1) {
            throw new BadRequestException("page 必须 ≥ 1");
        }
        if (size < 1 || size > MAX_SIZE) {
            throw new BadRequestException("size 必须在 1-100 之间");
        }
    }
}
