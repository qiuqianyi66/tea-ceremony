package com.tea.telemetry.dto;

/**
 * vital 事件 payload（契约 §3.2）。
 * rating 保存 web-vitals 原值，不重算不纠正：服务端只做统计，评级口径以浏览器侧为准。
 */
public record VitalPayload(
        String name,
        Double value,
        String rating,
        String navigationType) {
}
