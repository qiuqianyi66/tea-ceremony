package com.tea.telemetry.dto;

/**
 * error 事件 payload（契约 §3.1）。
 * 长度上限（message 500 / source 256 / stack 4000）由 Service 校验，超出计入 rejected（契约 §4）。
 */
public record ErrorPayload(
        String kind,
        String message,
        String source,
        Integer lineno,
        Integer colno,
        String stack,
        String fingerprint) {
}
