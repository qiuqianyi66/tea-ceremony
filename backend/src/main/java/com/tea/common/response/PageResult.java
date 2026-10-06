package com.tea.common.response;

import java.util.List;

/**
 * 分页响应契约（编码规范：page 1-based、size ≤ 100）。
 * data 结构：{items, total, page, size}——见 PLAN.md T7 方案 F7-1。
 */
public record PageResult<T>(List<T> items, long total, int page, int size) {

    public static <T> PageResult<T> of(List<T> items, long total, int page, int size) {
        return new PageResult<>(items, total, page, size);
    }
}
